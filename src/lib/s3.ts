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
  try {
    // Use UUID for filename to ensure S3 compatibility and uniqueness
    const fileExtension = fileName.split('.').pop() || 'bin';
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    
    // In "делаем базар" implementation, key is just `${folder}/${filename}`
    // If bucket name is 'uploads' and folder is 'uploads', key becomes 'uploads/file.png'
    // The previous logic to avoid duplication might be over-engineering if MinIO handles it correctly
    // Let's stick to the proven pattern from the reference project.
    
    const key = `${folder}/${uniqueFileName}`;

    const params: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      // Re-enable ACL as per reference implementation, but comment out if it fails
      // In the reference, it is 'public-read'
      ACL: 'public-read', 
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Construct the public URL
    // For MinIO, it's typically: http://endpoint/bucket/key
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, '') || '';
    
    const url = `${endpoint}/${bucketName}/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to storage');
  }
}
