const axios = require('axios');
const BaseService = require('./baseService');

const PLATFORM = 'twitter';
const clientId = process.env.TWITTER_CLIENT_ID;
const clientSecret = process.env.TWITTER_CLIENT_SECRET;
const redirectUri = process.env.TWITTER_REDIRECT_URI;

class TwitterAuthService extends BaseService {
  constructor() {
    super(PLATFORM, { clientId, clientSecret, redirectUri });
  }

  getTwitterAuthUrl(userId) {
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
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state,
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  async handleTwitterCallback(userId, code) {
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code_verifier: 'challenge',
    });
    
    const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    
    try {
      const response = await axios.post('https://api.twitter.com/2/oauth2/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
      });
      
      const { access_token, refresh_token, expires_in } = response.data;
      
      await this.storeTokens(userId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiryTime: Date.now() + expires_in * 1000
      });
      
      return { access_token, refresh_token };
    } catch (error) {
      console.error('Error in Twitter callback:', error);
      throw new Error(error.response?.data?.error || 'Twitter authentication failed');
    }
  }

  async refreshAccessToken(userId) {
    // Twitter refresh token implementation would go here
    // For now, just throw an error to indicate re-authentication is needed
    await this.clearTokens(userId);
    throw new Error('Twitter token expired. Please re-authenticate.');
  }

  async getUserInfo(userId) {
    const tokens = await this.getStoredTokens(userId);
    if (!tokens.accessToken) {
      throw new Error('Not authenticated with Twitter');
    }
    
    try {
      const response = await axios.get(`https://api.twitter.com/2/users/me?user.fields=profile_image_url`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      });
      
      const user = response.data.data;
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.profile_image_url
      };
    } catch (error) {
      console.error('Twitter user info error:', error);
      throw new Error(error.response?.data || error.message || 'Failed to fetch Twitter user info');
    }
  }
}

// Create and export a singleton instance
const twitterAuthService = new TwitterAuthService();
module.exports = twitterAuthService;
