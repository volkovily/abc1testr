const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/login/google', userController.initiateGoogleAuth);
router.get('/login/google/callback', userController.googleCallback);
router.get('/profile', userController.getCurrentUser);

module.exports = router;
