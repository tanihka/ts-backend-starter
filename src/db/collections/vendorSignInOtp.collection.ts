import type { Db } from 'mongodb';

export async function setupVendorSignInOtpCollection(db: Db): Promise<void> {
  const collectionName = 'vendorSignInOtp';
  const collections = await db.listCollections({ name: collectionName }).toArray();

  if (collections.length === 0) {
    await db.createCollection(collectionName, {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['mobile', 'otp', 'createdAt', 'expiryAt'],
          properties: {
            mobile:    { bsonType: 'string' },
            otp:       { bsonType: 'string' },
            createdAt: { bsonType: 'date' },
            expiryAt:  { bsonType: 'date' },
          },
        },
      },
    });
  }

  // TTL index — MongoDB auto-deletes the document when expiryAt is reached.
  await db.collection(collectionName).createIndex(
    { expiryAt: 1 },
    { expireAfterSeconds: 0, name: 'ttl_expiryAt' }
  );
}