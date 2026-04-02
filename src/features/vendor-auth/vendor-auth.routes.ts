import { Router } from 'express';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { sendOtpHandler, verifyOtpHandler } from './vendor-auth.controller';

const router = Router();

// POST /api/v1/vendor/auth/send-otp
router.post('/send-otp', authRateLimiter, sendOtpHandler);

// POST /api/v1/vendor/auth/verify-otp
router.post('/verify-otp', authRateLimiter, verifyOtpHandler);

export default router;
