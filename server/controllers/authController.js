const axios = require('axios');
const { URLSearchParams } = require('url');
const googleAuthService = require('../services/googleAuthService');
const tiktokAuthService = require('../services/tiktokAuthService');
const facebookAuthService = require('../services/facebookAuthService');
const twitterAuthService = require('../services/twitterAuthService');
const { authenticateToken } = require('../lib/jwt');

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.BACKEND_REDIRECT_URI;

const tiktokClientId = process.env.TIKTOK_CLIENT_ID;
const tiktokRedirectUri = process.env.TIKTOK_BACKEND_REDIRECT_URI;

const frontendOrigin = process.env.FRONTEND_URL;

const sendPopupResponse = (res, messageType, data) => {
    const scriptContent = `
        if(window.opener) {
            window.opener.postMessage(${JSON.stringify({ type: messageType, ...data })}, '${frontendOrigin}');
        } else { console.error("window.opener not found!"); }
        window.close();
    `;
    const htmlBody = messageType.endsWith('_SUCCESS')
        ? `<h1>Authentication Success</h1><p>Closing...</p>`
        : `<h1>Authentication Error</h1><p>${data.error || 'Unknown error'}. Closing...</p>`;
    res.status(messageType.endsWith('_SUCCESS') ? 200 : 400).send(
        `<!DOCTYPE html><html><head><title>Auth</title></head><body><script>${scriptContent}</script>${htmlBody}</body></html>`
    );
};

exports.googleCallback = async (req, res) => {
    const { code, error, state } = req.query;
    let userId;

    if (state) {
        try {
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
            if (stateData.userId) {
                userId = stateData.userId;
                console.log(`Google Callback: Extracted userId ${userId} from state`);
            } else {
                throw new Error('userId missing in state');
            }
        } catch (stateError) {
            console.error('Google OAuth Error: Invalid or missing state parameter.', stateError);
            return sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Invalid state parameter' });
        }
    } else {
        console.error('Google OAuth Error: State parameter missing.');
        return sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'State parameter missing' });
    }

    if (error) {
        console.error('Google OAuth Error:', error);
        return sendPopupResponse(res, 'YT_AUTH_ERROR', { error });
    }

    if (!code) {
        console.error('Authorization code missing from Google callback.');
        return sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Authorization code missing' });
    }

    if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
        console.error('Google credentials or redirect URI not configured on backend.');
        return sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Backend configuration error' });
    }

    try {
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
            code: code,
            client_id: googleClientId,
            client_secret: googleClientSecret,
            redirect_uri: googleRedirectUri,
            grant_type: 'authorization_code'
        }));

        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        if (!access_token) {
             throw new Error("Access token missing in Google's response.");
        }

        await googleAuthService.storeTokens(userId, {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiryTime: Date.now() + expires_in * 1000
        });

        console.log(`Successfully obtained and stored YouTube tokens for user ${userId}.`);
        sendPopupResponse(res, 'YT_AUTH_SUCCESS', { platform: 'YouTube' });

    } catch (err) {
        console.error(`Error exchanging Google code for tokens for user ${userId}:`, err.response ? err.response.data : err.message);
        sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Token exchange failed' });
    }
};

exports.initiateGoogleAuth = [authenticateToken, (req, res) => {
    if (!googleClientId || !googleRedirectUri) {
        return res.status(500).json({ error: 'Google credentials or redirect URI not configured on backend.' });
    }
    const userId = req.user.userId;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    const stateData = JSON.stringify({ userId: userId, nonce: Math.random().toString(36).substring(7) });
    const state = Buffer.from(stateData).toString('base64');
    console.log(`Initiating Google Auth for user ${userId} with state: ${state}`);

    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.readonly'
    ];
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: googleRedirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: state
    })}`;
    res.status(200).json({ authUrl });
}];

exports.initiateTikTokAuth = [authenticateToken, (req, res) => {
    if (!tiktokClientId || !tiktokRedirectUri) {
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

    const stateData = JSON.stringify({ userId: userId, nonce: Math.random().toString(36).substring(7) });
    const csrfState = Buffer.from(stateData).toString('base64');
    console.log(`Initiating TikTok Auth for user ${userId} with state: ${csrfState}`);

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
        client_key: tiktokClientId,
        scope: scopes.join(','),
        response_type: 'code',
        redirect_uri: tiktokRedirectUri,
        state: csrfState,
    })}`;

    console.log("Generated TikTok Auth URL:", authUrl);
    res.status(200).json({ authUrl });
}];

exports.tikTokCallback = async (req, res) => {
    const { code, state, error, error_description } = req.query;
    let userId;

    if (state) {
        try {
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
            if (stateData.userId) {
                userId = stateData.userId;
                console.log(`TikTok Callback: Extracted userId ${userId} from state`);
            } else {
                throw new Error('userId missing in state');
            }
        } catch (stateError) {
            console.error('TikTok OAuth Error: Invalid or missing state parameter.', stateError);
            return sendPopupResponse(res, 'TT_AUTH_ERROR', { error: 'Invalid state parameter' });
        }
    } else {
        console.error('TikTok OAuth Error: State parameter missing.');
        return sendPopupResponse(res, 'TT_AUTH_ERROR', { error: 'State parameter missing' });
    }

    if (error) {
        console.error('TikTok OAuth Error:', error, error_description);
        return sendPopupResponse(res, 'TT_AUTH_ERROR', { error: error_description || error });
    }
    if (!code) {
        console.error('Authorization code missing from TikTok callback.');
        return sendPopupResponse(res, 'TT_AUTH_ERROR', { error: 'Authorization code missing' });
    }

    try {
        await tiktokAuthService.exchangeCode(userId, code);
        console.log(`Successfully obtained and stored TikTok tokens for user ${userId}.`);
        sendPopupResponse(res, 'TT_AUTH_SUCCESS', { platform: 'TikTok' });

    } catch (err) {
        console.error(`Error handling TikTok callback for user ${userId}:`, err.message);
        sendPopupResponse(res, 'TT_AUTH_ERROR', { error: err.message || 'Token exchange failed' });
    }
};

exports.googleLogout = [authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
    try {
        await googleAuthService.clearTokens(userId);
        console.log(`Successfully cleared YouTube tokens from database for user ${userId}.`);
        res.status(200).json({ success: true, message: 'Successfully logged out from YouTube.' });
    } catch (err) {
        console.error(`Error during YouTube logout for user ${userId}:`, err.message);
        res.status(500).json({ error: 'Failed to logout from YouTube.' });
    }
}];

exports.tiktokLogout = [authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
    try {
        await tiktokAuthService.clearTokens(userId);
        console.log(`Successfully cleared TikTok tokens from database for user ${userId}.`);
        res.status(200).json({ success: true, message: 'Successfully logged out from TikTok.' });
    } catch (err) {
        console.error(`Error during TikTok logout for user ${userId}:`, err.message);
        res.status(500).json({ error: 'Failed to logout from TikTok.' });
    }
}];

exports.initiateFacebookAuth = [authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const authUrl = facebookAuthService.getFacebookAuthUrl(userId);
    res.status(200).json({ authUrl });
  } catch (error) {
    console.error('Error initiating Facebook auth:', error);
    res.status(500).json({ error: 'Failed to initiate Facebook authentication' });
  }
}];

exports.facebookCallback = async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return sendPopupResponse(res, 'FB_AUTH_ERROR', { error });
  }
  if (!code || !state) {
    return sendPopupResponse(res, 'FB_AUTH_ERROR', { error: 'Missing code or state' });
  }
  let userId;
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
    userId = stateData.userId;
  } catch (err) {
    return sendPopupResponse(res, 'FB_AUTH_ERROR', { error: 'Invalid state' });
  }
  try {
    const { user, pages } = await facebookAuthService.handleFacebookCallback(userId, code);
    sendPopupResponse(res, 'FB_AUTH_SUCCESS', { user, pages });
  } catch (err) {
    console.error('Error in Facebook callback:', err);
    sendPopupResponse(res, 'FB_AUTH_ERROR', { error: err.message || 'Facebook authentication failed' });
  }
};

exports.facebookLogout = [authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await facebookAuthService.clearTokens(userId);
    res.status(200).json({ success: true, message: 'Successfully logged out from Facebook.' });
  } catch (err) {
    console.error('Error during Facebook logout:', err);
    res.status(500).json({ error: 'Failed to logout from Facebook.' });
  }
}];

exports.initiateTwitterAuth = [authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const authUrl = twitterAuthService.getTwitterAuthUrl(userId);
    res.status(200).json({ authUrl });
  } catch (error) {
    console.error('Error initiating Twitter auth:', error);
    res.status(500).json({ error: 'Failed to initiate Twitter authentication' });
  }
}];

exports.twitterCallback = async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return sendPopupResponse(res, 'TW_AUTH_ERROR', { error });
  }
  if (!code || !state) {
    return sendPopupResponse(res, 'TW_AUTH_ERROR', { error: 'Missing code or state' });
  }
  let userId;
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
    userId = stateData.userId;
  } catch (err) {
    return sendPopupResponse(res, 'TW_AUTH_ERROR', { error: 'Invalid state' });
  }
  try {
    await twitterAuthService.handleTwitterCallback(userId, code);
    sendPopupResponse(res, 'TW_AUTH_SUCCESS', { platform: 'Twitter' });
  } catch (err) {
    console.error('Error in Twitter callback:', err);
    sendPopupResponse(res, 'TW_AUTH_ERROR', { error: err.message || 'Twitter authentication failed' });
  }
};

exports.twitterLogout = [authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await twitterAuthService.clearTokens(userId);
    res.status(200).json({ success: true, message: 'Successfully logged out from Twitter.' });
  } catch (err) {
    console.error('Error during Twitter logout:', err);
    res.status(500).json({ error: 'Failed to logout from Twitter.' });
  }
}];
