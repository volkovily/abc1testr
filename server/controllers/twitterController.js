const Token = require('../models/Token');
const axios = require('axios');
const FormData = require('form-data');

const TWITTER_API = {
  MEDIA_UPLOAD: 'https://api.twitter.com/2/media/upload',
  TWEET: 'https://api.twitter.com/2/tweets',
  USER_INFO: 'https://api.twitter.com/2/users/me'
};

const CHUNK_SIZE = 2 * 1024 * 1024;

async function getTwitterAuth(userId) {
  const tokenDoc = await Token.findOne({ userId, platform: 'twitter' });
  if (!tokenDoc || !tokenDoc.accessToken) {
    return { error: 'Not authenticated with Twitter' };
  }
  return { accessToken: tokenDoc.accessToken };
}

async function uploadMediaToTwitter(file, accessToken) {
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

async function postTweet(accessToken, text, mediaIds = []) {
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

exports.getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const token = await Token.findOne({ userId, platform: 'twitter' });
    res.json({ isAuthenticated: !!token });
  } catch (error) {
    console.error('Twitter status check error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check Twitter status' 
    });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { error, accessToken } = await getTwitterAuth(userId);
    
    if (error) {
      return res.status(401).json({ success: false, error });
    }
    
    const response = await axios.get(`${TWITTER_API.USER_INFO}?user.fields=profile_image_url`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const user = response.data.data;
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.profile_image_url
      }
    });
  } catch (error) {
    console.error('Twitter user info error:', error);
    const errorMessage = error.response?.data || error.message || 'Failed to fetch Twitter user info';
    
    res.status(500).json({ 
      success: false,
      error: errorMessage
    });
  }
};

exports.uploadToTwitter = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { error, accessToken } = await getTwitterAuth(userId);
    if (error) {
      return res.status(401).json({ success: false, error });
    }
    const file = req.file;
    const text = req.body.text || '';
    let mediaIds = [];
    if (file) {
      try {
        const mediaId = await uploadMediaToTwitter(file, accessToken);
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
      const tweetResponse = await postTweet(accessToken, text, mediaIds);
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
    console.error('Twitter post general error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post to Twitter',
      details: error.message
    });
  }
};
