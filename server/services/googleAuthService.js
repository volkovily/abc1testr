const { google } = require('googleapis');
const Token = require('../models/Token');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.BACKEND_REDIRECT_URI;

const PLATFORM = 'youtube';

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

exports.storeTokens = async (userId, { accessToken, refreshToken, expiryTime }) => {
    try {
        let token = await Token.findOne({ userId: userId, platform: PLATFORM });
        
        if (token) {
            token.accessToken = accessToken;
            if (refreshToken) {
                token.refreshToken = refreshToken;
            }
            token.expiryTime = expiryTime;
        } else {
            token = new Token({
                userId: userId,
                platform: PLATFORM,
                accessToken,
                refreshToken,
                expiryTime
            });
        }
        
        await token.save();
    } catch (error) {
        console.error(`Error storing YouTube tokens for user ${userId}:`, error);
        throw new Error("Failed to store authentication tokens");
    }
};

const getStoredTokens = async (userId) => {
    if (!userId) {
        return { accessToken: null, refreshToken: null, expiryTime: null };
    }
    try {
        const token = await Token.findOne({ userId: userId, platform: PLATFORM });
        
        if (!token) {
            return { accessToken: null, refreshToken: null, expiryTime: null };
        }
        
        return {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiryTime: token.expiryTime
        };
    } catch (error) {
        console.error(`Error retrieving YouTube tokens for user ${userId} from database:`, error);
        return { accessToken: null, refreshToken: null, expiryTime: null };
    }
};

const setOAuthCredentials = async (userId) => {
    const tokens = await getStoredTokens(userId);
    if (tokens.accessToken && tokens.refreshToken) {
        oauth2Client.setCredentials({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expiry_date: tokens.expiryTime,
        });
    } else {
        oauth2Client.setCredentials({});
    }
};

exports.ensureValidToken = async (userId) => {
    await setOAuthCredentials(userId);

    const currentTokens = await getStoredTokens(userId);
    if (!currentTokens.accessToken || !currentTokens.refreshToken) {
        throw new Error('User not authenticated with YouTube or refresh token missing.');
    }

    const isTokenExpired = !currentTokens.expiryTime || Date.now() >= currentTokens.expiryTime;

    if (isTokenExpired) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();

            await exports.storeTokens(userId, {
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token || currentTokens.refreshToken,
                expiryTime: credentials.expiry_date
            });

            oauth2Client.setCredentials(credentials);

        } catch (refreshError) {
            await exports.clearTokens(userId);
            oauth2Client.setCredentials({});
            throw new Error('Failed to refresh YouTube token. Please re-authenticate.');
        }
    }

    if (!oauth2Client.credentials.access_token) {
        throw new Error('Missing access token after check/refresh.');
    }

    return oauth2Client;
};

exports.checkTokenStatus = async (userId) => {
    const tokens = await getStoredTokens(userId);
    const isAuthenticated = !!tokens.accessToken && (!tokens.expiryTime || tokens.expiryTime > Date.now());
    return { isAuthenticated };
};

exports.clearTokens = async (userId) => {
    if (!userId) {
        return;
    }
    try {
        await Token.deleteOne({ userId: userId, platform: PLATFORM });
    } catch (error) {
        console.error(`Error clearing YouTube tokens for user ${userId} from database:`, error);
    }
};

exports.getOAuth2Client = () => oauth2Client;