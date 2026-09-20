import { useRef, useState } from 'react';

// Drag and drop plus click to browse, shared by the nav rail's compact
// control and the full-size Upload section. Always mounted so a new file
// can replace the current one from anywhere in the tool.
export default function UploadDropzone({ onFileSelected, status, hasImage, compact = false }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(fileList) {
    const file = fileList && fileList[0];
    if (file) onFileSelected(file);
  }

  function handleDrop(event) {
    event.preventDefault();
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

  const sizeClasses = compact ? 'px-3 py-4 gap-1' : 'px-6 py-14 gap-2';
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
      className={`flex flex-col items-center justify-center text-center rounded-lg border-2 border-dashed cursor-pointer transition-colors ${sizeClasses} ${stateClasses}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />
      {status === 'loading' ? (
        <p className={compact ? 'text-xs text-gray-500' : 'text-sm text-gray-500'}>Loading...</p>
      ) : (
        <>
          <p className={compact ? 'text-xs font-medium text-gray-700' : 'text-sm font-medium text-gray-700'}>
            {hasImage ? (compact ? 'Replace image' : 'Drop a new image to replace') : 'Drop an image here'}
          </p>
          <p className={compact ? 'text-[11px] text-gray-400' : 'text-xs text-gray-400'}>
            or click to browse. JPG, PNG, or WebP.
          </p>
        </>
      )}
    </div>
  );
}
