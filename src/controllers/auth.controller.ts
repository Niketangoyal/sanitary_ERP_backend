import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/AppError";

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await authService.me(req.user.userId);
    res.json({ success: true, data: user });
  }),

  logout: asyncHandler(async (_req: Request, res: Response) => {
    // Stateless JWT: logout is handled client-side by discarding the token.
    res.json({ success: true, message: "Logged out" });
  }),
};
