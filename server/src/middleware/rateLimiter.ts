import rateLimit from 'express-rate-limit'

// General API rate limiter - 100 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエストが多すぎます。しばらくしてから再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict rate limiter for auth endpoints - 10 requests per minute per IP
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'ログイン試行回数が多すぎます。しばらくしてから再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Very strict limiter for sensitive operations - 5 requests per minute per IP
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエストが多すぎます。しばらくしてから再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})
