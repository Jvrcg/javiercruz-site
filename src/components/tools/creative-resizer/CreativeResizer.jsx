import { useCallback, useReducer } from 'react';
import { reducer, initialState } from './state.js';
import { useSourceDisposal } from './hooks/useSourceDisposal.js';
import { loadImageSource, ImageLoadError } from './lib/canvas.js';
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

  const handleFileSelected = useCallback(async file => {
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

  const activeSource = state.sourceFiles.find(s => s.id === state.activeSourceId) || null;
  const ActiveSection = SECTION_COMPONENTS[state.activeSection] || UploadSection;

  return (
    <div className="flex flex-col md:flex-row md:min-h-screen bg-white">
      <NavRail
        activeSection={state.activeSection}
        onSelectSection={section => dispatch({ type: 'nav/setSection', section })}
        status={state.status}
        hasImage={Boolean(activeSource)}
        onFileSelected={handleFileSelected}
      />
      <main className="flex-1 min-w-0 px-4 py-6 md:px-8 md:py-8">
        <div className="max-w-3xl">
          <ActiveSection
            status={state.status}
            error={state.error}
            source={activeSource}
            onFileSelected={handleFileSelected}
          />
        </div>
      </main>
    </div>
  );
}
