const express = require('express');
const multer = require('multer');
const youtubeController = require('../controllers/youtubeController');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/status', youtubeController.getStatus);
router.get('/channel', youtubeController.getChannel);
router.post('/upload', upload.single('videoFile'), youtubeController.uploadVideo);

module.exports = router;