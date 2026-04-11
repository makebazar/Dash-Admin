import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { uploadFileToS3 } from '@/lib/s3';

const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 78;
const WEBP_QUALITY = 78;
const AVIF_QUALITY = 50;
const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);

type PreparedUpload = {
  buffer: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, '-');
}

function getFileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '') || 'image';
}

async function prepareUpload(file: File): Promise<PreparedUpload> {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalFileName = sanitizeFileName(file.name);
  const originalMimeType = file.type || 'application/octet-stream';

  if (!COMPRESSIBLE_IMAGE_TYPES.has(originalMimeType)) {
    return {
      buffer: originalBuffer,
      fileName: originalFileName,
      mimeType: originalMimeType,
    };
  }

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;
    const baseName = getFileBaseName(originalFileName);
    let pipeline = sharp(originalBuffer, { failOnError: false }).rotate();
    const metadata = await pipeline.metadata();
    const shouldResize =
      (metadata.width ?? 0) > MAX_IMAGE_DIMENSION ||
      (metadata.height ?? 0) > MAX_IMAGE_DIMENSION;

    if (shouldResize) {
      pipeline = pipeline.resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    let compressedBuffer: Buffer | Uint8Array = originalBuffer;
    let compressedFileName = originalFileName;
    let compressedMimeType = originalMimeType;

    switch (originalMimeType) {
      case 'image/jpeg':
      case 'image/jpg':
      case 'image/heic':
      case 'image/heif':
        compressedBuffer = await pipeline
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        compressedFileName = `${baseName}.jpg`;
        compressedMimeType = 'image/jpeg';
        break;
      case 'image/png':
        compressedBuffer = await pipeline
          .png({ quality: 80, compressionLevel: 9, palette: true, effort: 8 })
          .toBuffer();
        compressedFileName = `${baseName}.png`;
        compressedMimeType = 'image/png';
        break;
      case 'image/webp':
        compressedBuffer = await pipeline
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
        compressedFileName = `${baseName}.webp`;
        compressedMimeType = 'image/webp';
        break;
      case 'image/avif':
        compressedBuffer = await pipeline
          .avif({ quality: AVIF_QUALITY })
          .toBuffer();
        compressedFileName = `${baseName}.avif`;
        compressedMimeType = 'image/avif';
        break;
      default:
        return {
          buffer: originalBuffer,
          fileName: originalFileName,
          mimeType: originalMimeType,
        };
    }

    if (!shouldResize && compressedBuffer.length >= originalBuffer.length) {
      return {
        buffer: originalBuffer,
        fileName: originalFileName,
        mimeType: originalMimeType,
      };
    }

    return {
      buffer: compressedBuffer,
      fileName: compressedFileName,
      mimeType: compressedMimeType,
    };
  } catch (error) {
    console.warn('Image compression skipped:', error);
    return {
      buffer: originalBuffer,
      fileName: originalFileName,
      mimeType: originalMimeType,
    };
  }
}

async function prepareOriginalUpload(file: File): Promise<PreparedUpload> {
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: sanitizeFileName(file.name),
    mimeType: file.type || 'application/octet-stream',
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = (await cookies()).get('session_user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const preserveOriginal = String(formData.get('preserveOriginal') || '').trim() === '1';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const { buffer, fileName, mimeType } = preserveOriginal
      ? await prepareOriginalUpload(file)
      : await prepareUpload(file);

    const url = await uploadFileToS3(buffer, fileName, mimeType);

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
