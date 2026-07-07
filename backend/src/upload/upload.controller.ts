import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Controller('api/upload')
export class UploadController {
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return {
      filename: file.filename,
      originalname: file.originalname,
      url: `/api/upload/${file.filename}`,
    };
  }

  @Get(':filename')
  download(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize: only allow filename (no path traversal)
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(UPLOAD_DIR, safe);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }
    res.download(filePath);
  }
}
