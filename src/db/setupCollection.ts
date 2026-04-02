import type { Db } from 'mongodb';
import { setupVendorSignInOtpCollection } from './collections/vendorSignInOtp.collection';

export async function setupCollections(db: Db): Promise<void> {
  await setupVendorSignInOtpCollection(db);
  // Add more collection setups here as the app grows.
}