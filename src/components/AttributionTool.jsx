import { useState, useEffect } from "react";

// Display metadata only — channel colors, real benchmark reference ranges
// (matching the downloadable workbook's own "Channel role reference table"),
// and the real annual spend figures. NOT a second dataset: every count,
// rate, and dollar figure in this component comes from
// /data/attribution_summary.json, which is pre-aggregated directly from the
// same finalized generator output that produces the downloadable workbook.
const CH_DISPLAY = [
  ["LinkedIn", "linkedin"],
  ["Google Ads", "google"],
  ["G2", "g2"],
  ["Programmatic", "programmatic"],
];
const CH_LABEL = Object.fromEntries(CH_DISPLAY.map(([label, key]) => [key, label]));
const CH_COLORS = { linkedin: "#2563EB", google: "#1D9E75", g2: "#BA7517", programmatic: "#888780" };
const ANNUAL_SPEND = { linkedin: 574000, google: 574000, g2: 112000, programmatic: 140000 };
const TOTAL_BUDGET = Object.values(ANNUAL_SPEND).reduce((a, b) => a + b, 0);
const CPL_BENCH = { linkedin: { low: 80, high: 130 }, google: { low: 75, high: 200 } };
const ROAS_BENCH = { linkedin: { low: 3.0, high: 4.0 }, google: { low: 3.0, high: 4.0 } };

const TIER_DISPLAY = [
  ["c_suite_vp", "C-Suite / VP"],
  ["director", "Director"],
  ["manager", "Manager"],
  ["ic_analyst", "IC / Analyst"],
];
const TIER_COLORS = { c_suite_vp: "#2563EB", director: "#1D9E75", manager: "#BA7517", ic_analyst: "#888780" };

const JOB_FUNCTION_TITLES = {
  "Data Engineering": ["Data Engineer", "Senior Data Engineer", "Data Engineering Manager", "Director of Data Engineering", "VP of Data Engineering"],
  "Analytics and BI": ["Data Analyst", "BI Analyst", "Analytics Engineer", "Analytics Manager", "BI Manager", "Director of Analytics", "Director of Business Intelligence", "VP of Analytics", "Chief Analytics Officer"],
  "Data Platform and Governance": ["Data Platform Manager", "Director of Data", "VP of Data", "Chief Data Officer"],
};
const JOB_FUNCTIONS = Object.keys(JOB_FUNCTION_TITLES);

const LEAD_TYPE_LABELS = { demo: "Demo (MQL only)", trial: "Trial (PQL only)", both: "Both", neither: "Neither" };

function fmt$(n) { return "$" + (Math.abs(n) >= 1000000 ? (n / 1000000).toFixed(1) + "M" : (n / 1000).toFixed(0) + "K"); }
function fmtK(n) { return "$" + Math.round(n / 1000) + "K"; }
function pct(a, b) { return b ? Math.round(a / b * 100) + "%" : "-"; }
function pctN(a, b) { return b ? Math.round(a / b * 100) : 0; }
function fmtN(n) { return Math.round(n).toLocaleString(); }

function cplVal(ch, data) { const c = data.channels[ch]; return c.leads ? Math.round(ANNUAL_SPEND[ch] / c.leads) : 0; }
function cpMQLVal(ch, data) { const c = data.channels[ch]; return c.mqls ? Math.round(ANNUAL_SPEND[ch] / c.mqls) : 0; }
function roasNum(ch, model, data) { const c = data.channels[ch]; return ANNUAL_SPEND[ch] ? parseFloat((c.pipeline_by_model[model] / ANNUAL_SPEND[ch]).toFixed(2)) : 0; }

function cplStatus(ch, v) {
  if (!CPL_BENCH[ch]) return null;
  const b = CPL_BENCH[ch];
  if (v < b.low) return "yellow";
  if (v <= b.high) return "green";
  return "red";
}
function roasStatus(ch, v) {
  if (!ROAS_BENCH[ch]) return null;
  const b = ROAS_BENCH[ch];
  if (v < b.low) return "red";
  if (v <= b.high) return "green";
  return "yellow";
}

const STATUS_COLORS = { green: "#1D9E75", yellow: "#BA7517", red: "#E24B4A" };

function CplCell({ ch, data }) {
  const v = cplVal(ch, data);
  const s = cplStatus(ch, v);
  if (!s) return <span className="font-medium">${v}</span>;
  const tip = s === "green" ? "on benchmark" : s === "yellow" ? "below range: review quality" : "over benchmark";
  return <span style={{ background: s === "green" ? "#dcfce7" : s === "yellow" ? "#fef9c3" : "#fee2e2", color: s === "green" ? "#166534" : s === "yellow" ? "#854d0e" : "#991b1b", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 500 }}>${v} <span style={{ fontWeight: 400, opacity: .85 }}>{tip}</span></span>;
}
function RoasCell({ ch, model, data }) {
  const v = roasNum(ch, model, data);
  const s = roasStatus(ch, v);
  if (!s) return <span className="font-medium">{v > 0 ? v.toFixed(1) + "x" : "-"}</span>;
  const tip = s === "green" ? "on benchmark" : s === "yellow" ? "above range: review" : "below target";
  return <span style={{ background: s === "green" ? "#dcfce7" : s === "yellow" ? "#fef9c3" : "#fee2e2", color: s === "green" ? "#166534" : s === "yellow" ? "#854d0e" : "#991b1b", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 500 }}>{v.toFixed(1)}x <span style={{ fontWeight: 400, opacity: .85 }}>{tip}</span></span>;
}
function Dot({ color }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 5 }} />;
}
function PacePill({ actual, goal }) {
  const p = goal ? actual / goal : 0;
  if (p >= .95) return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#dcfce7", color: "#166534" }}>On track</span>;
  if (p >= .80) return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#fef9c3", color: "#854d0e" }}>At risk</span>;
  return <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#fee2e2", color: "#991b1b" }}>Behind</span>;
}
function NoteBox({ children }) {
  return <div style={{ background: "#f8f8f7", borderLeft: "3px solid #2563EB", borderRadius: "0 6px 6px 0", padding: ".6rem .85rem", fontSize: 11, color: "#6b6a68", marginBottom: "1rem", lineHeight: 1.6 }}>{children}</div>;
}
function BenchLegend() {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, fontSize: 10, color: "#6b6a68" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#dcfce7", display: "inline-block" }}></span>On benchmark</span>
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#fef9c3", display: "inline-block" }}></span>CPL: below range, review quality / ROAS: above range, review</span>
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#fee2e2", display: "inline-block" }}></span>CPL: over benchmark / ROAS: below target</span>
  </div>;
}

function SimpleBar({ data, color, height = 160 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingTop: 8 }}>
    {data.map((d, i) => (
      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 9, color: "#6b6a68" }}>{d.label2}</span>
        <div style={{ width: "100%", background: d.color || color || "#2563EB", borderRadius: "3px 3px 0 0", height: Math.max(4, Math.round((d.value / max) * (height - 40))) }} />
        <span style={{ fontSize: 9, color: "#6b6a68", textAlign: "center", lineHeight: 1.2 }}>{d.label}</span>
      </div>
    ))}
  </div>;
}
function MiniLine({ data, color = "#2563EB", height = 140 }) {
  const max = Math.max(...data, 1), min = 0;
  const pts = data.map((v, i) => [i / (data.length - 1) * 100, 100 - ((v - min) / (max - min) * 80 + 10)]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height }}>
    <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

// MQL pacing chart: solid actual (Feb-Oct), dashed projected (Nov-Jan),
// flat goal line (all 12 months), dotted quarter dividers after Apr/Jul/Oct.
function PacingLineChart({ months, actual, goal, projected, cutoffIdx, height = 220 }) {
  const W = 600, H = height, padL = 34, padR = 12, padT = 16, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = months.length;
  const allVals = [...actual.slice(0, cutoffIdx + 1), ...goal, ...Object.values(projected)];
  const maxV = Math.max(...allVals, 1);
  const x = i => padL + (i / (n - 1)) * plotW;
  const y = v => padT + plotH - (v / maxV) * plotH;

  const actualPts = actual.slice(0, cutoffIdx + 1).map((v, i) => [x(i), y(v)]);
  const actualPath = actualPts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  const projMonths = months.slice(cutoffIdx + 1);
  const projVals = projMonths.map(m => projected[m]);
  const projPts = [[x(cutoffIdx), y(actual[cutoffIdx])], ...projVals.map((v, i) => [x(cutoffIdx + 1 + i), y(v)])];
  const projPath = projPts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  const goalPts = goal.map((v, i) => [x(i), y(v)]);
  const goalPath = goalPts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  const quarterDividers = [3, 6, 9]; // after Apr(idx2)->before May(idx3), after Jul(idx5)->before Aug(idx6), after Oct(idx8)->before Nov(idx9)

  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }}>
    {quarterDividers.map(i => (
      <line key={i} x1={x(i) - (plotW / (n - 1)) / 2} y1={padT} x2={x(i) - (plotW / (n - 1)) / 2} y2={padT + plotH}
        stroke="#d1d1d0" strokeWidth="1" strokeDasharray="2,3" />
    ))}
    <path d={goalPath} fill="none" stroke="#888780" strokeWidth="1.5" />
    <path d={actualPath} fill="none" stroke="#2563EB" strokeWidth="2.5" />
    <path d={projPath} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="5,4" />
    {actualPts.map((p, i) => <circle key={"a" + i} cx={p[0]} cy={p[1]} r="2.5" fill="#2563EB" />)}
    {projPts.slice(1).map((p, i) => <circle key={"p" + i} cx={p[0]} cy={p[1]} r="2.5" fill="#fff" stroke="#2563EB" strokeWidth="2" />)}
    {projVals.map((v, i) => (
      <text key={"lbl" + i} x={x(cutoffIdx + 1 + i)} y={y(v) - 8} fontSize="9" fill="#1a1a19" textAnchor="middle">{Math.round(v)}</text>
    ))}
    {months.map((m, i) => (
      <text key={m} x={x(i)} y={H - 6} fontSize="8" fill="#6b6a68" textAnchor="middle">{m.split("-")[0]}</text>
    ))}
  </svg>;
}

function SummaryTab({ model, data }) {
  const t = data.totals;
  const totalPipeline = t.pipeline_by_model[model];
  const handleTemplateDownload = () => {
    const link = document.createElement('a');
    link.href = '/downloads/syncflow_attribution_template.xlsx';
    link.download = 'syncflow_attribution_template.xlsx';
    link.click();
  };
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(95px,1fr))", gap: 8, marginBottom: "1rem" }}>
      {[
        { label: "Total leads", val: fmtN(t.leads) },
        { label: "MQLs", val: fmtN(t.mqls), sub: pct(t.mqls, data.meta.annual_goals.mql) + " of goal" },
        { label: "SQLs / Opps", val: fmtN(t.opportunities) },
        { label: "Closed-won", val: fmtN(t.closed_won) },
        { label: "Total pipeline", val: fmt$(totalPipeline), sub: pct(totalPipeline, data.meta.annual_goals.pipeline) + " of goal" },
        { label: "Total spend", val: fmt$(TOTAL_BUDGET) },
        { label: "Blended CPL", val: "$" + (t.mqls ? Math.round(TOTAL_BUDGET / t.mqls) : 0) },
      ].map((k, i) => <div key={i} style={{ background: "#f8f8f7", borderRadius: 6, padding: ".8rem" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>{k.label}</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{k.val}</p>
        {k.sub && <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 8px" }}>Funnel conversion rates: blended</p>
    <div style={{ display: "flex", alignItems: "stretch", gap: 3, marginBottom: "1rem", flexWrap: "wrap" }}>
      {[
        { rate: fmtN(t.leads), lbl: "Leads", color: "#e5e5e3" },
        { rate: pctN(t.mqls, t.leads) + "%", lbl: "Lead→MQL", sub: fmtN(t.mqls), border: "#2563EB" },
        { rate: pctN(t.opportunities, t.mqls) + "%", lbl: "MQL→SQL", sub: fmtN(t.opportunities), border: "#1D9E75" },
        { rate: pctN(t.closed_won, t.opportunities) + "%", lbl: "SQL→Closed", sub: fmtN(t.closed_won), border: "#BA7517" },
        { rate: pctN(t.closed_won, t.leads) + "%", lbl: "Lead→Closed", sub: "end-to-end", border: "#888780" },
      ].map((f, i) => <div key={i} style={{ flex: 1, minWidth: 80, background: "#f8f8f7", borderRadius: 6, padding: ".75rem", textAlign: "center", borderTop: f.border ? `2px solid ${f.border}` : "none" }}>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{f.rate}</p>
        <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>{f.lbl}</p>
        {f.sub && <p style={{ fontSize: 10, color: "#6b6a68", margin: "2px 0 0" }}>{f.sub}</p>}
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Channel summary</p>
    <BenchLegend />
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Channel", "Leads", "MQLs", "SQLs", "Closed", "Pipeline", "Opps touched", "CPL", "ROAS", "L→MQL", "MQL→SQL"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{CH_DISPLAY.map(([label, ch]) => {
          const c = data.channels[ch];
          return <tr key={ch}>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={CH_COLORS[ch]} />{label}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(c.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(c.mqls)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(c.opportunities)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(c.closed_won)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtK(c.pipeline_by_model[model])}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(c.opportunities_touched)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><CplCell ch={ch} data={data} /></td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><RoasCell ch={ch} model={model} data={data} /></td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.mqls, c.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.opportunities, c.mqls)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "0.5px solid #e5e5e3" }}>
      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 6px" }}>Download the dataset</p>
      <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 10px", maxWidth: 560 }}>
        The template includes the full mock dataset alongside pre-built analysis tabs covering channel performance, multi-touch attribution models, monthly pacing, and deal efficiency by seniority tier. Download it, explore the formulas, and replace the raw data tab with your own CRM export to run the same analysis on real numbers.
      </p>
      <button onClick={handleTemplateDownload} style={{
        padding: "4px 9px", fontSize: 11, borderRadius: 6,
        border: "none", cursor: "pointer", background: "#2563EB", color: "#fff"
      }}>Download Template</button>
      <p style={{ fontSize: 11, color: "#9b9a97", margin: "6px 0 0" }}>syncflow_attribution_template.xlsx, 6 tabs, raw data + pre-built analysis</p>
    </div>
  </div>;
}

function ChannelTab({ model, data }) {
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: "1rem" }}>
      {CH_DISPLAY.map(([label, ch]) => <div key={ch} style={{ background: "#f8f8f7", borderRadius: "0 6px 6px 0", padding: ".8rem", borderLeft: `3px solid ${CH_COLORS[ch]}` }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{fmt$(ANNUAL_SPEND[ch])}</p>
        <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>annual spend</p>
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Volume counts by funnel stage</p>
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Channel", "Leads", "MQLs", "SQLs", "Closed", "Lead→MQL", "MQL→SQL", "SQL→Closed", "MQL→Closed", "Lead→Closed"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{CH_DISPLAY.map(([label, ch]) => {
          const c = data.channels[ch];
          return <tr key={ch}>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={CH_COLORS[ch]} />{label}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontWeight: 600 }}>{fmtN(c.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontWeight: 600 }}>{fmtN(c.mqls)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontWeight: 600 }}>{fmtN(c.opportunities)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontWeight: 600 }}>{fmtN(c.closed_won)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.mqls, c.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.opportunities, c.mqls)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.closed_won, c.opportunities)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.closed_won, c.mqls)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(c.closed_won, c.leads)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Efficiency metrics</p>
    <BenchLegend />
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Channel", "Spend", "CPL", "cpMQL", "ROAS", "Cost/Demo", "Cost/Trial"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3" }}>{h}</th>)}</tr></thead>
        <tbody>{CH_DISPLAY.map(([label, ch]) => {
          const c = data.channels[ch];
          return <tr key={ch}>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={CH_COLORS[ch]} />{label}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmt$(ANNUAL_SPEND[ch])}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><CplCell ch={ch} data={data} /></td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>${cpMQLVal(ch, data)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><RoasCell ch={ch} model={model} data={data} /></td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>${fmtN(c.demo_touches ? Math.round(ANNUAL_SPEND[ch] / c.demo_touches) : 0)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>${fmtN(c.trial_touches ? Math.round(ANNUAL_SPEND[ch] / c.trial_touches) : 0)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <NoteBox>Post-MQL suppression drops further linkedin/google/g2 touches once a prospect qualifies; programmatic (ABM air cover) is exempt since it targets the account, not the individual. To keep that exemption from inflating programmatic's credit, any post-MQL programmatic touch is excluded from first-touch and last-touch position weighting under every model and instead treated as a middle touch. ROAS and CPL health indicators are not applied to G2 or Programmatic.</NoteBox>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 4px" }}>CPL by channel: color = benchmark health</p>
        <BenchLegend />
        <SimpleBar height={155} data={CH_DISPLAY.map(([label, ch]) => {
          const v = cplVal(ch, data); const s = cplStatus(ch, v);
          return { label, label2: "$" + v, value: v, color: s ? STATUS_COLORS[s] : CH_COLORS[ch] };
        })} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 4px" }}>ROAS by channel: color = benchmark health</p>
        <BenchLegend />
        <SimpleBar height={155} data={CH_DISPLAY.map(([label, ch]) => {
          const v = roasNum(ch, model, data); const s = roasStatus(ch, v);
          return { label, label2: v > 0 ? v.toFixed(1) + "x" : "-", value: v, color: s ? STATUS_COLORS[s] : CH_COLORS[ch] };
        })} />
      </div>
    </div>
  </div>;
}

function CampaignTab({ model, data }) {
  const sorted = Object.entries(data.campaigns).sort((a, b) => b[1].pipeline_by_model[model] - a[1].pipeline_by_model[model]);
  return <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
      <thead><tr>{["Campaign", "Channel", "Pipeline credit", "Opportunities touched"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3" }}>{h}</th>)}</tr></thead>
      <tbody>{sorted.map(([name, d]) => <tr key={name}>
        <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontSize: 10 }}>{name}</td>
        <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={CH_COLORS[d.channel]} /><span style={{ fontSize: 10 }}>{CH_LABEL[d.channel]}</span></td>
        <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtK(d.pipeline_by_model[model])}</td>
        <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.opportunities_touched)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function TrafficTab({ data }) {
  const leads = data.monthly.leads_actual;
  const months = data.monthly.months;
  const peakIdx = leads.indexOf(Math.max(...leads));
  const slowIdx = leads.indexOf(Math.min(...leads));
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(95px,1fr))", gap: 8, marginBottom: "1rem" }}>
      {[
        { label: "In-window leads", val: fmtN(data.totals.leads) },
        { label: "Peak lead month", val: months[peakIdx].split("-")[0], sub: fmtN(leads[peakIdx]) + " leads" },
        { label: "Slowest lead month", val: months[slowIdx].split("-")[0], sub: fmtN(leads[slowIdx]) + " leads" },
        { label: "Annual MQL goal", val: fmtN(data.meta.annual_goals.mql), sub: "seasonality-weighted" },
      ].map((k, i) => <div key={i} style={{ background: "#f8f8f7", borderRadius: 6, padding: ".8rem" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>{k.label}</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{k.val}</p>
        {k.sub && <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Monthly leads by first-touch date (fiscal window)</p>
    <MiniLine data={leads} color="#2563EB" height={120} />
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
      {months.map(m => <span key={m} style={{ fontSize: 8, color: "#6b6a68" }}>{m.split("-")[0]}</span>)}
    </div>
    <NoteBox>January 2026 shows zero new leads by design. Seeding ends December 2025, so January reflects only journeys carried in from prior months, not new first touches.</NoteBox>
  </div>;
}

function PacingTab({ data }) {
  const g = data.meta.annual_goals;
  const t = data.totals;
  const m = data.monthly;
  const months = m.months;
  const CUTOFF_IDX = 8; // Oct

  const quarters = [
    { q: "Q1 (Feb-Apr)", range: [0, 1, 2] },
    { q: "Q2 (May-Jul)", range: [3, 4, 5] },
    { q: "Q3 (Aug-Oct)", range: [6, 7, 8] },
    { q: "Q4 (Nov-Jan)", range: [9, 10, 11] },
  ].map(({ q, range }) => ({
    q,
    mqlGoal: range.reduce((s, i) => s + m.mql_goal[i], 0),
    mqlActual: range.reduce((s, i) => s + m.mql_actual[i], 0),
    pipeGoal: range.reduce((s, i) => s + m.pipeline_goal[i], 0),
    pipeActual: range.reduce((s, i) => s + m.pipeline_actual[i], 0),
  }));

  return <div>
    <p style={{ fontSize: 12, color: "#6b6a68", marginBottom: 8 }}>Annual goals (distributed monthly by seasonality index)</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(95px,1fr))", gap: 8, marginBottom: "1rem" }}>
      {[
        { label: "Annual MQL goal", val: fmtN(g.mql) },
        { label: "Annual PQL goal", val: fmtN(g.pql) },
        { label: "Annual pipeline goal", val: fmt$(g.pipeline) },
      ].map((k, i) => <div key={i} style={{ background: "#f8f8f7", borderRadius: 6, padding: ".8rem" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>{k.label}</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{k.val}</p>
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", marginBottom: 8 }}>Full-year pacing</p>
    {[
      { label: `MQLs: ${fmtN(t.mqls)} of ${fmtN(g.mql)}`, pct: Math.min(100, Math.round(t.mqls / g.mql * 100)), color: "#2563EB" },
      { label: `PQLs: ${fmtN(t.pqls)} of ${fmtN(g.pql)}`, pct: Math.min(100, Math.round(t.pqls / g.pql * 100)), color: "#BA7517" },
      { label: `Pipeline: ${fmt$(t.pipeline_by_model.u_shaped)} of ${fmt$(g.pipeline)}`, pct: Math.min(100, Math.round(t.pipeline_by_model.u_shaped / g.pipeline * 100)), color: "#1D9E75" },
    ].map((b, i) => <div key={i} style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b6a68", marginBottom: 3 }}><span>{b.label}</span><span>{b.pct}%</span></div>
      <div style={{ height: 8, background: "#e5e5e3", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: b.pct + "%", background: b.color, borderRadius: 4 }} /></div>
    </div>)}

    <p style={{ fontSize: 12, color: "#6b6a68", margin: "1.5rem 0 6px" }}>MQL pacing: actual through October, projected for the remainder</p>
    <PacingLineChart months={months} actual={m.mql_actual} goal={m.mql_goal} projected={data.pacing_projection.projected} cutoffIdx={CUTOFF_IDX} />
    <div style={{ display: "flex", gap: 14, fontSize: 10, color: "#6b6a68", marginBottom: "1rem", flexWrap: "wrap" }}>
      <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#2563EB", verticalAlign: "middle", marginRight: 4 }} />Actual</span>
      <span><span style={{ display: "inline-block", width: 14, height: 0, borderTop: "2px dashed #2563EB", verticalAlign: "middle", marginRight: 4 }} />Projected (based on prior year monthly distribution)</span>
      <span><span style={{ display: "inline-block", width: 14, height: 1.5, background: "#888780", verticalAlign: "middle", marginRight: 4 }} />Monthly goal</span>
    </div>
    <p style={{ fontSize: 10, color: "#6b6a68", margin: "-0.5rem 0 1rem" }}>Seeding ends December 2025, so January reflects only journeys carried in from prior months.</p>

    <p style={{ fontSize: 12, color: "#6b6a68", margin: "1rem 0 6px" }}>Quarterly breakdown</p>
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Quarter", "MQL goal", "MQL actual", "MQL %", "Pipeline goal", "Pipeline actual", "Pipeline %", "Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3" }}>{h}</th>)}</tr></thead>
        <tbody>{quarters.map(d => <tr key={d.q}>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontWeight: 500 }}>{d.q}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.mqlGoal)}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.mqlActual)}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(d.mqlActual, d.mqlGoal)}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtK(d.pipeGoal)}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtK(d.pipeActual)}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(d.pipeActual, d.pipeGoal)}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><PacePill actual={d.mqlActual} goal={d.mqlGoal} /></td>
        </tr>)}</tbody>
      </table>
    </div>

    <p style={{ fontSize: 12, color: "#6b6a68", margin: "1rem 0 6px" }}>Monthly Breakdown</p>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Month", "MQL goal", "Actual MQLs", "PQL goal", "Actual PQLs", "Pipeline goal", "Actual pipeline", "Status"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{months.map((mo, i) => <tr key={mo}>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{mo}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(m.mql_goal[i])}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(m.mql_actual[i])}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(m.pql_goal[i])}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(m.pql_actual[i])}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtK(m.pipeline_goal[i])}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtK(m.pipeline_actual[i])}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><PacePill actual={m.mql_actual[i]} goal={m.mql_goal[i]} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p style={{ fontSize: 10, color: "#6b6a68", margin: "6px 0 0" }}>Seeding ends December 2025, so January reflects only journeys carried in from prior months.</p>
  </div>;
}

function DealTab({ data }) {
  const t = data.totals;
  const sen = data.demographics.seniority;
  const plt = data.demographics.pipeline_by_lead_type;
  const CH_ROLES = {
    linkedin: { role: "Demand generation", annotation: "Creates and nurtures demand. Longer cycle reflects multi-stakeholder deals. CPL: $80–$130. ROAS: 3–4x." },
    google: { role: "Demand capture", annotation: "Intercepts in-market buyers. Shortest cycle, highest standalone close rate. CPL: $75–$200. ROAS: 3–4x." },
    g2: { role: "Closing validator", annotation: "Highest MQL quality, lowest volume. Buyers already in evaluation. No CPL/ROAS benchmark applied." },
    programmatic: { role: "Air cover / ABM", annotation: "Visibility channel targeting accounts, not individuals. Exempt from post-MQL suppression, but any post-MQL touch is excluded from first/last-touch credit under every attribution model." },
  };
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(95px,1fr))", gap: 8, marginBottom: "1rem" }}>
      {[
        { label: "Avg deal size", val: fmt$(t.avg_deal_size), sub: "closed-won only" },
        { label: "Avg sales cycle", val: t.avg_cycle_days + "d" },
        { label: "Overall win rate", val: pct(t.closed_won, t.opportunities) },
        { label: "Pipeline velocity", val: fmt$(t.pipeline_velocity_30d), sub: "per 30 days" },
        { label: "Demo-sourced pipeline", val: fmt$(plt.demo + plt.both) },
        { label: "Trial-sourced pipeline", val: fmt$(plt.trial + plt.neither) },
      ].map((k, i) => <div key={i} style={{ background: "#f8f8f7", borderRadius: 6, padding: ".8rem" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>{k.label}</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{k.val}</p>
        {k.sub && <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Deal metrics by seniority tier</p>
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Tier", "Leads", "MQLs", "SQLs", "Closed", "Avg deal", "Avg cycle", "Win rate", "Lead→MQL", "MQL→SQL"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{TIER_DISPLAY.map(([key, label]) => {
          const d = sen[key];
          return <tr key={key}>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={TIER_COLORS[key]} />{label}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.mqls)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.opportunities)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(d.closed_won)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{d.avg_deal_size != null ? fmt$(d.avg_deal_size) : "-"}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{d.avg_cycle_days != null ? d.avg_cycle_days + "d" : "-"}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{d.win_rate != null ? Math.round(d.win_rate * 100) + "%" : "-"}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(d.mqls, d.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(d.opportunities, d.mqls)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" }}>
      <div>
        <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Avg deal size by tier (closed-won)</p>
        <SimpleBar height={150} data={TIER_DISPLAY.map(([key, label]) => ({ label: label.split("/")[0].trim(), label2: sen[key].avg_deal_size != null ? fmt$(sen[key].avg_deal_size) : "-", value: sen[key].avg_deal_size || 0, color: TIER_COLORS[key] }))} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Avg sales cycle by tier (days)</p>
        <SimpleBar height={150} data={TIER_DISPLAY.map(([key, label]) => ({ label: label.split("/")[0].trim(), label2: sen[key].avg_cycle_days != null ? sen[key].avg_cycle_days + "d" : "-", value: sen[key].avg_cycle_days || 0, color: TIER_COLORS[key] }))} />
      </div>
    </div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Channel role: context for finance and leadership</p>
    <NoteBox>Pipeline credit reflects attribution model weighting across the prospect's full surviving touch path. ROAS and CPL health indicators are not applied to G2 or Programmatic. Evaluate channels by their role, not pipeline credit alone.</NoteBox>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Channel", "Role", "Annotation"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3" }}>{h}</th>)}</tr></thead>
        <tbody>{CH_DISPLAY.map(([label, ch]) => <tr key={ch}>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={CH_COLORS[ch]} />{label}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontWeight: 500 }}>{CH_ROLES[ch].role}</td>
          <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3", fontSize: 10, color: "#6b6a68" }}>{CH_ROLES[ch].annotation}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function DemographicsTab({ data }) {
  const lt = data.demographics.lead_type;
  const sen = data.demographics.seniority;
  const fn = data.demographics.job_function;
  const bc = data.demographics.buying_committee;
  const totalLeads = data.totals.leads;

  const renderGroupTable = (groups, rows, colorFn) => (
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead><tr>{["Group", "Leads", "MQLs", "Cost per MQL", ...CH_DISPLAY.map(([label]) => label)].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 7px", color: "#6b6a68", fontWeight: 500, borderBottom: "0.5px solid #e5e5e3", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(([key, label]) => {
          const g = groups[key];
          if (!g) return null;
          return <tr key={key}>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}><Dot color={colorFn(key)} />{label}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(g.leads)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{fmtN(g.mqls)}</td>
            <td style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{g.cost_per_mql != null ? "$" + fmtN(g.cost_per_mql) : "-"}</td>
            {CH_DISPLAY.map(([label2, ch]) => <td key={ch} style={{ padding: "5px 7px", borderBottom: "0.5px solid #e5e5e3" }}>{pct(g.channel_mix[ch], g.leads)}</td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
  );

  return <div>
    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>Lead type breakdown</p>
    <div style={{ display: "flex", gap: 3, marginBottom: "1.5rem", flexWrap: "wrap" }}>
      {Object.entries(LEAD_TYPE_LABELS).map(([key, label]) => <div key={key} style={{ flex: 1, minWidth: 100, background: "#f8f8f7", borderRadius: 6, padding: ".75rem", textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{fmtN(lt[key] || 0)}</p>
        <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>{label}</p>
        <p style={{ fontSize: 10, color: "#6b6a68", margin: "2px 0 0" }}>{pct(lt[key] || 0, totalLeads)}</p>
      </div>)}
    </div>

    <p style={{ fontSize: 12, color: "#6b6a68", margin: "0 0 6px" }}>By seniority tier: cost per MQL and channel mix</p>
    {renderGroupTable(sen, TIER_DISPLAY, k => TIER_COLORS[k])}

    <p style={{ fontSize: 12, color: "#6b6a68", margin: "1.5rem 0 6px" }}>By job function: cost per MQL and channel mix</p>
    {renderGroupTable(fn, JOB_FUNCTIONS.map(f => [f, f]), () => "#2563EB")}
    <NoteBox>
      <strong>Title-to-function mapping</strong> (so this breakdown is auditable):<br />
      {Object.entries(JOB_FUNCTION_TITLES).map(([func, titles]) => (
        <div key={func} style={{ marginTop: 4 }}><strong>{func}:</strong> {titles.join(", ")}</div>
      ))}
    </NoteBox>

    <p style={{ fontSize: 12, color: "#6b6a68", margin: "1.5rem 0 6px" }}>Buying committee size</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(95px,1fr))", gap: 8, marginBottom: "0.5rem" }}>
      <div style={{ background: "#f8f8f7", borderRadius: 6, padding: ".8rem" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>Avg distinct prospects per company</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{bc.avg_distinct_prospects_per_company}</p>
      </div>
      {["1", "2", "3", "4+"].map(k => <div key={k} style={{ background: "#f8f8f7", borderRadius: 6, padding: ".8rem" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 3px" }}>{k} prospect{k !== "1" ? "s" : ""}</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{fmtN(bc.distribution[k])}</p>
        <p style={{ fontSize: 10, color: "#6b6a68", margin: "3px 0 0" }}>companies</p>
      </div>)}
    </div>
    <NoteBox>Company names are drawn from a fixed 30-name pool in this mock dataset (not unique real accounts), so "buying committee size" here reflects that pool structure rather than realistic per-account contact counts. In a real CRM export, this same calculation would reflect actual multi-threading depth per account.</NoteBox>
  </div>;
}

function SourcesTab({ data }) {
  const pp = data.pacing_projection;
  const novKey = Object.keys(pp.validation)[0];
  const decKey = Object.keys(pp.validation)[1];
  const nov = pp.validation[novKey];
  const dec = pp.validation[decKey];
  const janKey = Object.keys(pp.projected).find(k => k !== novKey && k !== decKey);

  const SOURCES = [
    { ch: "All channels: funnel benchmarks", color: "#2C2C2A", metrics: [{ l: "Lead to MQL (B2B avg)", v: "20–31%" }, { l: "MQL to SQL", v: "13–22%" }, { l: "SQL to closed-won", v: "20–30%" }, { l: "Lead to customer", v: "2–5%" }], rationale: "Industry-wide funnel benchmarks form the baseline for all channel conversion assumptions. B2B SaaS skews higher due to tighter ICP targeting and demo/trial-gated conversion paths.", sources: [{ n: "SerpSculpt: 2025 B2B Funnel Conversion Benchmarks", u: "https://serpsculpt.com/reports/b2b-sales-conversion-rate-by-industry/" }, { n: "SalesHive: B2B Lead Gen Benchmarks 2024-2025", u: "https://saleshive.com/blog/b2b-lead-benchmarks-digital-marketing-gen/" }, { n: "MarketJoy: B2B Sales Pipeline Conversion Rates", u: "https://marketjoy.com/b2b-sales-pipeline-conversion-rates-marketjoy-data/" }, { n: "The Digital Bloom: 2025 B2B SaaS Funnel Benchmarks", u: "https://thedigitalbloom.com/learn/pipeline-performance-benchmarks-2025/" }] },
    { ch: "Google Ads", color: "#1D9E75", metrics: [{ l: "CPL benchmark", v: "$75–$200" }, { l: "ROAS benchmark", v: "3–4x" }], rationale: "Google captures high-intent, in-market buyers. CPL below $75 signals broad match issues. CPL above $200 indicates overbidding or saturation.", sources: [{ n: "SaaSHero: 2026 B2B SaaS Conversion Benchmarks", u: "https://www.saashero.net/content/2026-b2b-saas-conversion-benchmarks/" }, { n: "Involve Digital: Google Ads for B2B SaaS 2026", u: "https://www.involvedigital.com/insights/google-ads-b2b-saas" }] },
    { ch: "LinkedIn", color: "#2563EB", metrics: [{ l: "CPL benchmark", v: "$80–$130" }, { l: "ROAS benchmark", v: "3–4x" }], rationale: "LinkedIn reaches buyers by professional profile, not search intent. Longer cycle reflects multi-stakeholder buying committees.", sources: [{ n: "GrowthSpree: LinkedIn Ads Benchmarks 2026", u: "https://www.growthspreeofficial.com/blogs/linkedin-ads-benchmarks-2026-b2b-saas-cpc-cpl-cost-per-sql" }, { n: "HockeyStack Labs: 2025 LinkedIn Ads Benchmark Report", u: "https://www.hockeystack.com/lab-blog-posts/linkedin-ads-benchmarks" }] },
    { ch: "G2", color: "#BA7517", metrics: [{ l: "CPL / ROAS benchmark", v: "Not applied" }], rationale: "G2 CPL and ROAS benchmarks are excluded. G2 investment is tied to review acquisition and category listing: not a traditional CPL buying model.", sources: [{ n: "GrowthSpree: MQL to SQL Conversion Rate Benchmarks 2026", u: "https://www.growthspreeofficial.com/blogs/mql-to-sql-conversion-rate-benchmarks-b2b-saas-2026" }] },
    { ch: "Programmatic", color: "#888780", metrics: [{ l: "CPL / ROAS benchmark", v: "Not applied" }, { l: "Suppression status", v: "Exempt from post-MQL suppression" }, { l: "Attribution eligibility", v: "Excluded from first/last-touch position after MQL" }], rationale: "Programmatic (ABM air cover) targets accounts, not individuals, so it is not suppressed once a prospect becomes an MQL — unlike LinkedIn, Google, and G2, which are. To prevent that exemption from letting a late programmatic impression collect outsized first- or last-touch credit, any programmatic touch occurring after a prospect's mql_date is excluded from first-touch and last-touch position weighting under every model and folded into the middle-touch bucket instead.", sources: [{ n: "LeadSpot: 2025 AI-Driven Demand Generation Benchmark Report", u: "https://lead-spot.net/research/the-2025-ai-driven-demand-generation-benchmark-report/" }] },
    { ch: "Sales cycle benchmarks", color: "#2C2C2A", metrics: [{ l: "C-Suite / VP cycle base", v: "70 days" }, { l: "Director cycle base", v: "55 days" }, { l: "Manager cycle base", v: "45 days" }, { l: "IC / Analyst cycle base", v: "30 days" }], rationale: "Sales cycle lengths are grounded in ACV-tier benchmarks from 2025–2026 research, then adjusted by lead_type (demo/trial/both/neither) with a further +/-15% noise band per opportunity.", sources: [{ n: "Optifai Sales Ops Benchmark 2026", u: "https://optif.ai/learn/questions/sales-cycle-length-benchmark/" }, { n: "Human Renaissance: B2B Tech Sales Cycle Benchmarks 2025", u: "https://www.humanr.ai/intelligence/b2b-tech-sales-cycle-benchmarks-by-deal-size" }] },
    { ch: "Attribution models", color: "#2C2C2A", metrics: [{ l: "U-shaped (default)", v: "40% first / 20% mid / 40% last" }, { l: "First touch", v: "100% first eligible touch" }, { l: "Last touch", v: "100% last eligible touch" }, { l: "Linear", v: "Equal weight per touch" }], rationale: "U-shaped is the default: it credits both the channel that created awareness and the channel that triggered conversion. \"Eligible\" excludes any post-MQL programmatic touch from the first/last position — see the Programmatic row above.", sources: [{ n: "HockeyStack: Multi-Touch Attribution for B2B", u: "https://www.hockeystack.com/lab-blog-posts/linkedin-ads-benchmarks" }] },
    {
      ch: "Pacing projection — validation", color: "#2C2C2A",
      metrics: [
        { l: "Prior-year YoY growth assumption", v: "18% (stated, not a benchmark)" },
        { l: "Method", v: "implied_total = actual Feb–Oct MQLs / prior-year share of Feb–Oct" },
        { l: `${novKey} — projected vs. withheld actual`, v: `${nov.projected} vs. ${nov.actual} (${nov.variance_pct > 0 ? "+" : ""}${nov.variance_pct}%)` },
        { l: `${decKey} — projected vs. withheld actual`, v: `${dec.projected} vs. ${dec.actual} (${dec.variance_pct > 0 ? "+" : ""}${dec.variance_pct}%)` },
        { l: `${janKey} — projected (no withheld actual to check against)`, v: `${pp.projected[janKey]}` },
      ],
      rationale: "The dashed projection line on the Pacing & Goals tab for Nov/Dec/Jan assumes an 18% year-over-year growth rate (a stated modeling choice, not a benchmark) and distributes the implied prior-year total across months using a seeded, independently-varied version of the same seasonality index used to seed this year's data. The generator actually produced real Nov/Dec MQL counts (hidden behind the chart's cutoff so the dashed line isn't shown competing with real data); those real values are used above only to check how close the projection method lands, and are read live from the same generated dataset as everything else in this tool — this note is not hardcoded and will update on the next data regeneration.",
    },
  ];
  return <div>
    <NoteBox>All conversion rates, CPL benchmarks, and ROAS targets are grounded in published 2024–2026 B2B SaaS research. CPL and ROAS health indicators apply to LinkedIn and Google Ads only. Every count and dollar figure elsewhere in this tool comes from the same finalized generator output as the downloadable workbook — nothing here is computed from a separate mock dataset.</NoteBox>
    {SOURCES.map((s, i) => <div key={i} style={{ background: "#f8f8f7", borderRadius: 6, padding: "1rem 1.1rem", marginBottom: ".75rem" }}>
      <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}><Dot color={s.color} />{s.ch}</h3>
      <div style={{ marginBottom: ".75rem" }}>
        {s.metrics.map((m, j) => <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: "0.5px solid #e5e5e3", fontSize: 11 }}>
          <span style={{ color: "#6b6a68" }}>{m.l}</span><span style={{ fontWeight: 500 }}>{m.v}</span>
        </div>)}
      </div>
      <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 8px", lineHeight: 1.6 }}>{s.rationale}</p>
      {s.sources && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {s.sources.map((src, j) => <a key={j} href={src.u} target="_blank" rel="noopener" style={{ color: "#2563EB", fontSize: 11, textDecoration: "none" }}>↗ {src.n}</a>)}
      </div>}
    </div>)}
  </div>;
}

const TABS = ["Summary", "Channel insights", "Campaign insights", "Traffic", "Pacing & Goals", "Deal efficiency", "Demographics", "Sources"];
const MODEL_LABELS = { u_shaped: "U-shaped", first_touch: "First touch", last_touch: "Last touch", linear: "Linear" };

export default function AttributionTool() {
  const [tab, setTab] = useState(0);
  const [model, setModel] = useState("u_shaped");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/attribution_summary.json')
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div style={{ padding: "2rem", color: "#991b1b", fontSize: 13 }}>Could not load dataset: {error}</div>;
  if (!data) return <div style={{ padding: "2rem", color: "#6b6a68", fontSize: 13 }}>Loading dataset…</div>;

  return <div style={{ fontFamily: "inherit", maxWidth: "100%" }}>
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 6 }}>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} style={{
          padding: "5px 10px", fontSize: 11, borderRadius: 6, border: tab === i ? "0.5px solid #d1d1d0" : "0.5px solid transparent",
          cursor: "pointer", background: tab === i ? "#fff" : "transparent",
          color: tab === i ? "#1a1a19" : "#6b6a68", whiteSpace: "nowrap"
        }}>{t}</button>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginLeft: "auto" }}>
        <p style={{ fontSize: 11, color: "#6b6a68", margin: "0 0 2px", textAlign: "right" }}>Attribution model</p>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {Object.entries(MODEL_LABELS).map(([k, v]) => <button key={k} onClick={() => setModel(k)} style={{
            padding: "4px 9px", fontSize: 11, borderRadius: 6,
            border: model === k ? "0.5px solid #2563EB" : "0.5px solid #d1d1d0",
            cursor: "pointer", background: model === k ? "#eff6ff" : "transparent",
            color: model === k ? "#1d4ed8" : "#6b6a68"
          }}>{v}</button>)}
        </div>
      </div>
    </div>
    {tab === 0 && <SummaryTab model={model} data={data} />}
    {tab === 1 && <ChannelTab model={model} data={data} />}
    {tab === 2 && <CampaignTab model={model} data={data} />}
    {tab === 3 && <TrafficTab data={data} />}
    {tab === 4 && <PacingTab data={data} />}
    {tab === 5 && <DealTab data={data} />}
    {tab === 6 && <DemographicsTab data={data} />}
    {tab === 7 && <SourcesTab data={data} />}
  </div>;
}
