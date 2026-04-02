import { ObjectId } from 'mongodb';

/** Shape of the personalInformation sub-document we query on. */
export interface VendorPersonalInformation {
  mobile: string;
}

/** Minimal vendor shape — only fields this feature needs. */
export interface Vendor {
  _id: ObjectId;
  personalInformation: VendorPersonalInformation;
}

/** Document stored in the `vendorSignInOtp` collection. */
export interface VendorOtpRecord {
  mobile: string;
  otp: string;
  createdAt: Date;
  expiryAt: Date;
}
