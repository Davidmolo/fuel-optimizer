import { model, Schema } from "mongoose";

export type CustomerDocument = {
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const customerSchema = new Schema<CustomerDocument>(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const CustomerModel = model<CustomerDocument>("Customer", customerSchema);
