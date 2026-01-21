import { Router, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads'
const dirs = ['', '/avatars', '/files'].map(d => path.join(uploadDir, d))
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// File upload config
const storage = multer.diskStorage({
  destination: path.join(uploadDir, 'files'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuid()}${ext}`)
  },
})

const maxSize = parseInt(process.env.MAX_FILE_SIZE || '52428800') // 50MB default

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Others
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  },
})

// Upload file
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR')
      }

      const { messageId } = req.body

      // Validate messageId if provided
      if (messageId) {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        })

        if (!message) {
          // Delete uploaded file
          fs.unlinkSync(req.file.path)
          throw new AppError('Message not found', 404, 'NOT_FOUND')
        }
      }

      const file = await prisma.file.create({
        data: {
          messageId: messageId || null,
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: `/uploads/files/${req.file.filename}`,
          uploadedById: req.userId!,
        },
      })

      res.status(201).json(file)
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path)
        } catch {
          // Ignore cleanup errors
        }
      }
      next(error)
    }
  }
)

// Upload multiple files
router.post(
  '/upload-multiple',
  authenticate,
  upload.array('files', 10),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[]

      if (!files || files.length === 0) {
        throw new AppError('No files uploaded', 400, 'VALIDATION_ERROR')
      }

      const { messageId } = req.body

      // Validate messageId if provided
      if (messageId) {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        })

        if (!message) {
          // Delete uploaded files
          files.forEach(f => {
            try { fs.unlinkSync(f.path) } catch { /* ignore */ }
          })
          throw new AppError('Message not found', 404, 'NOT_FOUND')
        }
      }

      const createdFiles = await Promise.all(
        files.map(f =>
          prisma.file.create({
            data: {
              messageId: messageId || null,
              filename: f.filename,
              originalName: f.originalname,
              mimeType: f.mimetype,
              size: f.size,
              url: `/uploads/files/${f.filename}`,
              uploadedById: req.userId!,
            },
          })
        )
      )

      res.status(201).json({ files: createdFiles })
    } catch (error) {
      // Clean up files on error
      const files = req.files as Express.Multer.File[]
      if (files) {
        files.forEach(f => {
          try { fs.unlinkSync(f.path) } catch { /* ignore */ }
        })
      }
      next(error)
    }
  }
)

// Get file info
router.get('/:fileId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.fileId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    })

    if (!file) {
      throw new AppError('File not found', 404, 'NOT_FOUND')
    }

    res.json(file)
  } catch (error) {
    next(error)
  }
})

// Delete file
router.delete('/:fileId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.fileId },
    })

    if (!file) {
      throw new AppError('File not found', 404, 'NOT_FOUND')
    }

    // Check permission
    if (file.uploadedById !== req.userId) {
      throw new AppError('Permission denied', 403, 'FORBIDDEN')
    }

    // Delete file from disk
    const filePath = path.join(uploadDir, 'files', file.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: req.params.fileId },
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
