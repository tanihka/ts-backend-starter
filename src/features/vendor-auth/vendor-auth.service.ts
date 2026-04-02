import axios from 'axios';
import { VendorForm } from '@momkidcare/shared-utils';
import { getDB } from '../../config/db';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import type { VendorOtpRecord } from './vendor-auth.types';

const OTP_COLLECTION = 'vendorSignInOtp';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Looks up the vendor by mobile number, generates a 6-digit OTP,
 * sends it via 2Factor SMS, and upserts the record into `vendorSignInOtp`.
 */
export async function sendVendorOtp(mobile: string): Promise<void> {
  const db = getDB();

  // 1. Confirm the mobile belongs to a registered vendor.
  const vendor = await VendorForm.findOne({ 'personalInformation.mobile': mobile});

  if (!vendor) {
    throw new ApiError(404, 'No vendor account found with this mobile number.');
  }

  // 2. Generate a 6-digit OTP.
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  // 3. Deliver via 2Factor Transactional SMS.
  const formData = new FormData();
  formData.append('From', env.TWO_FACTOR_SENDER_ID);
  formData.append('To', mobile);
  formData.append('TemplateName', env.TWO_FACTOR_TEMPLATE_NAME);
  formData.append('VAR1', otp);

  const url = `https://2factor.in/API/V1/${env.TWO_FACTOR_API_KEY}/ADDON_SERVICES/SEND/TSMS`;

  const response = await axios.post<{ Status: string }>(url, formData);

  if (response.data.Status !== 'Success') {
    logger.error({ mobile, status: response.data.Status }, 'OTP delivery failed');
    throw new ApiError(502, 'Failed to deliver OTP. Please try again.');
  }

  // 4. Upsert the OTP so any previous unsued OTP is overwritten.
  await db
    .collection<VendorOtpRecord>(OTP_COLLECTION)
    .updateOne(
      { mobile },
      { $set: { otp, createdAt: new Date(), expiryAt: new Date(Date.now() + OTP_EXPIRY_MS) } },
      { upsert: true }
    );

  logger.info({ mobile }, 'Vendor OTP sent');
}

/**
 * Validates the OTP submitted by the vendor.
 * Throws ApiError for expired or incorrect OTPs.
 * Deletes the record on success so each OTP is single-use.
 */
export async function verifyVendorOtp(mobile: string, otp: string): Promise<void> {
  const db = getDB();

  const record = await db
    .collection<VendorOtpRecord>(OTP_COLLECTION)
    .findOne({ mobile });

  if (!record) {
    throw new ApiError(400, 'OTP not found. Please request a new one.');
  }

  if (record.expiryAt < new Date()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  if (record.otp !== otp) {
    throw new ApiError(400, 'Invalid OTP.');
  }

  // Delete after use — each OTP is single-use.
  await db.collection(OTP_COLLECTION).deleteOne({ mobile });

  logger.info({ mobile }, 'Vendor OTP verified');
}
