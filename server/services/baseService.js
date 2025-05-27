const Token = require('../models/Token');
const axios = require('axios');

class BaseService {
  constructor(platform, config = {}) {
    this.platform = platform;
    this.config = config;
  }

  async storeTokens(userId, { accessToken, refreshToken, expiryTime, platformUserId }) {
    try {
      let token = await Token.findOne({ userId, platform: this.platform });
      
      if (token) {
        token.accessToken = accessToken;
        if (refreshToken) {
          token.refreshToken = refreshToken;
        }
        token.expiryTime = expiryTime;
        if (platformUserId) {
          token.platformUserId = platformUserId;
        }
      } else {
        token = new Token({
          userId,
          platform: this.platform,
          accessToken,
          refreshToken,
          expiryTime,
          platformUserId: platformUserId || null
        });
      }
      
      await token.save();
    } catch (error) {
      console.error(`Error storing ${this.platform} tokens for user ${userId}:`, error);
      throw new Error(`Failed to store authentication tokens for ${this.platform}`);
    }
  }

  async getStoredTokens(userId) {
    if (!userId) {
      return { accessToken: null, refreshToken: null, expiryTime: null, platformUserId: null };
    }
    
    try {
      const token = await Token.findOne({ userId, platform: this.platform });
      
      if (!token) {
        return { accessToken: null, refreshToken: null, expiryTime: null, platformUserId: null };
      }
      
      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiryTime: token.expiryTime,
        platformUserId: token.platformUserId
      };
    } catch (error) {
      console.error(`Error retrieving ${this.platform} tokens for user ${userId}:`, error);
      return { accessToken: null, refreshToken: null, expiryTime: null, platformUserId: null };
    }
  }

  async checkTokenStatus(userId) {
    const tokens = await this.getStoredTokens(userId);
    const isAuthenticated = !!tokens.accessToken && (!tokens.expiryTime || tokens.expiryTime > Date.now());
    return { isAuthenticated, platformUserId: tokens.platformUserId };
  }

  async clearTokens(userId) {
    if (!userId) {
      return;
    }
    
    try {
      await Token.deleteOne({ userId, platform: this.platform });
    } catch (error) {
      console.error(`Error clearing ${this.platform} tokens for user ${userId}:`, error);
    }
  }

  async makeApiRequest(method, url, options = {}) {
    try {
      const response = await axios({
        method,
        url,
        ...options
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        const errorMessage = errorData?.error?.message || 
                            errorData?.error_description || 
                            errorData?.error || 
                            'API request failed';
        
        throw new Error(`${this.platform} API Error (${error.response.status}): ${errorMessage}`);
      }
      
      throw error;
    }
  }

  async ensureValidToken(userId) {
    const currentTokens = await this.getStoredTokens(userId);
    
    if (!currentTokens.accessToken) {
      throw new Error(`User not authenticated with ${this.platform}`);
    }
    
    const isTokenExpired = !currentTokens.expiryTime || Date.now() >= currentTokens.expiryTime;
    
    if (isTokenExpired && currentTokens.refreshToken) {
      return await this.refreshAccessToken(userId);
    }
    
    return currentTokens.accessToken;
  }

  async refreshAccessToken(userId) {
    throw new Error('refreshAccessToken must be implemented by subclass');
  }

  async getUserInfo(userId) {
    throw new Error('getUserInfo must be implemented by subclass');
  }
}

module.exports = BaseService;
