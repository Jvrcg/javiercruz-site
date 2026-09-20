// Central configuration and tunable constants for the creative resizer tool.
// Nothing here performs work. It is data only, read by lib/ and the section
// components.

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// 50 megapixels. Refuse to decode anything larger so a huge source image
// cannot lock up the tab.
export const MAX_INPUT_PIXELS = 50_000_000;

export const NAV_SECTIONS = [
  { key: 'upload', label: 'Upload' },
  { key: 'resize', label: 'Resize' },
  { key: 'crop', label: 'Crop' },
  { key: 'export', label: 'Export' },
  { key: 'preview', label: 'Preview' },
  { key: 'report', label: 'Report' },
];

// Generic aspect-ratio reference sizes, for testing only. NOT platform ad
// specs. Labeled by ratio only: do not attach a platform name to any entry
// here, and do not add to or expand this list without sourced values.
export const PRESETS = [
  { id: 'square-1-1', label: 'Square 1:1', width: 1080, height: 1080 },
  { id: 'landscape-1-91-1', label: 'Landscape 1.91:1', width: 1200, height: 628 },
  { id: 'vertical-9-16', label: 'Vertical 9:16', width: 1080, height: 1920 },
  { id: 'portrait-4-5', label: 'Portrait 4:5', width: 1080, height: 1350 },
];

// Any downscale steeper than this ratio is resampled in stepwise halving
// passes instead of a single drawImage call.
export const STEPWISE_RESAMPLE_THRESHOLD = 0.5;

// --- Phase 3 (export). Recorded now per approved Phase 0 amendments.
// Not wired up until Phase 3. ---

// Quality slider range. Disabled entirely when the selected format is PNG,
// since the quality argument only applies to lossy formats.
export const QUALITY_MIN = 0.6;
export const QUALITY_MAX = 1.0;

// Re-encode debounce while the quality slider is moving.
export const ENCODE_DEBOUNCE_MS = 180;

// Above this many (selected outputs times batch images), require explicit
// user confirmation before running the full encode matrix.
export const MAX_ENCODE_MATRIX = 40;

// Target-size binary search terminates within this many KB of the target,
// or after MAX_TARGET_SIZE_PASSES passes, whichever comes first.
export const TOLERANCE_KB = 5;
export const MAX_TARGET_SIZE_PASSES = 8;

// Chrome layer blur in the Phase 4 preview composition frames.
export const PREVIEW_CHROME_BLUR_PX = 6;

// Zip export uses fflate's async zip(), not zipSync: zipSync blocks the
// main thread, while the async API runs in Web Workers and parallelizes
// across files. Every file is stored with level: 0. JPEG, PNG, and WebP
// are already compressed, so re-compressing them in the zip wastes CPU for
// no size benefit. https://github.com/101arrowz/fflate
export const ZIP_COMPRESSION_LEVEL = 0;

export const FILENAME_TEMPLATE_DEFAULT = '{name}_{width}x{height}.{ext}';
