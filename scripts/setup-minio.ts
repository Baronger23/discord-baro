import { Client } from 'minio';

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT?.split(':')[0] || 'localhost',
  port: parseInt(process.env.MINIO_ENDPOINT?.split(':')[1] || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const bucketName = process.env.MINIO_BUCKET_NAME || 'discord-files';

// Public read policy - allows anyone to read files
const publicReadPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${bucketName}/*`],
    },
  ],
};

async function setupMinio() {
  try {
    console.log('🔧 Setting up MinIO...');
    
    // 1. Check if bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    
    if (!bucketExists) {
      console.log(`📦 Creating bucket: ${bucketName}`);
      await minioClient.makeBucket(bucketName);
      console.log('✅ Bucket created successfully!');
    } else {
      console.log(`✅ Bucket "${bucketName}" already exists`);
    }

    // 2. Set bucket policy to public read
    console.log('🔓 Setting bucket policy to public read...');
    await minioClient.setBucketPolicy(
      bucketName,
      JSON.stringify(publicReadPolicy)
    );
    console.log('✅ Bucket policy set to public!');

    // 3. Verify policy
    const policy = await minioClient.getBucketPolicy(bucketName);
    console.log('📋 Current bucket policy:', policy);

    console.log('\n🎉 MinIO setup completed successfully!');
    console.log(`📁 Bucket: ${bucketName}`);
    console.log(`🌐 Access files at: http://localhost:9000/${bucketName}/[filename]`);
    console.log(`🎛️  MinIO Console: http://localhost:9001`);
    console.log(`   Username: minioadmin`);
    console.log(`   Password: minioadmin123`);

  } catch (error) {
    console.error('❌ Error setting up MinIO:', error);
    process.exit(1);
  }
}

setupMinio();
