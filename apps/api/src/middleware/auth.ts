import { Request, Response, NextFunction } from "express";
import { auth } from "../firebase.js";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice(7);

  try {
    const decoded = await auth.verifyIdToken(token);

    if (!decoded.email_verified) {
      res.status(403).json({ error: "Email not verified" });
      return;
    }

    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error("Auth token verification failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
