/**
 * shared-utils.d.ts — Type declarations for @momkidcare/shared-utils.
 *
 * The package is plain JavaScript with no bundled types.
 * Only the fields and models used by this backend are declared here.
 * Add more as new models are consumed.
 */
declare module '@momkidcare/shared-utils' {
  import { Model, Document } from 'mongoose';

  // ── VendorForm (mongoose model name: "vendor", collection: "vendors") ──────

  interface IVendorPersonalInformation {
    firstName?: string;
    lastName?: string;
    mobile?: string;
    email?: string;
  }

  interface IVendor extends Document {
    personalInformation: IVendorPersonalInformation;
  }

  export const VendorForm: Model<IVendor>;
}
