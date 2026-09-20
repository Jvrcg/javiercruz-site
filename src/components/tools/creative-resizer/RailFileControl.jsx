import { useRef } from 'react';

// The rail's compact upload control. No dashed border, no drag styling, no
// drop handler: the drag-and-drop dropzone lives only in the Upload
// section (sections/UploadSection.jsx). This is a filename readout plus a
// button that opens the file picker.
export default function RailFileControl({ fileName, status, onFileSelected }) {
  const inputRef = useRef(null);

  function handleChange(event) {
    const file = event.target.files && event.target.files[0];
    if (file) onFileSelected(file);
    event.target.value = '';
  }

  const isLoading = status === 'loading';

  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 bg-gray-50">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      <p className="flex-1 min-w-0 truncate text-xs text-gray-600">
        {isLoading ? 'Loading...' : fileName || 'No image loaded'}
      </p>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => inputRef.current && inputRef.current.click()}
        className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        Replace
      </button>
    </div>
  );
}
