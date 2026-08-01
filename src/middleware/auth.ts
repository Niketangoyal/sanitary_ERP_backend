import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyToken } from "../utils/jwt";

export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing or invalid authorization header");
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyToken(token);
  } catch {
    throw AppError.unauthorized("Session expired, please log in again");
  }

  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw AppError.forbidden("You do not have permission to perform this action");
    }
    next();
  };
};
