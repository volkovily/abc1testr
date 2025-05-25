const express = require('express');
const facebookController = require('../controllers/facebookController');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../lib/jwt');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

router.get('/status', facebookController.getStatus);
router.get('/userinfo', facebookController.getUserInfo);
router.get('/pages', facebookController.getPages);
router.post('/upload', authenticateToken, upload.single('videoFile'), facebookController.uploadVideo);
router.post('/photo', authenticateToken, upload.single('photo'), facebookController.uploadPhoto);
router.post('/post', authenticateToken, facebookController.createPost);

module.exports = router;