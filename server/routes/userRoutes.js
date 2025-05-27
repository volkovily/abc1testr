const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/login/google', userController.initiateGoogleAuth);
router.get('/login/google/callback', userController.googleCallback);

// Remove authenticateToken middleware as it's now included in the controller
router.get('/profile', userController.getCurrentUser);
router.put('/profile', userController.updateUserProfile);
router.post('/logout', userController.logoutUser);

module.exports = router;
