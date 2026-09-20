import { useEffect, useRef } from 'react';

// Closes ImageBitmap objects and revokes object URLs that fall out of
// sourceFiles between renders, and disposes whatever remains on unmount.
// Disposal lives here rather than in the reducer: see the comment at the
// top of state.js for why.
export function useSourceDisposal(sourceFiles) {
  const prevSourcesRef = useRef([]);

  useEffect(() => {
    const nextIds = new Set(sourceFiles.map(source => source.id));
    for (const source of prevSourcesRef.current) {
      if (!nextIds.has(source.id)) {
        disposeSource(source);
      }
    }
    prevSourcesRef.current = sourceFiles;
  }, [sourceFiles]);

  useEffect(() => {
    return () => {
      for (const source of prevSourcesRef.current) {
        disposeSource(source);
      }
    };
  }, []);
}

function disposeSource(source) {
  if (source.bitmap) {
    try {
      source.bitmap.close();
    } catch {
      // Already closed, nothing to do.
    }
  }
  if (source.url) {
    URL.revokeObjectURL(source.url);
  }
}
