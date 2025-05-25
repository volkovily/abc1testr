const userAuthService = require('../services/userAuthService');
const { generateToken, generateRefreshToken } = require('../lib/jwt');
const User = require('../models/User');

const sendPopupResponse = (res, messageType, data) => {
  res.send(`
    <script>
      window.opener.postMessage(${JSON.stringify({ type: messageType, ...data })}, "*");
      window.close();
    </script>
    <p>${messageType.endsWith('_SUCCESS') ? 'Authentication successful' : 'Authentication failed'}</p>
  `);
};

exports.initiateGoogleAuth = (req, res) => {
  try {
    const authUrl = userAuthService.getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google auth:', error);
    res.status(500).json({ error: 'Failed to initiate Google authentication' });
  }
};

exports.googleCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return sendPopupResponse(res, 'USER_AUTH_ERROR', { error });
  }

  if (!code) {
    return sendPopupResponse(res, 'USER_AUTH_ERROR', { error: 'Authorization code missing' });
  }

  try {
    const { user, tokens } = await userAuthService.handleGoogleCallback(code);
    
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    sendPopupResponse(res, 'USER_AUTH_SUCCESS', { 
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Error in Google callback:', error);
    sendPopupResponse(res, 'USER_AUTH_ERROR', { error: error.message || 'Authentication failed' });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await userAuthService.getUserById(userId);
    
    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(404).json({ error: error.message || 'User not found' });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (name) user.name = name;
    await user.save();
    
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    await userAuthService.logoutUser(userId);
    
    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    console.error('Error logging out user:', error);
    res.status(500).json({ error: error.message || 'Logout failed' });
  }
}; 