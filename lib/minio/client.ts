import { Client } from 'minio';
import { validateFile, processImage, scanFile, FileValidationConfig, ProcessedFile } from './file-processing';

const parseStorageConfig = () => {
  const rawEndpoint = process.env.MINIO_ENDPOINT?.trim() || 'localhost:9000';
  let endPoint = 'localhost';
  let port = 9000;
  let useSSL = process.env.MINIO_USE_SSL === 'true';
  let inferredBucketName: string | undefined;

  try {
    const hasProtocol = rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://');
    const endpointWithProtocol = hasProtocol ? rawEndpoint : `${useSSL ? 'https' : 'http'}://${rawEndpoint}`;

    const parsed = new URL(endpointWithProtocol);
    endPoint = parsed.hostname;

    if (parsed.port) {
      port = Number.parseInt(parsed.port, 10);
    } else {
      port = parsed.protocol === 'https:' ? 443 : 80;
    }

    if (hasProtocol) {
      useSSL = parsed.protocol === 'https:';
    } else if (useSSL) {
      port = 443;
    } else if (rawEndpoint.includes(':')) {
      // Keep the default 9000 for local MinIO when no port is specified.
      port = 9000;
    }

    const firstPathSegment = parsed.pathname.split('/').filter(Boolean)[0];
    if (firstPathSegment) {
      inferredBucketName = firstPathSegment;
    }
  } catch {
    const [host, parsedPort] = rawEndpoint.split(':');
    endPoint = host || 'localhost';
    port = parsedPort ? Number.parseInt(parsedPort, 10) : 9000;
  }

  const bucketName = process.env.MINIO_BUCKET_NAME || inferredBucketName || 'discord-files';

  return { endPoint, port, useSSL, bucketName };
};

const storageConfig = parseStorageConfig();
const DEFAULT_BUCKET_NAME = storageConfig.bucketName;
const DEFAULT_PRESIGNED_EXPIRY_SECONDS = Number.parseInt(process.env.PRESIGNED_URL_EXPIRY_SECONDS || '3600', 10);
const IS_CLOUDFLARE_R2 = storageConfig.endPoint.endsWith('.r2.cloudflarestorage.com');
const SHOULD_SKIP_BUCKET_CHECK = process.env.MINIO_SKIP_BUCKET_CHECK === 'true' || IS_CLOUDFLARE_R2;
const DEFAULT_REGION = process.env.MINIO_REGION || (IS_CLOUDFLARE_R2 ? 'auto' : 'us-east-1');
const DEFAULT_UPLOAD_BASE_URL = (
  process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT ||
  `${storageConfig.useSSL ? 'https' : 'http'}://${storageConfig.endPoint}${
    (storageConfig.useSSL && storageConfig.port === 443) || (!storageConfig.useSSL && storageConfig.port === 80)
      ? ''
      : `:${storageConfig.port}`
  }/${DEFAULT_BUCKET_NAME}`
).replace(/\/+$/, '');

const minioClient = new Client({
  endPoint: storageConfig.endPoint,
  port: storageConfig.port,
  useSSL: storageConfig.useSSL,
  region: DEFAULT_REGION,
  pathStyle: true,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const formatStorageError = (error: unknown): string => {
  if (error instanceof Error) {
    const anyError = error as Error & {
      code?: string;
      resource?: string;
      requestid?: string;
      hostid?: string;
      amzRequestid?: string;
      amzId2?: string;
      amzBucketRegion?: string;
      region?: string;
    };

    const details = [
      anyError.code ? `code=${anyError.code}` : null,
      anyError.region ? `region=${anyError.region}` : null,
      anyError.resource ? `resource=${anyError.resource}` : null,
      anyError.requestid ? `requestid=${anyError.requestid}` : null,
      anyError.hostid ? `hostid=${anyError.hostid}` : null,
      anyError.amzRequestid ? `amzRequestid=${anyError.amzRequestid}` : null,
      anyError.amzId2 ? `amzId2=${anyError.amzId2}` : null,
      anyError.amzBucketRegion ? `amzBucketRegion=${anyError.amzBucketRegion}` : null,
    ].filter(Boolean);

    return details.length > 0 ? `${anyError.message} (${details.join(', ')})` : anyError.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown storage error';
  }
};

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
      bucketName = DEFAULT_BUCKET_NAME,
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

    const fileUrl = await getFileUrl(finalFileName, bucketName);
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
      
      thumbnailUrl = await getFileUrl(thumbnailFileName, bucketName);
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
    const message = formatStorageError(error);
    console.error('Advanced upload error:', message);
    return { success: false, error: message };
  }
};

// Utility functions
const ensureBucketExists = async (bucketName: string): Promise<void> => {
  if (SHOULD_SKIP_BUCKET_CHECK) {
    return;
  }

  try {
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      await minioClient.makeBucket(bucketName);
    }
  } catch (error) {
    console.error('Bucket check/create error:', error);
    throw new Error(
      'Storage bucket check failed. Ensure the bucket exists and set MINIO_SKIP_BUCKET_CHECK=true for managed S3 services like Cloudflare R2.'
    );
  }
};

export const uploadFile = async (
  file: Buffer,
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME
): Promise<string> => {
  try {
    // Check if bucket exists, create if not
    await ensureBucketExists(bucketName);

    // Upload file
    await minioClient.putObject(bucketName, fileName, file);
    
    // Return public URL
    return await getFileUrl(fileName, bucketName);
  } catch (error) {
    const message = formatStorageError(error);
    console.error('MinIO upload error:', message);
    throw new Error(message);
  }
};

export const deleteFile = async (
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME
): Promise<void> => {
  try {
    await minioClient.removeObject(bucketName, fileName);
  } catch (error) {
    const message = formatStorageError(error);
    console.error('MinIO delete error:', message);
    throw new Error(message);
  }
};

export const getFileUrl = async (
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME,
  expirySeconds: number = DEFAULT_PRESIGNED_EXPIRY_SECONDS
): Promise<string> => {
  const shouldUsePresignedGetUrl = process.env.MINIO_USE_PRESIGNED_GET_URL !== 'false';

  if (!shouldUsePresignedGetUrl) {
    return `${DEFAULT_UPLOAD_BASE_URL}/${fileName}`;
  }

  try {
    return await minioClient.presignedGetObject(bucketName, fileName, expirySeconds);
  } catch (error) {
    console.error('MinIO get file URL error:', error);
    return `${DEFAULT_UPLOAD_BASE_URL}/${fileName}`;
  }
};

export const listFiles = async (
  bucketName: string = DEFAULT_BUCKET_NAME,
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
    const message = formatStorageError(error);
    console.error('MinIO list error:', message);
    throw new Error(message);
  }
};

export const getFileInfo = async (
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME
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
    const message = formatStorageError(error);
    console.error('MinIO stat error:', message);
    throw new Error(message);
  }
};

export const downloadFile = async (
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME
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
    const message = formatStorageError(error);
    console.error('MinIO download error:', message);
    throw new Error(message);
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
  bucketName: string = DEFAULT_BUCKET_NAME,
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
    const message = formatStorageError(error);
    console.error('MinIO presigned URL error:', message);
    throw new Error(message);
  }
};

/**
 * Generate presigned URL for downloading file
 */
export const getPresignedDownloadUrl = async (
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME,
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
    const message = formatStorageError(error);
    console.error('MinIO presigned download URL error:', message);
    throw new Error(message);
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
  bucketName: string = DEFAULT_BUCKET_NAME
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
    const message = formatStorageError(error);
    console.error('Init chunked upload error:', message);
    throw new Error(message);
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
    const message = formatStorageError(error);
    console.error(`Upload chunk ${partNumber} error:`, message);
    throw new Error(message);
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
    
    return await getFileUrl(fileName, bucketName);
  } catch (error) {
    const message = formatStorageError(error);
    console.error('Complete chunked upload error:', message);
    throw new Error(message);
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
    const message = formatStorageError(error);
    console.error('Abort chunked upload error:', message);
    throw new Error(message);
  }
};

/**
 * Helper: Upload large file with chunks
 */
export const uploadLargeFile = async (
  file: Buffer,
  fileName: string,
  bucketName: string = DEFAULT_BUCKET_NAME,
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
