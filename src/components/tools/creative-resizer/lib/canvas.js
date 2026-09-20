import { ACCEPTED_MIME_TYPES, MAX_INPUT_PIXELS } from '../config.js';
import {
  EXIF_ORIENTATION_FIXTURE_BASE64,
  EXIF_FIXTURE_EXPECTED_WIDTH,
  EXIF_FIXTURE_EXPECTED_HEIGHT,
} from './exifOrientationFixture.js';

export class ImageLoadError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Loads a File/Blob into an ImageBitmap. This is the only decode path in
// the tool: there is no <img> src draw fallback anywhere. imageOrientation
// is always passed explicitly, even though "from-image" is the default,
// because it is what makes createImageBitmap honor EXIF rotation metadata.
// Phone photos carry a rotation tag; ignoring it produces sideways output.
//
// Note what this does NOT catch: a browser that does not recognize the
// second options argument at all does not throw. It decodes successfully
// and silently ignores imageOrientation, producing a correctly-decoded but
// wrongly rotated bitmap. There is no exception to catch and no field on
// the resulting bitmap that flags it. That failure mode is only detectable
// by decoding a fixture with a known EXIF orientation and checking whether
// the reported dimensions come back rotated. See
// detectExifOrientationSupport below, run once at startup rather than per
// upload, since it is a capability check, not a per-file validation.
// https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
export async function loadImageSource(file) {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new ImageLoadError(
      'unsupported-type',
      `"${file.type || 'unknown type'}" is not a supported format. Upload a JPG, PNG, or WebP file.`
    );
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageLoadError(
      'decode-failed',
      'This file could not be decoded. It may be corrupt or not a valid image.'
    );
  }

  const pixelCount = bitmap.width * bitmap.height;
  if (pixelCount > MAX_INPUT_PIXELS) {
    bitmap.close();
    const limitMegapixels = MAX_INPUT_PIXELS / 1_000_000;
    const actualMegapixels = pixelCount / 1_000_000;
    throw new ImageLoadError(
      'too-large',
      `This image is ${actualMegapixels.toFixed(1)} megapixels, over the ${limitMegapixels.toFixed(0)} megapixel limit.`
    );
  }

  return { bitmap, width: bitmap.width, height: bitmap.height };
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Decodes a fixture JPEG with a known EXIF orientation tag and checks
// whether the reported dimensions come back rotated as expected. Returns
// true if this browser's createImageBitmap actually honors
// imageOrientation, false if it silently ignored it (or the probe itself
// failed to decode, which is treated as unsupported). Run once at startup,
// not per upload: see the comment on loadImageSource above for why this
// exists.
export async function detectExifOrientationSupport() {
  try {
    const blob = base64ToBlob(EXIF_ORIENTATION_FIXTURE_BASE64, 'image/jpeg');
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const supported =
      bitmap.width === EXIF_FIXTURE_EXPECTED_WIDTH && bitmap.height === EXIF_FIXTURE_EXPECTED_HEIGHT;
    bitmap.close();
    return supported;
  } catch {
    return false;
  }
}
