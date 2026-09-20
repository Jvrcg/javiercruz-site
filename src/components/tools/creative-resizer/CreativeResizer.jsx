import { useCallback, useEffect, useReducer } from 'react';
import { reducer, initialState } from './state.js';
import { useSourceDisposal } from './hooks/useSourceDisposal.js';
import { loadImageSource, detectExifOrientationSupport, ImageLoadError } from './lib/canvas.js';
import NavRail from './NavRail.jsx';
import UploadSection from './sections/UploadSection.jsx';
import ResizeSection from './sections/ResizeSection.jsx';
import CropSection from './sections/CropSection.jsx';
import ExportSection from './sections/ExportSection.jsx';
import PreviewSection from './sections/PreviewSection.jsx';
import ReportSection from './sections/ReportSection.jsx';

const SECTION_COMPONENTS = {
  upload: UploadSection,
  resize: ResizeSection,
  crop: CropSection,
  export: ExportSection,
  preview: PreviewSection,
  report: ReportSection,
};

let sourceIdCounter = 0;

export default function CreativeResizer() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useSourceDisposal(state.sourceFiles);

  useEffect(() => {
    let cancelled = false;
    detectExifOrientationSupport().then(supported => {
      if (!cancelled) dispatch({ type: 'diagnostics/setExifOrientationSupport', supported });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileSelected = useCallback(async file => {
    // A file can be picked from the rail, the page-level drop target, or
    // the Upload section's own dropzone, but load feedback (the preview,
    // the dimensions, any error) only renders in the Upload section.
    // Jump there so the result of every load attempt is always visible.
    dispatch({ type: 'nav/setSection', section: 'upload' });
    dispatch({ type: 'upload/start' });
    try {
      const { bitmap, width, height } = await loadImageSource(file);
      sourceIdCounter += 1;
      dispatch({
        type: 'upload/success',
        source: {
          id: `source-${sourceIdCounter}`,
          bitmap,
          width,
          height,
          name: file.name,
          sizeBytes: file.size,
        },
      });
    } catch (err) {
      const code = err instanceof ImageLoadError ? err.code : 'unknown';
      const message = err instanceof ImageLoadError
        ? err.message
        : 'Something went wrong loading this image.';
      dispatch({ type: 'upload/error', error: { code, message } });
    }
  }, []);

  // Page-level drop target: the rail's dropzone was providing "drop a file
  // from anywhere in the tool" behavior. Now that the rail has no dropzone
  // of its own, this replaces that. Bound to window so it covers the
  // whole page, not just the tool's own DOM subtree. UploadDropzone's own
  // onDrop calls stopPropagation, so a drop that lands on the Upload
  // section's dropzone is handled there only, not here as well.
  useEffect(() => {
    function handleWindowDragOver(event) {
      event.preventDefault();
    }
    function handleWindowDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    }
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleFileSelected]);

  const activeSource = state.sourceFiles.find(s => s.id === state.activeSourceId) || null;
  const ActiveSection = SECTION_COMPONENTS[state.activeSection] || UploadSection;

  return (
    <div className="flex flex-col md:flex-row md:min-h-screen bg-white">
      <NavRail
        activeSection={state.activeSection}
        onSelectSection={section => dispatch({ type: 'nav/setSection', section })}
        status={state.status}
        fileName={activeSource ? activeSource.name : null}
        onFileSelected={handleFileSelected}
      />
      <div className="flex-1 min-w-0 px-4 py-6 md:px-8 md:py-8">
        {state.exifOrientationSupported === false && (
          <div className="mb-6 max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This browser does not appear to apply photo rotation metadata automatically. Images taken on a phone in portrait orientation may appear sideways after upload.
          </div>
        )}
        <ActiveSection
          status={state.status}
          error={state.error}
          source={activeSource}
          onFileSelected={handleFileSelected}
        />
      </div>
    </div>
  );
}
