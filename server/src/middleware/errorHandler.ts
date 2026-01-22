import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  statusCode: number
  code: string
  details?: unknown

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err)

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    })
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  })
}
