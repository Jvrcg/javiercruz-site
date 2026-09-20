import { useRef, useState } from 'react';

// The full drag-and-drop dropzone. Lives only in the Upload section; the
// rail's compact control (RailFileControl.jsx) has no drag behavior of
// its own. stopPropagation on drop keeps this from also being handled by
// the page-level fallback drop target in CreativeResizer.jsx.
export default function UploadDropzone({ onFileSelected, status, hasImage }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList) {
    const file = fileList && fileList[0];
    if (file) onFileSelected(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function handleInputChange(event) {
    handleFiles(event.target.files);
    event.target.value = '';
  }

  function openBrowser() {
    if (inputRef.current) inputRef.current.click();
  }

  const stateClasses = isDragging
    ? 'border-blue-500 bg-blue-50'
    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openBrowser}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openBrowser();
        }
      }}
      onDragOver={event => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center text-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors px-6 py-14 ${stateClasses}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />
      {status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">
            {hasImage ? 'Drop a new image to replace' : 'Drop an image here'}
          </p>
          <p className="text-xs text-gray-400">or click to browse. JPG, PNG, or WebP.</p>
        </>
      )}
    </div>
  );
}
