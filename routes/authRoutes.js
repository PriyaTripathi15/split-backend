import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import { register, login,googleLogin,forgotPassword,resetPassword,updateProfile,getProfile} from '../controllers/authController.js';

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
export default router;