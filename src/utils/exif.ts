/**
 * Analyseur EXIF ultra-performant et gestionnaire d'orientation d'image.
 * Prend en charge la détection du tag EXIF standard 0x0112 (Orientation).
 * 
 * Valeurs standard du tag EXIF 0x0112 :
 * 1 = 0° (Normal - Paysage)
 * 2 = Miroir horizontal
 * 3 = 180° (Inversé)
 * 4 = Miroir vertical
 * 5 = Miroir horizontal & Rotation 270° CW -> Mode Portrait
 * 6 = Rotation 90° CW (appareil tourné à droite) -> Mode Portrait
 * 7 = Miroir horizontal & Rotation 90° CW -> Mode Portrait
 * 8 = Rotation 270° CW / 90° CCW (appareil tourné à gauche) -> Mode Portrait
 */

export const EXIF_TAG_ORIENTATION = 0x0112;

export interface ImageMetadata {
  width: number;
  height: number;
  isPortrait: boolean;
  exifOrientation: number;
}

/**
 * Détermine si la valeur du tag EXIF 0x0112 correspond à une prise de vue en mode portrait.
 * Les valeurs 5, 6, 7 et 8 indiquent une rotation d'un quart de tour (photo verticale).
 */
export function isExifPortrait(orientation: number): boolean {
  return orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
}

/**
 * Parse un en-tête TIFF (TIFF Header) pour extraire la valeur du tag 0x0112 (Orientation).
 */
export function parseTiffOrientation(view: DataView, tiffStart: number): number {
  const length = view.byteLength;
  if (tiffStart + 8 > length) return 1;

  // Détection de l'endianness : 0x4949 = Little Endian ('II'), 0x4D4D = Big Endian ('MM')
  const endianness = view.getUint16(tiffStart, false);
  const littleEndian = endianness === 0x4949;
  if (!littleEndian && endianness !== 0x4d4d) return 1;

  // Numéro magique TIFF 42 (0x002A)
  if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) return 1;

  // Offset vers le premier IFD (IFD0)
  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const initialIfd = tiffStart + firstIfdOffset;

  // File d'attente pour scanner IFD0, IFD1 ou le sous-répertoire ExifIFD (0x8769)
  const ifdsToScan: number[] = [initialIfd];
  const visited = new Set<number>();

  while (ifdsToScan.length > 0) {
    const curIfd = ifdsToScan.shift()!;
    if (visited.has(curIfd) || curIfd + 2 > length) continue;
    visited.add(curIfd);

    const entriesCount = view.getUint16(curIfd, littleEndian);
    const entriesStart = curIfd + 2;

    for (let i = 0; i < entriesCount; i++) {
      const entryOffset = entriesStart + i * 12;
      if (entryOffset + 12 > length) break;

      const tag = view.getUint16(entryOffset, littleEndian);

      // TAG 0x0112 : ORIENTATION
      if (tag === EXIF_TAG_ORIENTATION) {
        const orientation = view.getUint16(entryOffset + 8, littleEndian);
        if (orientation >= 1 && orientation <= 8) {
          return orientation;
        }
      } else if (tag === 0x8769) {
        // Pointeur vers le sous-répertoire ExifIFD
        const subIfdOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
        if (subIfdOffset + 2 <= length && !visited.has(subIfdOffset)) {
          ifdsToScan.push(subIfdOffset);
        }
      }
    }

    // Pointeur éventuel vers l'IFD suivant (IFD1)
    const nextIfdPtrOffset = entriesStart + entriesCount * 12;
    if (nextIfdPtrOffset + 4 <= length) {
      const nextIfdOffset = view.getUint32(nextIfdPtrOffset, littleEndian);
      if (nextIfdOffset > 0 && tiffStart + nextIfdOffset + 2 <= length) {
        ifdsToScan.push(tiffStart + nextIfdOffset);
      }
    }
  }

  return 1;
}

/**
 * Extrait la valeur du tag EXIF 0x0112 (Orientation) depuis un ArrayBuffer (JPEG, WebP ou PNG).
 */
export function getExifOrientation(buffer: ArrayBuffer): number {
  if (!buffer || buffer.byteLength < 4) return 1;
  const view = new DataView(buffer);
  const length = view.byteLength;

  // 1. FORMAT JPEG (SOI = 0xFFD8)
  if (view.getUint16(0, false) === 0xffd8) {
    let offset = 2;
    while (offset < length - 1) {
      // Trouver le prochain octet 0xFF marquant le début d'un segment
      if (view.getUint8(offset) !== 0xff) {
        offset++;
        continue;
      }
      // Ignorer les octets de remplissage 0xFF consécutifs
      while (offset < length && view.getUint8(offset) === 0xff) {
        offset++;
      }
      if (offset >= length) break;

      const marker = view.getUint8(offset);
      offset++;

      // Fin des en-têtes ou début du scan de données compressées (SOS = 0xDA, EOI = 0xD9)
      if (marker === 0xda || marker === 0xd9) {
        break;
      }

      // Marqueurs sans longueur (RST0-RST7, TEM, etc.)
      if (marker >= 0xd0 && marker <= 0xd8) {
        continue;
      }

      if (offset + 2 > length) break;
      const segLength = view.getUint16(offset, false);
      if (segLength < 2) break;

      // SEGMENT APP1 (0xE1) -> EXIF
      if (marker === 0xe1) {
        const payloadOffset = offset + 2;
        if (payloadOffset + 6 <= length) {
          // Vérification de la signature "Exif\0\0"
          const isExif =
            view.getUint32(payloadOffset, false) === 0x45786966 && // "Exif"
            view.getUint16(payloadOffset + 4, false) === 0x0000;   // "\0\0"

          if (isExif) {
            const tiffStart = payloadOffset + 6;
            const orientation = parseTiffOrientation(view, tiffStart);
            if (orientation >= 1 && orientation <= 8) {
              return orientation;
            }
          }
        }
      }

      offset += segLength;
    }
    return 1;
  }

  // 2. FORMAT WEBP (RIFF .... WEBP)
  if (
    length >= 12 &&
    view.getUint32(0, false) === 0x52494646 && // 'RIFF'
    view.getUint32(8, false) === 0x57454250    // 'WEBP'
  ) {
    let offset = 12;
    while (offset + 8 <= length) {
      const chunkFourCC = view.getUint32(offset, false);
      const chunkSize = view.getUint32(offset + 4, true); // Little endian size
      offset += 8;

      if (chunkFourCC === 0x45584946) { // 'EXIF'
        const orientation = parseTiffOrientation(view, offset);
        if (orientation >= 1 && orientation <= 8) {
          return orientation;
        }
        break;
      }
      // Les chunks WebP sont alignés sur 2 octets
      offset += chunkSize + (chunkSize % 2);
    }
    return 1;
  }

  // 3. FORMAT PNG
  if (
    length >= 8 &&
    view.getUint32(0, false) === 0x89504e47 &&
    view.getUint32(4, false) === 0x0d0a1a0a
  ) {
    let offset = 8;
    while (offset + 8 <= length) {
      const chunkSize = view.getUint32(offset, false);
      const chunkType = view.getUint32(offset + 4, false);
      offset += 8;

      if (chunkType === 0x65584966) { // 'eXIf'
        const orientation = parseTiffOrientation(view, offset);
        if (orientation >= 1 && orientation <= 8) {
          return orientation;
        }
        break;
      }
      offset += chunkSize + 4; // Skip data + CRC
    }
    return 1;
  }

  return 1;
}

/**
 * Extrait le tag EXIF 0x0112 de façon asynchrone et ultra-rapide depuis un Blob ou File.
 * Ne lit que les premiers 64 Ko pour ne pas ralentir le diaporama.
 */
export async function getExifOrientationFromBlob(blob: Blob): Promise<number> {
  try {
    const slice = blob.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    return getExifOrientation(buffer);
  } catch {
    return 1;
  }
}

/**
 * Extrait le tag EXIF 0x0112 depuis n'importe quelle URL (blob:, data:, ou web).
 */
export async function getExifOrientationFromUrl(url: string): Promise<number> {
  try {
    const response = await fetch(url);
    if (!response.ok) return 1;
    const blob = await response.blob();
    return await getExifOrientationFromBlob(blob);
  } catch {
    return 1;
  }
}

/**
 * Détecte les dimensions et l'état mode portrait d'une photo en examinant :
 * 1. Le tag EXIF 0x0112 (valeurs 5, 6, 7, 8 -> Mode Portrait).
 * 2. Le ratio naturel de l'image (hauteur > largeur -> Mode Portrait).
 */
export async function detectPhotoMetadata(url: string, fileOrBlob?: Blob): Promise<ImageMetadata> {
  let exifOrientation = 1;

  try {
    if (fileOrBlob) {
      exifOrientation = await getExifOrientationFromBlob(fileOrBlob);
    } else {
      exifOrientation = await getExifOrientationFromUrl(url);
    }
  } catch {
    exifOrientation = 1;
  }

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const w = img.naturalWidth || 1920;
      const h = img.naturalHeight || 1080;

      // Mode portrait si tag EXIF 0x0112 indique une rotation portrait (5, 6, 7, 8)
      // OU si la hauteur naturelle de l'image dépasse sa largeur
      const isPortrait = isExifPortrait(exifOrientation) || h > w;

      resolve({
        width: w,
        height: h,
        isPortrait,
        exifOrientation,
      });
    };

    img.onerror = () => {
      const isPortrait = isExifPortrait(exifOrientation);
      resolve({
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
        isPortrait,
        exifOrientation,
      });
    };

    img.src = url;
  });
}

/**
 * Ancien helper pour compatibilité ascendante.
 */
export async function detectFileMetadata(file: File): Promise<ImageMetadata> {
  return detectPhotoMetadata(URL.createObjectURL(file), file);
}
