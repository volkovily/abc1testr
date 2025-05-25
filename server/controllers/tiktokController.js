const tiktokAuthService = require('../services/tiktokAuthService');
const axios = require('axios');
const stream = require('stream');
const { authenticateToken } = require('../lib/jwt');

exports.getStatus = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const status = await tiktokAuthService.checkTokenStatus(userId);
    res.json(status);
  } catch (error) {
    console.error(`Error checking TikTok status for user ${userId}:`, error.message);
    res.status(500).json({ isAuthenticated: false, error: 'Failed to check status' });
  }
}];

exports.getUserInfo = [authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const accessToken = await tiktokAuthService.ensureValidToken(userId);
        const userInfoEndpoint = process.env.VITE_TIKTOK_USERINFO_ENDPOINT || 'https://open.tiktokapis.com/v2/user/info/';

        const response = await axios.get(userInfoEndpoint, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                fields: 'open_id,display_name,avatar_url'
            }
        });

        const tikTokError = response.data.error;
        if (tikTokError && tikTokError.code !== 'ok') { 
            console.error("TikTok User Info API Error:", tikTokError);
            throw new Error(tikTokError.message || 'Failed to fetch user info from TikTok');
        }
        
        if (!response.data.data?.user) {
            console.error('User data missing in TikTok response, even though code was ok.');
            throw new Error('User data not found in TikTok response.');
        }

        res.status(200).json(response.data);

    } catch (error) {
        console.error(`Error fetching TikTok user info for user ${userId}:`, error.message);
        if (error.message?.includes('re-authenticate') || error.message?.includes('token') || error.message?.includes('PERMISSION_DENIED')) {
             await tiktokAuthService.clearTokens(userId);
             res.status(401).json({ error: `Authentication error: ${error.message}. Please reconnect TikTok.` });
        } else {
             res.status(500).json({ error: error.message || 'An unknown error occurred while fetching TikTok user info.' });
        }
    }
}];

exports.uploadVideo = [authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const accessToken = await tiktokAuthService.ensureValidToken(userId);

        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded.' });
        }
        if (!req.file.buffer) {
             console.error("Upload Error: req.file.buffer is missing. Ensure multer uses memoryStorage for this route.");
             return res.status(500).json({ error: 'Internal server error: Upload buffer unavailable.' });
        }

        const initEndpoint = process.env.VITE_TIKTOK_VIDEO_INIT_ENDPOINT || 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
        console.log(`Initializing TikTok inbox upload for user ${userId}: ${req.file.originalname}, Size: ${req.file.size} bytes`);

        const initResponse = await axios.post(
            initEndpoint,
            {
                source_info: {
                    source: "FILE_UPLOAD",
                    video_size: req.file.size,
                    chunk_size: req.file.size,
                    total_chunk_count: 1
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }
        );

        const initError = initResponse.data.error;
        if (initError && initError.code !== 'ok') {
            console.error("TikTok Init API Error Details:", initError);
            throw new Error(`Failed to initialize TikTok upload: ${initError.message || 'Unknown init error'} (Code: ${initError.code})`);
        }

        if (!initResponse.data.data?.publish_id || !initResponse.data.data?.upload_url) {
            console.error("Missing publish_id or upload_url in TikTok init response data.data:", initResponse.data);
            throw new Error("Incomplete initialization response from TikTok (publish_id or upload_url missing in data object)");
        }

        const { publish_id, upload_url } = initResponse.data.data;
        console.log(`TikTok upload initialized. Publish ID: ${publish_id}.`);

        console.log(`Uploading buffer for user ${userId} to: ${upload_url.substring(0, 100)}...`);
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);

        const uploadResponse = await axios.put(
            upload_url,
            bufferStream,
            {
                headers: {
                    'Content-Type': req.file.mimetype,
                    'Content-Range': `bytes 0-${req.file.size - 1}/${req.file.size}`
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 300000
            }
        );

        if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
            console.error(`TikTok PUT upload failed with status: ${uploadResponse.status}`);
            console.error("TikTok PUT Upload Response Data:", uploadResponse.data);
            throw new Error(`Video file upload to TikTok storage failed with status ${uploadResponse.status}`);
        }

        console.log(`Video buffer successfully uploaded to TikTok storage for user ${userId}.`);
        res.status(200).json({
            message: 'Successfully initiated video upload to TikTok Inbox!',
            upload_id: publish_id,
            details: "Video is processing in TikTok inbox. Check the TikTok app."
        });

    } catch (error) {
        console.error(`Error during TikTok inbox upload process for user ${userId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);

        let statusCode = 500;
        let errorMessage = 'An unknown error occurred during TikTok upload.';

        if (axios.isAxiosError(error)) {
            statusCode = error.response?.status || 500;
            const tiktokError = error.response?.data?.error;
            const uploadErrorData = error.response?.data;

            errorMessage = tiktokError?.message ||
                           (typeof uploadErrorData === 'string' ? uploadErrorData.substring(0,200) : null) ||
                           error.message;

            if ((statusCode === 401 || statusCode === 403 || tiktokError?.code === 'permission_denied' || tiktokError?.code === 2003) && error.config.url.includes('video/init')) { 
                 try { 
                     await tiktokAuthService.clearTokens(userId); 
                 } catch (clearErr) { console.error("Failed to clear tokens:", clearErr); }
                 errorMessage = `TikTok Auth/Permission Error during init (${tiktokError?.code}): ${errorMessage}. Please reconnect.`;
                 statusCode = statusCode === 403 ? 403 : 401;
            } else {
                 errorMessage = `TikTok API Error (${tiktokError?.code || statusCode}): ${errorMessage}`;
            }

        } else if (error.message?.includes('re-authenticate')) {
             statusCode = 401;
             errorMessage = `Authentication error: ${error.message}. Please reconnect TikTok.`;
        } else {
             errorMessage = error.message || errorMessage;
        }

        return res.status(statusCode).json({ error: errorMessage });
    }
}];