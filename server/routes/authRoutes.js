const express = require('express');
const youtubeController = require('../controllers/youtubeController');
const tiktokController = require('../controllers/tiktokController');
const facebookController = require('../controllers/facebookController');
const twitterController = require('../controllers/twitterController');

const router = express.Router();

// Google/YouTube auth routes
router.get('/google', youtubeController.initiateAuth);
router.get('/google/callback', youtubeController.authCallback);
router.post('/google/logout', youtubeController.logout);

// TikTok auth routes
router.get('/tiktok', tiktokController.initiateAuth);
router.get('/tiktok/callback', tiktokController.authCallback);
router.post('/tiktok/logout', tiktokController.logout);

// Facebook auth routes
router.get('/facebook', facebookController.initiateAuth);
router.get('/facebook/callback', facebookController.authCallback);
router.post('/facebook/logout', facebookController.logout);

// Twitter auth routes
router.get('/twitter', twitterController.initiateAuth);
router.get('/twitter/callback', twitterController.authCallback);
router.post('/twitter/logout', twitterController.logout);

module.exports = router;
