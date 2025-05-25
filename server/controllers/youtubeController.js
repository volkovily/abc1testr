const { google } = require('googleapis');
const stream = require('stream');
const { ensureValidToken } = require('../services/googleAuthService');
const { authenticateToken } = require('../lib/jwt');

// Get Authentication Status
// Protect this route
exports.getStatus = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Pass userId to the service function
    const tokenStatus = await ensureValidToken(userId);
    // If ensureValidToken doesn't throw, we consider it authenticated for status check
    res.json({ isAuthenticated: true });
  } catch (error) {
    // If ensureValidToken throws (e.g., no refresh token, refresh failed), user is not authenticated
    console.warn(`Status check failed for user ${userId}:`, error.message);
    res.json({ isAuthenticated: false });
  }
}];

// Get Channel Info
// Protect this route
exports.getChannel = [authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Pass userId to the service function
    const authenticatedClient = await ensureValidToken(userId); // Ensures valid token, refreshes if needed
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
    console.error(`Error fetching YouTube channel info for user ${userId}:`, error.response ? error.response.data : error.message);
    if (error.message?.includes('re-authenticate')) {
        res.status(401).json({ error: error.message });
    } else {
        res.status(500).json({ error: error.message || 'An unknown error occurred while fetching channel info.' });
    }
  }
}];

// Upload Video
// Protect this route (assuming multer middleware is applied before authenticateToken in the route definition)
exports.uploadVideo = [authenticateToken, async (req, res) => {
    const userId = req.user.userId;
  try {
    // Pass userId to the service function
    const authenticatedClient = await ensureValidToken(userId); // Ensures valid token

    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const { title, description, tags, visibility, scheduledDate } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Video title is required.' });
    }

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
      // Validate the date string format before assigning (basic check)
      if (isNaN(Date.parse(scheduledDate))) { // Check if the date string is parsable
          console.error("Invalid scheduledDate format received:", scheduledDate);
          // Don't set publishAt, it will upload as private (already set above)
          console.warn("Proceeding with private upload due to invalid schedule date format.");
      } else {
          // Assign the ISO string directly to publishAt
          metadata.status.publishAt = scheduledDate;
          console.log(`Scheduling video for: ${scheduledDate}`);
      }
    } else if (visibility === 'scheduled' && !scheduledDate) {
        // If visibility is 'scheduled' but no date string came through, log warning.
        // privacyStatus is already set to 'private' above.
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
      videoUrl: `https://www.youtube.com/watch?v=${youtubeResponse.data.id}`,
    });

  } catch (error) {
    console.error(`Error during YouTube upload for user ${userId}:`, error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message || 'An unknown error occurred during YouTube upload.' });
  }
}];