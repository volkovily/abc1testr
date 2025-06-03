const { google } = require('googleapis');
const stream = require('stream');
const axios = require('axios');
const { URLSearchParams } = require('url');
const BaseController = require('./baseController');
const youtubeAuthService = require('../services/youtubeAuthService');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_BACKEND_REDIRECT_URI;

const YOUTUBE_API = {
  AUTH: (params) => `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  TOKEN: 'https://oauth2.googleapis.com/token',
  VIDEO_URL: (videoId) => `https://www.youtube.com/watch?v=${videoId}`
};

class YouTubeController extends BaseController {
  constructor() {
    super(youtubeAuthService);
  }

  initiateAuth = async (req, res) => {
    if (!GOOGLE_CLIENT_ID || !YOUTUBE_REDIRECT_URI) {
      return res.status(500).json({ error: 'Google credentials or redirect URI not configured on backend.' });
    }
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    const state = this.createStateParameter(userId);
    console.log(`Initiating YouTube Auth for user ${userId} with state: ${state}`);

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly'
    ];
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: YOUTUBE_REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state
    });
    const authUrl = YOUTUBE_API.AUTH(params);
    res.status(200).json({ authUrl });
  };

  authCallback = async (req, res) => {
    const { code, error, state } = req.query;
    let userId;

    if (state) {
      const result = this.extractUserIdFromState(state);
      if (result.error) {
        console.error(`YouTube OAuth Error: ${result.error}`);
        return this.sendPopupResponse(res, 'YT_AUTH_ERROR', { error: result.error });
      }
      userId = result.userId;
      console.log(`YouTube Callback: Extracted userId ${userId} from state`);
    } else {
      console.error('YouTube OAuth Error: State parameter missing.');
      return this.sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'State parameter missing' });
    }

    if (error) {
      console.error('YouTube OAuth Error:', error);
      return this.sendPopupResponse(res, 'YT_AUTH_ERROR', { error });
    }

    if (!code) {
      console.error('Authorization code missing from YouTube callback.');
      return this.sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Authorization code missing' });
    }


    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !YOUTUBE_REDIRECT_URI) {
      console.error('Google credentials or redirect URI not configured on backend.');
      return this.sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Backend configuration error' });
    }

    try {
      const tokenResponse = await axios.post(YOUTUBE_API.TOKEN, new URLSearchParams({
        code: code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: YOUTUBE_REDIRECT_URI,
        grant_type: 'authorization_code'
      }));

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      if (!access_token) {
        throw new Error("Access token missing in Google's response.");
      }

      await this.service.storeTokens(userId, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiryTime: Date.now() + expires_in * 1000
      });

      console.log(`Successfully obtained and stored YouTube tokens for user ${userId}.`);
      this.sendPopupResponse(res, 'YT_AUTH_SUCCESS', { platform: 'YouTube' });

    } catch (err) {
      console.error(`Error exchanging YouTube code for tokens for user ${userId}:`, err.response ? err.response.data : err.message);
      this.sendPopupResponse(res, 'YT_AUTH_ERROR', { error: 'Token exchange failed' });
    }
  };

  getChannel = async (req, res) => {
    const userId = req.user.userId;
    try {
      // Pass userId to the service function
      const authenticatedClient = await this.service.ensureValidToken(userId);
      const youtube = google.youtube({ version: 'v3', auth: authenticatedClient });

      const response = await youtube.channels.list({
        part: 'snippet',
        mine: true,
        maxResults: 1
      });

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        const snippet = channel.snippet;
        const channelInfo = {
          id: channel.id,
          title: snippet.title,
          thumbnailUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || null
        };
        res.status(200).json(channelInfo);
      } else {
        res.status(404).json({ error: 'No YouTube channel found for the authenticated user.' });
      }
    } catch (error) {
      this.handleError(error, res, userId, 'fetching YouTube channel info');
    }
  };

  uploadVideo = async (req, res) => {
    const userId = req.user.userId;
    try {
      const authenticatedClient = await this.service.ensureValidToken(userId);

      if (!this.validateRequiredFields(req, res, ['file', 'title'])) {
        return;
      }

      const { title, description, tags, visibility, scheduledDate } = req.body;

      const metadata = {
        snippet: {
          title: title,
          description: description || '',
          tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        },
        status: {
          // Set initial privacy status. If scheduling, it MUST be private first.
          privacyStatus: (visibility === 'scheduled') ? 'private' : (visibility || 'private'),
        },
      };

      // Handle scheduling ONLY if visibility is 'scheduled' and a date was provided
      if (visibility === 'scheduled' && scheduledDate) {
        if (isNaN(Date.parse(scheduledDate))) {
            console.error("Invalid scheduledDate format received:", scheduledDate);
            console.warn("Proceeding with private upload due to invalid schedule date format.");
        } else {
            metadata.status.publishAt = scheduledDate;
            console.log(`Scheduling video for: ${scheduledDate}`);
        }
      } else if (visibility === 'scheduled' && !scheduledDate) {
          console.warn("Visibility was 'scheduled' but no valid date provided in request body. Uploading as private.");
      }

      console.log(`Uploading to YouTube for user ${userId} with metadata:`, metadata);

      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);

      const youtube = google.youtube({ version: 'v3', auth: authenticatedClient });

      const youtubeResponse = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: metadata,
          media: {
            mimeType: req.file.mimetype,
            body: bufferStream,
          },
        });

      console.log(`YouTube upload successful for user ${userId}:`, youtubeResponse.data);

      res.status(200).json({
        message: 'Successfully uploaded to YouTube!',
        videoId: youtubeResponse.data.id,
        videoUrl: YOUTUBE_API.VIDEO_URL(youtubeResponse.data.id),
      });

    } catch (error) {
      this.handleError(error, res, userId, 'YouTube upload');
    }
  };
}

// Create controller instance
const youtubeController = new YouTubeController();

// Export controller methods with authentication middleware
module.exports = {
  getStatus: youtubeController.protected(youtubeController.getStatus),
  getChannel: youtubeController.protected(youtubeController.getChannel),
  uploadVideo: youtubeController.protected(youtubeController.uploadVideo),
  initiateAuth: youtubeController.protected(youtubeController.initiateAuth),
  authCallback: youtubeController.authCallback,
  logout: youtubeController.protected(youtubeController.logout)
};
