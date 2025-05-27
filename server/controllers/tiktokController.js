const BaseController = require('./baseController');
const tiktokAuthService = require('../services/tiktokAuthService');
const axios = require('axios');
const stream = require('stream');
const { URLSearchParams } = require('url');

const TIKTOK_CLIENT_ID = process.env.TIKTOK_CLIENT_ID;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_BACKEND_REDIRECT_URI;

const TIKTOK_API = {
  AUTH: (params) => `https://www.tiktok.com/v2/auth/authorize/?${params}`,
  VIDEO_INIT: 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
};

class TikTokController extends BaseController {
  constructor() {
    super(tiktokAuthService);
  }

  initiateAuth = async (req, res) => {
    if (!TIKTOK_CLIENT_ID || !TIKTOK_REDIRECT_URI) {
      return res.status(500).json({ error: 'TikTok Client ID or Redirect URI not configured on backend.' });
    }
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const scopes = [
      "user.info.basic",
      "video.upload",
    ];

    const csrfState = this.createStateParameter(userId);
    console.log(`Initiating TikTok Auth for user ${userId} with state: ${csrfState}`);

    const params = new URLSearchParams({
      client_key: TIKTOK_CLIENT_ID,
      scope: scopes.join(','),
      response_type: 'code',
      redirect_uri: TIKTOK_REDIRECT_URI,
      state: csrfState,
    });
    const authUrl = TIKTOK_API.AUTH(params);

    console.log("Generated TikTok Auth URL:", authUrl);
    res.status(200).json({ authUrl });
  };

  authCallback = async (req, res) => {
    const { code, state, error, error_description } = req.query;
    let userId;

    if (state) {
      const result = this.extractUserIdFromState(state);
      if (result.error) {
        console.error(`TikTok OAuth Error: ${result.error}`);
        return this.sendPopupResponse(res, 'TT_AUTH_ERROR', { error: result.error });
      }
      userId = result.userId;
      console.log(`TikTok Callback: Extracted userId ${userId} from state`);
    } else {
      console.error('TikTok OAuth Error: State parameter missing.');
      return this.sendPopupResponse(res, 'TT_AUTH_ERROR', { error: 'State parameter missing' });
    }

    if (error) {
      console.error('TikTok OAuth Error:', error, error_description);
      return this.sendPopupResponse(res, 'TT_AUTH_ERROR', { error: error_description || error });
    }
    if (!code) {
      console.error('Authorization code missing from TikTok callback.');
      return this.sendPopupResponse(res, 'TT_AUTH_ERROR', { error: 'Authorization code missing' });
    }

    try {
      await this.service.exchangeCode(userId, code);
      console.log(`Successfully obtained and stored TikTok tokens for user ${userId}.`);
      this.sendPopupResponse(res, 'TT_AUTH_SUCCESS', { platform: 'TikTok' });

    } catch (err) {
      console.error(`Error handling TikTok callback for user ${userId}:`, err.message);
      this.sendPopupResponse(res, 'TT_AUTH_ERROR', { error: err.message || 'Token exchange failed' });
    }
  };

  logout = async (req, res) => {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }
    try {
      await this.service.clearTokens(userId);
      console.log(`Successfully cleared TikTok tokens from database for user ${userId}.`);
      res.status(200).json({ success: true, message: 'Successfully logged out from TikTok.' });
    } catch (err) {
      this.handleError(err, res, userId, 'TikTok logout');
    }
  };

  getUserInfo = async (req, res) => {
    const userId = req.user.userId;
    try {
      const userInfo = await this.service.getUserInfo(userId);
      res.status(200).json(userInfo);
    } catch (error) {
      if (error.message?.includes('re-authenticate') || 
          error.message?.includes('token') || 
          error.message?.includes('PERMISSION_DENIED')) {
        await this.service.clearTokens(userId);
        res.status(401).json({ error: `Authentication error: ${error.message}. Please reconnect TikTok.` });
      } else {
        this.handleError(error, res, userId, 'fetching TikTok user info');
      }
    }
  };

  uploadVideo = async (req, res) => {
    const userId = req.user.userId;
    try {
      const accessToken = await this.service.ensureValidToken(userId);

      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded.' });
      }
      if (!req.file.buffer) {
        console.error("Upload Error: req.file.buffer is missing. Ensure multer uses memoryStorage for this route.");
        return res.status(500).json({ error: 'Internal server error: Upload buffer unavailable.' });
      }

      const initEndpoint = TIKTOK_API.VIDEO_INIT;
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
            await this.service.clearTokens(userId); 
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
  };
}

// Create controller instance
const tiktokController = new TikTokController();

// Export controller methods with authentication middleware
module.exports = {
  getStatus: tiktokController.protected(tiktokController.getStatus),
  getUserInfo: tiktokController.protected(tiktokController.getUserInfo),
  uploadVideo: tiktokController.protected(tiktokController.uploadVideo),
  initiateAuth: tiktokController.protected(tiktokController.initiateAuth),
  authCallback: tiktokController.authCallback,
  logout: tiktokController.protected(tiktokController.logout)
};
