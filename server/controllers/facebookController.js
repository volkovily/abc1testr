const BaseController = require('./baseController');
const facebookAuthService = require('../services/facebookAuthService');
const axios = require('axios');
const FormData = require('form-data');

const GRAPH = 'https://graph.facebook.com/v22.0';
const FACEBOOK_API = {
  GRAPH,
  VIDEO: (pageId) => `${GRAPH}/${pageId}/videos`,
  FEED: (pageId) => `${GRAPH}/${pageId}/feed`,
  PHOTO: (pageId) => `${GRAPH}/${pageId}/photos`,
  VIDEO_URL: (pageId, videoId) => `https://www.facebook.com/${pageId}/videos/${videoId}`
};

class FacebookController extends BaseController {
  constructor() {
    super(facebookAuthService);
  }

  initiateAuth = async (req, res) => {
    try {
      const userId = req.user.userId;
      const authUrl = this.service.getFacebookAuthUrl(userId);
      res.status(200).json({ authUrl });
    } catch (error) {
      this.handleError(error, res, req.user.userId, 'initiating Facebook auth');
    }
  };

  authCallback = async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      return this.sendPopupResponse(res, 'FB_AUTH_ERROR', { error });
    }
    if (!code || !state) {
      return this.sendPopupResponse(res, 'FB_AUTH_ERROR', { error: 'Missing code or state' });
    }
    
    const result = this.extractUserIdFromState(state);
    if (result.error) {
      return this.sendPopupResponse(res, 'FB_AUTH_ERROR', { error: result.error });
    }
    const userId = result.userId;
    
    try {
      const { user, pages } = await this.service.handleFacebookCallback(userId, code);
      this.sendPopupResponse(res, 'FB_AUTH_SUCCESS', { user, pages });
    } catch (err) {
      console.error('Error in Facebook callback:', err);
      this.sendPopupResponse(res, 'FB_AUTH_ERROR', { error: err.message || 'Facebook authentication failed' });
    }
  };

  getPages = async (req, res) => {
    const userId = req.user.userId;
    try {
      const pages = await this.service.getPages(userId);
      res.json({ pages });
    } catch (error) {
      this.handleError(error, res, userId, 'fetching Facebook pages');
    }
  };

  uploadVideo = async (req, res) => {
    const userId = req.user.userId;
    const { title, description, selectedPageId } = req.body;

    if (!this.validateRequiredFields(req, res, ['file', 'selectedPageId'])) {
      return;
    }

    try {
      const pages = await this.service.getPages(userId);
      const page = pages.find(p => p.id === selectedPageId);
      if (!page || !page.access_token) {
        return res.status(403).json({ error: 'Not authenticated or missing page access token' });
      }
      const pageToken = page.access_token;

      const form = new FormData();
      form.append('source', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
      if (title) form.append('title', title);
      if (description) form.append('description', description);
      form.append('access_token', pageToken);

      const fbRes = await axios.post(
        FACEBOOK_API.VIDEO(selectedPageId),
        form,
        { headers: form.getHeaders() }
      );

      const videoId = fbRes.data.id;
      const videoUrl = FACEBOOK_API.VIDEO_URL(selectedPageId, videoId);
      res.json({ videoId, videoUrl });
    } catch (error) {
      console.error('Error during Facebook video upload:', error.response ? error.response.data : error.message);
      const message = error.response?.data?.error?.message || error.message;
      res.status(500).json({ error: message });
    }
  };

  createPost = async (req, res) => {
    const userId = req.user.userId;
    const { pageId, message, link, published, scheduledPublishTime } = req.body;
    
    if (!this.validateRequiredFields(req, res, ['pageId', 'message'])) {
      return;
    }

    try {
      const pages = await this.service.getPages(userId);
      const page = pages.find(p => p.id === pageId);
      if (!page || !page.access_token) {
        return res.status(403).json({ error: 'Not authenticated or missing page access token.' });
      }
      const params = { access_token: page.access_token, message };
      if (link) params.link = link;
      if (typeof published !== 'undefined') params.published = published;
      if (scheduledPublishTime) params.scheduled_publish_time = scheduledPublishTime;
      const fbRes = await axios.post(
        FACEBOOK_API.FEED(pageId),
        params
      );
      return res.json({ postId: fbRes.data.id });
    } catch (error) {
      console.error('Error creating Facebook post:', error.response ? error.response.data : error.message);
      const msg = error.response?.data?.error?.message || error.message;
      res.status(500).json({ error: msg });
    }
  };

  uploadPhoto = async (req, res) => {
    const userId = req.user.userId;
    const { pageId, message, published, scheduledPublishTime } = req.body;
    
    if (!this.validateRequiredFields(req, res, ['pageId', 'file'])) {
      return;
    }

    try {
      const pages = await this.service.getPages(userId);
      const page = pages.find(p => p.id === pageId);
      if (!page || !page.access_token) {
        return res.status(403).json({ error: 'Not authenticated or missing page access token.' });
      }
      const form = new FormData();
      form.append('source', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
      form.append('access_token', page.access_token);
      if (message) form.append('caption', message);
      if (typeof published !== 'undefined') form.append('published', published);
      if (scheduledPublishTime) form.append('scheduled_publish_time', scheduledPublishTime);
      const fbRes = await axios.post(
        FACEBOOK_API.PHOTO(pageId),
        form,
        { headers: form.getHeaders() }
      );
      res.json({ photoId: fbRes.data.id, postId: fbRes.data.post_id });
    } catch (error) {
      console.error('Error uploading Facebook photo:', error.response ? error.response.data : error.message);
      const errMsg = error.response?.data?.error?.message || error.message;
      res.status(500).json({ error: errMsg });
    }
  };
}

const facebookController = new FacebookController();

module.exports = {
  getStatus: facebookController.protected(facebookController.getStatus),
  getUserInfo: facebookController.protected(facebookController.getUserInfo),
  getPages: facebookController.protected(facebookController.getPages),
  uploadVideo: facebookController.protected(facebookController.uploadVideo),
  createPost: facebookController.protected(facebookController.createPost),
  uploadPhoto: facebookController.protected(facebookController.uploadPhoto),
  initiateAuth: facebookController.protected(facebookController.initiateAuth),
  authCallback: facebookController.authCallback,
  logout: facebookController.protected(facebookController.logout)
};
