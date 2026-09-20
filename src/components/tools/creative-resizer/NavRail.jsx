import { useState } from 'react';
import { NAV_SECTIONS } from './config.js';
import UploadDropzone from './UploadDropzone.jsx';

function NavList({ activeSection, onSelectSection }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_SECTIONS.map(section => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelectSection(section.key)}
          className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === section.key
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

export default function NavRail({ activeSection, onSelectSection, status, hasImage, onFileSelected }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  function selectSection(key) {
    onSelectSection(key);
    setDrawerOpen(false);
  }

  return (
    <>
      {/* Top bar, visible below the md breakpoint */}
      <div className="md:hidden flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-white sticky top-0 z-20">
        <p className="text-sm font-semibold text-gray-900">Creative Resizer</p>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-sm font-medium text-blue-600"
        >
          Menu
        </button>
      </div>

      {/* Drawer, visible below the md breakpoint */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-white overflow-y-auto p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Creative Resizer</p>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-sm text-gray-500">
                Close
              </button>
            </div>
            <UploadDropzone compact status={status} hasImage={hasImage} onFileSelected={onFileSelected} />
            <NavList activeSection={activeSection} onSelectSection={selectSection} />
          </div>
        </div>
      )}

      {/* Persistent rail, visible at and above the md breakpoint */}
      <div className="hidden md:flex md:flex-col md:w-64 md:shrink-0 md:h-screen md:sticky md:top-0 md:overflow-y-auto md:border-r md:border-gray-200 md:p-4 md:gap-4 bg-white">
        <p className="text-sm font-semibold text-gray-900">Creative Resizer</p>
        <UploadDropzone compact status={status} hasImage={hasImage} onFileSelected={onFileSelected} />
        <NavList activeSection={activeSection} onSelectSection={onSelectSection} />
      </div>
    </>
  );
}
