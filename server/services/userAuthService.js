const { google } = require('googleapis');
const User = require('../models/User');

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const userAuthRedirectUri = process.env.USER_AUTH_REDIRECT_URI;

const userAuthClient = new google.auth.OAuth2(clientId, clientSecret, userAuthRedirectUri);

exports.getGoogleAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
    'profile',
    'email'
  ];

  return userAuthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    include_granted_scopes: true
  });
};

exports.handleGoogleCallback = async (code) => {
  try {
    const { tokens } = await userAuthClient.getToken(code);
    userAuthClient.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: userAuthClient });
    const { data } = await oauth2.userinfo.get();
    
    let user = await User.findOne({ googleId: data.id });
    
    if (user) {
      user.name = data.name;
      user.firstName = data.given_name;
      user.lastName = data.family_name;
      user.profilePicture = data.picture;
      user.accessToken = tokens.access_token;
      user.lastLogin = new Date();
      
      if (tokens.refresh_token) {
        user.refreshToken = tokens.refresh_token;
      }
      
      if (tokens.expiry_date) {
        user.expiryTime = tokens.expiry_date;
      }
    } else {
      user = new User({
        googleId: data.id,
        email: data.email,
        name: data.name,
        firstName: data.given_name,
        lastName: data.family_name,
        profilePicture: data.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryTime: tokens.expiry_date,
      });
    }
    
    await user.save();
    
    return {
      user: {
        id: user._id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role
      },
      tokens
    };
  } catch (error) {
    console.error('Error handling Google callback:', error);
    throw new Error('Failed to authenticate with Google');
  }
};

exports.getUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    return {
      id: user._id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      role: user.role
    };
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

exports.refreshUserToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.refreshToken) {
      throw new Error('User not found or missing refresh token');
    }
    
    const isTokenExpired = !user.expiryTime || Date.now() >= user.expiryTime - (5 * 60 * 1000);
    
    if (isTokenExpired) {
      userAuthClient.setCredentials({
        refresh_token: user.refreshToken
      });
      
      const { credentials } = await userAuthClient.refreshAccessToken();
      
      user.accessToken = credentials.access_token;
      if (credentials.refresh_token) {
        user.refreshToken = credentials.refresh_token;
      }
      user.expiryTime = credentials.expiry_date;
      
      await user.save();
    }
    
    return {
      accessToken: user.accessToken,
      expiryTime: user.expiryTime
    };
  } catch (error) {
    console.error('Error refreshing user token:', error);
    throw error;
  }
};

exports.logoutUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    user.accessToken = null;
    user.expiryTime = null;
    
    await user.save();
    
    return { success: true };
  } catch (error) {
    console.error('Error logging out user:', error);
    throw error;
  }
};