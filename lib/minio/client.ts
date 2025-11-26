import { Client } from 'minio';
import { validateFile, processImage, scanFile, FileValidationConfig, ProcessedFile } from './file-processing';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT?.split(':')[0] || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT?.split(':')[1] || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

// Advanced upload with validation, processing, and metadata
export const uploadFileAdvanced = async (
  file: Buffer | File,
  fileName: string,
  options: {
    bucketName?: string;
    validation?: FileValidationConfig;
    processImage?: boolean;
    imageOptions?: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    };
    virusScan?: boolean;
    generateThumbnail?: boolean;
    metadata?: Record<string, string>;
  } = {}
): Promise<{
  success: boolean;
  fileUrl?: string;
  thumbnailUrl?: string;
  metadata?: any;
  error?: string;
}> => {
  try {
    const {
      bucketName = process.env.MINIO_BUCKET_NAME || 'discord-files',
      validation,
      processImage: shouldProcessImage = false,
      imageOptions = {},
      virusScan = true,
      generateThumbnail = false,
      metadata = {}
    } = options;

    let buffer: Buffer;
    let originalFileName: string;
    let contentType: string;
    let fileSize: number;

    // Handle File vs Buffer input
    if (file instanceof File) {
      // Validate file if config provided
      if (validation) {
        const validationResult = validateFile(file, validation);
        if (!validationResult.isValid) {
          return { success: false, error: validationResult.error };
        }
      }

      buffer = Buffer.from(await file.arrayBuffer());
      originalFileName = file.name;
      contentType = file.type;
      fileSize = file.size;
    } else {
      buffer = file;
      originalFileName = fileName;
      contentType = 'application/octet-stream';
      fileSize = buffer.length;
    }

    // Virus scan
    if (virusScan) {
      const scanResult = await scanFile(buffer);
      if (!scanResult.isClean) {
        return { success: false, error: `Security threat detected: ${scanResult.threat}` };
      }
    }

    let finalBuffer = buffer;
    let finalFileName = fileName;
    let processedMetadata: any = {};

    // Process image if requested
    if (shouldProcessImage && contentType.startsWith('image/')) {
      const processed = await processImage(buffer, imageOptions);
      finalBuffer = processed.buffer;
      finalFileName = processed.fileName;
      contentType = processed.contentType;
      processedMetadata = processed.metadata;
    }

    // Upload main file
    await ensureBucketExists(bucketName);
    
    // Sanitize metadata values - encode to base64 for safety
    const sanitizeMetadataValue = (value: string): string => {
      // Remove or encode special characters that are not allowed in HTTP headers
      // Use base64 encoding for non-ASCII characters
      try {
        return Buffer.from(value).toString('base64');
      } catch {
        return value.replace(/[^\x20-\x7E]/g, ''); // Remove non-ASCII chars as fallback
      }
    };

    const uploadMetadata = {
      'Content-Type': contentType,
      'Original-Name': sanitizeMetadataValue(originalFileName),
      'Upload-Time': new Date().toISOString(),
      'File-Size': fileSize.toString(),
      ...Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, sanitizeMetadataValue(value)])
      ),
      ...processedMetadata
    };

    await minioClient.putObject(bucketName, finalFileName, finalBuffer, finalBuffer.length, uploadMetadata);

    const fileUrl = getFileUrl(finalFileName);
    let thumbnailUrl: string | undefined;

    // Generate thumbnail if requested
    if (generateThumbnail && contentType.startsWith('image/')) {
      const thumbnail = await processImage(buffer, {
        maxWidth: 200,
        maxHeight: 200,
        crop: true,
        format: 'webp',
        quality: 70
      });
      
      const thumbnailFileName = `thumbnails/${finalFileName.split('.')[0]}-thumb.webp`;
      await minioClient.putObject(bucketName, thumbnailFileName, thumbnail.buffer, thumbnail.buffer.length, {
        'Content-Type': 'image/webp',
        'Is-Thumbnail': 'true',
        'Parent-File': finalFileName
      });
      
      thumbnailUrl = getFileUrl(thumbnailFileName);
    }

    return {
      success: true,
      fileUrl,
      thumbnailUrl,
      metadata: {
        fileName: finalFileName,
        originalName: originalFileName,
        size: finalBuffer.length,
        contentType,
        uploadTime: uploadMetadata['Upload-Time'],
        ...processedMetadata
      }
    };

  } catch (error) {
    console.error('Advanced upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
};

// Utility functions
const ensureBucketExists = async (bucketName: string): Promise<void> => {
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName);
  }
};

export const uploadFile = async (
  file: Buffer,
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files'
): Promise<string> => {
  try {
    // Check if bucket exists, create if not
    await ensureBucketExists(bucketName);

    // Upload file
    await minioClient.putObject(bucketName, fileName, file);
    
    // Return public URL
    const endpoint = process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT || 'http://localhost:9000/discord-files';
    return `${endpoint}/${fileName}`;
  } catch (error) {
    console.error('MinIO upload error:', error);
    throw new Error('Failed to upload file');
  }
};

export const deleteFile = async (
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files'
): Promise<void> => {
  try {
    await minioClient.removeObject(bucketName, fileName);
  } catch (error) {
    console.error('MinIO delete error:', error);
    throw new Error('Failed to delete file');
  }
};

export const getFileUrl = (fileName: string): string => {
  const endpoint = process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT || 'http://localhost:9000/discord-files';
  return `${endpoint}/${fileName}`;
};

export const listFiles = async (
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files',
  prefix?: string
): Promise<string[]> => {
  try {
    const fileNames: string[] = [];
    const stream = minioClient.listObjects(bucketName, prefix);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => fileNames.push(obj.name || ''));
      stream.on('error', reject);
      stream.on('end', () => resolve(fileNames));
    });
  } catch (error) {
    console.error('MinIO list error:', error);
    throw new Error('Failed to list files');
  }
};

export const getFileInfo = async (
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files'
) => {
  try {
    const stat = await minioClient.statObject(bucketName, fileName);
    return {
      size: stat.size,
      lastModified: stat.lastModified,
      contentType: stat.metaData?.['content-type'],
      etag: stat.etag
    };
  } catch (error) {
    console.error('MinIO stat error:', error);
    throw new Error('Failed to get file info');
  }
};

export const downloadFile = async (
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files'
): Promise<Buffer> => {
  try {
    const stream = await minioClient.getObject(bucketName, fileName);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  } catch (error) {
    console.error('MinIO download error:', error);
    throw new Error('Failed to download file');
  }
};

// ============================================
// PRESIGNED URLS - Client upload trực tiếp
// ============================================

/**
 * Generate presigned URL for uploading file
 * Client có thể upload trực tiếp lên MinIO mà không qua server
 */
export const getPresignedUploadUrl = async (
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files',
  expirySeconds: number = 3600 // 1 hour
): Promise<string> => {
  try {
    await ensureBucketExists(bucketName);
    
    const url = await minioClient.presignedPutObject(
      bucketName,
      fileName,
      expirySeconds
    );
    
    return url;
  } catch (error) {
    console.error('MinIO presigned URL error:', error);
    throw new Error('Failed to generate presigned URL');
  }
};

/**
 * Generate presigned URL for downloading file
 */
export const getPresignedDownloadUrl = async (
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files',
  expirySeconds: number = 3600
): Promise<string> => {
  try {
    const url = await minioClient.presignedGetObject(
      bucketName,
      fileName,
      expirySeconds
    );
    
    return url;
  } catch (error) {
    console.error('MinIO presigned download URL error:', error);
    throw new Error('Failed to generate presigned download URL');
  }
};

// ============================================
// CHUNKED UPLOAD - Cho file lớn (> 50MB)
// ============================================

export interface ChunkUploadSession {
  uploadId: string;
  fileName: string;
  bucketName: string;
  totalChunks: number;
  uploadedChunks: number[];
}

/**
 * Initialize multipart upload session
 */
export const initChunkedUpload = async (
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files'
): Promise<{ uploadId: string; sessionId: string }> => {
  try {
    await ensureBucketExists(bucketName);
    
    // MinIO's initiate multipart upload
    const uploadId = await minioClient.initiateNewMultipartUpload(
      bucketName,
      fileName,
      {}
    );
    
    const sessionId = `${bucketName}:${fileName}:${uploadId}`;
    
    return { uploadId, sessionId };
  } catch (error) {
    console.error('Init chunked upload error:', error);
    throw new Error('Failed to initialize chunked upload');
  }
};

/**
 * Upload a single chunk
 * Note: MinIO client doesn't expose uploadPart directly in TypeScript
 * We'll use putObject for each chunk with unique names, then combine them
 */
export const uploadChunk = async (
  bucketName: string,
  fileName: string,
  uploadId: string,
  partNumber: number,
  chunkData: Buffer
): Promise<{ etag: string; partNumber: number }> => {
  try {
    // Store chunk temporarily with uploadId prefix
    const chunkName = `${uploadId}/part-${partNumber}`;
    
    const result = await minioClient.putObject(
      bucketName,
      chunkName,
      chunkData,
      chunkData.length
    );
    
    // putObject returns UploadedObjectInfo with etag
    return { 
      etag: result.etag.replace(/"/g, ''), // Remove quotes from etag
      partNumber 
    };
  } catch (error) {
    console.error(`Upload chunk ${partNumber} error:`, error);
    throw new Error(`Failed to upload chunk ${partNumber}`);
  }
};

/**
 * Complete chunked upload - Combine all chunks into final file
 */
export const completeChunkedUpload = async (
  bucketName: string,
  fileName: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<string> => {
  try {
    // Sort parts by part number
    const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
    
    // Read all chunks and combine them
    const chunks: Buffer[] = [];
    for (const part of sortedParts) {
      const chunkName = `${uploadId}/part-${part.partNumber}`;
      const stream = await minioClient.getObject(bucketName, chunkName);
      
      // Convert stream to buffer
      const chunkBuffer = await streamToBuffer(stream);
      chunks.push(chunkBuffer);
    }
    
    // Combine all chunks
    const finalBuffer = Buffer.concat(chunks);
    
    // Upload final file
    await minioClient.putObject(
      bucketName,
      fileName,
      finalBuffer,
      finalBuffer.length
    );
    
    // Delete temporary chunks
    for (const part of sortedParts) {
      const chunkName = `${uploadId}/part-${part.partNumber}`;
      await minioClient.removeObject(bucketName, chunkName).catch(() => {
        // Ignore cleanup errors
      });
    }
    
    return getFileUrl(fileName);
  } catch (error) {
    console.error('Complete chunked upload error:', error);
    throw new Error('Failed to complete chunked upload');
  }
};

// Helper: Convert stream to buffer
const streamToBuffer = async (stream: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};

/**
 * Abort chunked upload (cleanup nếu upload bị hủy)
 */
export const abortChunkedUpload = async (
  bucketName: string,
  fileName: string,
  uploadId: string
): Promise<void> => {
  try {
    await minioClient.abortMultipartUpload(bucketName, fileName, uploadId);
  } catch (error) {
    console.error('Abort chunked upload error:', error);
    throw new Error('Failed to abort chunked upload');
  }
};

/**
 * Helper: Upload large file with chunks
 */
export const uploadLargeFile = async (
  file: Buffer,
  fileName: string,
  bucketName: string = process.env.MINIO_BUCKET_NAME || 'discord-files',
  chunkSize: number = 5 * 1024 * 1024, // 5MB per chunk
  onProgress?: (percent: number, uploadedBytes: number, totalBytes: number) => void
): Promise<string> => {
  try {
    const totalSize = file.length;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    
    console.log(`Uploading ${fileName}: ${totalSize} bytes in ${totalChunks} chunks`);
    
    // Initialize upload
    const { uploadId } = await initChunkedUpload(fileName, bucketName);
    
    const parts: Array<{ partNumber: number; etag: string }> = [];
    let uploadedBytes = 0;
    
    // Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = file.slice(start, end);
      
      const partNumber = i + 1;
      const { etag } = await uploadChunk(bucketName, fileName, uploadId, partNumber, chunk);
      
      parts.push({ partNumber, etag });
      uploadedBytes += chunk.length;
      
      // Report progress
      const percent = (uploadedBytes / totalSize) * 100;
      console.log(`Chunk ${partNumber}/${totalChunks} uploaded: ${percent.toFixed(2)}%`);
      
      if (onProgress) {
        onProgress(percent, uploadedBytes, totalSize);
      }
    }
    
    // Complete upload
    const fileUrl = await completeChunkedUpload(bucketName, fileName, uploadId, parts);
    
    console.log(`Upload completed: ${fileUrl}`);
    return fileUrl;
    
  } catch (error) {
    console.error('Large file upload error:', error);
    throw new Error('Failed to upload large file');
  }
};

export default minioClient;
