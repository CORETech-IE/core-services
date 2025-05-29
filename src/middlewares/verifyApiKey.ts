import { Request, Response, NextFunction } from "express";
import config from "../config/envConfig";

export function verifyApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ error: "API key missing or invalid" });
  }

  if (apiKey !== config.logApiKey) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}
