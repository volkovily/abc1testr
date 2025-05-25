const express = require('express');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../lib/jwt');

const router = express.Router();

router.get('/login/google', userController.initiateGoogleAuth);
router.get('/login/google/callback', userController.googleCallback);

router.get('/profile', authenticateToken, userController.getCurrentUser);
router.put('/profile', authenticateToken, userController.updateUserProfile);
router.post('/logout', authenticateToken, userController.logoutUser);

module.exports = router; 