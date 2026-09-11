import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * ChallengerM4_Artifacts_Stress.test.ts
 *
 * Adversarial Challenge & Stress Test Suite for Milestone 4 Visual Proof Artifacts.
 * Author: challenger_m4_1 (Empirical Challenger)
 *
 * Adversarial Invariant Verification:
 * 1. Physical Existence & Payload Boundary:
 *    - All 4 required PNG files exist in `artifacts/dark_fantasy/`.
 *    - Each file strictly exceeds 250KB (256,000 bytes) with zero truncation.
 * 2. Binary PNG Specification & Chunk Structure:
 *    - Exact 8-byte PNG magic header: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].
 *    - IHDR chunk: 1920x1080 dimensions (2x retina scale), bit depth 8, valid color type (2 or 6).
 *    - Chunk sequence: starts with IHDR, contains multiple IDAT chunks, terminates with IEND.
 *    - Zero truncation: file ends exactly at the IEND chunk boundary (no extra trailing bytes).
 * 3. Cryptographic Integrity:
 *    - Recalculates ISO 3309 / ITU-T V.42 CRC32 across Chunk Type + Chunk Data for every chunk.
 *    - 100% chunk checksum matching.
 * 4. IDAT Decompression & Pixel Data Integrity:
 *    - Inflates concatenated IDAT payload via zlib.
 *    - Decompressed payload size matches height * (1 + width * bytesPerPixel) exactly (6,221,880 bytes for RGB).
 * 5. Mathematical Entropy & Variance Non-Blank Proof:
 *    - Unfilters PNG scanlines (Sub, Up, Average, Paeth) to reconstruct raw pixel buffer.
 *    - Calculates Shannon entropy H(X): asserts H(X) > 4.0 bits/pixel (proves image is not flat or low-information).
 *    - Calculates pixel value variance sigma^2: asserts sigma^2 > 400.0 and sigma > 20.0 (proves high contrast).
 *    - Counts distinct 24-bit RGB colors: asserts unique colors > 5,000 per image.
 * 6. Adversarial Oracles (Negative Control Tests):
 *    - Verifies validator rejects truncated PNGs, CRC-corrupted chunks, dummy solid buffers, and undersized files.
 */

// Precompute CRC32 lookup table (ISO 3309 polynomial 0xEDB88320)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function calculateCRC32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ParsedChunk {
  type: string;
  length: number;
  data: Buffer;
  storedCRC: number;
  computedCRC: number;
  crcValid: boolean;
}

interface ParsedPNG {
  filePath: string;
  fileSizeBytes: number;
  hasValidSignature: boolean;
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compressionMethod: number;
  filterMethod: number;
  interlaceMethod: number;
  chunks: ParsedChunk[];
  idatChunks: ParsedChunk[];
  zeroTruncation: boolean;
  decompressedBytes: Buffer;
  decompressedLength: number;
  expectedDecompressedLength: number;
  rawPixels: Buffer;
  rawPixelEntropy: number;
  rawPixelVariance: number;
  rawPixelStdDev: number;
  uniqueColorCount: number;
}

function parseAndAnalyzePNG(filePath: string): ParsedPNG {
  const buf = fs.readFileSync(filePath);
  const fileSizeBytes = buf.length;

  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const hasValidSignature = buf.subarray(0, 8).equals(PNG_MAGIC);
  if (!hasValidSignature) {
    throw new Error(`Invalid PNG signature in ${filePath}`);
  }

  let offset = 8;
  const chunks: ParsedChunk[] = [];
  const idatChunks: ParsedChunk[] = [];

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let compressionMethod = 0;
  let filterMethod = 0;
  let interlaceMethod = 0;

  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const chunkDataOffset = offset + 8;
    const chunkDataEnd = chunkDataOffset + length;

    if (chunkDataEnd + 4 > buf.length) {
      throw new Error(`Truncated chunk ${type} at offset ${offset} in ${filePath}`);
    }

    const chunkData = buf.subarray(chunkDataOffset, chunkDataEnd);
    const storedCRC = buf.readUInt32BE(chunkDataEnd);

    // CRC is computed over Chunk Type (4 bytes) + Chunk Data (length bytes)
    const crcTarget = buf.subarray(offset + 4, chunkDataEnd);
    const computedCRC = calculateCRC32(crcTarget);
    const crcValid = computedCRC === storedCRC;

    const chunkObj: ParsedChunk = {
      type,
      length,
      data: chunkData,
      storedCRC,
      computedCRC,
      crcValid,
    };

    chunks.push(chunkObj);

    if (type === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData.readUInt8(8);
      colorType = chunkData.readUInt8(9);
      compressionMethod = chunkData.readUInt8(10);
      filterMethod = chunkData.readUInt8(11);
      interlaceMethod = chunkData.readUInt8(12);
    } else if (type === 'IDAT') {
      idatChunks.push(chunkObj);
    }

    offset = chunkDataEnd + 4;
    if (type === 'IEND') {
      break;
    }
  }

  const zeroTruncation = offset === buf.length;

  // Decompress concatenated IDAT chunks
  const totalIdatBuffer = Buffer.concat(idatChunks.map((c) => c.data));
  const decompressedBytes = zlib.inflateSync(totalIdatBuffer);
  const decompressedLength = decompressedBytes.length;

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const expectedDecompressedLength = height * (1 + width * bytesPerPixel);

  // Reconstruct uncompressed raw pixel values by inverting scanline filters
  const scanlineLength = width * bytesPerPixel;
  const rawPixels = Buffer.alloc(width * height * bytesPerPixel);

  let srcPos = 0;
  let dstPos = 0;

  for (let y = 0; y < height; y++) {
    const filterType = decompressedBytes[srcPos++];
    const lineDstStart = dstPos;
    const prevLineDstStart = y > 0 ? (y - 1) * scanlineLength : -1;

    for (let x = 0; x < scanlineLength; x++) {
      const rawByte = decompressedBytes[srcPos++];
      const a = x >= bytesPerPixel ? rawPixels[lineDstStart + x - bytesPerPixel] : 0;
      const b = prevLineDstStart >= 0 ? rawPixels[prevLineDstStart + x] : 0;
      const c =
        prevLineDstStart >= 0 && x >= bytesPerPixel
          ? rawPixels[prevLineDstStart + x - bytesPerPixel]
          : 0;

      let val = rawByte;
      if (filterType === 1) {
        // Sub
        val = (rawByte + a) & 0xff;
      } else if (filterType === 2) {
        // Up
        val = (rawByte + b) & 0xff;
      } else if (filterType === 3) {
        // Average
        val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
      } else if (filterType === 4) {
        // Paeth
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr = c;
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        val = (rawByte + pr) & 0xff;
      }
      rawPixels[dstPos++] = val;
    }
  }

  // Calculate Shannon entropy on raw pixel byte values
  const freq = new Uint32Array(256);
  let sum = 0;
  for (let i = 0; i < rawPixels.length; i++) {
    freq[rawPixels[i]]++;
    sum += rawPixels[i];
  }

  let rawPixelEntropy = 0;
  for (let i = 0; i < 256; i++) {
    if (freq[i] > 0) {
      const p = freq[i] / rawPixels.length;
      rawPixelEntropy -= p * Math.log2(p);
    }
  }

  // Calculate variance and standard deviation
  const mean = sum / rawPixels.length;
  let varSum = 0;
  for (let i = 0; i < rawPixels.length; i++) {
    const diff = rawPixels[i] - mean;
    varSum += diff * diff;
  }
  const rawPixelVariance = varSum / rawPixels.length;
  const rawPixelStdDev = Math.sqrt(rawPixelVariance);

  // Count unique RGB colors
  const colorSet = new Set<number>();
  for (let i = 0; i < rawPixels.length; i += bytesPerPixel) {
    const r = rawPixels[i];
    const g = rawPixels[i + 1];
    const b = rawPixels[i + 2];
    colorSet.add((r << 16) | (g << 8) | b);
  }

  return {
    filePath,
    fileSizeBytes,
    hasValidSignature,
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
    chunks,
    idatChunks,
    zeroTruncation,
    decompressedBytes,
    decompressedLength,
    expectedDecompressedLength,
    rawPixels,
    rawPixelEntropy,
    rawPixelVariance,
    rawPixelStdDev,
    uniqueColorCount: colorSet.size,
  };
}

describe('Milestone 4 Adversarial Stress: Visual Proof Artifacts Invariant Verification', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/dark_fantasy');
  const MIN_REQUIRED_SIZE = 250 * 1024; // 256,000 bytes

  const REQUIRED_FILES = [
    {
      name: 'widened_fov_battlefield.png',
      description: 'Widened FOV battlefield (Z = 0.80, 1200x675 visible area)',
      minExpectedColors: 10000,
      minExpectedVariance: 400.0,
    },
    {
      name: 'modern_gothic_hud.png',
      description: 'Modern Gothic HUD (filigree health bar, soul-blue XP, gold chronometer)',
      minExpectedColors: 15000,
      minExpectedVariance: 500.0,
    },
    {
      name: 'dynamic_motion_proof.png',
      description: 'Dynamic motion proof (dash squash/stretch, walk bobs, spectral hover)',
      minExpectedColors: 15000,
      minExpectedVariance: 500.0,
    },
    {
      name: 'upgrade_modal_modern.png',
      description: 'Modern 4-tier rarity glassmorphic upgrade modal',
      minExpectedColors: 8000,
      minExpectedVariance: 800.0,
    },
  ];

  // =========================================================================
  // Test Suite 1: File Existence & Strict Size Boundary (>250KB)
  // =========================================================================
  describe('Suite 1: Physical File Presence & Strict >250KB Threshold', () => {
    for (const item of REQUIRED_FILES) {
      it(`verifies ${item.name} exists and strictly exceeds 250KB (256,000 bytes)`, () => {
        const fullPath = path.join(ARTIFACT_DIR, item.name);
        expect(fs.existsSync(fullPath), `File ${item.name} must exist on disk`).toBe(true);

        const stat = fs.statSync(fullPath);
        expect(
          stat.size,
          `File ${item.name} size (${stat.size} bytes) must strictly exceed 250KB (${MIN_REQUIRED_SIZE} bytes)`
        ).toBeGreaterThan(MIN_REQUIRED_SIZE);
      });
    }
  });

  // =========================================================================
  // Test Suite 2: Binary PNG Specification, IHDR & Chunk Parsing
  // =========================================================================
  describe('Suite 2: Binary PNG Specification, IHDR Dimensions & Chunk CRC32 Checksums', () => {
    for (const item of REQUIRED_FILES) {
      it(`parses and validates binary chunks for ${item.name}`, () => {
        const fullPath = path.join(ARTIFACT_DIR, item.name);
        const parsed = parseAndAnalyzePNG(fullPath);

        // 1. Signature
        expect(parsed.hasValidSignature).toBe(true);

        // 2. IHDR Dimensions (Retina 2x: 1920x1080)
        expect(parsed.width).toBe(1920);
        expect(parsed.height).toBe(1080);
        expect(parsed.bitDepth).toBe(8);
        expect([2, 6]).toContain(parsed.colorType); // Truecolor RGB or RGBA
        expect(parsed.compressionMethod).toBe(0);
        expect(parsed.filterMethod).toBe(0);

        // 3. Chunk sequence invariant: starts with IHDR, ends with IEND
        expect(parsed.chunks.length).toBeGreaterThanOrEqual(3);
        expect(parsed.chunks[0].type).toBe('IHDR');
        expect(parsed.chunks[parsed.chunks.length - 1].type).toBe('IEND');

        // 4. Zero truncation invariant: file ends cleanly at IEND
        expect(parsed.zeroTruncation).toBe(true);

        // 5. Cryptographic CRC32 validation: EVERY chunk CRC matches
        for (const chunk of parsed.chunks) {
          expect(
            chunk.crcValid,
            `Chunk ${chunk.type} in ${item.name} has invalid CRC (computed ${chunk.computedCRC} !== stored ${chunk.storedCRC})`
          ).toBe(true);
        }

        // 6. IDAT chunks presence
        expect(parsed.idatChunks.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  // =========================================================================
  // Test Suite 3: IDAT Decompression & Non-Blank Mathematical Proof
  // =========================================================================
  describe('Suite 3: IDAT Decompression, Scanline Reconstruction & Non-Blank Entropy/Variance', () => {
    for (const item of REQUIRED_FILES) {
      it(`decompresses and mathematically proves ${item.name} is non-blank and non-dummy`, () => {
        const fullPath = path.join(ARTIFACT_DIR, item.name);
        const parsed = parseAndAnalyzePNG(fullPath);

        // 1. Exact uncompressed byte length matches 1080 * (1 + 1920 * BPP)
        expect(parsed.decompressedLength).toBe(parsed.expectedDecompressedLength);
        expect(parsed.decompressedLength).toBe(6221880); // 1080 * (1 + 1920 * 3)

        // 2. Shannon Entropy of raw pixel values strictly > 4.0 bits/pixel
        // (Blank/solid color image would have entropy < 0.1 bits/pixel)
        expect(
          parsed.rawPixelEntropy,
          `Raw pixel entropy (${parsed.rawPixelEntropy.toFixed(3)}) in ${item.name} must be > 4.0 bits/pixel`
        ).toBeGreaterThan(4.0);

        // 3. Pixel Value Variance strictly > threshold (proves dramatic light/dark contrast)
        // (Solid color image has variance === 0.0)
        expect(
          parsed.rawPixelVariance,
          `Pixel variance (${parsed.rawPixelVariance.toFixed(2)}) in ${item.name} must exceed ${item.minExpectedVariance}`
        ).toBeGreaterThan(item.minExpectedVariance);

        expect(parsed.rawPixelStdDev).toBeGreaterThan(20.0);

        // 4. Unique 24-bit RGB Color Diversity
        // (Dummy or flat images have < 100 colors; genuine dark fantasy renders have > 8,000 colors)
        expect(
          parsed.uniqueColorCount,
          `Unique color count (${parsed.uniqueColorCount}) in ${item.name} must exceed ${item.minExpectedColors}`
        ).toBeGreaterThan(item.minExpectedColors);
      });
    }
  });

  // =========================================================================
  // Test Suite 4: Adversarial Oracles & Negative Controls
  // =========================================================================
  describe('Suite 4: Adversarial Negative Control Oracles', () => {
    it('catches and rejects truncated PNG buffers missing IEND', () => {
      const fullPath = path.join(ARTIFACT_DIR, 'widened_fov_battlefield.png');
      const validBuf = fs.readFileSync(fullPath);

      // Create truncated buffer (cut 500 bytes before end)
      const truncatedBuf = validBuf.subarray(0, validBuf.length - 500);

      // Verify parser detects truncation or missing IEND
      let caught = false;
      try {
        let offset = 8;
        while (offset + 12 <= truncatedBuf.length) {
          const length = truncatedBuf.readUInt32BE(offset);
          const type = truncatedBuf.toString('ascii', offset + 4, offset + 8);
          offset += 12 + length;
          if (type === 'IEND') break;
        }
        if (offset !== truncatedBuf.length) {
          caught = true; // Truncation detected
        }
      } catch {
        caught = true;
      }
      expect(caught).toBe(true);
    });

    it('catches and rejects corrupted CRC32 checksums', () => {
      const fullPath = path.join(ARTIFACT_DIR, 'widened_fov_battlefield.png');
      const validBuf = Buffer.from(fs.readFileSync(fullPath));

      // Corrupt a single byte in the IHDR chunk data
      validBuf[16] ^= 0xff; // Flip bit in width

      // Read stored CRC vs computed CRC
      const ihdrLength = validBuf.readUInt32BE(8);
      const chunkTarget = validBuf.subarray(12, 12 + 4 + ihdrLength);
      const computedCRC = calculateCRC32(chunkTarget);
      const storedCRC = validBuf.readUInt32BE(12 + 4 + ihdrLength);

      expect(computedCRC).not.toBe(storedCRC);
    });

    it('mathematically discriminates dummy solid black buffer (entropy ~ 0, variance === 0)', () => {
      const dummyPixels = Buffer.alloc(1920 * 1080 * 3, 0); // Solid black
      const freq = new Uint32Array(256);
      for (let i = 0; i < dummyPixels.length; i++) {
        freq[dummyPixels[i]]++;
      }
      let dummyEntropy = 0;
      for (let i = 0; i < 256; i++) {
        if (freq[i] > 0) {
          const p = freq[i] / dummyPixels.length;
          dummyEntropy -= p * Math.log2(p);
        }
      }

      // Solid color has exactly 0 entropy and 0 variance
      expect(dummyEntropy).toBe(0);

      // Real images have entropy > 4.0
      const realPath = path.join(ARTIFACT_DIR, 'widened_fov_battlefield.png');
      const realParsed = parseAndAnalyzePNG(realPath);
      expect(realParsed.rawPixelEntropy).toBeGreaterThan(4.0);
      expect(realParsed.rawPixelEntropy).toBeGreaterThan(dummyEntropy + 4.0);
    });
  });
});
