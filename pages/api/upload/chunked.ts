import { NextApiRequest, NextApiResponse } from 'next';
import { 
  initChunkedUpload, 
  uploadChunk, 
  completeChunkedUpload,
  abortChunkedUpload 
} from '@/lib/minio/client';
import { currentProfilePages } from '@/lib/current-profile-pages';
import { withRateLimit, rateLimitPresets } from '@/lib/rate-limit';

/**
 * API: Chunked Upload for large files (> 50MB)
 * Rate limit: 5 uploads per 5 minutes (heavy operation)
 * 
 * POST /api/upload/chunked?action=init - Initialize upload
 * POST /api/upload/chunked?action=upload - Upload chunk
 * POST /api/upload/chunked?action=complete - Complete upload
 * POST /api/upload/chunked?action=abort - Abort upload
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Auth check
    const profile = await currentProfilePages(req);
    if (!profile) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action } = req.query;

    // ========== INITIALIZE UPLOAD ==========
    if (action === 'init') {
      const { fileName, fileSize, fileType } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: 'File name is required' });
      }

      // Only allow chunked upload for files > 10MB
      const minSize = 10 * 1024 * 1024; // 10MB
      if (fileSize && fileSize < minSize) {
        return res.status(400).json({ 
          error: 'File too small for chunked upload. Use regular upload.',
          minSize
        });
      }

      // Max 500MB per file
      const maxSize = 500 * 1024 * 1024;
      if (fileSize && fileSize > maxSize) {
        return res.status(400).json({ 
          error: 'File too large',
          maxSize 
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFileName = `${profile.id}/${timestamp}-${sanitizedName}`;

      // Initialize multipart upload
      const { uploadId, sessionId } = await initChunkedUpload(uniqueFileName);

      // Calculate recommended chunk size (5MB default)
      const chunkSize = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(fileSize / chunkSize);

      return res.status(200).json({
        uploadId,
        sessionId,
        fileName: uniqueFileName,
        chunkSize,
        totalChunks,
        publicUrl: `${process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT}/${uniqueFileName}`
      });
    }

    // ========== UPLOAD CHUNK ==========
    if (action === 'upload') {
      const { uploadId, fileName, partNumber, chunkData } = req.body;

      if (!uploadId || !fileName || !partNumber || !chunkData) {
        return res.status(400).json({ 
          error: 'Missing required fields: uploadId, fileName, partNumber, chunkData' 
        });
      }

      // Decode base64 chunk data
      const buffer = Buffer.from(chunkData, 'base64');

      // Upload chunk
      const result = await uploadChunk(
        process.env.MINIO_BUCKET_NAME || 'discord-files',
        fileName,
        uploadId,
        partNumber,
        buffer
      );

      return res.status(200).json({
        success: true,
        partNumber: result.partNumber,
        etag: result.etag
      });
    }

    // ========== COMPLETE UPLOAD ==========
    if (action === 'complete') {
      const { uploadId, fileName, parts } = req.body;

      if (!uploadId || !fileName || !parts || !Array.isArray(parts)) {
        return res.status(400).json({ 
          error: 'Missing required fields: uploadId, fileName, parts' 
        });
      }

      // Complete multipart upload
      const fileUrl = await completeChunkedUpload(
        process.env.MINIO_BUCKET_NAME || 'discord-files',
        fileName,
        uploadId,
        parts
      );

      return res.status(200).json({
        success: true,
        fileUrl,
        fileName
      });
    }

    // ========== ABORT UPLOAD ==========
    if (action === 'abort') {
      const { uploadId, fileName } = req.body;

      if (!uploadId || !fileName) {
        return res.status(400).json({ 
          error: 'Missing required fields: uploadId, fileName' 
        });
      }

      await abortChunkedUpload(
        process.env.MINIO_BUCKET_NAME || 'discord-files',
        fileName,
        uploadId
      );

      return res.status(200).json({
        success: true,
        message: 'Upload aborted successfully'
      });
    }

    return res.status(400).json({ 
      error: 'Invalid action. Use: init, upload, complete, or abort' 
    });

  } catch (error) {
    console.error('Chunked upload error:', error);
    return res.status(500).json({ 
      error: 'Chunked upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Apply rate limiting: Heavy operations (5 uploads per 5 minutes)
export default withRateLimit(handler, rateLimitPresets.heavy);

// Increase body size limit for chunk upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow 10MB chunks
    },
  },
};
