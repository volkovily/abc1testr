require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./lib/database');

const authRoutes = require('./routes/authRoutes');
const youtubeRoutes = require('./routes/youtubeRoutes');
const tiktokRoutes = require('./routes/tiktokRoutes');
const userRoutes = require('./routes/userRoutes');
const facebookRoutes = require('./routes/facebookRoutes');
const twitterRoutes = require('./routes/twitterRoutes');

const app = express();
const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';

const frontendOrigin = process.env.FRONTEND_URL;

app.use(cors({
  origin: frontendOrigin,
  credentials: true
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/tiktok', tiktokRoutes);
app.use('/api/users', userRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/twitter', twitterRoutes);

async function startServer() {
  try {
    await connectToDatabase();
    app.listen(port, host, () => {
      console.log(`Backend server running on http://${host}:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();