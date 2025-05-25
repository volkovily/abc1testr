const axios = require('axios');
const { URLSearchParams } = require('url');
const Token = require('../models/Token');

const clientId = process.env.TIKTOK_CLIENT_ID;
const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
const redirectUri = process.env.TIKTOK_BACKEND_REDIRECT_URI;

const tokenEndpoint = process.env.VITE_TIKTOK_TOKEN_ENDPOINT || 'https://open.tiktokapis.com/v2/oauth/token/';

const PLATFORM = 'tiktok';

exports.storeTokens = async (userId, { accessToken, refreshToken, expiryTime, openId }) => {
    try {
        let token = await Token.findOne({ userId: userId, platform: PLATFORM });
        
        if (token) {
            token.accessToken = accessToken;
            if (refreshToken) {
                token.refreshToken = refreshToken;
            }
            token.expiryTime = expiryTime;
            if (openId) {
                token.platformUserId = openId;
            }
        } else {
            token = new Token({
                userId: userId,
                platform: PLATFORM,
                accessToken,
                refreshToken,
                expiryTime,
                platformUserId: openId || null
            });
        }
        
        await token.save();
    } catch (error) {
        console.error(`Error storing TikTok tokens for user ${userId}:`, error);
        throw new Error("Failed to store TikTok authentication tokens");
    }
};

const getStoredTokens = async (userId) => {
    if (!userId) {
        return { accessToken: null, refreshToken: null, expiryTime: null, openId: null };
    }
    try {
        const token = await Token.findOne({ userId: userId, platform: PLATFORM });
        
        if (!token) {
            return { accessToken: null, refreshToken: null, expiryTime: null, openId: null };
        }
        
        return {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiryTime: token.expiryTime,
            openId: token.platformUserId
        };
    } catch (error) {
        console.error(`Error retrieving TikTok tokens for user ${userId} from database:`, error);
        return { accessToken: null, refreshToken: null, expiryTime: null, openId: null };
    }
};

exports.checkTokenStatus = async (userId) => {
    const tokens = await getStoredTokens(userId);
    const isAuthenticated = !!tokens.accessToken && (!tokens.expiryTime || tokens.expiryTime > Date.now());
    return { isAuthenticated, openId: tokens.openId };
};

exports.exchangeCode = async (userId, code) => {
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("TikTok Client ID, Client Secret, or Redirect URI not configured on backend");
    }
    try {
        const params = {
            client_key: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        };
        const formBody = new URLSearchParams(params).toString();

        const response = await axios.post(tokenEndpoint, formBody, {
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

        await exports.storeTokens(userId, {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiryTime: expiryTime,
            openId: open_id
        });

        return { success: true };

    } catch (error) {
        const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
        console.error(`Error exchanging TikTok code for user ${userId}:`, errorMsg);
        throw new Error(`TikTok token exchange failed: ${errorMsg}`);
    }
};

exports.refreshAccessToken = async (userId) => {
    const currentTokens = await getStoredTokens(userId);
    if (!clientId || !clientSecret) {
        throw new Error("TikTok Client ID or Client Secret not configured");
    }
    if (!currentTokens.refreshToken) {
        throw new Error(`No TikTok refresh token available for user ${userId}`);
    }

    try {
        const params = {
            client_key: clientId,
            client_secret: clientSecret,
            refresh_token: currentTokens.refreshToken,
            grant_type: "refresh_token"
        };
        const formBody = new URLSearchParams(params).toString();

        const response = await axios.post(tokenEndpoint, formBody, {
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

        await exports.storeTokens(userId, {
            accessToken: access_token,
            refreshToken: refresh_token || currentTokens.refreshToken,
            expiryTime: expiryTime,
            openId: open_id || currentTokens.openId
        });

        return access_token;

    } catch (error) {
        const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
        console.error(`Error refreshing TikTok token for user ${userId}:`, errorMsg);
        await exports.clearTokens(userId);
        throw new Error(`Failed to refresh TikTok token: ${errorMsg}. Please re-authenticate.`);
    }
};

exports.ensureValidToken = async (userId) => {
    const currentTokens = await getStoredTokens(userId);
    if (!currentTokens.accessToken || !currentTokens.refreshToken) {
        throw new Error('User not authenticated with TikTok or refresh token missing.');
    }

    const isTokenExpired = !currentTokens.expiryTime || Date.now() >= currentTokens.expiryTime;

    if (isTokenExpired) {
        return await exports.refreshAccessToken(userId);
    } else {
        return currentTokens.accessToken;
    }
};

exports.clearTokens = async (userId) => {
    if (!userId) {
        return;
    }
    try {
        await Token.deleteOne({ userId: userId, platform: PLATFORM });
    } catch (error) {
        console.error(`Error clearing TikTok tokens for user ${userId} from database:`, error);
    }
};