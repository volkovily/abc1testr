const express = require('express');
const twitterController = require('../controllers/twitterController');
const { authenticateToken } = require('../lib/jwt');
const multer = require('multer');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 512 * 1024 * 1024 } });

router.get('/status', authenticateToken, twitterController.getStatus);
router.get('/userinfo', authenticateToken, twitterController.getUserInfo);
router.post('/upload', authenticateToken, upload.single('file'), twitterController.uploadToTwitter);

module.exports = router;
