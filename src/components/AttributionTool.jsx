import { useState } from 'react';

export default function AttributionTool() {
  const [ready] = useState(true);

  return (
    <div className="rounded-lg border border-gray-200 p-6 text-gray-700">
      {ready ? 'Attribution tool placeholder — component code coming soon.' : null}
    </div>
  );
}
