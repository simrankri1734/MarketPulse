import { NextFunction, Request, Response } from "express";
import { adminAuth } from "../config/firebaseAdmin.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}
export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
    name?: string;
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const idToken = authorization.substring("Bearer ".length);

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const authenticatedRequest = req as AuthenticatedRequest;

    authenticatedRequest.user = {
      uid: decodedToken.uid,
      email: decodedToken.email ?? "",
      name: decodedToken.name,
    };

    next();
  } catch (error) {
    console.error("Authentication verification failed:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}