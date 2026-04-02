import { Request, Response, NextFunction } from 'express';
import { sendVendorOtp, verifyVendorOtp } from './vendor-auth.service';
import { successResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';

/** POST /api/v1/vendor/auth/send-otp — { mobile } */
export async function sendOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { mobile } = req.body as { mobile?: unknown };

    if (typeof mobile !== 'string' || !/^[6-9]\d{9}$/.test(mobile)) {
      throw new ApiError(400, 'A valid 10-digit Indian mobile number is required.');
    }

    await sendVendorOtp(mobile);

    res.status(200).json(successResponse('OTP sent successfully.'));
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/vendor/auth/verify-otp — { mobile, otp } */
export async function verifyOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { mobile, otp } = req.body as { mobile?: unknown; otp?: unknown };

    if (typeof mobile !== 'string' || !/^[6-9]\d{9}$/.test(mobile)) {
      throw new ApiError(400, 'A valid 10-digit Indian mobile number is required.');
    }

    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      throw new ApiError(400, 'OTP must be a 6-digit number.');
    }

    await verifyVendorOtp(mobile, otp);

    res.status(200).json(successResponse('OTP verified successfully.'));
  } catch (err) {
    next(err);
  }
}
