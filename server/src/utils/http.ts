import { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Wrap async route handlers so rejected promises reach the error middleware.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
