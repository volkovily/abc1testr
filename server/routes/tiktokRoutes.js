const express = require('express');
const router = express.Router();
const tiktokController = require('../controllers/tiktokController');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage, 
    limits: { 
        fileSize: 50 * 1024 * 1024
    }
}); 

router.get('/status', tiktokController.getStatus);
router.get('/userinfo', tiktokController.getUserInfo);
router.post('/upload', upload.single('videoFile'), tiktokController.uploadVideo);

module.exports = router; 