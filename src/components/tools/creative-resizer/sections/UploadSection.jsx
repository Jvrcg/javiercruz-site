import { useEffect, useRef } from 'react';
import UploadDropzone from '../UploadDropzone.jsx';

const PREVIEW_MAX_DIMENSION = 640;

function bytesToKB(bytes) {
  return Math.round(bytes / 1024);
}

export default function UploadSection({ status, error, source, onFileSelected }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!source || !source.bitmap || !canvasRef.current) return;
    const { bitmap, width, height } = source;
    const scale = Math.min(1, PREVIEW_MAX_DIMENSION / Math.max(width, height));
    const canvas = canvasRef.current;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }, [source]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload</h2>
        <p className="text-sm text-gray-500">
          Load a JPG, PNG, or WebP image. Everything happens in your browser: the image is never uploaded anywhere.
        </p>
      </div>

      <UploadDropzone status={status} hasImage={Boolean(source)} onFileSelected={onFileSelected} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {source && (
        <div className="flex flex-col gap-3">
          <canvas ref={canvasRef} className="max-w-full border border-gray-200 rounded-md" />
          <p className="text-sm text-gray-600">
            {source.name}, {source.width} × {source.height} pixels, {bytesToKB(source.sizeBytes)} KB
          </p>
        </div>
      )}
    </div>
  );
}
