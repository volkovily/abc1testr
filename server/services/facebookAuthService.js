const axios = require('axios');
const BaseService = require('./baseService');

const PLATFORM = 'facebook';
const clientId = process.env.FACEBOOK_APP_ID;
const clientSecret = process.env.FACEBOOK_APP_SECRET;
const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

class FacebookAuthService extends BaseService {
  constructor() {
    super(PLATFORM, { clientId, clientSecret, redirectUri });
  }

  getFacebookAuthUrl(userId) {
    if (!this.config.clientId || !this.config.redirectUri) {
      throw new Error('Facebook OAuth config missing');
    }
    
    const stateData = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: stateData,
      scope: 'email,public_profile,pages_show_list',
      response_type: 'code'
    });
    
    return `https://www.facebook.com/v16.0/dialog/oauth?${params}`;
  }

  async handleFacebookCallback(userId, code) {
    const tokenRes = await this.makeApiRequest('get', 'https://graph.facebook.com/v16.0/oauth/access_token', {
      params: {
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        client_secret: this.config.clientSecret,
        code
      }
    });
    
    const accessToken = tokenRes.access_token;

    const longRes = await this.makeApiRequest('get', 'https://graph.facebook.com/v16.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        fb_exchange_token: accessToken
      }
    });
    
    const longToken = longRes.access_token;
    const expiresInRaw = longRes.expires_in;
    const expiresInSec = typeof expiresInRaw === 'number' && !isNaN(expiresInRaw) ? expiresInRaw : 60 * 24 * 60 * 60;
    const expiryTime = Date.now() + expiresInSec * 1000;

    await this.storeTokens(userId, {
      accessToken: longToken,
      refreshToken: longToken, // Facebook uses the same token for refresh
      expiryTime
    });

    const profileRes = await this.makeApiRequest('get', 'https://graph.facebook.com/me', {
      params: { 
        access_token: longToken, 
        fields: 'id,name,email,picture' 
      }
    });

    const pagesRes = await this.makeApiRequest('get', 'https://graph.facebook.com/me/accounts', {
      params: { 
        access_token: longToken 
      }
    });

    return { user: profileRes, pages: pagesRes.data };
  }

  async getUserInfo(userId) {
    const accessToken = await this.ensureValidToken(userId);
    
    try {
      const res = await this.makeApiRequest('get', 'https://graph.facebook.com/me', {
        params: { 
          access_token: accessToken, 
          fields: 'id,name,email,picture' 
        }
      });
      
      return res;
    } catch (err) {
      console.error('Error fetching Facebook user profile:', err);
      throw new Error('Failed to fetch Facebook profile');
    }
  }

  async getPages(userId) {
    const accessToken = await this.ensureValidToken(userId);
    
    try {
      const res = await this.makeApiRequest('get', 'https://graph.facebook.com/me/accounts', {
        params: { 
          access_token: accessToken 
        }
      });
      
      return res.data;
    } catch (err) {
      console.error('Error fetching Facebook pages:', err);
      throw new Error('Failed to fetch Facebook pages');
    }
  }

  // Facebook doesn't have a traditional refresh token flow, so we override this method
  async refreshAccessToken(userId) {
    // For Facebook, we just return the existing token since long-lived tokens are used
    const tokens = await this.getStoredTokens(userId);
    return tokens.accessToken;
  }
}

// Create and export a singleton instance
const facebookAuthService = new FacebookAuthService();
module.exports = facebookAuthService;
