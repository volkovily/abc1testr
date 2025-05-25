const axios = require('axios');
const Token = require('../models/Token');

const clientId = process.env.TWITTER_CLIENT_ID;
const clientSecret = process.env.TWITTER_CLIENT_SECRET;
const redirectUri = process.env.TWITTER_REDIRECT_URI;

exports.getTwitterAuthUrl = (userId) => {
  const stateData = JSON.stringify({ userId, nonce: Math.random().toString(36).substring(7) });
  const state = Buffer.from(stateData).toString('base64');
  const scopes = [
    'tweet.read',
    'tweet.write',
    'users.read',
    'offline.access',
    'media.write'
  ];
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: 'challenge',
    code_challenge_method: 'plain',
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
};

exports.handleTwitterCallback = async (userId, code) => {
  const params = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: 'challenge',
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post('https://api.twitter.com/2/oauth2/token', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
  });
  const { access_token, refresh_token, expires_in } = response.data;
  await Token.findOneAndUpdate(
    { userId, platform: 'twitter' },
    {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiryTime: Date.now() + expires_in * 1000,
    },
    { upsert: true, new: true }
  );
  return { access_token, refresh_token };
};

exports.clearTokens = async (userId) => {
  await Token.deleteOne({ userId, platform: 'twitter' });
};
