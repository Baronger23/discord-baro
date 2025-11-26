import { NextApiRequest, NextApiResponse } from 'next';
import { getPresignedUploadUrl } from '@/lib/minio/client';
import { currentProfilePages } from '@/lib/current-profile-pages';
import { withRateLimit, rateLimitPresets } from '@/lib/rate-limit';

/**
 * API: Generate presigned upload URL
 * Client sẽ upload trực tiếp lên MinIO với URL này
 * Rate limit: 10 uploads per minute
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

    const { fileName, fileType, fileSize } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // Validate file size (max 50MB cho presigned, > 50MB dùng chunked)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (fileSize && fileSize > maxSize) {
      return res.status(400).json({ 
        error: 'File too large for presigned upload. Use chunked upload instead.',
        maxSize,
        shouldUseChunked: true
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${profile.id}/${timestamp}-${sanitizedName}`;

    // Get presigned URL (valid for 1 hour)
    const presignedUrl = await getPresignedUploadUrl(uniqueFileName, undefined, 3600);

    return res.status(200).json({
      presignedUrl,
      fileName: uniqueFileName,
      expiresIn: 3600, // seconds
      publicUrl: `${process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT}/${uniqueFileName}`
    });

  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}

// Apply rate limiting: 10 uploads per minute per user
export default withRateLimit(handler, {
  ...rateLimitPresets.upload,
  keyGenerator: (req) => {
    // Rate limit by user ID (from cookie/session)
    const userId = req.cookies['__clerk_db_jwt'] || req.socket.remoteAddress || 'unknown';
    return `upload:${userId}`;
  }
});
