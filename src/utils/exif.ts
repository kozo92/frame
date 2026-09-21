/**
 * Lightweight EXIF and image aspect ratio detector.
 * Supports reading EXIF orientation tags from JPEG headers without external dependencies.
 */

export interface ImageMetadata {
  width: number;
  height: number;
  isPortrait: boolean;
  exifOrientation?: number;
}

/**
 * Reads EXIF orientation from a JPEG ArrayBuffer.
 * Orientation values:
 * 1 = Normal (0°)
 * 3 = Upside Down (180°)
 * 6 = Rotated 90° CW (Camera rotated right, typical portrait photo)
 * 8 = Rotated 270° CW / 90° CCW (Camera rotated left)
 */
export function getExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) {
    return 1; // Not a valid JPEG
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset < length) {
    if (offset + 4 > length) break;
    const marker = view.getUint16(offset, false);
    offset += 2;

    if (marker === 0xffe1) {
      // APP1 Marker (EXIF)
      const segLength = view.getUint16(offset, false);
      offset += 2;

      if (segLength < 8 || offset + 6 > length) break;
      // Check for "Exif\0\0"
      if (view.getUint32(offset, false) === 0x45786966 && view.getUint16(offset + 4, false) === 0x0000) {
        const tiffStart = offset + 6;
        if (tiffStart + 8 > length) break;

        // Byte order: 0x4949 = Little Endian ('II'), 0x4D4D = Big Endian ('MM')
        const endianness = view.getUint16(tiffStart, false);
        const littleEndian = endianness === 0x4949;

        // TIFF magic number 42
        if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return 1;

        const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
        let ifdOffset = tiffStart + firstIfdOffset;
        if (ifdOffset + 2 > length) return 1;

        const entriesCount = view.getUint16(ifdOffset, littleEndian);
        ifdOffset += 2;

        for (let i = 0; i < entriesCount; i++) {
          const entryOffset = ifdOffset + i * 12;
          if (entryOffset + 12 > length) break;

          const tag = view.getUint16(entryOffset, littleEndian);
          if (tag === 0x0112) {
            // Orientation tag
            const orientation = view.getUint16(entryOffset + 8, littleEndian);
            if (orientation >= 1 && orientation <= 8) {
              return orientation;
            }
          }
        }
      }
      break;
    } else if ((marker & 0xff00) !== 0xff00 || marker === 0xffda || marker === 0xffd9) {
      // End of headers
      break;
    } else {
      const segLength = view.getUint16(offset, false);
      offset += segLength;
    }
  }

  return 1;
}

/**
 * Asynchronously detects dimensions and portrait status of an image file.
 */
export async function detectFileMetadata(file: File): Promise<ImageMetadata> {
  // Read first 64KB for EXIF orientation if JPEG
  let exifOrientation = 1;
  if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
    try {
      const slice = file.slice(0, 65536);
      const buffer = await slice.arrayBuffer();
      exifOrientation = getExifOrientation(buffer);
    } catch {
      // Non-blocking fallback
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth || 1920;
      let h = img.naturalHeight || 1080;

      // In browsers where EXIF isn't automatically normalized:
      // orientation 6 or 8 means the photo was captured vertically
      const isPortrait = (exifOrientation === 6 || exifOrientation === 8)
        ? true
        : h > w;

      resolve({
        width: w,
        height: h,
        isPortrait,
        exifOrientation,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: 1920,
        height: 1080,
        isPortrait: false,
        exifOrientation: 1,
      });
    };

    img.src = url;
  });
}
