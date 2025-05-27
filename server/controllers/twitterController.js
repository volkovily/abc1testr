const BaseController = require('./baseController');
const twitterAuthService = require('../services/twitterAuthService');
const axios = require('axios');
const FormData = require('form-data');

const TWITTER_API = {
  MEDIA_UPLOAD: 'https://api.twitter.com/2/media/upload',
  TWEET: 'https://api.twitter.com/2/tweets',
  USER_INFO: 'https://api.twitter.com/2/users/me'
};

const CHUNK_SIZE = 2 * 1024 * 1024;

class TwitterController extends BaseController {
  constructor() {
    super(twitterAuthService);
  }

  initiateAuth = async (req, res) => {
    try {
      const userId = req.user.userId;
      const authUrl = this.service.getTwitterAuthUrl(userId);
      res.status(200).json({ authUrl });
    } catch (error) {
      this.handleError(error, res, req.user.userId, 'initiating Twitter auth');
    }
  };

  authCallback = async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      return this.sendPopupResponse(res, 'TW_AUTH_ERROR', { error });
    }
    if (!code || !state) {
      return this.sendPopupResponse(res, 'TW_AUTH_ERROR', { error: 'Missing code or state' });
    }
    
    const result = this.extractUserIdFromState(state);
    if (result.error) {
      return this.sendPopupResponse(res, 'TW_AUTH_ERROR', { error: result.error });
    }
    const userId = result.userId;
    
    try {
      await this.service.handleTwitterCallback(userId, code);
      this.sendPopupResponse(res, 'TW_AUTH_SUCCESS', { platform: 'Twitter' });
    } catch (err) {
      console.error('Error in Twitter callback:', err);
      this.sendPopupResponse(res, 'TW_AUTH_ERROR', { error: err.message || 'Twitter authentication failed' });
    }
  };

  logout = async (req, res) => {
    try {
      const userId = req.user.userId;
      await this.service.clearTokens(userId);
      res.status(200).json({ success: true, message: 'Successfully logged out from Twitter.' });
    } catch (err) {
      this.handleError(err, res, req.user.userId, 'Twitter logout');
    }
  };

  getStatus = async (req, res) => {
    try {
      const userId = req.user.userId;
      const status = await this.service.checkTokenStatus(userId);
      res.json({ isAuthenticated: !!status.isAuthenticated });
    } catch (error) {
      this.handleError(error, res, req.user.userId, 'checking Twitter status');
    }
  };

  getUserInfo = async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = await this.service.getUserInfo(userId);
      
      res.json({
        success: true,
        user
      });
    } catch (error) {
      this.handleError(error, res, req.user.userId, 'fetching Twitter user info');
    }
  };

  async getTwitterAuth(userId) {
    const tokens = await this.service.getStoredTokens(userId);
    if (!tokens.accessToken) {
      return { error: 'Not authenticated with Twitter' };
    }
    return { accessToken: tokens.accessToken };
  }

  async uploadMediaToTwitter(file, accessToken) {
    try {
      const totalBytes = file.size;
      const mediaType = file.mimetype;
      
      const mediaCategory = mediaType.startsWith('image/') 
        ? 'tweet_image' 
        : 'tweet_video';
      
      const initForm = new FormData();
      initForm.append('command', 'INIT');
      initForm.append('media_type', mediaType);
      initForm.append('total_bytes', totalBytes.toString());
      initForm.append('media_category', mediaCategory);
      
      const initResp = await axios.post(TWITTER_API.MEDIA_UPLOAD, initForm, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...initForm.getHeaders()
        }
      });
      
      const mediaId = initResp.data.data.id;
      
      for (let i = 0; i < totalBytes; i += CHUNK_SIZE) {
        const chunk = file.buffer.slice(i, i + CHUNK_SIZE);
        const segmentIndex = Math.floor(i / CHUNK_SIZE);
        
        const appendForm = new FormData();
        appendForm.append('command', 'APPEND');
        appendForm.append('media_id', mediaId);
        appendForm.append('segment_index', segmentIndex);
        appendForm.append('media', chunk, { 
          filename: file.originalname, 
          contentType: mediaType 
        });
        
        await axios.post(TWITTER_API.MEDIA_UPLOAD, appendForm, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...appendForm.getHeaders()
          }
        });
      }
      
      const finalizeForm = new FormData();
      finalizeForm.append('command', 'FINALIZE');
      finalizeForm.append('media_id', mediaId);
      
      const finalizeResp = await axios.post(TWITTER_API.MEDIA_UPLOAD, finalizeForm, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...finalizeForm.getHeaders()
        }
      });
      
      let processingInfo = finalizeResp.data.data.processing_info;
      if (!processingInfo) {
        return mediaId;
      }
      
      let state = processingInfo.state;
      let checkAfterSecs = processingInfo.check_after_secs || 1;
      
      while (state && state !== 'succeeded' && state !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, checkAfterSecs * 1000));
        
        const statusResp = await axios.get(TWITTER_API.MEDIA_UPLOAD, {
          params: { command: 'STATUS', media_id: mediaId },
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        processingInfo = statusResp.data.data.processing_info;
        if (!processingInfo) break;
        
        state = processingInfo.state;
        checkAfterSecs = processingInfo.check_after_secs || 1;
        
        if (state === 'failed') {
          throw new Error(`Twitter media processing failed: ${JSON.stringify(processingInfo)}`);
        }
      }
      
      return mediaId;
    } catch (error) {
      if (error.response) {
        throw new Error(`Twitter API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async postTweet(accessToken, text, mediaIds = []) {
    const payload = { text: text || '' };
    
    if (mediaIds.length > 0) {
      payload.media = { media_ids: mediaIds };
    }
    
    const response = await axios.post(TWITTER_API.TWEET, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }

  uploadToTwitter = async (req, res) => {
    try {
      const userId = req.user.userId;
      const { error, accessToken } = await this.getTwitterAuth(userId);
      if (error) {
        return res.status(401).json({ success: false, error });
      }
      const file = req.file;
      const text = req.body.text || '';
      let mediaIds = [];
      if (file) {
        try {
          const mediaId = await this.uploadMediaToTwitter(file, accessToken);
          mediaIds.push(mediaId);
        } catch (err) {
          console.error('Twitter media upload error:', err);
          return res.status(500).json({
            success: false,
            error: 'Media upload failed',
            details: err.message
          });
        }
      }
      try {
        const tweetResponse = await this.postTweet(accessToken, text, mediaIds);
        res.json({
          success: true,
          tweet: tweetResponse
        });
      } catch (err) {
        console.error('Twitter post error:', err);
        return res.status(500).json({
          success: false,
          error: 'Tweet failed',
          details: err.response?.data || err.message
        });
      }
    } catch (error) {
      this.handleError(error, res, req.user.userId, 'posting to Twitter');
    }
  };
}

// Create controller instance
const twitterController = new TwitterController();

// Export controller methods with authentication middleware
module.exports = {
  getStatus: twitterController.protected(twitterController.getStatus),
  getUserInfo: twitterController.protected(twitterController.getUserInfo),
  uploadToTwitter: twitterController.protected(twitterController.uploadToTwitter),
  initiateAuth: twitterController.protected(twitterController.initiateAuth),
  authCallback: twitterController.authCallback,
  logout: twitterController.protected(twitterController.logout)
};
