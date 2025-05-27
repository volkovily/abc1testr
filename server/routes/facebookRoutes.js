const express = require('express');
const facebookController = require('../controllers/facebookController');
const router = express.Router();
const multer = require('multer');

// No need to import authenticateToken as it's now handled in the controller
// const { authenticateToken } = require('../lib/jwt');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

router.get('/status', facebookController.getStatus);
router.get('/userinfo', facebookController.getUserInfo);
router.get('/pages', facebookController.getPages);
// Remove authenticateToken middleware as it's now included in the controller
router.post('/upload', upload.single('videoFile'), facebookController.uploadVideo);
router.post('/photo', upload.single('photo'), facebookController.uploadPhoto);
router.post('/post', facebookController.createPost);

module.exports = router;
