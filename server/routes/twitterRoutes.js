const express = require('express');
const twitterController = require('../controllers/twitterController');
const multer = require('multer');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 512 * 1024 * 1024 } });

// Remove authenticateToken middleware as it's now included in the controller
router.get('/status', twitterController.getStatus);
router.get('/userinfo', twitterController.getUserInfo);
router.post('/upload', upload.single('file'), twitterController.uploadToTwitter);

module.exports = router;
