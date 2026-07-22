import { useState, useEffect, useRef } from 'react';

const IGNORE = '__ignore__';

export const FUNNEL_FIELDS = [
  { key: 'month', label: 'Month/Period', required: true, aliases: ['month', 'period', 'monthperiod', 'reportingmonth', 'reportingperiod', 'date', 'monthyear'] },
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

const REQUIRED_FIELDS = FUNNEL_FIELDS.filter(f => f.required);

const EMPTY_MANUAL_FORM = Object.fromEntries(FUNNEL_FIELDS.map(f => [f.key, '']));

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
  const period = { ...EMPTY_MANUAL_FORM };
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
  const exampleRow = ['Jan 2026', 'Google Ads', '15000', '4200', '180', '45', '12', '3', '45000', '12', '2024-03-01', 'Tier 1', 'Lead Gen'].map(csvField).join(',');
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
  const [activeTab, setActiveTab] = useState('upload');
  const [periods, setPeriods] = useState([]);

  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [parsedRows, setParsedRows] = useState(null);
  const [mapping, setMapping] = useState(null);

  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');

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

  function handleManualChange(key, value) {
    setManualForm(prev => ({ ...prev, [key]: value }));
  }

  function handleAddManualRow(e) {
    e.preventDefault();
    const month = manualForm.month.trim();
    const channel = manualForm.channel.trim();
    const missing = REQUIRED_FIELDS.filter(f => !manualForm[f.key].trim());
    if (missing.length) { setManualError(`${missing.map(f => f.label).join(', ')} required.`); setManualSuccess(''); return; }
    setPeriods(prev => mergePeriod(prev, { ...manualForm, month, channel }));
    setManualError('');
    setManualSuccess(`${month} added to confirmed data.`);
    setManualForm(EMPTY_MANUAL_FORM);
  }

  function handleRemovePeriod(index) {
    setPeriods(prev => prev.filter((_, i) => i !== index));
  }

  const numberFieldKeys = new Set(['spend', 'clicks', 'leads', 'mqls', 'opportunitiesCreated', 'closedWonDeals', 'dealValue', 'daysSinceLastCreativeRefresh']);

  return (
    <div className="fd-wrap">
      <div className="fd-tab-row">
        <button className={`fd-tab${activeTab === 'upload' ? ' active' : ''}`} onClick={() => setActiveTab('upload')}>Upload CSV</button>
        <button className={`fd-tab${activeTab === 'manual' ? ' active' : ''}`} onClick={() => setActiveTab('manual')}>Manual row entry</button>
      </div>

      <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
        <span className="fd-label">Upload your funnel data</span>
        <p className="fd-note" style={{ marginBottom: 12 }}>
          Upload your full monthly history as a CSV. The tool reads across your whole timeline, so more history means a sharper diagnosis.
        </p>
        <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          <li>One row per channel per month</li>
          <li>Aim for at least 4 months of data per channel, some checks need that much history to run</li>
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

      <div style={{ display: activeTab === 'manual' ? 'block' : 'none' }}>
        <p className="fd-note">Enter one month at a time. This writes to the same data set as your uploaded file, so you can mix both entry methods.</p>
        <form onSubmit={handleAddManualRow}>
          <div className="fd-form-grid">
            {FUNNEL_FIELDS.map(f => (
              <div key={f.key}>
                <label className={`fd-label${f.required ? ' fd-field-required' : ''}`} style={{ marginBottom: 4 }}>{f.label}</label>
                {f.options ? (
                  <select
                    className="fd-select"
                    value={manualForm[f.key]}
                    onChange={e => handleManualChange(f.key, e.target.value)}
                    style={{ borderColor: f.required && manualError && !manualForm[f.key].trim() ? '#C0392B' : undefined }}
                  >
                    <option value="">Select...</option>
                    {f.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={numberFieldKeys.has(f.key) ? 'number' : 'text'}
                    className="fd-input"
                    value={manualForm[f.key]}
                    onChange={e => handleManualChange(f.key, e.target.value)}
                    style={{ borderColor: f.required && manualError && !manualForm[f.key].trim() ? '#C0392B' : undefined }}
                  />
                )}
              </div>
            ))}
          </div>
          {manualError && <p className="fd-error">{manualError}</p>}
          {manualSuccess && <p className="fd-success">{manualSuccess}</p>}
          <button type="submit" className="fd-btn">Add month</button>
        </form>
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
        </div>
      )}
    </div>
  );
}
