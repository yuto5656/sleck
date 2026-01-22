import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'

// Speed limiter - gradually slow down responses after threshold
// After 30 requests, add 500ms delay per request
export const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 30, // Start slowing after 30 requests
  delayMs: (hits) => hits * 500, // Add 500ms * number of hits over limit
  maxDelayMs: 10000, // Max delay of 10 seconds
})

// General API rate limiter - 60 requests per minute per IP
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエストが多すぎます。しばらくしてから再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
})

// Strict rate limiter for auth endpoints - 5 requests per minute per IP
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'ログイン試行回数が多すぎます。1分後に再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Very strict limiter for registration - 3 requests per 5 minutes per IP
export const registrationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '登録リクエストが多すぎます。5分後に再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Burst limiter - very short window to prevent rapid fire requests
// 10 requests per 10 seconds
export const burstLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエストが速すぎます。少し待ってから再試行してください。',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})
