const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

/**
 * Generates an orange icon with the Zap logo.
 * @param {number} size - Square size in pixels.
 * @param {string} fileName - Output filename.
 * @param {boolean} maskable - Whether to add padding for safe area.
 */
function generateIcon(size, fileName, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 1024;

  // Background - DashAdmin Orange (#f97316)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      pixels[index] = 249;     // R
      pixels[index + 1] = 115; // G
      pixels[index + 2] = 22;  // B
      pixels[index + 3] = 255; // A
    }
  }

  // Zap (Bolt) Polygon points (normalized to 1024x1024)
  const boltRaw = [
    [600, 170],
    [300, 560],
    [456, 560],
    [420, 856],
    [752, 452],
    [586, 452],
    [624, 190],
  ];

  // Apply scaling and optional maskable padding (10% safe area)
  const offset = maskable ? size * 0.1 : 0;
  const contentScale = maskable ? 0.8 : 1.0;

  const bolt = boltRaw.map(p => [
    (p[0] * scale * contentScale) + offset,
    (p[1] * scale * contentScale) + offset
  ]);

  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Draw the bolt (White #FFFFFF)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!pointInPolygon(x, y, bolt)) continue;
      const index = (y * size + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = 255;
    }
  }

  function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(data.length, 0);

    const crcBuffer = Buffer.alloc(4);
    const crcValue = crc32(Buffer.concat([typeBuffer, data]));
    crcBuffer.writeUInt32BE(crcValue, 0);

    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawRows[rowStart] = 0;
    pixels.copy(rawRows, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const idat = zlib.deflateSync(rawRows, { level: 9 });

  const png = Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  const outDir = path.join(process.cwd(), "public", "icons");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outputPath = path.join(outDir, fileName);
  fs.writeFileSync(outputPath, png);
  console.log(`✓ Generated ${outputPath}`);
}

// Generate all required sizes
generateIcon(192, "icon-192.png");
generateIcon(192, "icon-192-maskable.png", true);
generateIcon(512, "icon-512.png");
generateIcon(512, "icon-512-maskable.png", true);
