import { useState } from "react";

const CHANNELS = ["LinkedIn", "Google Ads", "G2", "Programmatic"];
const CH_COLORS = { LinkedIn: "#2563EB", "Google Ads": "#1D9E75", G2: "#BA7517", Programmatic: "#888780" };
const ANNUAL_SPEND = { LinkedIn: 574000, "Google Ads": 574000, G2: 112000, Programmatic: 140000 };
const TOTAL_BUDGET = 1400000;
const GOALS = { mqls: 1800, pipeline: 5000000, budget: 1400000, roas: 3.5 };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TRAFFIC_INDEX = [0.055,0.072,0.095,0.092,0.105,0.068,0.055,0.063,0.092,0.098,0.075,0.030];
const MONTHLY_TRAFFIC = TRAFFIC_INDEX.map(w => Math.round(w * 42000 * 12));
const DSP_ATTR = "DSP-Retarget-HighIntent-14d";
const CPL_BENCH = { LinkedIn: { low: 80, high: 130 }, "Google Ads": { low: 75, high: 200 } };
const ROAS_BENCH = { LinkedIn: { low: 3.0, high: 4.0 }, "Google Ads": { low: 3.0, high: 4.0 } };
const CH_LEAD_COUNTS = { LinkedIn: 5200, "Google Ads": 4000, G2: 140, Programmatic: 38 };
const CH_RATES = {
  LinkedIn:     { l2mql: 0.35, mql2opp: 0.22, opp2close: 0.24, cycle: 95 },
  "Google Ads": { l2mql: 0.38, mql2opp: 0.25, opp2close: 0.28, cycle: 60 },
  G2:           { l2mql: 0.40, mql2opp: 0.28, opp2close: 0.30, cycle: 50 },
  Programmatic: { l2mql: 0.04, mql2opp: 0.03, opp2close: 0.05, cycle: 140 },
};
const CH_SEN_DIST = {
  LinkedIn:     [{tier:"c_suite_vp",mult:1.5,w:.10},{tier:"director",mult:1.25,w:.35},{tier:"manager",mult:1.0,w:.40},{tier:"ic_analyst",mult:.75,w:.15}],
  "Google Ads": [{tier:"c_suite_vp",mult:1.5,w:.10},{tier:"director",mult:1.25,w:.32},{tier:"manager",mult:1.0,w:.42},{tier:"ic_analyst",mult:.75,w:.16}],
  G2:           [{tier:"c_suite_vp",mult:1.5,w:.12},{tier:"director",mult:1.25,w:.23},{tier:"manager",mult:1.0,w:.35},{tier:"ic_analyst",mult:.75,w:.30}],
  Programmatic: [{tier:"c_suite_vp",mult:1.5,w:.12},{tier:"director",mult:1.25,w:.23},{tier:"manager",mult:1.0,w:.35},{tier:"ic_analyst",mult:.75,w:.30}],
};
const SEN_DEAL = {
  c_suite_vp: { label:"C-Suite / VP", track:"Sales-assisted", avgDeal:32000, cycle:70, color:"#2563EB" },
  director:   { label:"Director",     track:"Sales-assisted", avgDeal:24000, cycle:55, color:"#1D9E75" },
  manager:    { label:"Manager",      track:"Both",           avgDeal:16000, cycle:45, color:"#BA7517" },
  ic_analyst: { label:"IC / Analyst", track:"PLG",            avgDeal:9000,  cycle:30, color:"#888780" },
};
const CH_DEALS = {
  LinkedIn:     { c_suite_vp: 10000, director: 8000, manager: 6000, ic_analyst: 4000 },
  "Google Ads": { c_suite_vp: 10000, director: 8000, manager: 6000, ic_analyst: 4000 },
  G2:           { c_suite_vp: 32000, director: 24000, manager: 16000, ic_analyst: 9000 },
  Programmatic: { c_suite_vp: 32000, director: 24000, manager: 16000, ic_analyst: 9000 },
};
const CAMPAIGNS = {
  LinkedIn:     ["LI-ENT-Awareness-DataPipeline","LI-ENT-Awareness-DataIntegration","LI-MOFU-Demo-DataEngineers","LI-MOFU-Trial-AnalyticsTeams","LI-Retarget-SiteVisitors-30d","LI-Retarget-PricingPage-14d","LI-ABM-Strategic-ENT"],
  "Google Ads": ["GGL-Brand-Syncflow-Exact","GGL-NonBrand-ETL-Tools","GGL-NonBrand-DataPipeline","GGL-Competitor-Pipeform-Alt","GGL-Competitor-Streamlink-Alt","GGL-RLSA-HighIntent-Visitors"],
  G2:           ["G2-GridReport-ETL-Gated","G2-Badge-LP-Integration","G2-Retarget-CategoryBuyers"],
  Programmatic: ["DSP-ABM-AirCover-Strategic","DSP-ABM-AirCover-Commercial","DSP-Retarget-HighIntent-14d","DSP-Awareness-DataEngineers"],
};
const FORMS = ["gated_content_download","newsletter_signup","trial_signup","demo_request"];
const FORM_W = [0.45, 0.25, 0.20, 0.10];
const ANGLES = ["pain-point","social-proof","thought-leadership","product-feature"];
const CTAS = ["cta-demo","cta-trial","cta-download","cta-learn-more"];
const LI_TERMS = ["li-ent-data-engineers","li-mid-analytics-directors","li-retarget-site-visitors-30d","li-lookalike-closed-won","li-abm-strategic-accounts"];
const GGL_TERMS = ["etl-software","data-pipeline-tools","syncflow-alternative","data-integration-platform","pipeform-alternative","streamlink-vs-syncflow"];
const G2_TERMS = ["etl-tools-comparison","data-integration-review","pipeline-software-evaluation"];
const DSP_TERMS = ["abm-strategic-accounts","retarget-site-visitors-14d","lookalike-data-engineers"];

function seededRand(s) { let x = s; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
const rng = seededRand(42);
function pick(a) { return a[Math.floor(rng() * a.length)]; }
function pickW(a, w) { let r = rng(), c = 0; for (let i = 0; i < a.length; i++) { c += w[i]; if (r < c) return a[i]; } return a[a.length - 1]; }
function getSenForCh(ch) { const dist = CH_SEN_DIST[ch]; let r = rng(), c = 0; for (let s of dist) { c += s.w; if (r < c) return s; } return dist[dist.length - 1]; }
function getUTM(ch) {
  if (ch === "LinkedIn")    return { source:"linkedin",    medium:"paid-social",  content:"single-image_"+pick(ANGLES)+"_"+pick(CTAS), term:pick(LI_TERMS) };
  if (ch === "Google Ads")  return { source:"google",      medium:"paid-search",  content:pick(["text-ad_search","text-ad_rlsa","text-ad_competitor"]), term:pick(GGL_TERMS) };
  if (ch === "G2")          return { source:"g2",          medium:"review-site",  content:pick(["gated-report_etl","badge-display_integration","retarget-banner_category"]), term:pick(G2_TERMS) };
  return { source:"stackadapt", medium:"display", content:pick(["display-banner_abm","display-banner_retarget","display-banner_awareness"]), term:pick(DSP_TERMS) };
}

const TOTAL_LEADS_COUNT = Object.values(CH_LEAD_COUNTS).reduce((a, b) => a + b, 0);
const PROSPECTS = [];
let pidx = 0;
CHANNELS.forEach(ch => {
  const n = CH_LEAD_COUNTS[ch];
  const rates = CH_RATES[ch];
  const dspCamps = CAMPAIGNS["Programmatic"];
  for (let i = 0; i < n; i++) {
    const sen = getSenForCh(ch);
    const nT = pickW([2,3,4],[.30,.45,.25]);
    const touches = [];
    for (let t = 0; t < nT; t++) {
      const tch = t === 0 ? ch : (t === nT-1 && nT > 2 ? (rng() < .4 ? "G2" : pick(CHANNELS)) : pick(CHANNELS));
      let camp = tch === "Programmatic" ? (rng() < 0.25 ? DSP_ATTR : pick(dspCamps.filter(c => c !== DSP_ATTR))) : pick(CAMPAIGNS[tch]);
      touches.push({ touch_number: t+1, channel: tch, campaign_name: camp, form_type: pickW(FORMS, FORM_W), ...getUTM(tch) });
    }
    const isMQL = rng() < rates.l2mql;
    const isOpp = isMQL && rng() < rates.mql2opp;
    const isClosed = isOpp && rng() < rates.opp2close;
    const dd = SEN_DEAL[sen.tier];
    const dealSize = isOpp ? Math.round(CH_DEALS[ch][sen.tier] * (0.8 + rng() * 0.4)) : 0;
    const salesCycle = isOpp ? Math.round(rates.cycle * (0.85 + rng() * 0.3)) : 0;
    const month = Math.floor(pidx / TOTAL_LEADS_COUNT * 12);
    PROSPECTS.push({ id: pidx++, primaryCh: ch, tier: sen.tier, mult: sen.mult, touches, isMQL, isOpp, isClosed, pipeline: dealSize, dealSize, salesCycle, month, track: dd.track });
  }
});

function computeAttrib(model) {
  const cr = {}; CHANNELS.forEach(c => cr[c] = 0);
  PROSPECTS.forEach(p => {
    if (!p.isOpp || !p.pipeline) return;
    const attr = p.touches.map(t => ({ ...t, eligible: !(t.channel === "Programmatic" && t.campaign_name !== DSP_ATTR) }));
    const eidxs = attr.map((t, i) => t.eligible ? i : -1).filter(i => i >= 0);
    const eN = eidxs.length; if (!eN) return;
    eidxs.forEach((i, ei) => {
      const t = attr[i];
      let w = model === "first_touch" ? (ei===0?1:0) : model === "last_touch" ? (ei===eN-1?1:0) : model === "linear" ? 1/eN : (eN===1?1:eN===2?.5:(ei===0||ei===eN-1?.4:.2/(eN-2)));
      cr[t.channel] = (cr[t.channel] || 0) + p.pipeline * w;
    });
  });
  return cr;
}

const totalLeads = PROSPECTS.length;
const totalMQLs = PROSPECTS.filter(p => p.isMQL).length;
const totalOpps = PROSPECTS.filter(p => p.isOpp).length;
const totalClosed = PROSPECTS.filter(p => p.isClosed).length;
const totalPipeline = PROSPECTS.reduce((s, p) => s + p.pipeline, 0);

const chLeads={}, chMQLs={}, chOpps={}, chClosed={}, chDemos={}, chTrials={};
CHANNELS.forEach(c => { chLeads[c]=0; chMQLs[c]=0; chOpps[c]=0; chClosed[c]=0; chDemos[c]=0; chTrials[c]=0; });
PROSPECTS.forEach(p => {
  chLeads[p.primaryCh]++;
  if (p.isMQL) chMQLs[p.primaryCh]++;
  if (p.isOpp) chOpps[p.primaryCh]++;
  if (p.isClosed) chClosed[p.primaryCh]++;
  p.touches.forEach(t => { if (t.form_type==="demo_request") chDemos[t.channel]++; if (t.form_type==="trial_signup") chTrials[t.channel]++; });
});

const senLeads={}, senMQLs={}, senOpps={}, senClosed={}, senCycles=[];
Object.keys(SEN_DEAL).forEach(k => { senLeads[k]=0; senMQLs[k]=0; senOpps[k]=0; senClosed[k]=0; });
PROSPECTS.forEach(p => {
  senLeads[p.tier]++;
  if (p.isMQL) senMQLs[p.tier]++;
  if (p.isOpp) { senOpps[p.tier]++; if (p.salesCycle) senCycles.push({ tier:p.tier, cycle:p.salesCycle, deal:p.dealSize }); }
  if (p.isClosed) senClosed[p.tier]++;
});

const monthlyMQLs = Array(12).fill(0), monthlyPipeline = Array(12).fill(0);
PROSPECTS.forEach(p => { if (p.isMQL) monthlyMQLs[p.month]++; monthlyPipeline[p.month] += p.pipeline; });

function fmt$(n) { return "$" + (n >= 1000000 ? (n/1000000).toFixed(1)+"M" : (n/1000).toFixed(0)+"K"); }
function fmtK(n) { return "$" + Math.round(n/1000) + "K"; }
function pct(a, b) { return b ? Math.round(a/b*100)+"%" : "-"; }
function pctN(a, b) { return b ? Math.round(a/b*100) : 0; }
function fmtN(n) { return Math.round(n).toLocaleString(); }
function cplVal(ch) { return chLeads[ch] ? Math.round(ANNUAL_SPEND[ch]/chLeads[ch]) : 0; }
function cpMQLVal(ch) { return chMQLs[ch] ? Math.round(ANNUAL_SPEND[ch]/chMQLs[ch]) : 0; }
function roasNum(ch, model) { const cr = computeAttrib(model); return ANNUAL_SPEND[ch] ? parseFloat((cr[ch]/ANNUAL_SPEND[ch]).toFixed(2)) : 0; }

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

function CplCell({ ch }) {
  const v = cplVal(ch);
  const s = cplStatus(ch, v);
  if (!s) return <span className="font-medium">${v}</span>;
  const tip = s==="green" ? "on benchmark" : s==="yellow" ? "below range: review quality" : "over benchmark";
  return <span style={{ background: s==="green"?"#dcfce7":s==="yellow"?"#fef9c3":"#fee2e2", color: s==="green"?"#166534":s==="yellow"?"#854d0e":"#991b1b", padding:"2px 8px", borderRadius:"20px", fontSize:"11px", fontWeight:500 }}>${v} <span style={{fontWeight:400,opacity:.85}}>{tip}</span></span>;
}
function RoasCell({ ch, model }) {
  const v = roasNum(ch, model);
  const s = roasStatus(ch, v);
  if (!s) return <span className="font-medium">{v > 0 ? v.toFixed(1)+"x" : "-"}</span>;
  const tip = s==="green" ? "on benchmark" : s==="yellow" ? "above range: review" : "below target";
  return <span style={{ background: s==="green"?"#dcfce7":s==="yellow"?"#fef9c3":"#fee2e2", color: s==="green"?"#166534":s==="yellow"?"#854d0e":"#991b1b", padding:"2px 8px", borderRadius:"20px", fontSize:"11px", fontWeight:500 }}>{v.toFixed(1)}x <span style={{fontWeight:400,opacity:.85}}>{tip}</span></span>;
}
function Dot({ color }) {
  return <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:color, marginRight:5 }} />;
}
function PacePill({ actual, goal }) {
  const p = goal ? actual/goal : 0;
  if (p >= .95) return <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#dcfce7",color:"#166534"}}>On track</span>;
  if (p >= .80) return <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#fef9c3",color:"#854d0e"}}>At risk</span>;
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#fee2e2",color:"#991b1b"}}>Behind</span>;
}
function NoteBox({ children }) {
  return <div style={{background:"#f8f8f7",borderLeft:"3px solid #2563EB",borderRadius:"0 6px 6px 0",padding:".6rem .85rem",fontSize:11,color:"#6b6a68",marginBottom:"1rem",lineHeight:1.6}}>{children}</div>;
}
function BenchLegend() {
  return <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8,fontSize:10,color:"#6b6a68"}}>
    <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#dcfce7",display:"inline-block"}}></span>On benchmark</span>
    <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#fef9c3",display:"inline-block"}}></span>CPL: below range, review quality / ROAS: above range, review</span>
    <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#fee2e2",display:"inline-block"}}></span>CPL: over benchmark / ROAS: below target</span>
  </div>;
}

function SimpleBar({ data, color, height=160 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return <div style={{display:"flex",alignItems:"flex-end",gap:6,height,paddingTop:8}}>
    {data.map((d, i) => (
      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <span style={{fontSize:9,color:"#6b6a68"}}>{d.label2}</span>
        <div style={{width:"100%",background:d.color||color||"#2563EB",borderRadius:"3px 3px 0 0",height:Math.max(4,Math.round((d.value/max)*(height-40)))}}/>
        <span style={{fontSize:9,color:"#6b6a68",textAlign:"center",lineHeight:1.2}}>{d.label}</span>
      </div>
    ))}
  </div>;
}
function MiniLine({ data, color="#2563EB", height=140 }) {
  const max = Math.max(...data, 1), min = 0;
  const pts = data.map((v,i) => [i/(data.length-1)*100, 100-((v-min)/(max-min)*80+10)]);
  const d = pts.map((p,i) => (i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:"100%",height}}>
    <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
  </svg>;
}

function SummaryTab({ model }) {
  const cr = computeAttrib(model);
  const tot = Object.values(cr).reduce((a,b)=>a+b,0);
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/data/prospects.csv';
    link.download = 'syncflow_prospects.csv';
    link.click();
  };
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(95px,1fr))",gap:8,marginBottom:"1rem"}}>
      {[
        {label:"Total leads",    val:fmtN(totalLeads)},
        {label:"MQLs",           val:fmtN(totalMQLs),   sub:pct(totalMQLs,GOALS.mqls)+" of goal"},
        {label:"SQLs / Opps",    val:fmtN(totalOpps)},
        {label:"Closed-won",     val:fmtN(totalClosed)},
        {label:"Total pipeline", val:fmt$(totalPipeline), sub:pct(totalPipeline,GOALS.pipeline)+" of goal"},
        {label:"Total spend",    val:fmt$(TOTAL_BUDGET)},
        {label:"Blended CPL",    val:"$"+(totalMQLs?Math.round(TOTAL_BUDGET/totalMQLs):0)},
      ].map((k,i) => <div key={i} style={{background:"#f8f8f7",borderRadius:6,padding:".8rem"}}>
        <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 3px"}}>{k.label}</p>
        <p style={{fontSize:18,fontWeight:500,margin:0}}>{k.val}</p>
        {k.sub && <p style={{fontSize:10,color:"#6b6a68",margin:"3px 0 0"}}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 8px"}}>Funnel conversion rates: blended</p>
    <div style={{display:"flex",alignItems:"stretch",gap:3,marginBottom:"1rem",flexWrap:"wrap"}}>
      {[
        {rate:fmtN(totalLeads), lbl:"Leads", color:"#e5e5e3"},
        {rate:pctN(totalMQLs,totalLeads)+"%", lbl:"Lead→MQL", sub:fmtN(totalMQLs), border:"#2563EB"},
        {rate:pctN(totalOpps,totalMQLs)+"%",  lbl:"MQL→SQL",  sub:fmtN(totalOpps),  border:"#1D9E75"},
        {rate:pctN(totalClosed,totalOpps)+"%",lbl:"SQL→Closed",sub:fmtN(totalClosed),border:"#BA7517"},
        {rate:pctN(totalClosed,totalLeads)+"%",lbl:"Lead→Closed",sub:"end-to-end",border:"#888780"},
      ].map((f,i) => <div key={i} style={{flex:1,minWidth:80,background:"#f8f8f7",borderRadius:6,padding:".75rem",textAlign:"center",borderTop:f.border?`2px solid ${f.border}`:"none"}}>
        <p style={{fontSize:18,fontWeight:500,margin:0}}>{f.rate}</p>
        <p style={{fontSize:10,color:"#6b6a68",margin:"3px 0 0"}}>{f.lbl}</p>
        {f.sub && <p style={{fontSize:10,color:"#6b6a68",margin:"2px 0 0"}}>{f.sub}</p>}
      </div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:"1rem"}}>
      <div>
        <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Pipeline credit by channel</p>
        <SimpleBar height={160} data={CHANNELS.map(c=>({label:c.replace(" Ads",""),label2:fmtK(cr[c]),value:cr[c],color:CH_COLORS[c]}))}/>
      </div>
      <div>
        <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Lead to MQL rate by channel</p>
        <SimpleBar height={160} data={CHANNELS.map(c=>({label:c.replace(" Ads",""),label2:pct(chMQLs[c],chLeads[c]),value:pctN(chMQLs[c],chLeads[c]),color:CH_COLORS[c]}))}/>
      </div>
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Channel summary</p>
    <BenchLegend/>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Channel","Leads","MQLs","SQLs","Closed","Pipeline","CPL","ROAS","L→MQL","MQL→SQL"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{CHANNELS.map(ch=><tr key={ch}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><Dot color={CH_COLORS[ch]}/>{ch}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(chLeads[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(chMQLs[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(chOpps[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(chClosed[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtK(cr[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><CplCell ch={ch}/></td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><RoasCell ch={ch} model={model}/></td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chMQLs[ch],chLeads[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chOpps[ch],chMQLs[ch])}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{marginTop:"1.5rem",paddingTop:"1.5rem",borderTop:"0.5px solid #e5e5e3"}}>
      <p style={{fontSize:14,fontWeight:500,margin:"0 0 6px"}}>Download the dataset</p>
      <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 10px",maxWidth:560}}>
        Pull the mock dataset into Looker Studio, Google Sheets, or your BI tool of choice. The CSV includes 9,378 prospect journeys with full UTM taxonomy, touch sequences, form types, seniority tiers, and pipeline values.
      </p>
      <button onClick={handleDownload} style={{
        padding:"5px 10px",fontSize:11,borderRadius:6,
        border:"none",cursor:"pointer",background:"#2563EB",color:"#fff"
      }}>Download CSV</button>
      <p style={{fontSize:11,color:"#9b9a97",margin:"6px 0 0"}}>syncflow_prospects.csv — 1.5MB — one row per touch</p>
    </div>
  </div>;
}

function ChannelTab({ model }) {
  const cr = computeAttrib(model);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:"1rem"}}>
      {CHANNELS.map(ch=><div key={ch} style={{background:"#f8f8f7",borderRadius:"0 6px 6px 0",padding:".8rem",borderLeft:`3px solid ${CH_COLORS[ch]}`}}>
        <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 3px"}}>{ch}</p>
        <p style={{fontSize:14,fontWeight:500,margin:0}}>{fmt$(ANNUAL_SPEND[ch])}</p>
        <p style={{fontSize:10,color:"#6b6a68",margin:"3px 0 0"}}>annual spend</p>
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Volume counts by funnel stage</p>
    <div style={{overflowX:"auto",marginBottom:"1rem"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Channel","Leads","MQLs","SQLs","Closed","Lead→MQL","MQL→SQL","SQL→Closed","MQL→Closed","Lead→Closed"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{CHANNELS.map(ch=><tr key={ch}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><Dot color={CH_COLORS[ch]}/>{ch}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontWeight:600}}>{fmtN(chLeads[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontWeight:600}}>{fmtN(chMQLs[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontWeight:600}}>{fmtN(chOpps[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontWeight:600}}>{fmtN(chClosed[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chMQLs[ch],chLeads[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chOpps[ch],chMQLs[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chClosed[ch],chOpps[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chClosed[ch],chMQLs[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(chClosed[ch],chLeads[ch])}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Efficiency metrics</p>
    <BenchLegend/>
    <div style={{overflowX:"auto",marginBottom:"1rem"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Channel","Spend","CPL","cpMQL","ROAS","Cost/Demo","Cost/Trial"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3"}}>{h}</th>)}</tr></thead>
        <tbody>{CHANNELS.map(ch=><tr key={ch}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><Dot color={CH_COLORS[ch]}/>{ch}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmt$(ANNUAL_SPEND[ch])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><CplCell ch={ch}/></td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>${cpMQLVal(ch)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><RoasCell ch={ch} model={model}/></td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>${fmtN(chDemos[ch]?Math.round(ANNUAL_SPEND[ch]/chDemos[ch]):0)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>${fmtN(chTrials[ch]?Math.round(ANNUAL_SPEND[ch]/chTrials[ch]):0)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <NoteBox>Programmatic pipeline credit is restricted to <strong>DSP-Retarget-HighIntent-14d</strong> only. Air cover and awareness campaigns receive zero direct attribution. Value is measured through assisted lift on other channels. ROAS and CPL health indicators are not applied to G2 or Programmatic.</NoteBox>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div>
        <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 4px"}}>CPL by channel: color = benchmark health</p>
        <BenchLegend/>
        <SimpleBar height={155} data={CHANNELS.map(ch=>{
          const v=cplVal(ch); const s=cplStatus(ch,v);
          return {label:ch.replace(" Ads",""),label2:"$"+v,value:v,color:s?STATUS_COLORS[s]:CH_COLORS[ch]};
        })}/>
      </div>
      <div>
        <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 4px"}}>ROAS by channel: color = benchmark health</p>
        <BenchLegend/>
        <SimpleBar height={155} data={CHANNELS.map(ch=>{
          const v=roasNum(ch,model); const s=roasStatus(ch,v);
          return {label:ch.replace(" Ads",""),label2:v>0?v.toFixed(1)+"x":"-",value:v,color:s?STATUS_COLORS[s]:CH_COLORS[ch]};
        })}/>
      </div>
    </div>
  </div>;
}

function CampaignTab({ model }) {
  const camps = {};
  PROSPECTS.forEach(p => {
    if (!p.isOpp || !p.pipeline) return;
    const attr = p.touches.map(t => ({ ...t, eligible: !(t.channel==="Programmatic" && t.campaign_name!==DSP_ATTR) }));
    const eidxs = attr.map((t,i) => t.eligible?i:-1).filter(i=>i>=0);
    const eN = eidxs.length; if (!eN) return;
    eidxs.forEach((i,ei) => {
      const t = attr[i];
      let w = model==="first_touch"?(ei===0?1:0):model==="last_touch"?(ei===eN-1?1:0):model==="linear"?1/eN:(eN===1?1:eN===2?.5:(ei===0||ei===eN-1?.4:.2/(eN-2)));
      if (!camps[t.campaign_name]) camps[t.campaign_name]={channel:t.channel,pipeline:0,mqls:0,touches:0};
      camps[t.campaign_name].pipeline += p.pipeline*w;
      camps[t.campaign_name].touches++;
    });
    p.touches.forEach(t => { if (p.isMQL && camps[t.campaign_name]) camps[t.campaign_name].mqls++; });
  });
  const sorted = Object.entries(camps).sort((a,b)=>b[1].pipeline-a[1].pipeline).slice(0,15);
  const max = sorted[0]?.[1].pipeline || 1;
  return <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
      <thead><tr>{["Campaign","Channel","Pipeline credit","MQLs","Touches","Relative"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3"}}>{h}</th>)}</tr></thead>
      <tbody>{sorted.map(([name,d])=><tr key={name}>
        <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontSize:10}}>{name}</td>
        <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><Dot color={CH_COLORS[d.channel]}/><span style={{fontSize:10}}>{d.channel}</span></td>
        <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtK(d.pipeline)}</td>
        <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{d.mqls}</td>
        <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{d.touches}</td>
        <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>
          <div style={{height:5,background:"#e5e5e3",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.round(d.pipeline/max*100)+"%",background:CH_COLORS[d.channel],borderRadius:3}}/>
          </div>
        </td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function PacingTab() {
  const now = 5;
  const weeksElapsed = Math.round((now+1)/12*52);
  const weeklyTarget = Math.round(GOALS.mqls/52);
  const weeklyActual = Math.round(totalMQLs/weeksElapsed);
  const mqlGoals = TRAFFIC_INDEX.map(w=>Math.round(w*GOALS.mqls));
  const pipeGoals = TRAFFIC_INDEX.map(w=>Math.round(w*GOALS.pipeline));
  const ytdMQLGoal = mqlGoals.slice(0,now+1).reduce((a,b)=>a+b,0);
  const ytdPipeGoal = pipeGoals.slice(0,now+1).reduce((a,b)=>a+b,0);
  const ytdMQLActual = monthlyMQLs.slice(0,now+1).reduce((a,b)=>a+b,0);
  const ytdPipeActual = monthlyPipeline.slice(0,now+1).reduce((a,b)=>a+b,0);
  const qData = [{q:"Q1",m:[0,1,2]},{q:"Q2",m:[3,4,5]},{q:"Q3",m:[6,7,8]},{q:"Q4",m:[9,10,11]}].map(({q,m})=>({
    q, mqlGoal:m.reduce((s,i)=>s+mqlGoals[i],0), mqlActual:m.reduce((s,i)=>s+monthlyMQLs[i],0),
    pipeGoal:m.reduce((s,i)=>s+pipeGoals[i],0), pipeActual:m.reduce((s,i)=>s+monthlyPipeline[i],0),
  }));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(95px,1fr))",gap:8,marginBottom:"1rem"}}>
      {[
        {label:"YTD MQLs",val:fmtN(ytdMQLActual),sub:pct(ytdMQLActual,ytdMQLGoal)+" of YTD goal"},
        {label:"YTD pipeline",val:fmt$(ytdPipeActual),sub:pct(ytdPipeActual,ytdPipeGoal)+" of YTD goal"},
        {label:"Weekly MQLs",val:fmtN(weeklyActual),sub:"target "+fmtN(weeklyTarget)+"/wk"},
        {label:"Annual MQL goal",val:fmtN(GOALS.mqls)},
        {label:"Annual pipeline goal",val:fmt$(GOALS.pipeline)},
      ].map((k,i)=><div key={i} style={{background:"#f8f8f7",borderRadius:6,padding:".8rem"}}>
        <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 3px"}}>{k.label}</p>
        <p style={{fontSize:18,fontWeight:500,margin:0}}>{k.val}</p>
        {k.sub&&<p style={{fontSize:10,color:"#6b6a68",margin:"3px 0 0"}}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#6b6a68",marginBottom:8}}>Yearly pacing</p>
    {[{label:`MQLs: ${fmtN(totalMQLs)} of ${fmtN(GOALS.mqls)}`,pct:Math.min(100,Math.round(totalMQLs/GOALS.mqls*100)),color:"#2563EB"},
      {label:`Pipeline: ${fmt$(totalPipeline)} of ${fmt$(GOALS.pipeline)}`,pct:Math.min(100,Math.round(totalPipeline/GOALS.pipeline*100)),color:"#1D9E75"}
    ].map((b,i)=><div key={i} style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b6a68",marginBottom:3}}><span>{b.label}</span><span>{b.pct}%</span></div>
      <div style={{height:8,background:"#e5e5e3",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:b.pct+"%",background:b.color,borderRadius:4}}/></div>
    </div>)}
    <p style={{fontSize:12,color:"#6b6a68",margin:"1rem 0 6px"}}>Quarterly breakdown</p>
    <div style={{overflowX:"auto",marginBottom:"1rem"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Quarter","MQL goal","MQL actual","MQL %","Pipeline goal","Pipeline actual","Pipeline %","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3"}}>{h}</th>)}</tr></thead>
        <tbody>{qData.map(d=><tr key={d.q}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontWeight:500}}>{d.q}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(d.mqlGoal)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(d.mqlActual)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(d.mqlActual,d.mqlGoal)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtK(d.pipeGoal)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtK(d.pipeActual)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(d.pipeActual,d.pipeGoal)}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><PacePill actual={d.mqlActual} goal={d.mqlGoal}/></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Monthly MQLs vs. seasonality-adjusted goal</p>
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:160,paddingTop:8}}>
      {MONTHS.map((m,i)=>{
        const maxV=Math.max(...monthlyMQLs,...TRAFFIC_INDEX.map(w=>Math.round(w*GOALS.mqls)),1);
        const aH=Math.max(3,Math.round(monthlyMQLs[i]/maxV*130));
        const gH=Math.max(3,Math.round(TRAFFIC_INDEX[i]*GOALS.mqls/maxV*130));
        return <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",display:"flex",gap:1,alignItems:"flex-end",height:130}}>
            <div style={{flex:1,background:"#2563EB",borderRadius:"2px 2px 0 0",height:aH}}/>
            <div style={{flex:1,background:"rgba(29,158,117,0.3)",border:"1px solid #1D9E75",borderRadius:"2px 2px 0 0",height:gH}}/>
          </div>
          <span style={{fontSize:8,color:"#6b6a68"}}>{m}</span>
        </div>;
      })}
    </div>
  </div>;
}

function TrafficTab() {
  const mqlGoals = TRAFFIC_INDEX.map(w=>Math.round(w*GOALS.mqls));
  const pipeGoals = TRAFFIC_INDEX.map(w=>Math.round(w*GOALS.pipeline));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(95px,1fr))",gap:8,marginBottom:"1rem"}}>
      {[
        {label:"Annual sessions",val:fmtN(MONTHLY_TRAFFIC.reduce((a,b)=>a+b,0))},
        {label:"Peak month",val:"May",sub:"10.5% of traffic"},
        {label:"Slowest month",val:"Dec",sub:"3.0% of traffic"},
        {label:"Annual MQL goal",val:fmtN(GOALS.mqls),sub:"seasonality-weighted"},
      ].map((k,i)=><div key={i} style={{background:"#f8f8f7",borderRadius:6,padding:".8rem"}}>
        <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 3px"}}>{k.label}</p>
        <p style={{fontSize:18,fontWeight:500,margin:0}}>{k.val}</p>
        {k.sub&&<p style={{fontSize:10,color:"#6b6a68",margin:"3px 0 0"}}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Monthly organic sessions</p>
    <MiniLine data={MONTHLY_TRAFFIC} color="#2563EB" height={120}/>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"1rem"}}>
      {MONTHS.map(m=><span key={m} style={{fontSize:8,color:"#6b6a68"}}>{m}</span>)}
    </div>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Month","Sessions","Traffic index","MQL goal","Actual MQLs","Pipeline goal","Actual pipeline","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{MONTHS.map((m,i)=><tr key={m}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{m}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(MONTHLY_TRAFFIC[i])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{Math.round(TRAFFIC_INDEX[i]*100)}%</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(mqlGoals[i])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(monthlyMQLs[i])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtK(pipeGoals[i])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtK(monthlyPipeline[i])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><PacePill actual={monthlyMQLs[i]} goal={mqlGoals[i]}/></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function DealTab() {
  const senTiers = Object.entries(SEN_DEAL);
  const avgCycleByTier={}, avgDealByTier={};
  senTiers.forEach(([k])=>{
    const rows=senCycles.filter(r=>r.tier===k);
    avgCycleByTier[k]=rows.length?Math.round(rows.reduce((s,r)=>s+r.cycle,0)/rows.length):0;
    avgDealByTier[k]=rows.length?Math.round(rows.reduce((s,r)=>s+r.deal,0)/rows.length):0;
  });
  const plgPipe=PROSPECTS.filter(p=>p.isOpp&&p.track==="PLG").reduce((s,p)=>s+p.pipeline,0);
  const slgPipe=PROSPECTS.filter(p=>p.isOpp&&(p.track==="Sales-assisted"||p.track==="Both")).reduce((s,p)=>s+p.pipeline,0);
  const avgCycle=Math.round(senCycles.reduce((s,r)=>s+r.cycle,0)/(senCycles.length||1));
  const avgDeal=Math.round(senCycles.reduce((s,r)=>s+r.deal,0)/(senCycles.length||1));
  const velocity=Math.round((totalOpps*(totalClosed/(totalOpps||1))*avgDeal)/(avgCycle||1)*30);
  const CH_ROLES={
    LinkedIn:{role:"Demand generation",annotation:"Creates and nurtures demand. Longer cycle reflects multi-stakeholder deals. CPL: $80–$130. ROAS: 3–4x.",track:"Both"},
    "Google Ads":{role:"Demand capture",annotation:"Intercepts in-market buyers. Shortest cycle, highest standalone close rate. CPL: $75–$200. ROAS: 3–4x.",track:"Both"},
    G2:{role:"Closing validator",annotation:"Highest MQL quality, lowest volume. Buyers already in evaluation. No CPL/ROAS benchmark applied.",track:"Both"},
    Programmatic:{role:"Air cover / ABM",annotation:"Visibility channel. Pipeline credit restricted to retargeting only. Air cover = zero attribution.",track:"Sales-assisted"},
  };
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(95px,1fr))",gap:8,marginBottom:"1rem"}}>
      {[
        {label:"Avg deal size",val:fmt$(avgDeal)},
        {label:"Avg sales cycle",val:avgCycle+"d"},
        {label:"Overall win rate",val:pct(totalClosed,totalOpps)},
        {label:"Pipeline velocity",val:fmt$(velocity),sub:"per 30 days"},
        {label:"PLG pipeline",val:fmt$(plgPipe)},
        {label:"Sales-assisted",val:fmt$(slgPipe)},
      ].map((k,i)=><div key={i} style={{background:"#f8f8f7",borderRadius:6,padding:".8rem"}}>
        <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 3px"}}>{k.label}</p>
        <p style={{fontSize:18,fontWeight:500,margin:0}}>{k.val}</p>
        {k.sub&&<p style={{fontSize:10,color:"#6b6a68",margin:"3px 0 0"}}>{k.sub}</p>}
      </div>)}
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Deal metrics by seniority tier</p>
    <div style={{overflowX:"auto",marginBottom:"1rem"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Tier","Motion","Leads","MQLs","SQLs","Closed","Avg deal","Avg cycle","Win rate","Lead→MQL","MQL→SQL"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{senTiers.map(([k,d])=><tr key={k}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><Dot color={d.color}/>{d.label}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:d.track==="PLG"?"#dbeafe":"#f8f8f7",color:d.track==="PLG"?"#1d4ed8":"#6b6a68"}}>{d.track}</span></td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(senLeads[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(senMQLs[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(senOpps[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmtN(senClosed[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{fmt$(avgDealByTier[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{avgCycleByTier[k]}d</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(senClosed[k],senOpps[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(senMQLs[k],senLeads[k])}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}>{pct(senOpps[k],senMQLs[k])}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:"1rem"}}>
      <div>
        <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Avg deal size by tier</p>
        <SimpleBar height={150} data={senTiers.map(([k,d])=>({label:d.label.split("/")[0].trim(),label2:fmt$(avgDealByTier[k]),value:avgDealByTier[k],color:d.color}))}/>
      </div>
      <div>
        <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Avg sales cycle by tier (days)</p>
        <SimpleBar height={150} data={senTiers.map(([k,d])=>({label:d.label.split("/")[0].trim(),label2:d.cycle+"d",value:d.cycle,color:d.color}))}/>
      </div>
    </div>
    <p style={{fontSize:12,color:"#6b6a68",margin:"0 0 6px"}}>Channel role: context for finance and leadership</p>
    <NoteBox>Pipeline credit reflects attribution model weighting. Programmatic credit is restricted to retargeting click conversions only. ROAS and CPL health indicators are not applied to G2 or Programmatic. Evaluate channels by their role, not pipeline credit alone.</NoteBox>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
        <thead><tr>{["Channel","Role","Motion","Annotation"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 7px",color:"#6b6a68",fontWeight:500,borderBottom:"0.5px solid #e5e5e3"}}>{h}</th>)}</tr></thead>
        <tbody>{CHANNELS.map(ch=><tr key={ch}>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><Dot color={CH_COLORS[ch]}/>{ch}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontWeight:500}}>{CH_ROLES[ch].role}</td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#f8f8f7",color:"#6b6a68"}}>{CH_ROLES[ch].track}</span></td>
          <td style={{padding:"5px 7px",borderBottom:"0.5px solid #e5e5e3",fontSize:10,color:"#6b6a68"}}>{CH_ROLES[ch].annotation}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function SourcesTab() {
  const SOURCES = [
    {ch:"All channels: funnel benchmarks",color:"#2C2C2A",metrics:[{l:"Lead to MQL (B2B avg)",v:"20–31%"},{l:"MQL to SQL",v:"13–22%"},{l:"SQL to closed-won",v:"20–30%"},{l:"Lead to customer",v:"2–5%"}],rationale:"Industry-wide funnel benchmarks form the baseline for all channel conversion assumptions. B2B SaaS skews higher due to tighter ICP targeting and demo/trial-gated conversion paths.",sources:[{n:"SerpSculpt: 2025 B2B Funnel Conversion Benchmarks",u:"https://serpsculpt.com/reports/b2b-sales-conversion-rate-by-industry/"},{n:"SalesHive: B2B Lead Gen Benchmarks 2024-2025",u:"https://saleshive.com/blog/b2b-lead-benchmarks-digital-marketing-gen/"},{n:"MarketJoy: B2B Sales Pipeline Conversion Rates",u:"https://marketjoy.com/b2b-sales-pipeline-conversion-rates-marketjoy-data/"},{n:"The Digital Bloom: 2025 B2B SaaS Funnel Benchmarks",u:"https://thedigitalbloom.com/learn/pipeline-performance-benchmarks-2025/"}]},
    {ch:"Google Ads",color:"#1D9E75",metrics:[{l:"Lead to MQL",v:"38%"},{l:"MQL to SQL",v:"25%"},{l:"SQL to closed",v:"28%"},{l:"Avg sales cycle",v:"65 days"},{l:"CPL benchmark",v:"$75–$200"},{l:"ROAS benchmark",v:"3–4x"},{l:"Lead volume",v:"4,000 → $143 CPL"}],rationale:"Google captures high-intent, in-market buyers. CPL below $75 signals broad match issues. CPL above $200 indicates overbidding or saturation. Blended ROAS is excluded from the summary. G2 structurally skews totals.",sources:[{n:"SaaSHero: 2026 B2B SaaS Conversion Benchmarks",u:"https://www.saashero.net/content/2026-b2b-saas-conversion-benchmarks/"},{n:"Involve Digital: Google Ads for B2B SaaS 2026",u:"https://www.involvedigital.com/insights/google-ads-b2b-saas"},{n:"GrowthSpree: B2B SaaS Sales Cycle Benchmarks 2026",u:"https://www.growthspreeofficial.com/blogs/b2b-saas-sales-cycle-length-benchmarks-2026-by-acv-vertical"}]},
    {ch:"LinkedIn",color:"#2563EB",metrics:[{l:"Lead to MQL",v:"35%"},{l:"MQL to SQL",v:"22%"},{l:"SQL to closed",v:"24%"},{l:"Avg sales cycle (model)",v:"120 days"},{l:"Dreamdata avg first-touch to closed",v:"281 days"},{l:"CPL benchmark",v:"$80–$130"},{l:"ROAS benchmark",v:"3–4x"},{l:"Lead volume",v:"5,200 → $110 CPL"}],rationale:"LinkedIn reaches buyers by professional profile, not search intent. Longer cycle reflects multi-stakeholder buying committees. Deal sizes skew toward Director/Manager tier to produce a realistic 3–4x ROAS alongside a $80–$130 CPL.",sources:[{n:"GrowthSpree: LinkedIn Ads Benchmarks 2026",u:"https://www.growthspreeofficial.com/blogs/linkedin-ads-benchmarks-2026-b2b-saas-cpc-cpl-cost-per-sql"},{n:"HockeyStack Labs: 2025 LinkedIn Ads Benchmark Report",u:"https://www.hockeystack.com/lab-blog-posts/linkedin-ads-benchmarks"},{n:"Dreamdata via GrowthSpree: Avg first-touch to closed: 281 days",u:"https://www.growthspreeofficial.com/blogs/linkedin-ads-roi-calculator-b2b-saas-cost-per-pipeline-dollar-120-day-sales-cycle"},{n:"Brixon Group: LinkedIn vs Google B2B 2026",u:"https://brixongroup.com/en/google-search-ads-vs-linkedin-message-ads-the-b2b-comparison-with-experience-values"}]},
    {ch:"G2",color:"#BA7517",metrics:[{l:"Lead to MQL",v:"40%"},{l:"MQL to SQL",v:"28%"},{l:"SQL to closed",v:"30%"},{l:"Lead volume",v:"140"},{l:"Avg sales cycle",v:"55 days"},{l:"CPL / ROAS benchmark",v:"Not applied"}],rationale:"G2 CPL and ROAS benchmarks are excluded. G2 investment is tied to review acquisition and category listing: not a traditional CPL buying model. Evaluated on MQL quality, SQL conversion rate, and sales cycle length.",sources:[{n:"GrowthSpree: MQL to SQL Conversion Rate Benchmarks 2026",u:"https://www.growthspreeofficial.com/blogs/mql-to-sql-conversion-rate-benchmarks-b2b-saas-2026"},{n:"Understory: MQL to SQL Conversion Rate Benchmarks",u:"https://www.understoryagency.com/blog/mql-to-sql-conversion-rate-benchmarks"}]},
    {ch:"Programmatic",color:"#888780",metrics:[{l:"CTR (display)",v:"0.1–0.3%"},{l:"Lead to MQL",v:"4%"},{l:"MQL to SQL",v:"3%"},{l:"SQL to closed",v:"5%"},{l:"Assisted lift on other channels",v:"5–10%"},{l:"Lead volume",v:"38 (visibility channel)"},{l:"Avg sales cycle",v:"150 days"},{l:"CPL / ROAS benchmark",v:"Not applied"},{l:"Attributable campaign",v:"DSP-Retarget-HighIntent-14d only"},{l:"View-through attribution",v:"Excluded by default"}],rationale:"Programmatic is a visibility channel. Near-zero standalone pipeline is expected. Value is measured through 5–10% assisted lift on other channel conversions for ABM target accounts. Only DSP-Retarget-HighIntent-14d receives pipeline credit: it is the only campaign with click-based UTM tracking. Air cover campaigns (DSP-ABM-AirCover-Strategic, DSP-ABM-AirCover-Commercial, DSP-Awareness-DataEngineers) receive zero attribution, mirroring how Bizible and Marketo Measure handle DSP by default.",sources:[{n:"LeadSpot: 2025 AI-Driven Demand Generation Benchmark Report",u:"https://lead-spot.net/research/the-2025-ai-driven-demand-generation-benchmark-report/"},{n:"The Digital Bloom: PPC Funnel Performance 2025",u:"https://thedigitalbloom.com/learn/pipeline-performance-benchmarks-2025/"},{n:"Bizible / Marketo Measure: DSP Attribution Documentation",u:"https://experienceleague.adobe.com/en/docs/marketo-measure/using/marketo-measure-and-adobe/marketo-measure-integrations-with-adobe-analytics"}]},
    {ch:"Sales cycle benchmarks",color:"#2C2C2A",metrics:[{l:"C-Suite / VP cycle",v:"70 days"},{l:"Director cycle",v:"55 days"},{l:"Manager cycle",v:"45 days"},{l:"IC / Analyst cycle",v:"30 days"},{l:"LinkedIn channel cycle",v:"95 days"},{l:"Google Ads channel cycle",v:"60 days"},{l:"G2 channel cycle",v:"50 days"},{l:"Programmatic channel cycle",v:"140 days"}],rationale:"Sales cycle lengths are grounded in ACV-tier benchmarks from 2025–2026 research. Deals under $15K ACV average 14–55 days; mid-market $15K–$100K averages 55–90 days. LinkedIn and Google deal sizes ($4K–$10K) map to the SMB/low mid-market range. Cycles reflect faster single-approver decisions. G2 buyers are already in evaluation so cycle is compressed. LinkedIn cycles are longer than Google because LinkedIn sources more multi-stakeholder enterprise deals even at similar ACVs.",sources:[{n:"Optifai Sales Ops Benchmark 2026",u:"https://optif.ai/learn/questions/sales-cycle-length-benchmark/"},{n:"Human Renaissance: B2B Tech Sales Cycle Benchmarks 2025",u:"https://www.humanr.ai/intelligence/b2b-tech-sales-cycle-benchmarks-by-deal-size"},{n:"Prospeo: B2B Sales Cycle Length 2026",u:"https://prospeo.io/s/b2b-sales-cycle-length"},{n:"Gradient Works: 2025 B2B Sales Performance Benchmarks",u:"https://www.gradient.works/blog/2025-b2b-sales-performance-benchmarks"}]},
    {ch:"Attribution models",color:"#2C2C2A",metrics:[{l:"U-shaped (default)",v:"40% T1 / 20% mid / 40% last"},{l:"First touch",v:"100% T1"},{l:"Last touch",v:"100% last touch"},{l:"Linear",v:"Equal weight per touch"},{l:"Blended ROAS",v:"Excluded from summary, G2 skews totals"}],rationale:"U-shaped is the default: it credits both the channel that created awareness and the channel that triggered conversion. Blended ROAS is intentionally excluded from the Summary tile. G2's high conversion rate on low spend inflates the blended number and produces a misleading story for finance and leadership.",sources:[{n:"HockeyStack: Multi-Touch Attribution for B2B",u:"https://www.hockeystack.com/lab-blog-posts/linkedin-ads-benchmarks"},{n:"Swydo: LinkedIn vs Google Ads Attribution",u:"https://www.swydo.com/blog/google-ads-vs-linkedin-ads/"}]},
  ];
  return <div>
    <NoteBox>All conversion rates, CPL benchmarks, and ROAS targets are grounded in published 2024–2026 B2B SaaS research. CPL and ROAS health indicators apply to LinkedIn and Google Ads only. Blended ROAS is excluded from the Summary dashboard. G2 structurally skews blended totals. Programmatic attribution is restricted to click-based retargeting only.</NoteBox>
    {SOURCES.map((s,i)=><div key={i} style={{background:"#f8f8f7",borderRadius:6,padding:"1rem 1.1rem",marginBottom:".75rem"}}>
      <h3 style={{fontSize:13,fontWeight:500,margin:"0 0 6px",display:"flex",alignItems:"center",gap:6}}><Dot color={s.color}/>{s.ch}</h3>
      <div style={{marginBottom:".75rem"}}>
        {s.metrics.map((m,j)=><div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"4px 0",borderBottom:"0.5px solid #e5e5e3",fontSize:11}}>
          <span style={{color:"#6b6a68"}}>{m.l}</span><span style={{fontWeight:500}}>{m.v}</span>
        </div>)}
      </div>
      <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 8px",lineHeight:1.6}}>{s.rationale}</p>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {s.sources.map((src,j)=><a key={j} href={src.u} target="_blank" rel="noopener" style={{color:"#2563EB",fontSize:11,textDecoration:"none"}}>↗ {src.n}</a>)}
      </div>
    </div>)}
  </div>;
}

const TABS = ["Summary","Channel insights","Campaign insights","Traffic & goals","Pacing","Deal efficiency","Sources"];
const MODEL_LABELS = { u_shaped:"U-shaped", first_touch:"First touch", last_touch:"Last touch", linear:"Linear" };

export default function AttributionTool() {
  const [tab, setTab] = useState(0);
  const [model, setModel] = useState("u_shaped");

  return <div style={{fontFamily:"inherit",maxWidth:"100%"}}>
    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:"1rem",flexWrap:"wrap",gap:6}}>
      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
        {TABS.map((t,i)=><button key={t} onClick={()=>setTab(i)} style={{
          padding:"5px 10px",fontSize:11,borderRadius:6,border:tab===i?"0.5px solid #d1d1d0":"0.5px solid transparent",
          cursor:"pointer",background:tab===i?"#fff":"transparent",
          color:tab===i?"#1a1a19":"#6b6a68",whiteSpace:"nowrap"
        }}>{t}</button>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:3,marginLeft:"auto"}}>
        <p style={{fontSize:11,color:"#6b6a68",margin:"0 0 2px",textAlign:"right"}}>Attribution model</p>
        <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {Object.entries(MODEL_LABELS).map(([k,v])=><button key={k} onClick={()=>setModel(k)} style={{
            padding:"4px 9px",fontSize:11,borderRadius:6,
            border:model===k?"0.5px solid #2563EB":"0.5px solid #d1d1d0",
            cursor:"pointer",background:model===k?"#eff6ff":"transparent",
            color:model===k?"#1d4ed8":"#6b6a68"
          }}>{v}</button>)}
        </div>
      </div>
    </div>
    {tab===0 && <SummaryTab model={model}/>}
    {tab===1 && <ChannelTab model={model}/>}
    {tab===2 && <CampaignTab model={model}/>}
    {tab===3 && <TrafficTab/>}
    {tab===4 && <PacingTab/>}
    {tab===5 && <DealTab/>}
    {tab===6 && <SourcesTab/>}
  </div>;
}
