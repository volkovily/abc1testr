const BaseController = require('./baseController');
const userAuthService = require('../services/userAuthService');
const { generateToken, generateRefreshToken } = require('../lib/jwt');
const User = require('../models/User');

class UserController extends BaseController {
  constructor() {
    super(userAuthService);
  }

  sendPopupResponse(res, messageType, data) {
    res.send(`
      <script>
        window.opener.postMessage(${JSON.stringify({ type: messageType, ...data })}, "*");
        window.close();
      </script>
      <p>${messageType.endsWith('_SUCCESS') ? 'Authentication successful' : 'Authentication failed'}</p>
    `);
  }

  initiateGoogleAuth = (req, res) => {
    try {
      const authUrl = this.service.getGoogleAuthUrl();
      res.redirect(authUrl);
    } catch (error) {
      this.handleError(error, res, 'unknown', 'initiating Google authentication');
    }
  };

  googleCallback = async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      return this.sendPopupResponse(res, 'USER_AUTH_ERROR', { error });
    }

    if (!code) {
      return this.sendPopupResponse(res, 'USER_AUTH_ERROR', { error: 'Authorization code missing' });
    }

    try {
      const { user, tokens } = await this.service.handleGoogleCallback(code);
      
      const accessToken = generateToken(user);
      const refreshToken = generateRefreshToken(user);
      
      this.sendPopupResponse(res, 'USER_AUTH_SUCCESS', { 
        user,
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Error in Google callback:', error);
      this.sendPopupResponse(res, 'USER_AUTH_ERROR', { error: error.message || 'Authentication failed' });
    }
  };

  getCurrentUser = async (req, res) => {
    try {
      const userId = req.user.userId;
      const user = await this.service.getUserById(userId);
      
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
      this.handleError(error, res, req.user.userId, 'getting current user', 404);
    }
  };

  updateUserProfile = async (req, res) => {
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
      this.handleError(error, res, req.user.userId, 'updating user profile');
    }
  };

  logoutUser = async (req, res) => {
    try {
      const userId = req.user.userId;
      await this.service.logoutUser(userId);
      
      res.status(200).json({ message: 'Successfully logged out' });
    } catch (error) {
      this.handleError(error, res, req.user.userId, 'logging out user');
    }
  };
}

// Create controller instance
const userController = new UserController();

module.exports = {
  initiateGoogleAuth: userController.initiateGoogleAuth,
  googleCallback: userController.googleCallback,
  getCurrentUser: userController.protected(userController.getCurrentUser),
  updateUserProfile: userController.protected(userController.updateUserProfile),
  logoutUser: userController.protected(userController.logoutUser)
};
