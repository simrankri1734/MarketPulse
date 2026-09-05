import { Request, Response } from "express";
import { User } from "../models/User.js";
import { AuthenticatedRequest } from "../middleware/authMiddleware.js";

export async function getCurrentUser(
  req: Request,
  res: Response
) {
  try {
    const authenticatedRequest = req as AuthenticatedRequest;

    const { uid, email, name } = authenticatedRequest.user;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Authenticated user does not have an email"
      });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          email,
          ...(name ? { name } : {})
        }
      },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error("Failed to sync user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load user"
    });
  }
}