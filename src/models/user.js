import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "please enter a valid email address"
      ]
    },

    password: {
      type: String,
      default: ""
    },

    googleId: {
      type: String,
      default: ""
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local"
    },

    avatar: {
      type: String,
      default: ""
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    isActive: {
      type: Boolean,
      default: true
    },

    resetPasswordToken: {
      type: String,
      default: ""
    },

    resetPasswordExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;