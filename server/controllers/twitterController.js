const BaseController = require('./baseController');
const twitterAuthService = require('../services/twitterAuthService');
const axios = require('axios');
const FormData = require('form-data');

const TWITTER_API = {
  MEDIA_UPLOAD_INITIALIZE: 'https://api.twitter.com/2/media/upload/initialize',
  MEDIA_UPLOAD_APPEND: 'https://api.twitter.com/2/media/upload/{id}/append',
  MEDIA_UPLOAD_FINALIZE: 'https://api.twitter.com/2/media/upload/{id}/finalize',
  MEDIA_UPLOAD_STATUS: 'https://api.twitter.com/2/media/upload',
  TWEET: 'https://api.twitter.com/2/tweets',
  USER_INFO: 'https://api.twitter.com/2/users/me'
};

const CHUNK_SIZE = 4 * 1024 * 1024;

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
    try {
      const accessToken = await this.service.ensureValidToken(userId);
      return { accessToken };
    } catch (error) {
      return { error: error.message || 'Not authenticated with Twitter' };
    }
  }

  async uploadMediaToTwitter(file, accessToken) {
    try {
      const totalBytes = file.size;
      const mediaType = file.mimetype;
      const isVideo = mediaType.startsWith('video/');
      
      const mediaCategory = mediaType.startsWith('image/') 
        ? 'tweet_image' 
        : 'tweet_video';
      
      const initPayload = {
        media_type: mediaType,
        total_bytes: totalBytes,
        media_category: mediaCategory
      };
      
      if (isVideo) {
        initPayload.additional_owners = [];
      }
      
      const initResp = await axios.post(TWITTER_API.MEDIA_UPLOAD_INITIALIZE, initPayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => {
        throw err;
      });
      
      const mediaId = initResp.data.data.id;
      
      const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
      
      for (let i = 0; i < totalBytes; i += CHUNK_SIZE) {
        const chunk = file.buffer.slice(i, i + CHUNK_SIZE);
        const segmentIndex = Math.floor(i / CHUNK_SIZE);
        
        const appendForm = new FormData();
        appendForm.append('segment_index', segmentIndex);
        appendForm.append('media', chunk, { 
          filename: file.originalname, 
          contentType: mediaType 
        });
        
        await axios.post(TWITTER_API.MEDIA_UPLOAD_APPEND.replace('{id}', mediaId), appendForm, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...appendForm.getHeaders()
          }
        }).catch(err => {
          throw err;
        });
      }
      
      const finalizePayload = {
        total_chunks: Math.ceil(totalBytes / CHUNK_SIZE)
      };
      
      const finalizeResp = await axios.post(TWITTER_API.MEDIA_UPLOAD_FINALIZE.replace('{id}', mediaId), finalizePayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => {
        throw err;
      });
      
      let processingInfo = finalizeResp.data.data.processing_info;
      if (!processingInfo) {
        return mediaId;
      }
      
      let state = processingInfo.state;
      let checkAfterSecs = processingInfo.check_after_secs || 1;
      
      while (state && state !== 'succeeded' && state !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, checkAfterSecs * 1000));
        
        const statusResp = await axios.get(TWITTER_API.MEDIA_UPLOAD_STATUS, {
          params: {
            media_id: mediaId,
            command: 'STATUS'
          },
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }).catch(err => {
          throw err;
        });
        
        processingInfo = statusResp.data.data.processing_info;
        if (!processingInfo) {
          break;
        }
        
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

const twitterController = new TwitterController();

module.exports = {
  getStatus: twitterController.protected(twitterController.getStatus),
  getUserInfo: twitterController.protected(twitterController.getUserInfo),
  uploadToTwitter: twitterController.protected(twitterController.uploadToTwitter),
  initiateAuth: twitterController.protected(twitterController.initiateAuth),
  authCallback: twitterController.authCallback,
  logout: twitterController.protected(twitterController.logout)
};
