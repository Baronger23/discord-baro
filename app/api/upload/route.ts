import { NextRequest, NextResponse } from 'next/server';
import { uploadFileAdvanced, deleteFile, getFileInfo, listFiles } from '@/lib/minio/client';
import { checkRateLimit, generateSecureFileName } from '@/lib/minio/security';
import { currentUser } from '@clerk/nextjs/server';

// Predefined validation configs
const VALIDATION_CONFIGS = {
  avatar: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    maxWidth: 512,
    maxHeight: 512
  },
  serverIcon: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    maxWidth: 256,
    maxHeight: 256
  },
  messageAttachment: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'
    ],
    allowedExtensions: [
      'jpg', 'jpeg', 'png', 'webp', 'gif',
      'pdf', 'txt', 'doc', 'docx',
      'mp4', 'webm', 'mp3', 'wav'
    ]
  }
};

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadType = (formData.get('type') as string) || 'messageAttachment';
    const generateThumbnail = formData.get('generateThumbnail') === 'true';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(user.id, file.size);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: rateLimitResult.error }, { status: 429 });
    }

    // Get validation config
    const validationConfig = VALIDATION_CONFIGS[uploadType as keyof typeof VALIDATION_CONFIGS];
    if (!validationConfig) {
      return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 });
    }

    // Generate secure filename
    const secureFileName = generateSecureFileName(file.name, user.id, uploadType);

    // Advanced upload with all features
    const result = await uploadFileAdvanced(file, secureFileName, {
      validation: validationConfig,
      processImage: file.type.startsWith('image/'),
      imageOptions: {
        maxWidth: (validationConfig as any).maxWidth || 1920,
        maxHeight: (validationConfig as any).maxHeight || 1080,
        quality: uploadType === 'avatar' ? 90 : 80,
        format: 'webp'
      },
      virusScan: true,
      generateThumbnail: generateThumbnail && file.type.startsWith('image/'),
      metadata: {
        'Upload-Type': uploadType,
        'User-Id': user.id,
        'User-Email': user.emailAddresses[0]?.emailAddress || '',
        'Client-IP': request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Log successful upload
    console.log(`File uploaded successfully:`, {
      userId: user.id,
      fileName: result.metadata?.fileName,
      type: uploadType,
      size: result.metadata?.size
    });

    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
      thumbnailUrl: result.thumbnailUrl,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    
    if (!fileName) {
      return NextResponse.json({ error: 'No fileName provided' }, { status: 400 });
    }

    // Only allow users to delete their own files
    if (!fileName.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await deleteFile(fileName);
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const fileName = searchParams.get('fileName');

    if (action === 'list') {
      // List user's files
      const files = await listFiles(process.env.MINIO_BUCKET_NAME || 'discord-files', `${user.id}/`);
      return NextResponse.json({ files });
    }

    if (action === 'info' && fileName) {
      // Get file info
      const info = await getFileInfo(fileName);
      return NextResponse.json({ info });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
