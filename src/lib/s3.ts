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
    
    // IMPORTANT: If bucket name matches folder, MinIO can get confused with path style access.
    // Let's remove the 'uploads' folder prefix if the bucket is also named 'uploads' 
    // or just put files in the root if folder is 'uploads'.
    // Or better, use a different folder name like 'files'.
    
    let key: string;
    if (folder === 'uploads' && bucketName === 'uploads') {
       // If both are 'uploads', put in root or use a date-based prefix
       const datePrefix = new Date().toISOString().split('T')[0];
       key = `${datePrefix}/${uniqueFileName}`;
    } else {
       key = `${folder}/${uniqueFileName}`;
    }

    const params: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      // ACL: 'public-read', // Uncomment if your MinIO bucket requires ACLs for public access
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Construct the public URL
    // For MinIO, it's typically: http://endpoint/bucket/key
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, '') || '';
    
    // Check if endpoint is localhost, if so, we might need to be careful about how clients access it
    // but usually for internal tools, the configured endpoint is fine.
    
    const url = `${endpoint}/${bucketName}/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file to storage');
  }
}
