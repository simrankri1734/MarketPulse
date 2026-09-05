import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    name: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model<IUser>("User", userSchema);