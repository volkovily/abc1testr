const axios = require('axios');
const { URLSearchParams } = require('url');
const BaseService = require('./baseService');

const PLATFORM = 'tiktok';
const clientId = process.env.TIKTOK_CLIENT_ID;
const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
const redirectUri = process.env.TIKTOK_BACKEND_REDIRECT_URI;
const tokenEndpoint = process.env.VITE_TIKTOK_TOKEN_ENDPOINT || 'https://open.tiktokapis.com/v2/oauth/token/';

class TikTokAuthService extends BaseService {
  constructor() {
    super(PLATFORM, { 
      clientId, 
      clientSecret, 
      redirectUri,
      tokenEndpoint
    });
  }

  async exchangeCode(userId, code) {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.redirectUri) {
      throw new Error("TikTok Client ID, Client Secret, or Redirect URI not configured on backend");
    }
    
    try {
      const params = {
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri
      };
      const formBody = new URLSearchParams(params).toString();

      const response = await axios.post(this.config.tokenEndpoint, formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.data.error || !response.data.access_token) {
        throw new Error(response.data.error_description || response.data.error || 'Token exchange failed');
      }

      const { access_token, refresh_token, expires_in, open_id } = response.data;
      const expiryTime = Date.now() + expires_in * 1000;

      await this.storeTokens(userId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiryTime: expiryTime,
        platformUserId: open_id
      });

      return { success: true };

    } catch (error) {
      const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
      console.error(`Error exchanging TikTok code for user ${userId}:`, errorMsg);
      throw new Error(`TikTok token exchange failed: ${errorMsg}`);
    }
  }

  async refreshAccessToken(userId) {
    const currentTokens = await this.getStoredTokens(userId);
    
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("TikTok Client ID or Client Secret not configured");
    }
    
    if (!currentTokens.refreshToken) {
      throw new Error(`No TikTok refresh token available for user ${userId}`);
    }

    try {
      const params = {
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: currentTokens.refreshToken,
        grant_type: "refresh_token"
      };
      const formBody = new URLSearchParams(params).toString();

      const response = await axios.post(this.config.tokenEndpoint, formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.data.error || !response.data.access_token) {
        throw new Error(response.data.error_description || response.data.error || 'Token refresh failed');
      }

      const { access_token, refresh_token, expires_in, open_id } = response.data;
      const expiryTime = Date.now() + expires_in * 1000;

      await this.storeTokens(userId, {
        accessToken: access_token,
        refreshToken: refresh_token || currentTokens.refreshToken,
        expiryTime: expiryTime,
        platformUserId: open_id || currentTokens.platformUserId
      });

      return access_token;

    } catch (error) {
      const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
      console.error(`Error refreshing TikTok token for user ${userId}:`, errorMsg);
      await this.clearTokens(userId);
      throw new Error(`Failed to refresh TikTok token: ${errorMsg}. Please re-authenticate.`);
    }
  }

  async getUserInfo(userId) {
    const accessToken = await this.ensureValidToken(userId);
    const userInfoEndpoint = process.env.VITE_TIKTOK_USERINFO_ENDPOINT || 'https://open.tiktokapis.com/v2/user/info/';

    try {
      const response = await axios.get(userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          fields: 'open_id,display_name,avatar_url'
        }
      });

      const tikTokError = response.data.error;
      if (tikTokError && tikTokError.code !== 'ok') { 
        console.error("TikTok User Info API Error:", tikTokError);
        throw new Error(tikTokError.message || 'Failed to fetch user info from TikTok');
      }
      
      if (!response.data.data?.user) {
        console.error('User data missing in TikTok response, even though code was ok.');
        throw new Error('User data not found in TikTok response.');
      }

      return response.data;
    } catch (error) {
      if (error.message?.includes('re-authenticate') || 
          error.message?.includes('token') || 
          error.message?.includes('PERMISSION_DENIED')) {
        await this.clearTokens(userId);
        throw new Error(`Authentication error: ${error.message}. Please reconnect TikTok.`);
      }
      throw error;
    }
  }
}

// Create and export a singleton instance
const tiktokAuthService = new TikTokAuthService();
module.exports = tiktokAuthService;
