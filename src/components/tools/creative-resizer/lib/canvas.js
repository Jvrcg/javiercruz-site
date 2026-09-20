import { ACCEPTED_MIME_TYPES, MAX_INPUT_PIXELS } from '../config.js';

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
