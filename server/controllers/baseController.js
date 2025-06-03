const { authenticateToken } = require('../lib/jwt');

const frontendOrigin = process.env.FRONTEND_URL;

class BaseController {
  constructor(service) {
    this.service = service;
    this.authenticateToken = authenticateToken;
  }

  protected(handler) {
    return [this.authenticateToken, handler];
  }

  handleError(error, res, userId, operation, statusCode = 500) {
    console.error(`Error ${operation} for user ${userId}:`, error.response ? error.response.data : error.message);
    
    if (error.message?.includes('re-authenticate') || 
        error.message?.includes('token') || 
        error.message?.includes('authentication') ||
        statusCode === 401) {
      return res.status(401).json({ error: `Authentication error: ${error.message}. Please reconnect.` });
    }
    
    return res.status(statusCode).json({ 
      error: error.response?.data?.error?.message || error.message || 'An unknown error occurred' 
    });
  }

  getStatus = async (req, res) => {
    const userId = req.user.userId;
    try {
      await this.service.ensureValidToken(userId);
      return res.status(200).json({ isAuthenticated: true });
    } catch (error) {
      console.log(`Auth check failed for user ${userId}:`, error.message);
      return res.status(200).json({ isAuthenticated: false });
    }
  };

  getUserInfo = async (req, res) => {
    const userId = req.user.userId;
    try {
      const profile = await this.service.getUserInfo(userId);
      res.json({ user: profile });
    } catch (error) {
      this.handleError(error, res, userId, `fetching user info`, 500);
    }
  };

  logout = async (req, res) => {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }
    try {
      await this.service.clearTokens(userId);
      console.log(`Successfully cleared tokens from database for user ${userId}.`);
      res.status(200).json({ success: true, message: 'Successfully logged out.' });
    } catch (err) {
      this.handleError(err, res, userId, 'logout');
    }
  };

  validateRequiredFields(req, res, requiredFields) {
    for (const field of requiredFields) {
      if (field === 'file' && !req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return false;
      } else if (field !== 'file' && (!req.body[field] || req.body[field].trim() === '')) {
        res.status(400).json({ error: `${field} is required.` });
        return false;
      }
    }
    return true;
  }

  /**
   * Sends a standardized popup response for OAuth callbacks
   */
  sendPopupResponse(res, messageType, data) {
    const scriptContent = `
        if(window.opener) {
            window.opener.postMessage(${JSON.stringify({ type: messageType, ...data })}, '${frontendOrigin}');
        } else { console.error("window.opener not found!"); }
        window.close();
    `;
    const htmlBody = messageType.endsWith('_SUCCESS')
        ? `<h1>Authentication Success</h1><p>Closing...</p>`
        : `<h1>Authentication Error</h1><p>${data.error || 'Unknown error'}. Closing...</p>`;
    res.status(messageType.endsWith('_SUCCESS') ? 200 : 400).send(
        `<!DOCTYPE html><html><head><title>Auth</title></head><body><script>${scriptContent}</script>${htmlBody}</body></html>`
    );
  }

  /**
   * Validates and extracts user ID from OAuth state parameter
   */
  extractUserIdFromState(state) {
    if (!state) {
      return { error: 'State parameter missing' };
    }
    
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      if (!stateData.userId) {
        return { error: 'userId missing in state' };
      }
      return { userId: stateData.userId };
    } catch (error) {
      return { error: 'Invalid state parameter' };
    }
  }

  /**
   * Creates a state parameter for OAuth flows
   */
  createStateParameter(userId) {
    const stateData = JSON.stringify({ 
      userId: userId, 
      nonce: Math.random().toString(36).substring(7) 
    });
    return Buffer.from(stateData).toString('base64');
  }
}

module.exports = BaseController;
