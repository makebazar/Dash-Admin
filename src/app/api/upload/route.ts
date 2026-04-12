import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

const WEBM_MIME_TYPE = 'video/webm';

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
};

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, '-');
}

function getFileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '') || 'image';
}

function getFileExtension(fileName: string) {
  const match = sanitizeFileName(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function getNormalizedMimeType(fileName: string, mimeType: string) {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  if (normalizedMimeType && normalizedMimeType !== 'application/octet-stream') {
    return normalizedMimeType;
  }

  return MIME_TYPE_BY_EXTENSION[getFileExtension(fileName)] || 'application/octet-stream';
}

function isVideoMimeType(mimeType: string) {
  return mimeType.startsWith('video/');
}

function shouldTranscodeVideo(fileName: string, mimeType: string, enabled: boolean) {
  if (!enabled || !isVideoMimeType(mimeType)) return false;
  return getFileExtension(fileName) !== 'webm';
}

async function runFfmpeg(args: string[]) {
  const ffmpegBinaryPath = process.env.FFMPEG_BIN
    || path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

  try {
    await fs.access(ffmpegBinaryPath);
  } catch {
    throw new Error('FFmpeg binary is not available');
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
    });
  });
}

async function transcodeVideoToWebm(buffer: Buffer | Uint8Array, fileName: string): Promise<PreparedUpload> {
  const baseName = getFileBaseName(fileName);
  const extension = getFileExtension(fileName) || 'bin';
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dashadmin-video-'));
  const inputPath = path.join(workDir, `input.${extension}`);
  const outputPath = path.join(workDir, `${baseName}.webm`);

  try {
    await fs.writeFile(inputPath, buffer);
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-an',
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '34',
      '-b:v',
      '0',
      '-deadline',
      'good',
      '-row-mt',
      '1',
      outputPath,
    ]);

    const outputBuffer = await fs.readFile(outputPath);
    return {
      buffer: outputBuffer,
      fileName: `${baseName}.webm`,
      mimeType: WEBM_MIME_TYPE,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function prepareUpload(file: File): Promise<PreparedUpload> {
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalFileName = sanitizeFileName(file.name);
  const originalMimeType = getNormalizedMimeType(originalFileName, file.type);

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
  const fileName = sanitizeFileName(file.name);
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName,
    mimeType: getNormalizedMimeType(fileName, file.type),
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
    const transcodeVideo = String(formData.get('transcodeVideo') || '').trim() === '1';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const preparedUpload = preserveOriginal
      ? await prepareOriginalUpload(file)
      : await prepareUpload(file);
    const finalUpload = shouldTranscodeVideo(preparedUpload.fileName, preparedUpload.mimeType, transcodeVideo)
      ? await transcodeVideoToWebm(preparedUpload.buffer, preparedUpload.fileName)
      : preparedUpload;

    const url = await uploadFileToS3(finalUpload.buffer, finalUpload.fileName, finalUpload.mimeType);

    return NextResponse.json({
      url,
      fileName: finalUpload.fileName,
      mimeType: finalUpload.mimeType,
      transcoded: finalUpload.fileName !== preparedUpload.fileName,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
