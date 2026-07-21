import { useState } from 'react';
import FunnelDiagnosticInput from './FunnelDiagnosticInput.jsx';
import FunnelDiagnosticOutput from './FunnelDiagnosticOutput.jsx';

export default function FunnelDiagnosticApp() {
  const [periods, setPeriods] = useState([]);
  const [mqlToSql, setMqlToSql] = useState('');
  const [sqlToOpp, setSqlToOpp] = useState('');

  return (
    <div>
      <div className="fd-wrap" style={{ marginBottom: 24 }}>
        <span className="fd-label">Your sales-cycle timing (recommended)</span>
        <p className="fd-note">
          Optional but recommended. Entering your own average time-in-stage lets the tool judge recent periods against your real sales cycle instead of a generic assumption. Leave blank if you are not sure.
        </p>
        <div className="fd-form-grid">
          <div>
            <label className="fd-label" style={{ marginBottom: 4 }}>Average days, MQL to SQL (recommended)</label>
            <input type="number" className="fd-input" value={mqlToSql} onChange={e => setMqlToSql(e.target.value)} />
          </div>
          <div>
            <label className="fd-label" style={{ marginBottom: 4 }}>Average days, SQL to Opp/Won (recommended)</label>
            <input type="number" className="fd-input" value={sqlToOpp} onChange={e => setSqlToOpp(e.target.value)} />
          </div>
        </div>
      </div>

      <FunnelDiagnosticInput onDataChange={setPeriods} />
      <FunnelDiagnosticOutput periods={periods} settings={{ mqlToSql, sqlToOpp }} />
    </div>
  );
}
