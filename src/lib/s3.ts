import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // Crucial for MinIO
});

const bucketName = process.env.S3_BUCKET_NAME || 'uploads';

/**
 * Uploads a file to S3/MinIO
 * @param file - The file buffer or stream
 * @param fileName - The desired file name
 * @param mimeType - The MIME type of the file
 * @param folder - The folder within the bucket (default: 'uploads')
 * @returns The public URL of the uploaded file
 */
export async function uploadFileToS3(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<string> {
  const fileExtension = fileName.split('.').pop() || 'bin';
  const uniqueFileName = `${uuidv4()}.${fileExtension}`;
  const key = `${folder}/${uniqueFileName}`;

  try {
    const params: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'public-read', 
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Construct the public URL
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, '') || '';
    const url = `${endpoint}/${bucketName}/${key}`;
    return url;
  } catch (error: any) {
    console.error('Detailed S3 Upload Error:', {
      message: error.message,
      code: error.code,
      requestId: error.$metadata?.requestId,
      bucket: bucketName,
      key: key
    });
    throw new Error(`S3 Upload failed: ${error.message}`);
  }
}
