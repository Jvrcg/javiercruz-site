import { useState, useEffect, useRef } from 'react';
import { computeChannelCoverage } from './funnelDiagnostics.js';
import { FunnelCoverageChart } from './FunnelCoverageChart.jsx';

const IGNORE = '__ignore__';

export const FUNNEL_FIELDS = [
  { key: 'month', label: 'Reporting Date', required: true, aliases: ['month', 'period', 'monthperiod', 'reportingmonth', 'reportingperiod', 'reportingdate', 'date', 'monthyear'] },
  { key: 'channel', label: 'Channel', required: true, options: ['Google Ads', 'LinkedIn', 'Meta', 'Programmatic/DSP', 'Other'], aliases: ['channel', 'adchannel', 'mediachannel', 'marketingchannel', 'platform'] },
  { key: 'spend', label: 'Spend', aliases: ['spend', 'adspend', 'totalspend', 'mediaspend', 'cost', 'totalcost'] },
  { key: 'clicks', label: 'Clicks', aliases: ['clicks', 'totalclicks', 'clickcount'] },
  { key: 'leads', label: 'Leads', aliases: ['leads', 'totalleads', 'formfills', 'formsubmissions'] },
  { key: 'mqls', label: 'MQLs', aliases: ['mqls', 'mql', 'mqlcount', 'marketingqualifiedleads'] },
  { key: 'opportunitiesCreated', label: 'Opportunities Created', aliases: ['opportunitiescreated', 'opportunities', 'oppscreated', 'opps', 'newopportunities'] },
  { key: 'closedWonDeals', label: 'Closed-Won Deals', aliases: ['closedwondeals', 'closedwon', 'wondeals', 'deals', 'closedwondealscount'] },
  { key: 'dealValue', label: 'Deal Value', aliases: ['dealvalue', 'revenue', 'dealrevenue', 'closedwonvalue', 'dealsvalue', 'totaldealvalue'] },
  { key: 'daysSinceLastCreativeRefresh', label: 'Days Since Last Creative Refresh', aliases: ['dayssincelastcreativerefresh', 'dayssincecreativerefresh', 'creativerefreshdays', 'daysincelastrefresh'] },
  { key: 'channelLaunchDate', label: 'Channel Launch Date', aliases: ['channellaunchdate', 'launchdate', 'channelstartdate'] },
  { key: 'placementTierOrViewabilityTrend', label: 'Placement-Tier or Viewability Trend', aliases: ['placementtierorviewabilitytrend', 'placementtier', 'viewabilitytrend', 'viewability', 'placementtierviewabilitytrend'] },
  { key: 'campaignObjective', label: 'Campaign Objective', aliases: ['campaignobjective', 'objective', 'adobjective'] },
];

const FIELD_LABEL_BY_KEY = Object.fromEntries(FUNNEL_FIELDS.map(f => [f.key, f.label]));

const FIELD_PLACEHOLDERS = {
  month: 'e.g. 2026-07-24',
  spend: 'e.g. 15000',
  clicks: 'e.g. 4200',
  leads: 'e.g. 180',
  mqls: 'e.g. 45',
  opportunitiesCreated: 'e.g. 12',
  closedWonDeals: 'e.g. 3',
  dealValue: 'e.g. 45000',
  daysSinceLastCreativeRefresh: 'e.g. 20',
  channelLaunchDate: 'e.g. 2024-03-01',
  placementTierOrViewabilityTrend: 'e.g. Tier 1',
  campaignObjective: 'e.g. Lead Gen',
};

const REQUIRED_FIELDS = FUNNEL_FIELDS.filter(f => f.required);

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findFieldForHeader(header) {
  const norm = normalize(header);
  if (!norm) return null;
  for (const field of FUNNEL_FIELDS) {
    if (field.aliases.some(a => normalize(a) === norm)) return field.key;
  }
  return null;
}

function detectDelimiter(line) {
  return line.includes('\t') ? '\t' : ',';
}

function parseDelimitedLine(line, delimiter) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  return cols.map(c => c.replace(/^"|"$/g, ''));
}

function parsePastedData(raw) {
  const lines = raw.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { error: 'Upload a file with a header row and at least one data row.' };
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map(l => parseDelimitedLine(l, delimiter));
  return { headers, rows };
}

function buildMapping(headers) {
  const claimed = new Set();
  return headers.map((header, index) => {
    const auto = findFieldForHeader(header);
    let fieldKey = null;
    if (auto && !claimed.has(auto)) {
      fieldKey = auto;
      claimed.add(auto);
    }
    return { index, header, fieldKey };
  });
}

function buildPeriodFromRow(mapping, row) {
  const period = Object.fromEntries(FUNNEL_FIELDS.map(f => [f.key, '']));
  mapping.forEach(m => {
    if (m.fieldKey && m.fieldKey !== IGNORE) {
      period[m.fieldKey] = (row[m.index] ?? '').trim();
    }
  });
  return period;
}

function periodKey(period) {
  return normalize(period.month) + '|' + normalize(period.channel);
}

function mergePeriod(periods, newPeriod) {
  const key = periodKey(newPeriod);
  const idx = periods.findIndex(p => periodKey(p) === key);
  if (idx >= 0) {
    const updated = [...periods];
    updated[idx] = newPeriod;
    return updated;
  }
  return [...periods, newPeriod];
}

function csvField(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadTemplate() {
  const headerRow = FUNNEL_FIELDS.map(f => f.label).map(csvField).join(',');
  const exampleRow = ['2026-07-24', 'Google Ads', '15000', '4200', '180', '45', '12', '3', '45000', '12', '2024-03-01', 'Tier 1', 'Lead Gen'].map(csvField).join(',');
  const csv = headerRow + '\n' + exampleRow + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'funnel-diagnostic-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FunnelDiagnosticInput({ onDataChange } = {}) {
  const [periods, setPeriods] = useState([]);

  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [parsedRows, setParsedRows] = useState(null);
  const [mapping, setMapping] = useState(null);

  useEffect(() => {
    if (onDataChange) onDataChange(periods);
  }, [periods, onDataChange]);

  function processRawText(raw, sourceLabel) {
    if (!raw || !raw.trim()) { setUploadError('The file looks empty.'); setMapping(null); setParsedRows(null); return; }
    const parsed = parsePastedData(raw);
    if (parsed.error) { setUploadError(parsed.error); setMapping(null); setParsedRows(null); return; }
    setUploadError('');
    setUploadSuccess('');
    setParsedRows(parsed.rows);
    setMapping(buildMapping(parsed.headers));
  }

  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.tsv') && !name.endsWith('.txt')) {
      setUploadError('Please upload a .csv, .tsv, or .txt file exported from your spreadsheet or ad platform.');
      setMapping(null); setParsedRows(null);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { processRawText(String(reader.result || ''), file.name); };
    reader.onerror = () => { setUploadError('Could not read that file. Try re-exporting it as CSV.'); };
    reader.readAsText(file);
    e.target.value = ''; // allow re-uploading the same filename
  }

  function handleMappingChange(index, value) {
    setMapping(prev => prev.map(m => (m.index === index ? { ...m, fieldKey: value === '' ? null : value } : m)));
  }

  const missingRequiredFields = mapping ? REQUIRED_FIELDS.filter(rf => !mapping.some(m => m.fieldKey === rf.key)) : [];
  const fieldCounts = {};
  if (mapping) {
    mapping.forEach(m => {
      if (m.fieldKey && m.fieldKey !== IGNORE) fieldCounts[m.fieldKey] = (fieldCounts[m.fieldKey] || 0) + 1;
    });
  }
  const duplicateFields = Object.entries(fieldCounts).filter(([, c]) => c > 1).map(([k]) => k);
  const matchedCount = mapping ? mapping.filter(m => m.fieldKey && m.fieldKey !== IGNORE).length : 0;
  const unmatchedCount = mapping ? mapping.filter(m => !m.fieldKey).length : 0;
  const canConfirm = !!mapping && missingRequiredFields.length === 0 && duplicateFields.length === 0 && unmatchedCount === 0;

  function handleConfirmMapping() {
    if (!canConfirm || !mapping || !parsedRows) return;
    let updated = periods;
    let count = 0;
    parsedRows.forEach(row => {
      const period = buildPeriodFromRow(mapping, row);
      if (REQUIRED_FIELDS.some(rf => !period[rf.key])) return;
      updated = mergePeriod(updated, period);
      count += 1;
    });
    setPeriods(updated);
    setMapping(null);
    setParsedRows(null);
    setUploadSuccess(`${count} period${count === 1 ? '' : 's'} added to confirmed data.`);
  }

  function handleCancelMapping() {
    setMapping(null);
    setParsedRows(null);
    setUploadError('');
  }

  function handleRemovePeriod(index) {
    setPeriods(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="fd-wrap">
      <div>
        <span className="fd-label">Upload your funnel data</span>
        <p className="fd-note" style={{ marginBottom: 12 }}>
          Upload your performance history as a CSV. One row per channel per date. Daily, weekly, or monthly data all work. The tool groups everything into 90-day windows before running the diagnosis. Include the header row.
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: '#4b5563', lineHeight: 1.6, listStyleType: 'disc' }}>
          <li>One row per channel per reporting date</li>
          <li>Aim for at least 90 days of data per channel; some checks need that much history to run</li>
          <li>Include the header row</li>
        </ul>
        <div style={{ marginBottom: 6 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button type="button" className="fd-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            Upload CSV file
          </button>
        </div>
        <p className="fd-note" style={{ marginBottom: 16 }}>
          Accepts .csv, .tsv, or .txt. Not sure of the format? Download the{' '}
          <a href="#" className="fd-link" onClick={(e) => { e.preventDefault(); downloadTemplate(); }}>template</a>.
        </p>
        {uploadError && <p className="fd-error" style={{ marginTop: 10 }}>{uploadError}</p>}
        {uploadSuccess && <p className="fd-success" style={{ marginTop: 10 }}>{uploadSuccess}</p>}

        {mapping && (
          <div className="fd-card" style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Confirm column mapping</p>
            <p className="fd-note">
              {matchedCount} of {mapping.length} column{mapping.length === 1 ? '' : 's'} matched automatically
              {unmatchedCount > 0 ? `, ${unmatchedCount} need a field selected below` : ''}. Nothing is added to your data until you confirm.
            </p>
            {missingRequiredFields.length > 0 && (
              <p className="fd-warn">
                {missingRequiredFields.map(f => f.label).join(', ')} {missingRequiredFields.length === 1 ? 'is' : 'are'} required. Map a column to each before confirming.
              </p>
            )}
            {unmatchedCount > 0 && (
              <p className="fd-warn">
                {unmatchedCount} column{unmatchedCount === 1 ? '' : 's'} still need{unmatchedCount === 1 ? 's' : ''} a field selected or "Ignore this column" chosen. Unmapped columns are never silently dropped, resolve each one before confirming.
              </p>
            )}
            {duplicateFields.length > 0 && (
              <p className="fd-warn">
                More than one column is mapped to the same field ({duplicateFields.map(k => FIELD_LABEL_BY_KEY[k]).join(', ')}). Change one to "Ignore this column" or a different field.
              </p>
            )}
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Detected column header</th>
                    <th>Sample value</th>
                    <th>Status</th>
                    <th>Mapped field</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map(m => (
                    <tr key={m.index}>
                      <td>{m.header ? m.header : <em style={{ color: '#9ca3af' }}>(blank)</em>}</td>
                      <td>{parsedRows && parsedRows[0] ? parsedRows[0][m.index] || '' : ''}</td>
                      <td>
                        {m.fieldKey === IGNORE ? (
                          <span className="fd-badge fd-badge-ignored">Ignored</span>
                        ) : m.fieldKey ? (
                          <span className="fd-badge fd-badge-matched">Matched</span>
                        ) : (
                          <span className="fd-badge fd-badge-unmatched">Unmatched</span>
                        )}
                      </td>
                      <td>
                        <select className="fd-select" value={m.fieldKey || ''} onChange={e => handleMappingChange(m.index, e.target.value)}>
                          <option value="">Select a field...</option>
                          {FUNNEL_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                          <option value={IGNORE}>Ignore this column</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fd-note">{parsedRows ? parsedRows.length : 0} data row{parsedRows && parsedRows.length === 1 ? '' : 's'} detected.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="fd-btn" onClick={handleConfirmMapping} disabled={!canConfirm}>Confirm mapping</button>
              <button className="fd-btn-secondary" onClick={handleCancelMapping}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {periods.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <span className="fd-label">Confirmed periods ({periods.length})</span>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  {FUNNEL_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={i}>
                    {FUNNEL_FIELDS.map(f => (
                      <td key={f.key}>{p[f.key] ? p[f.key] : <span style={{ color: '#d1d5db' }}>-</span>}</td>
                    ))}
                    <td><button type="button" className="fd-remove-btn" onClick={() => handleRemovePeriod(i)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="fd-label">Data coverage by channel</span>
          <FunnelCoverageChart coverage={computeChannelCoverage(periods)} />
        </div>
      )}
    </div>
  );
}
