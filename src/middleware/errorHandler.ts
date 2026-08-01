import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: `Duplicate value for ${(err.meta?.target as string[])?.join(", ") ?? "field"}`,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        success: false,
        message: "This record is referenced by other data and cannot be modified",
      });
    }
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    stack: env.NODE_ENV === "development" && err instanceof Error ? err.stack : undefined,
  });
};
