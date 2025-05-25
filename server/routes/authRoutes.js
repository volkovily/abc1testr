const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../lib/jwt');

const router = express.Router();

router.get('/google', authController.initiateGoogleAuth);
router.get('/google/callback', authController.googleCallback);
router.post('/google/logout', authController.googleLogout);

router.get('/tiktok', authController.initiateTikTokAuth);
router.get('/tiktok/callback', authController.tikTokCallback);
router.post('/tiktok/logout', authController.tiktokLogout);

router.get('/facebook', authenticateToken, authController.initiateFacebookAuth);
router.get('/facebook/callback', authController.facebookCallback);
router.post('/facebook/logout', authenticateToken, authController.facebookLogout);

router.get('/twitter', authController.initiateTwitterAuth);
router.get('/twitter/callback', authController.twitterCallback);
router.post('/twitter/logout', authController.twitterLogout);

module.exports = router;