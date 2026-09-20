import { FILENAME_TEMPLATE_DEFAULT } from './config.js';

// Disposal note: ImageBitmap.close() and URL.revokeObjectURL() are side
// effects. They must never run inside a reducer case, because a reducer
// has to stay a pure function of (state, action) and is not guaranteed to
// run exactly once per action (React StrictMode double-invokes reducers in
// development, for example). Disposal happens in
// hooks/useSourceDisposal.js, which diffs sourceFiles across renders and
// closes/revokes whatever fell out, plus cleans up on unmount. Do not move
// bitmap.close() or URL.revokeObjectURL() into this file.

export const initialState = {
  // Phase 1
  sourceFiles: [],
  activeSourceId: null,
  status: 'idle',
  error: null,
  activeSection: 'upload',

  // Phase 2
  selectedPresetIds: [],
  customOutputs: [],
  cropMode: 'fill',
  fitBackgroundColor: null,
  focalPoint: { x: 0.5, y: 0.5 },

  // Phase 3. Recorded now per approved Phase 0 amendments (A3, A4), not
  // wired up until Phase 3.
  activeOutputId: null,
  selectedFormat: 'jpeg',
  formatSupport: { png: null, jpeg: null, webp: null },
  quality: 0.92,
  targetSizeKB: null,
  filenameTemplate: FILENAME_TEMPLATE_DEFAULT,
  fillColorForFlattening: null,
  encodeStatus: 'idle',
  matrixConfirmed: false,

  // Phase 4
  previewContext: 'desktop',
  splitCompareTarget: null,

  // Cross-cutting export results, keyed by outputId then format. Derived
  // report values (Phase 5) are computed from this plus sourceFiles at
  // read time, not stored separately.
  results: {},
};

export function reducer(state, action) {
  switch (action.type) {
    case 'nav/setSection':
      return { ...state, activeSection: action.section };

    case 'upload/start':
      return { ...state, status: 'loading', error: null };

    case 'upload/success': {
      const source = action.source;
      return {
        ...state,
        status: 'idle',
        error: null,
        sourceFiles: [source],
        activeSourceId: source.id,
      };
    }

    case 'upload/error':
      return { ...state, status: 'error', error: action.error };

    default:
      return state;
  }
}
