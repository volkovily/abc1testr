const { google } = require('googleapis');
const BaseService = require('./baseService');

const PLATFORM = 'youtube';
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.BACKEND_REDIRECT_URI;

class GoogleAuthService extends BaseService {
  constructor() {
    super(PLATFORM, { clientId, clientSecret, redirectUri });
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  async setOAuthCredentials(userId) {
    const tokens = await this.getStoredTokens(userId);
    if (tokens.accessToken && tokens.refreshToken) {
      this.oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiryTime,
      });
    } else {
      this.oauth2Client.setCredentials({});
    }
  }

  async ensureValidToken(userId) {
    await this.setOAuthCredentials(userId);

    const currentTokens = await this.getStoredTokens(userId);
    if (!currentTokens.accessToken || !currentTokens.refreshToken) {
      throw new Error('User not authenticated with YouTube or refresh token missing.');
    }

    const isTokenExpired = !currentTokens.expiryTime || Date.now() >= currentTokens.expiryTime;

    if (isTokenExpired) {
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();

        await this.storeTokens(userId, {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || currentTokens.refreshToken,
          expiryTime: credentials.expiry_date
        });

        this.oauth2Client.setCredentials(credentials);

      } catch (refreshError) {
        await this.clearTokens(userId);
        this.oauth2Client.setCredentials({});
        throw new Error('Failed to refresh YouTube token. Please re-authenticate.');
      }
    }

    if (!this.oauth2Client.credentials.access_token) {
      throw new Error('Missing access token after check/refresh.');
    }

    return this.oauth2Client;
  }

  async refreshAccessToken(userId) {
    const currentTokens = await this.getStoredTokens(userId);
    this.oauth2Client.setCredentials({
      refresh_token: currentTokens.refreshToken
    });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    
    await this.storeTokens(userId, {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || currentTokens.refreshToken,
      expiryTime: credentials.expiry_date
    });
    
    return credentials.access_token;
  }

  getOAuth2Client() {
    return this.oauth2Client;
  }
}

// Create and export a singleton instance
const googleAuthService = new GoogleAuthService();
module.exports = googleAuthService;
