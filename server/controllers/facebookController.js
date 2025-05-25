const facebookAuthService = require('../services/facebookAuthService');
const { authenticateToken } = require('../lib/jwt');
const axios = require('axios');
const FormData = require('form-data');

exports.getStatus = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const status = await facebookAuthService.checkTokenStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('Error checking Facebook status for user', userId, error);
    res.status(500).json({ isAuthenticated: false, error: error.message });
  }
}];

exports.getUserInfo = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const profile = await facebookAuthService.getUserInfo(userId);
    res.json({ user: profile });
  } catch (error) {
    console.error('Error fetching Facebook user for user', userId, error);
    res.status(500).json({ error: error.message });
  }
}];

exports.getPages = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const pages = await facebookAuthService.getPages(userId);
    res.json({ pages });
  } catch (error) {
    console.error('Error fetching Facebook pages for user', userId, error);
    res.status(500).json({ error: error.message });
  }
}];

exports.uploadVideo = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { title, description, selectedPageId } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded.' });
  }
  if (!selectedPageId) {
    return res.status(400).json({ error: 'Facebook Page ID is required.' });
  }

  try {
    const pages = await facebookAuthService.getPages(userId);
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
      `https://graph.facebook.com/v16.0/${selectedPageId}/videos`,
      form,
      { headers: form.getHeaders() }
    );

    const videoId = fbRes.data.id;
    const videoUrl = `https://www.facebook.com/${selectedPageId}/videos/${videoId}`;
    res.json({ videoId, videoUrl });
  } catch (error) {
    console.error('Error during Facebook video upload:', error.response ? error.response.data : error.message);
    const message = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: message });
  }
}];

exports.createPost = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { pageId, message, link, published, scheduledPublishTime } = req.body;
  if (!pageId) return res.status(400).json({ error: 'Facebook Page ID is required.' });
  if (!message) return res.status(400).json({ error: 'Post message is required.' });
  try {
    const pages = await facebookAuthService.getPages(userId);
    const page = pages.find(p => p.id === pageId);
    if (!page || !page.access_token) {
      return res.status(403).json({ error: 'Not authenticated or missing page access token.' });
    }
    const params = { access_token: page.access_token, message };
    if (link) params.link = link;
    if (typeof published !== 'undefined') params.published = published;
    if (scheduledPublishTime) params.scheduled_publish_time = scheduledPublishTime;
    const fbRes = await axios.post(
      `https://graph.facebook.com/v16.0/${pageId}/feed`,
      params
    );
    return res.json({ postId: fbRes.data.id });
  } catch (error) {
    console.error('Error creating Facebook post:', error.response ? error.response.data : error.message);
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: msg });
  }
}];

exports.uploadPhoto = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { pageId, message, published, scheduledPublishTime } = req.body;
  if (!pageId) return res.status(400).json({ error: 'Facebook Page ID is required.' });
  if (!req.file) return res.status(400).json({ error: 'Photo file is required.' });
  try {
    const pages = await facebookAuthService.getPages(userId);
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
      `https://graph.facebook.com/v16.0/${pageId}/photos`,
      form,
      { headers: form.getHeaders() }
    );
    res.json({ photoId: fbRes.data.id, postId: fbRes.data.post_id });
  } catch (error) {
    console.error('Error uploading Facebook photo:', error.response ? error.response.data : error.message);
    const errMsg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: errMsg });
  }
}];