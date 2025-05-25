const axios = require('axios');
const Token = require('../models/Token');

const PLATFORM = 'facebook';
const clientId = process.env.FACEBOOK_APP_ID;
const clientSecret = process.env.FACEBOOK_APP_SECRET;
const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

exports.getFacebookAuthUrl = (userId) => {
  if (!clientId || !redirectUri) throw new Error('Facebook OAuth config missing');
  const stateData = Buffer.from(JSON.stringify({ userId })).toString('base64');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state: stateData,
    scope: 'email,public_profile,pages_show_list',
    response_type: 'code'
  });
  return `https://www.facebook.com/v16.0/dialog/oauth?${params}`;
};

exports.handleFacebookCallback = async (userId, code) => {
  const tokenRes = await axios.get('https://graph.facebook.com/v16.0/oauth/access_token', {
    params: {
      client_id: clientId,
      redirect_uri: redirectUri,
      client_secret: clientSecret,
      code
    }
  });
  const accessToken = tokenRes.data.access_token;

  const longRes = await axios.get('https://graph.facebook.com/v16.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: accessToken
    }
  });
  const longToken = longRes.data.access_token;
  const expiresInRaw = longRes.data.expires_in;
  const expiresInSec = typeof expiresInRaw === 'number' && !isNaN(expiresInRaw) ? expiresInRaw : 60 * 24 * 60 * 60;
  const expiryTime = Date.now() + expiresInSec * 1000;

  let token = await Token.findOne({ userId, platform: PLATFORM });
  if (token) {
    token.accessToken = longToken;
    token.refreshToken = longToken;
    token.expiryTime = expiryTime;
  } else {
    token = new Token({ userId, platform: PLATFORM, accessToken: longToken, refreshToken: longToken, expiryTime });
  }
  await token.save();

  const profileRes = await axios.get('https://graph.facebook.com/me', {
    params: { access_token: longToken, fields: 'id,name,email,picture' }
  });

  const pagesRes = await axios.get('https://graph.facebook.com/me/accounts', {
    params: { access_token: longToken }
  });

  return { user: profileRes.data, pages: pagesRes.data.data };
};

exports.clearTokens = async (userId) => {
  await Token.deleteOne({ userId, platform: PLATFORM });
};

exports.checkTokenStatus = async (userId) => {
  const token = await Token.findOne({ userId, platform: PLATFORM });
  const isAuthenticated = !!token && (!token.expiryTime || Date.now() < token.expiryTime);
  return { isAuthenticated };
};

exports.getUserInfo = async (userId) => {
  const tokenDoc = await Token.findOne({ userId, platform: PLATFORM });
  if (!tokenDoc || !tokenDoc.accessToken) {
    throw new Error('User not authenticated with Facebook');
  }
  try {
    const res = await axios.get('https://graph.facebook.com/me', {
      params: { access_token: tokenDoc.accessToken, fields: 'id,name,email,picture' }
    });
    return res.data;
  } catch (err) {
    console.error('Error fetching Facebook user profile:', err);
    throw new Error('Failed to fetch Facebook profile');
  }
};

exports.getPages = async (userId) => {
  const tokenDoc = await Token.findOne({ userId, platform: PLATFORM });
  if (!tokenDoc || !tokenDoc.accessToken) {
    throw new Error('User not authenticated with Facebook');
  }
  try {
    const res = await axios.get('https://graph.facebook.com/me/accounts', {
      params: { access_token: tokenDoc.accessToken }
    });
    return res.data.data;
  } catch (err) {
    console.error('Error fetching Facebook pages:', err);
    throw new Error('Failed to fetch Facebook pages');
  }
};
