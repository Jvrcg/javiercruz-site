import { useState, useRef } from 'react';

const JOB_FUNCTIONS = [{value:'accounting',label:'Accounting'},{value:'admin',label:'Administrative'},{value:'arts',label:'Arts and Design'},{value:'bizdev',label:'Business Development'},{value:'consulting',label:'Consulting'},{value:'education',label:'Education'},{value:'eng',label:'Engineering'},{value:'entrepreneurship',label:'Entrepreneurship'},{value:'finance',label:'Finance'},{value:'healthcare',label:'Healthcare Services'},{value:'hr',label:'Human Resources'},{value:'it',label:'Information Technology'},{value:'legal',label:'Legal'},{value:'marketing',label:'Marketing'},{value:'media',label:'Media and Communication'},{value:'operations',label:'Operations'},{value:'ppm',label:'Program and Project Management'},{value:'product',label:'Product Management'},{value:'qa',label:'Quality Assurance'},{value:'research',label:'Research'},{value:'sales',label:'Sales'},{value:'other',label:'Other'}];

const personaModifiers = {eng:{label:'Engineering',bofu:['api integration','developer etl','self-hosted pipeline','infrastructure data sync'],mofu:['etl for engineers','data pipeline platform','pipeline orchestration'],tofu:['what is a data pipeline','etl vs elt explained'],titleMod:['for engineering teams','for devops','for platform engineers'],layers:{branded:['developer data platform','engineering data tool'],category:['pipeline orchestration tool','data infrastructure software'],comparison:['airflow alternatives','etl tool comparison'],competitor:['prefect vs airflow','dagster alternative'],jtbd:['automate data workflows','build data pipelines fast','reduce pipeline maintenance']}},it:{label:'Information Technology',bofu:['it integration platform','enterprise data connector','it automation tool'],mofu:['it data platform','enterprise integration','it operations software'],tofu:['what is enterprise integration','it automation guide'],titleMod:['for it teams','for it directors','for cios'],layers:{branded:['it integration software','enterprise data platform'],category:['enterprise integration tool','it automation platform'],comparison:['mulesoft alternative','it integration comparison'],competitor:['boomi vs mulesoft','workato alternative'],jtbd:['automate it workflows','connect enterprise systems','reduce manual it work']}},marketing:{label:'Marketing',bofu:['marketing data integration','crm connector','campaign data pipeline','attribution data sync'],mofu:['marketing analytics platform','growth data tool','campaign reporting software'],tofu:['what is marketing data integration','how to connect crm to ads'],titleMod:['for marketing teams','for growth teams','for cmos'],layers:{branded:['marketing data platform','campaign analytics tool'],category:['marketing analytics software','crm data connector'],comparison:['segment alternative','cdp comparison'],competitor:['rudderstack vs segment','cdp comparison'],jtbd:['unify marketing data','connect ads to crm','automate campaign reporting']}},finance:{label:'Finance',bofu:['financial data integration','erp connector','salesforce data sync','revenue data pipeline'],mofu:['finance data platform','revenue operations tool','crm data sync'],tofu:['what is revenue operations','how to connect erp to crm'],titleMod:['for finance teams','for revops','for cfos'],layers:{branded:['finance data integration','revenue data platform'],category:['erp integration software','financial reporting tool'],comparison:['netsuite connector alternatives','crm data sync comparison'],competitor:['workato alternative','boomi vs mulesoft'],jtbd:['automate financial reporting','sync erp to crm','close books faster']}},sales:{label:'Sales',bofu:['sales data integration','crm data sync','sales analytics connector','pipeline data tool'],mofu:['sales analytics platform','crm integration software','sales reporting tool'],tofu:['what is sales analytics','how to sync crm data'],titleMod:['for sales teams','for sales ops','for vps of sales'],layers:{branded:['sales data platform','revenue analytics tool'],category:['crm analytics software','sales reporting platform'],comparison:['salesforce connector alternatives','sales analytics comparison'],competitor:['gong alternative','clari vs chorus'],jtbd:['forecast revenue accurately','sync crm automatically','reduce manual sales reporting']}},bizdev:{label:'Business Development',bofu:['business development data tool','partnership analytics','bd pipeline software'],mofu:['business development platform','partner data tool','bd analytics software'],tofu:['what is business development analytics','how to track bd pipeline'],titleMod:['for business development','for bd teams'],layers:{branded:['bd data platform','partner intelligence tool'],category:['business development software','partnership analytics platform'],comparison:['bd tool alternatives','account intelligence comparison'],competitor:['zoominfo alternative','apollo vs outreach'],jtbd:['find new partnership opportunities','track bd pipeline','automate prospecting']}},product:{label:'Product Management',bofu:['product analytics platform','product data integration','feature usage tracking'],mofu:['product analytics software','user behavior platform','product data tool'],tofu:['what is product analytics','how to track feature usage'],titleMod:['for product teams','for product managers','for cpos'],layers:{branded:['product analytics platform','user intelligence tool'],category:['product analytics software','feature tracking platform'],comparison:['mixpanel alternative','amplitude vs mixpanel'],competitor:['heap alternative','product analytics comparison'],jtbd:['understand user behavior','track feature adoption','reduce churn with data']}},operations:{label:'Operations',bofu:['operations data integration','ops automation tool','workflow data platform'],mofu:['operations analytics platform','ops data tool','business process software'],tofu:['what is operations analytics','how to automate business processes'],titleMod:['for operations teams','for ops leaders','for coos'],layers:{branded:['operations data platform','process intelligence tool'],category:['operations analytics software','workflow automation platform'],comparison:['process automation alternatives','ops tool comparison'],competitor:['zapier alternative','make vs zapier'],jtbd:['automate business processes','reduce operational overhead','connect business systems']}},hr:{label:'Human Resources',bofu:['hris integration','hr data sync','people analytics connector'],mofu:['hr data integration','people ops platform','hris connector'],tofu:['what is hris integration','hr analytics guide'],titleMod:['for hr teams','for people ops','for chros'],layers:{branded:['hr data platform','people analytics software'],category:['hris integration tool','hr data connector'],comparison:['workday integration alternatives','bamboohr connector'],competitor:['rippling alternative','hris integration comparison'],jtbd:['sync hr data automatically','connect hris to payroll','unify people data']}},accounting:{label:'Accounting',bofu:['accounting data integration','gl connector','finance data sync'],mofu:['accounting software integration','finance data platform','gl sync tool'],tofu:['what is accounting data integration','how to automate bookkeeping'],titleMod:['for accounting teams','for controllers'],layers:{branded:['accounting data platform','gl integration tool'],category:['accounting software connector','finance automation platform'],comparison:['quickbooks integration alternatives','accounting tool comparison'],competitor:['xero vs quickbooks connector','accounting automation comparison'],jtbd:['automate bookkeeping','sync accounting data','reduce manual reconciliation']}},admin:{label:'Administrative',bofu:['administrative automation tool','office data integration','admin workflow software'],mofu:['admin tools software','office automation platform'],tofu:['what is administrative automation','how to automate office workflows'],titleMod:['for administrative teams','for office managers'],layers:{branded:['admin automation platform','office workflow tool'],category:['administrative software','office automation tool'],comparison:['admin tool alternatives','office software comparison'],competitor:['microsoft 365 alternative','google workspace vs microsoft'],jtbd:['automate administrative tasks','reduce manual data entry','streamline office workflows']}},arts:{label:'Arts and Design',bofu:['creative project management tool','design data platform','brand asset management'],mofu:['creative management platform','design operations tool'],tofu:['what is creative ops','how to manage design workflows'],titleMod:['for creative teams','for design leads'],layers:{branded:['creative data platform','design workflow tool'],category:['creative management software','brand asset platform'],comparison:['bynder alternative','creative ops tool comparison'],competitor:['widen alternative','dam software comparison'],jtbd:['organize creative assets','streamline design workflows','scale creative production']}},consulting:{label:'Consulting',bofu:['consulting data platform','professional services automation','client data tool'],mofu:['consulting management platform','professional services software'],tofu:['what is professional services automation','how to manage consulting projects'],titleMod:['for consulting firms','for management consultants'],layers:{branded:['consulting data platform','professional services tool'],category:['psa software','consulting management platform'],comparison:['mavenlink alternative','psa tool comparison'],competitor:['kantata alternative','consulting software comparison'],jtbd:['automate project billing','track consultant utilization','manage client deliverables']}},education:{label:'Education',bofu:['edtech data integration','lms connector','student data platform'],mofu:['education data platform','lms integration software'],tofu:['what is edtech data integration','how to connect lms to reporting'],titleMod:['for education teams','for academic institutions'],layers:{branded:['education data platform','lms analytics tool'],category:['edtech integration software','student data platform'],comparison:['canvas integration alternatives','lms comparison'],competitor:['blackboard alternative','instructure vs d2l'],jtbd:['track student outcomes','connect lms to reporting','automate grade reporting']}},entrepreneurship:{label:'Entrepreneurship',bofu:['startup data platform','founder analytics tool','startup crm integration'],mofu:['startup analytics platform','founder data tool'],tofu:['what is startup analytics','how to track startup metrics'],titleMod:['for founders','for startup teams','for ceos'],layers:{branded:['startup data platform','founder analytics tool'],category:['startup analytics software','founder intelligence platform'],comparison:['startup tool alternatives','analytics comparison for startups'],competitor:['baremetrics alternative','chartmogul vs baremetrics'],jtbd:['track mrr and arr','understand churn','forecast startup growth']}},healthcare:{label:'Healthcare Services',bofu:['healthcare data integration','ehr connector','health data platform'],mofu:['healthcare analytics platform','ehr integration software'],tofu:['what is healthcare data integration','how to connect ehr systems'],titleMod:['for healthcare teams','for health it'],layers:{branded:['health data platform','ehr integration tool'],category:['healthcare analytics software','clinical data platform'],comparison:['epic integration alternatives','ehr connector comparison'],competitor:['health catalyst alternative','healthcare analytics comparison'],jtbd:['connect ehr systems','automate clinical reporting','unify patient data']}},legal:{label:'Legal',bofu:['legal data integration','contract data platform','legal analytics tool'],mofu:['legal management platform','contract analytics software'],tofu:['what is legal ops','how to automate contract management'],titleMod:['for legal teams','for general counsel'],layers:{branded:['legal data platform','contract intelligence tool'],category:['legal ops software','contract analytics platform'],comparison:['ironclad alternative','legal ops tool comparison'],competitor:['clio alternative','legal management comparison'],jtbd:['automate contract review','track legal spend','manage legal workflows']}},media:{label:'Media and Communication',bofu:['media data integration','content analytics platform','media intelligence tool'],mofu:['media analytics software','content data platform'],tofu:['what is media analytics','how to track content performance'],titleMod:['for media teams','for content leaders'],layers:{branded:['media data platform','content intelligence tool'],category:['media analytics software','content performance platform'],comparison:['media monitoring alternatives','content analytics comparison'],competitor:['brandwatch alternative','media intelligence comparison'],jtbd:['track content performance','monitor brand mentions','automate media reporting']}},ppm:{label:'Program and Project Management',bofu:['project management data integration','pmo analytics tool','project data platform'],mofu:['pmo software','project analytics platform'],tofu:['what is pmo analytics','how to track project portfolio'],titleMod:['for pmo teams','for project managers'],layers:{branded:['pmo data platform','project intelligence tool'],category:['pmo software','portfolio management platform'],comparison:['planview alternative','pmo tool comparison'],competitor:['monday vs asana','project portfolio comparison'],jtbd:['track project roi','manage resource allocation','automate project reporting']}},qa:{label:'Quality Assurance',bofu:['qa data integration','test analytics platform','quality data tool'],mofu:['qa management platform','test data analytics'],tofu:['what is qa analytics','how to track quality metrics'],titleMod:['for qa teams','for quality engineers'],layers:{branded:['qa data platform','test intelligence tool'],category:['qa analytics software','test management platform'],comparison:['testim alternative','qa tool comparison'],competitor:['sauce labs alternative','qa automation comparison'],jtbd:['reduce bug escape rate','automate qa reporting','track test coverage']}},research:{label:'Research',bofu:['research data platform','survey analytics tool','research intelligence software'],mofu:['research analytics platform','survey data tool'],tofu:['what is research analytics','how to analyze survey data'],titleMod:['for research teams','for market researchers'],layers:{branded:['research data platform','market intelligence tool'],category:['research analytics software','survey data platform'],comparison:['qualtrics alternative','research tool comparison'],competitor:['medallia alternative','survey analytics comparison'],jtbd:['analyze survey responses','track research insights','automate research reporting']}},other:{label:'Other',bofu:['enterprise software','business automation tool','data integration platform'],mofu:['business software platform','enterprise tool','workflow management software'],tofu:['what is business automation','how to choose enterprise software'],titleMod:[],layers:{branded:['enterprise platform','business intelligence tool'],category:['enterprise software','business automation platform'],comparison:['enterprise software comparison','business tool alternatives'],competitor:['enterprise alternative','software comparison'],jtbd:['automate business workflows','reduce manual work','connect business systems']}}};

const intentSignals = {bofu:['pricing','demo','trial','free trial','sign up','get started','quote','schedule','migrate','onboarding','vs ','versus','alternative','switch from','enterprise','buy','purchase','compare'],mofu:['software','platform','tool','solution','best','top','how to','features','integration','api','vendor','provider','service','cost','benchmark']};
const negSignals = {job:['jobs','salary','career','hire','hiring','interview','resume','glassdoor','internship'],freeOnly:['free ','open source','github','freeware','crack','no cost','student','academic'],educational:['certification','course','tutorial for beginners','learn ','coursera','udemy','training program','study guide'],irrelevant:['reddit','youtube','twitter','news','pdf download','torrent','wiki'],competitor:['vs ','versus','alternative to','switch from','migrate from','compare','competitor']};

function classifyIntent(kw) {
  const k = kw.toLowerCase();
  if (intentSignals.bofu.some(s => k.includes(s))) return 'bofu';
  if (intentSignals.mofu.some(s => k.includes(s))) return 'mofu';
  return 'tofu';
}
function intentLabel(i) { return i === 'bofu' ? 'Bottom funnel' : i === 'mofu' ? 'Mid funnel' : 'Top funnel'; }
function intentClass(i) { return i === 'bofu' ? 'intent-bofu' : i === 'mofu' ? 'intent-mofu' : 'intent-tofu'; }
function parseTitles(r) { return r.split(',').map(t => t.trim()).filter(Boolean).slice(0, 15); }

function groupIntoCampaigns(seeds) {
  const competitor = seeds.filter(s => negSignals.competitor.some(n => s.toLowerCase().includes(n)));
  const nonBrand = seeds.filter(s => !competitor.includes(s));
  const bofuSeeds = nonBrand.filter(s => classifyIntent(s) === 'bofu');
  const midSeeds = nonBrand.filter(s => classifyIntent(s) !== 'bofu');
  const campaigns = [];
  if (nonBrand.length) {
    const adgroups = [];
    if (bofuSeeds.length) adgroups.push({ name: 'High intent / evaluation', seeds: bofuSeeds });
    if (midSeeds.length) {
      const chunks = [];
      for (let i = 0; i < midSeeds.length; i += 3) chunks.push(midSeeds.slice(i, i + 3));
      chunks.forEach((c, i) => adgroups.push({ name: 'Category / solution (group ' + (i + 1) + ')', seeds: c }));
    }
    campaigns.push({ name: 'Non-brand search', type: 'Search', bidRec: 'Start Max Conversions -- graduate to tCPA once 30+ conversions/month', adgroups });
  }
  if (competitor.length) campaigns.push({ name: 'Competitor', type: 'Search', bidRec: 'Separate budget -- dedicated LP per competitor required', adgroups: [{ name: 'Competitor comparisons', seeds: competitor }] });
  return campaigns;
}

function renderPreviewHTML(seeds, titles) {
  const campaigns = groupIntoCampaigns(seeds);
  const bofuCount = seeds.filter(s => classifyIntent(s) === 'bofu').length;
  const mofuCount = seeds.filter(s => classifyIntent(s) === 'mofu').length;
  const tofuCount = seeds.length - bofuCount - mofuCount;
  let bidAdvice = 'Mostly top-funnel seeds. Start with Max Conversions, build data before setting tCPA.';
  if (bofuCount > mofuCount && bofuCount > tofuCount) bidAdvice = 'Strong BOFU signal. Move to tCPA sooner -- anchor to cost per qualified opportunity.';
  else if (mofuCount >= bofuCount) bidAdvice = 'Mixed intent. Keep ad groups separate so Smart Bidding learns independently per group.';
  let html = `<div class="kt-preview"><p class="kt-preview-title">Campaign architecture preview</p><p class="kt-preview-sub">Structured by intent, not topic -- per Google best practice for B2B Search.</p><div class="funnel-bar"><div class="funnel-cell funnel-bofu"><div class="funnel-count">${bofuCount}</div><div class="funnel-label">Bottom funnel</div></div><div class="funnel-cell funnel-mofu"><div class="funnel-count">${mofuCount}</div><div class="funnel-label">Mid funnel</div></div><div class="funnel-cell funnel-tofu"><div class="funnel-count">${tofuCount}</div><div class="funnel-label">Top funnel</div></div></div>`;
  campaigns.forEach(c => {
    html += `<div class="campaign-block"><div class="campaign-name">${c.name} <span style="font-size:11px;font-weight:400;color:#9ca3af;margin-left:6px">${c.type}</span></div><div class="campaign-meta">Bid strategy: ${c.bidRec}</div>`;
    c.adgroups.forEach(ag => {
      html += `<div class="adgroup-row"><span class="adgroup-name">${ag.name}</span><span class="adgroup-kws">${ag.seeds.join(', ')}</span></div>`;
    });
    html += `</div>`;
  });
  html += `<div class="bid-rec"><strong style="color:#111827">Bidding recommendation:</strong> ${bidAdvice}</div>`;
  if (titles.length) html += `<div class="cross-channel"><p class="cross-channel-title">Cross-channel audience seed</p><p class="cross-channel-sub">Included in CSV export as LinkedIn audience layer and Customer Match seed.</p><div>${titles.map(t => `<span class="title-tag">${t}</span>`).join('')}</div></div>`;
  html += `</div>`;
  return html;
}

function csvField(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(fields) {
  return fields.map(csvField).join('\t');
}

function adGroupFor(intent, isCompetitor) {
  if (isCompetitor) return 'Competitor comparisons';
  return intent === 'bofu' ? 'High intent / evaluation' : 'Category / solution';
}

function renderPerFunctionClustersHTML(seeds, selectedFns, titles, useE, useP, useB) {
  const negs = ['jobs', 'salary', 'free', 'open source', 'tutorial', 'certification', 'reddit', 'what is', 'course', 'training', 'github', 'freeware'];
  const rows = [['Keyword', 'Match Type', 'Campaign', 'Ad Group', 'Job Function', 'Label']];
  let html = '';
  selectedFns.forEach(fnKey => {
    const mods = personaModifiers[fnKey];
    html += `<div style="margin-bottom:20px"><div class="kt-group-header"><span class="kt-group-label">${mods.label}</span><span class="kt-group-badge">${seeds.length} seed${seeds.length > 1 ? 's' : ''}</span></div>`;
    seeds.forEach(seed => {
      const intent = classifyIntent(seed);
      const isCompetitor = negSignals.competitor.some(n => seed.toLowerCase().includes(n));
      const campaign = isCompetitor ? 'Competitor' : 'Non-brand search';
      const adGroup = adGroupFor(intent, isCompetitor);
      const csvCampaign = 'Non-brand search';
      const csvAdGroupExact = intent === 'bofu' ? 'High intent' : 'Category and solution';
      const csvAdGroupOther = 'Category and solution';
      const bofu = mods.bofu.map(m => seed + ' ' + m);
      const mofu = mods.mofu.map(m => seed + ' ' + m);
      const titleVariants = titles.length && mods.titleMod.length ? mods.titleMod.slice(0, 2).map(m => seed + ' ' + m) : [];
      html += `<div class="kt-card"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:10px"><span style="font-size:15px;font-weight:500;color:#111827">${seed}</span><span class="intent-pill ${intentClass(intent)}">${intentLabel(intent)}</span></div>`;
      if (useE) {
        const exactVariants = [
          { kw: '[' + seed + ']', adGroup: csvAdGroupExact },
          ...['demo','pricing','free trial','get started'].map(m => ({ kw: '[' + seed + ' ' + m + ']', adGroup: 'High intent' })),
          ...['vs','alternative','alternatives','comparison'].map(m => ({ kw: '[' + seed + ' ' + m + ']', adGroup: 'High intent' })),
          ...['migration','migrate to'].map(m => ({ kw: '[' + seed + ' ' + m + ']', adGroup: 'High intent' })),
          ...['integration','api','connector'].map(m => ({ kw: '[' + seed + ' ' + m + ']', adGroup: 'Category and solution' })),
          ...['enterprise','for teams'].map(m => ({ kw: '[' + seed + ' ' + m + ']', adGroup: 'High intent' })),
          ...bofu.map(k => ({ kw: '[' + k + ']', adGroup: 'High intent' })),
        ];
        const eks = [...new Map(exactVariants.map(v => [v.kw, v])).values()].slice(0, 20);
        html += `<span class="kt-label">Exact match</span><div style="margin-bottom:8px">`;
        eks.forEach(item => {
          html += `<span class="kw-tag kw-exact">${item.kw}</span>`;
          rows.push([item.kw.replace(/^\[|\]$/g, ''), 'Exact', csvCampaign, item.adGroup, mods.label, 'keyword']);
        });
        if (titleVariants.length) titleVariants.forEach(k => {
          html += `<span class="kw-tag kw-title">[${k}]</span>`;
          rows.push([k, 'Exact', csvCampaign, csvAdGroupExact, mods.label, 'title-informed']);
        });
        html += `</div>`;
      }
      if (useP) {
        const phraseSolution = ['best ' + seed, 'top ' + seed, seed + ' software', seed + ' platform', seed + ' tool', seed + ' solution'].map(k => '"' + k + '"');
        const phrasePersona = [seed + ' for ' + mods.label.toLowerCase()].map(k => '"' + k + '"');
        const phraseCategory = mofu.map(k => '"' + k + '"');
        const phraseBuying = [seed + ' pricing', seed + ' cost', seed + ' vendor'].map(k => '"' + k + '"');
        const pks = [...new Set(['"' + seed + '"', ...phraseSolution, ...phrasePersona, ...phraseCategory, ...phraseBuying])].slice(0, 15);
        html += `<span class="kt-label">Phrase match</span><div style="margin-bottom:8px">`;
        pks.forEach(k => {
          html += `<span class="kw-tag kw-phrase">${k}</span>`;
          rows.push([k.replace(/^"|"$/g, ''), 'Phrase', csvCampaign, csvAdGroupOther, mods.label, 'keyword']);
        });
        html += `</div>`;
      }
      if (useB) {
        html += `<span class="kt-label">Broad match (signal discovery only)</span><div style="margin-bottom:8px"><span class="kw-tag kw-broad">${seed}</span><div style="background:#fffbea;border-left:3px solid #f5c518;padding:8px 12px;margin-top:8px;font-size:12px;color:#6b7280">Broad match captures all phrase and exact match queries plus related searches. Add only the seed keyword -- Google's algorithm finds the variations. Pair with Smart Bidding (Max Conversions or tCPA). Review your search terms report weekly and add negatives before scaling budget.</div></div>`;
        rows.push([seed, 'Broad', csvCampaign, csvAdGroupOther, mods.label, 'keyword']);
      }
      html += `<span class="kt-label">Suggested negatives</span><div>`;
      negs.forEach(n => {
        html += `<span class="kw-tag kw-neg">-${n}</span>`;
        rows.push([n, 'Negative', '', '', mods.label, 'negative']);
      });
      html += `</div></div>`;
    });
    html += `</div>`;
  });
  const csvLines = rows.map(csvRow);
  if (titles.length) {
    csvLines.push('');
    csvLines.push('');
    csvLines.push('AUDIENCE SEED -- LinkedIn + Customer Match');
    titles.forEach(t => csvLines.push(csvRow([t])));
  }
  const csv = csvLines.join('\n');
  return { html, csv };
}

function analyzeCSVData(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: 'Need at least a header row and one data row.' };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const kwIdx = headers.findIndex(h => h.includes('keyword'));
  const convIdx = headers.findIndex(h => h.includes('conv'));
  const costIdx = headers.findIndex(h => h.includes('cost'));
  const isIdx = headers.findIndex(h => h.includes('impr') || h.includes('share'));
  if (kwIdx === -1) return { error: 'Could not find a Keyword column. Check your CSV header row.' };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const kw = (cols[kwIdx] || '').trim().replace(/^["']|["']$/g, '');
    if (!kw) continue;
    const conv = parseFloat(cols[convIdx]) || 0;
    const cost = parseFloat(cols[costIdx]) || 0;
    const is = isIdx >= 0 ? parseFloat(cols[isIdx]) || 0 : null;
    const cpa = conv > 0 ? Math.round(cost / conv) : null;
    rows.push({ kw, conv, cost, cpa, is, intent: classifyIntent(kw) });
  }
  return { rows };
}

function getISFlagHTML(r) {
  if (r.is === null) return '';
  const hi = r.is > 0.6, cv = r.conv > 0;
  if (hi && cv) return '<span class="is-flag is-protect">Protect and deepen</span>';
  if (!hi && cv) return '<span class="is-flag is-scale">Scale opportunity</span>';
  if (hi && !cv) return '<span class="is-flag is-efficiency">Efficiency problem</span>';
  return '<span class="is-flag is-deprioritize">Deprioritize</span>';
}

function renderAnalyzeCSVHTML(rows) {
  const converting = rows.filter(r => r.conv > 0).sort((a, b) => b.conv - a.conv);
  const nonConverting = rows.filter(r => r.conv === 0);
  const hasBOFU = rows.some(r => r.intent === 'bofu' && r.conv > 0);
  const hasMOFU = rows.some(r => r.intent === 'mofu' && r.conv > 0);
  const hasAnyBOFU = rows.some(r => r.intent === 'bofu');
  const gaps = [];
  if (!hasBOFU) gaps.push('No converting BOFU keywords -- missing evaluation-stage coverage (pricing, demo, alternatives, vs)');
  if (!hasMOFU) gaps.push('No converting MOFU keywords -- mid-funnel is underrepresented, limiting demand capture');
  if (!hasAnyBOFU) gaps.push('No bottom-funnel keywords in account at all -- add demo, pricing, and competitor comparison terms');
  let html = '';
  if (gaps.length) {
    html += `<div style="margin-bottom:14px"><span class="kt-label">Funnel gaps identified</span>`;
    gaps.forEach(g => { html += `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span class="gap-flag">Gap</span><span style="font-size:13px;color:#6b7280">${g}</span></div>`; });
    html += `</div>`;
  }
  html += `<span class="kt-label">Converting keywords (${converting.length}) -- ranked by volume</span>`;
  converting.forEach(r => {
    html += `<div class="perf-card"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px"><span style="font-size:14px;font-weight:500;color:#111827">${r.kw}</span><span class="intent-pill ${intentClass(r.intent)}">${intentLabel(r.intent)}</span>${getISFlagHTML(r)}</div><div class="perf-metrics"><span class="perf-metric">Conversions: <strong>${r.conv}</strong></span><span class="perf-metric">Cost: <strong>$${Math.round(r.cost)}</strong></span>${r.cpa !== null ? `<span class="perf-metric">CPA: <strong>$${r.cpa}</strong></span>` : ''} ${r.is !== null ? `<span class="perf-metric">Impr. share: <strong>${Math.round(r.is * 100)}%</strong></span>` : ''}</div></div>`;
  });
  if (nonConverting.length) {
    html += `<span class="kt-label" style="margin-top:4px">Zero-conversion keywords (${nonConverting.length}) -- review for negative or restructure</span>`;
    nonConverting.forEach(r => {
      html += `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:6px 0;border-bottom:0.5px solid #f3f4f6"><span style="font-size:13px;color:#6b7280">${r.kw}</span><span class="intent-pill ${intentClass(r.intent)}" style="font-size:10px">${intentLabel(r.intent)}</span>${getISFlagHTML(r)}<span style="font-size:11px;color:#9ca3af">$${Math.round(r.cost)} spent</span></div>`;
    });
  }
  const seeds = converting.slice(0, 10).map(r => r.kw);
  return { html, seeds };
}

function runAuditHTML(terms) {
  let html = `<div class="audit-row audit-head"><span>Search term</span><span>Recommendation</span><span>Reason</span></div>`;
  terms.forEach(t => {
    const tl = t.toLowerCase();
    let rec, cls, reason;
    if (negSignals.job.some(s => tl.includes(s)) || negSignals.irrelevant.some(s => tl.includes(s))) { rec = 'Add as negative'; cls = 'kw-neg'; reason = 'Irrelevant intent'; }
    else if (negSignals.freeOnly.some(s => tl.includes(s))) { rec = 'Add as negative'; cls = 'kw-neg'; reason = 'Free-only seeker'; }
    else if (negSignals.educational.some(s => tl.includes(s)) && classifyIntent(t) === 'tofu') { rec = 'Negative (or TOFU only)'; cls = 'kw-neg'; reason = 'Research / educational intent'; }
    else if (negSignals.competitor.some(s => tl.includes(s))) { rec = 'Dedicated ad group'; cls = 'kw-phrase'; reason = 'Comparison query -- needs tailored copy + LP'; }
    else if (classifyIntent(t) === 'bofu') { rec = 'Promote to exact'; cls = 'kw-exact'; reason = 'High commercial intent'; }
    else if (classifyIntent(t) === 'mofu') { rec = 'Keep as phrase'; cls = 'kw-phrase'; reason = 'Mid-funnel -- monitor CVR'; }
    else { rec = 'Negative or TOFU content'; cls = 'kw-neg'; reason = 'Low conversion probability'; }
    html += `<div class="audit-row"><span style="color:#111827">${t}</span><span><span class="kw-tag ${cls}" style="margin:0">${rec}</span></span><span style="color:#6b7280;font-size:12px">${reason}</span></div>`;
  });
  return `<div>${html}</div>`;
}

function genNegativesHTML(terms) {
  const buckets = { job: [], freeOnly: [], educational: [], irrelevant: [], competitor: [], keep: [] };
  terms.forEach(t => {
    const tl = t.toLowerCase();
    let placed = false;
    for (const [cat, sigs] of Object.entries(negSignals)) {
      if (sigs.some(s => tl.includes(s))) { buckets[cat].push(t); placed = true; break; }
    }
    if (!placed) buckets.keep.push(t);
  });
  const meta = {
    job: { label: 'Job seekers', action: 'Negative immediately', cls: 'kw-neg' },
    freeOnly: { label: 'Free / open source seekers', action: 'Negative unless you have freemium', cls: 'kw-neg' },
    educational: { label: 'Educational / certification intent', action: 'Negative unless you have TOFU content', cls: 'kw-neg' },
    irrelevant: { label: 'Off-topic / irrelevant', action: 'Negative immediately', cls: 'kw-neg' },
    competitor: { label: 'Competitor comparisons', action: 'Keep -- build dedicated comparison ad group', cls: 'kw-phrase' },
    keep: { label: 'Worth keeping', action: 'Monitor CVR -- evaluate for exact promotion', cls: 'kw-phrase' },
  };
  let html = '';
  Object.entries(buckets).forEach(([cat, list]) => {
    if (!list.length) return;
    const m = meta[cat];
    html += `<div class="kt-card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px"><span style="font-size:14px;font-weight:500;color:#111827">${m.label}</span><span style="font-size:11px;color:#6b7280">${list.length} term${list.length > 1 ? 's' : ''}</span></div><p style="font-size:12px;color:#6b7280;margin-bottom:8px">${m.action}</p><div>`;
    list.forEach(t => { html += `<span class="kw-tag ${m.cls}">${t}</span>`; });
    html += `</div></div>`;
  });
  return html;
}

const TOPIC_LAYER_META = [
  { key: 'branded', label: 'Branded intent', desc: 'Queries that include your product or category name -- highest purchase intent' },
  { key: 'category', label: 'Category definition', desc: 'How buyers describe the problem space when they do not yet know your brand' },
  { key: 'comparison', label: 'Solution comparison', desc: 'Buyers evaluating options -- high intent, needs dedicated landing pages' },
  { key: 'competitor', label: 'Competitor alternatives', desc: 'Buyers already aware of solutions -- separate campaign, tailored copy required' },
  { key: 'jtbd', label: 'Job to be done', desc: 'Queries based on what the buyer is trying to accomplish -- often underleveraged in B2B accounts' },
];

function FnGrid({ topic, selectedFns, onToggle }) {
  const count = selectedFns.length;
  const hasOther = selectedFns.includes('other');
  return (
    <div className="fn-checkbox-wrap">
      <div className="fn-grid" style={{ display: 'grid' }}>
        {JOB_FUNCTIONS.map(fn => (
          <label className="fn-item" key={fn.value}>
            <input
              type="checkbox"
              value={fn.value}
              checked={selectedFns.includes(fn.value)}
              onChange={() => onToggle(fn.value)}
            />
            {' '}{fn.label}
          </label>
        ))}
      </div>
      <p className="fn-count">{count > 0 ? `${count} function${count > 1 ? 's' : ''} selected` : ''}</p>
      {count >= 4 && (
        <div className="warn-note" style={{ marginTop: 6 }}>
          Selecting 4 or more functions will generate a large number of variants. Consider narrowing your selection or using fewer seed keywords for cleaner output.
        </div>
      )}
      <p className="fn-other-note" style={{ display: hasOther ? 'block' : 'none' }}>
        Job titles are required when "Other" is selected.
      </p>
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Explainer({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8f7', border: 'none', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1a1a19', cursor: 'pointer' }}
      >
        <span>{title}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ padding: '14px 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>{children}</div>
      )}
    </div>
  );
}

export default function KeywordPlanner() {
  const [activeTab, setActiveTab] = useState('manual');
  const [auditMode, setAuditMode] = useState('auditMode');

  const seedInputRef = useRef(null);
  const titlesInputRef = useRef(null);
  const chkERef = useRef(null);
  const chkPRef = useRef(null);
  const chkBRef = useRef(null);
  const [manualFns, setManualFns] = useState([]);
  const [manualPreview, setManualPreview] = useState('');
  const [manualOut, setManualOut] = useState('');
  const [manualCSV, setManualCSV] = useState('');
  const [manualCopied, setManualCopied] = useState(false);

  const csvInputRef = useRef(null);
  const [csvWindow, setCsvWindow] = useState('180');
  const [csvOut, setCsvOut] = useState('');
  const [csvPreview, setCsvPreview] = useState('');

  const topicInputRef = useRef(null);
  const topicTitlesRef = useRef(null);
  const [topicFns, setTopicFns] = useState([]);
  const [topicOut, setTopicOut] = useState('');
  const [topicPreview, setTopicPreview] = useState('');
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicSuggestions, setTopicSuggestions] = useState(null);

  const auditInputRef = useRef(null);
  const [auditOut, setAuditOut] = useState('');
  const negInputRef = useRef(null);
  const [negOut, setNegOut] = useState('');

  function toggleFn(list, setList, value) {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  }

  function buildManual() {
    const raw = (seedInputRef.current.value || '').trim();
    const titlesRaw = (titlesInputRef.current.value || '').trim();
    const useE = chkERef.current.checked;
    const useP = chkPRef.current.checked;
    const useB = chkBRef.current.checked;
    if (!raw) { setManualPreview(''); setManualOut('<p style="font-size:13px;color:#6b7280">Enter at least one seed keyword.</p>'); return; }
    if (manualFns.length === 0) { setManualPreview(''); setManualOut('<div class="warn-note">Select at least one job function to build clusters.</div>'); return; }
    if (manualFns.includes('other') && !titlesRaw) { setManualOut('<div class="warn-note">Job titles are required when "Other" is selected. Please enter at least one job title above.</div>'); return; }
    const seeds = raw.split('\n').map(s => s.trim()).filter(Boolean);
    const titles = parseTitles(titlesRaw);
    setManualPreview(renderPreviewHTML(seeds, titles));
    const { html, csv } = renderPerFunctionClustersHTML(seeds, manualFns, titles, useE, useP, useB);
    setManualOut(html);
    setManualCSV(csv);
    setManualCopied(false);
  }

  function copyManualCSV() {
    navigator.clipboard.writeText(manualCSV).then(() => {
      setManualCopied(true);
      setTimeout(() => setManualCopied(false), 2000);
    });
  }

  function analyzeCSV() {
    const raw = (csvInputRef.current.value || '').trim();
    if (!raw) { setCsvOut('<p style="font-size:13px;color:#6b7280">Paste CSV data first.</p>'); setCsvPreview(''); return; }
    const result = analyzeCSVData(raw);
    if (result.error) { setCsvOut(`<p style="font-size:13px;color:#6b7280">${result.error}</p>`); setCsvPreview(''); return; }
    const { html, seeds } = renderAnalyzeCSVHTML(result.rows);
    setCsvOut(html);
    if (seeds.length) setCsvPreview(renderPreviewHTML(seeds, []));
    else setCsvPreview('');
  }

  async function generateTopic() {
    const topic = (topicInputRef.current.value || '').trim();
    const titlesRaw = (topicTitlesRef.current.value || '').trim();
    const titles = parseTitles(titlesRaw);
    if (!topic) { setTopicOut('<p style="font-size:13px;color:#6b7280">Enter a topic first.</p>'); setTopicPreview(''); setTopicSuggestions(null); return; }
    if (topicFns.length === 0) { setTopicOut('<div class="warn-note">Select at least one job function to generate clusters.</div>'); setTopicPreview(''); setTopicSuggestions(null); return; }
    if (topicFns.includes('other') && !titlesRaw) { setTopicOut('<div class="warn-note">Job titles are required when "Other" is selected.</div>'); setTopicPreview(''); setTopicSuggestions(null); return; }

    setTopicSuggestions(null);
    setTopicLoading(true);
    const firstFn = personaModifiers[topicFns[0]];
    const layers = firstFn.layers;
    const seeds = [topic, ...layers.branded.slice(0, 2), ...layers.category.slice(0, 3), ...layers.comparison.slice(0, 2), ...layers.competitor.slice(0, 2), ...layers.jtbd.slice(0, 3)];
    const uniqueSeeds = [...new Set(seeds)].slice(0, 15);

    let layersHtml = `<div style="margin-bottom:14px">`;
    TOPIC_LAYER_META.forEach(l => {
      const layerKws = l.key === 'branded' ? [topic, ...layers[l.key]] : layers[l.key];
      layersHtml += `<div class="topic-layer"><p class="topic-layer-title">${l.label}</p><p class="topic-layer-desc">${l.desc}</p><div>`;
      layerKws.slice(0, 4).forEach(k => {
        const intent = classifyIntent(k);
        layersHtml += `<span class="kw-tag ${intent === 'bofu' ? 'kw-exact' : intent === 'mofu' ? 'kw-phrase' : 'kw-broad'}">${k}</span>`;
      });
      layersHtml += `</div></div>`;
    });
    layersHtml += `</div>`;
    setTopicOut(layersHtml);
    setTopicPreview(renderPreviewHTML(uniqueSeeds, titles));

    const allSuggestions = new Set();
    for (const seed of uniqueSeeds.slice(0, 5)) {
      try {
        const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`);
        if (r.ok) {
          const d = await r.json();
          (d[1] || []).forEach(s => allSuggestions.add(s));
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 150));
    }
    setTopicLoading(false);
    const suggestions = [...allSuggestions].filter(s => !uniqueSeeds.includes(s)).slice(0, 20);
    if (suggestions.length) {
      const classified = { bofu: [], mofu: [], other: [] };
      suggestions.forEach(s => {
        const isNeg = Object.values(negSignals).some(arr => arr.some(n => s.toLowerCase().includes(n)));
        if (!isNeg) {
          const i = classifyIntent(s);
          classified[i === 'bofu' ? 'bofu' : i === 'mofu' ? 'mofu' : 'other'].push(s);
        }
      });
      setTopicSuggestions([...classified.bofu, ...classified.mofu]);
    } else {
      setTopicSuggestions([]);
    }
  }

  function runAudit() {
    const raw = (auditInputRef.current.value || '').trim();
    if (!raw) { setAuditOut('<p style="font-size:13px;color:#6b7280">Paste search terms to audit.</p>'); return; }
    const terms = raw.split('\n').map(s => s.trim()).filter(Boolean);
    setAuditOut(runAuditHTML(terms));
  }

  function genNegatives() {
    const raw = (negInputRef.current.value || '').trim();
    if (!raw) { setNegOut('<p style="font-size:13px;color:#6b7280">Paste search terms first.</p>'); return; }
    const terms = raw.split('\n').map(s => s.trim()).filter(Boolean);
    setNegOut(genNegativesHTML(terms));
  }

  const windowNotes = {
    '30': '<div class="warn-note">30 days may be too thin for B2B SaaS. Consider 90 days minimum.</div>',
    '365': '<div style="background:#f9fafb;border-radius:6px;padding:8px 12px;font-size:12px;color:#6b7280;margin-bottom:8px">12 months may include restructured or paused campaigns.</div>',
  };

  return (
    <div className="kt-wrap">
      <div className="kt-tab-row">
        <button className={`kt-tab${activeTab === 'manual' ? ' active' : ''}`} onClick={() => setActiveTab('manual')}>Manual seeds</button>
        <button className={`kt-tab${activeTab === 'csv' ? ' active' : ''}`} onClick={() => setActiveTab('csv')}>CSV upload</button>
        <button className={`kt-tab${activeTab === 'topic' ? ' active' : ''}`} onClick={() => setActiveTab('topic')}>Topic generator</button>
        <button className={`kt-tab${activeTab === 'audit' ? ' active' : ''}`} onClick={() => setActiveTab('audit')}>Audit + negatives</button>
      </div>

      <div style={{ display: activeTab === 'manual' ? 'block' : 'none' }}>
        <span className="kt-label">1. Seed keywords (one per line)</span>
        <textarea ref={seedInputRef} className="kt-textarea" rows={4} style={{ marginBottom: 14 }} placeholder={'data integration\netl pipeline\nsalesforce connector\ncloud data warehouse\ndata pipeline tool'} />
        <span className="kt-label">2. Job function/s <span className="li-note">Matches LinkedIn job functions</span></span>
        <FnGrid selectedFns={manualFns} onToggle={v => toggleFn(manualFns, setManualFns, v)} />
        <span className="kt-label" style={{ marginTop: 10 }}>3. Job titles <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#9ca3af' }}>(optional unless "Other" is selected)</span></span>
        <input ref={titlesInputRef} type="text" className="kt-input" placeholder="VP of Data Engineering, Head of Analytics, Director of Data" style={{ marginBottom: 4, borderColor: manualFns.includes('other') ? '#E24B4A' : '' }} />
        <p className={manualFns.includes('other') ? 'required-note' : 'optional-note'}>
          {manualFns.includes('other')
            ? 'Required when "Other" is selected. Add up to 15 titles separated by commas.'
            : 'Optional but recommended. Up to 15 titles separated by commas. Sharpens exact match variants and doubles as your LinkedIn and Customer Match seed list.'}
        </p>
        <div style={{ display: 'flex', gap: 10, margin: '12px 0', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><input ref={chkERef} type="checkbox" defaultChecked /> Exact</label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><input ref={chkPRef} type="checkbox" defaultChecked /> Phrase</label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><input ref={chkBRef} type="checkbox" /> Broad</label>
        </div>
        <button className="kt-btn" onClick={buildManual}>Build clusters</button>
        <div style={{ marginTop: 16 }} dangerouslySetInnerHTML={{ __html: manualPreview }} />
        <div dangerouslySetInnerHTML={{ __html: manualOut }} />
        {manualCSV && (
          <div>
            <span className="kt-label" style={{ marginTop: 8 }}>Export (CSV -- keywords by job function + audience seed)</span>
            <div className="kt-export">{manualCSV}</div>
            <button className="kt-copy-btn" onClick={copyManualCSV}>{manualCopied ? 'Copied' : 'Copy CSV'}</button>
          </div>
        )}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Explainer title="How to use this keyword list">
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 0 }}>Start with the full list</p>
            <p style={{ marginBottom: 8 }}>This tool generates 20 to 30 keyword variants per seed. Your job is to curate it down.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Google's best practice</p>
            <p style={{ marginBottom: 8 }}>5 to 10 tightly themed keywords per ad group -- enough to cover intent without diluting relevance or fragmenting Smart Bidding signal.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>How to curate</p>
            <p style={{ marginBottom: 6 }}>(1) Remove variants that do not match your landing page or offer.</p>
            <p style={{ marginBottom: 6 }}>(2) Promote your top 5 to 10 exact match terms to a dedicated high-intent ad group.</p>
            <p style={{ marginBottom: 6 }}>(3) Use phrase match to cover adjacent intent in a separate ad group.</p>
            <p style={{ marginBottom: 6 }}>(4) Add the broad match seed only after 30 or more conversions per month with Smart Bidding active.</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Add the suggested negatives before launch.</p>
            <p style={{ fontSize: 11, color: '#9b9a97' }}>
              Sources: <a href="https://support.google.com/google-ads/answer/2453981" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Google Ads Help: Keyword best practices</a>
            </p>
          </Explainer>
          <Explainer title="How this keyword list is generated">
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, color: '#1a1a19' }}>Intent classification.</span> Every keyword is scored against a signal library of BOFU terms (pricing, demo, trial, alternatives, vs, migrate) and MOFU terms (software, platform, tool, solution, integration). Keywords that match neither are treated as top-funnel. This determines ad group assignment -- not topic.
            </p>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, color: '#1a1a19' }}>Match type expansion.</span> Exact match variants are generated by appending high-intent modifiers (demo, pricing, free trial, vs, alternatives, migration, integration, enterprise) to your seed. Phrase match variants cover solution-level queries (best [seed], [seed] platform, [seed] for [persona]). Broad match keeps only the raw seed -- Google's algorithm handles variation from there.
            </p>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, color: '#1a1a19' }}>Job function layering.</span> Each selected job function maps to a modifier set built for that persona's buying language and workflow. The same seed keyword generates different variants per function, which is how the tool produces job-function-targeted ad groups without requiring you to brainstorm per-persona manually.
            </p>
            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, marginBottom: 10 }}>
              What this tool does not do. It does not pull live search volume, CPC, or competition data -- those require the Google Keyword Planner or a paid tool like Semrush. Treat this output as your starting list for validation, not a final media plan.
            </p>
            <p style={{ fontSize: 11, color: '#9b9a97' }}>
              Sources: Google Ads match type documentation; Google Smart Bidding guide; practitioner judgment from 8+ years of B2B paid search management.
            </p>
          </Explainer>
          <Explainer title="Recommendations for selecting job functions">
            <p style={{ marginBottom: 8 }}>Job functions map directly to LinkedIn Campaign Manager audience targeting.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Select one function</p>
            <p style={{ marginBottom: 8 }}>When your ICP is clearly defined and sits within a single department.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Select two to three functions</p>
            <p style={{ marginBottom: 8 }}>When your buyer spans multiple departments. Each function generates its own cluster group.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Avoid selecting four or more</p>
            <p style={{ marginBottom: 8 }}>Unless doing exploratory research.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Select "Other" only</p>
            <p style={{ marginBottom: 8 }}>When your ICP falls outside LinkedIn's taxonomy. Job titles become required.</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Mirror this selection in your LinkedIn Campaign Manager audience setup for ICP consistency across channels.</p>
          </Explainer>
        </div>
      </div>

      <div style={{ display: activeTab === 'csv' ? 'block' : 'none' }}>
        <span className="kt-label">Time window</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {[['30', '30 days'], ['90', '90 days'], ['180', '6 months'], ['365', '12 months']].map(([v, l]) => (
            <label key={v} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="radio" name="window" value={v} checked={csvWindow === v} onChange={() => setCsvWindow(v)} /> {l}
              {v === '180' && <span style={{ fontSize: 11, color: '#2563eb', marginLeft: 4 }}>Recommended</span>}
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 14 }} dangerouslySetInnerHTML={{ __html: windowNotes[csvWindow] || '' }} />
        <span className="kt-label">Paste CSV data</span>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Export from Google Ads: Keywords &gt; Download. Required columns: <strong style={{ color: '#111827' }}>Keyword, Match type, Conversions, Cost</strong>. Optional: <strong style={{ color: '#111827' }}>Impr. share</strong></p>
        <textarea ref={csvInputRef} className="kt-textarea" rows={7} style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: 13 }} placeholder={'Keyword,Match type,Conversions,Cost,Impr. share\ndata integration,Exact,12,480,0.62\netl pipeline,Phrase,8,320,0.41\nfree etl tool,Broad,0,45,0.12'} />
        <button className="kt-btn" onClick={analyzeCSV}>Analyze keywords</button>
        <div style={{ marginTop: 16 }} dangerouslySetInnerHTML={{ __html: csvOut }} />
        {csvPreview && (
          <>
            <span className="kt-label" style={{ marginTop: 16 }}>Expansion clusters from top performers</span>
            <div dangerouslySetInnerHTML={{ __html: csvPreview }} />
          </>
        )}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Explainer title="How impression share is used in this tool">
            <p style={{ marginBottom: 8 }}>IS is a secondary signal. Conversion volume and cost efficiency drive clustering. IS layers in as a strategic flag:</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Protect and deepen</p>
            <p style={{ marginBottom: 8 }}>High IS + strong conversions.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Scale opportunity</p>
            <p style={{ marginBottom: 8 }}>Low IS + strong conversions.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Efficiency problem</p>
            <p style={{ marginBottom: 8 }}>High IS + weak conversions.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Deprioritize</p>
            <p style={{ marginBottom: 8 }}>Low IS + weak conversions.</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Always lead with pipeline impact over IS.</p>
            <p style={{ fontSize: 11, color: '#9b9a97' }}>
              Sources: <a href="https://support.google.com/google-ads/answer/2497703" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Google Ads Help: About impression share</a>
            </p>
          </Explainer>
        </div>
      </div>

      <div style={{ display: activeTab === 'topic' ? 'block' : 'none' }}>
        <span className="kt-label">Topic or product category</span>
        <input ref={topicInputRef} type="text" className="kt-input" placeholder="e.g. data integration platform, HR software for mid-market" style={{ marginBottom: 14 }} />
        <span className="kt-label">Job function/s <span className="li-note">Matches LinkedIn job functions</span></span>
        <FnGrid selectedFns={topicFns} onToggle={v => toggleFn(topicFns, setTopicFns, v)} />
        <span className="kt-label" style={{ marginTop: 10 }}>Job titles <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: '#9ca3af' }}>(optional unless "Other" is selected)</span></span>
        <input ref={topicTitlesRef} type="text" className="kt-input" placeholder="VP of Engineering, Head of Data, Director of Analytics" style={{ marginBottom: 4 }} />
        <p className="optional-note" style={{ marginBottom: 12 }}>Optional but recommended. Up to 15 titles separated by commas.</p>
        <button className="kt-btn" onClick={generateTopic}>Generate clusters</button>
        <div style={{ marginTop: 16 }}>
          <div dangerouslySetInnerHTML={{ __html: topicOut }} />
          {topicPreview && <div dangerouslySetInnerHTML={{ __html: topicPreview }} />}
          {topicLoading && <p className="loading-pulse">Fetching real queries <span className="suggest-badge">via Google Suggest</span></p>}
          {topicSuggestions !== null && topicSuggestions.length > 0 && (
            <>
              <span className="kt-label" style={{ marginTop: 4 }}>Google Suggest expansion <span className="suggest-badge">via Google Suggest</span></span>
              <div style={{ marginBottom: 8 }}>
                {topicSuggestions.map((s, i) => <span className="kw-tag kw-suggest" key={i}>{s}</span>)}
              </div>
            </>
          )}
        </div>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Explainer title="About Google Suggest data in this tool">
            <p style={{ marginBottom: 8 }}>Queries labeled <span className="suggest-badge">via Google Suggest</span> come from Google's autocomplete API. They reflect real queries people are typing.</p>
            <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>What Google Suggest does not tell you</p>
            <p style={{ marginBottom: 8 }}>Search volume, competition level, CPC, or conversion rate.</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Validate volume and intent in Google Ads Keyword Planner before committing budget.</p>
          </Explainer>
        </div>
      </div>

      <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
        <div className="kt-tab-row" style={{ marginBottom: 12 }}>
          <button className={`kt-tab${auditMode === 'auditMode' ? ' active' : ''}`} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setAuditMode('auditMode')}>Search term audit</button>
          <button className={`kt-tab${auditMode === 'negMode' ? ' active' : ''}`} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setAuditMode('negMode')}>Negative generator</button>
        </div>
        <div style={{ display: auditMode === 'auditMode' ? 'block' : 'none' }}>
          <span className="kt-label">Search terms (paste from Google Ads search term report)</span>
          <textarea ref={auditInputRef} className="kt-textarea" rows={7} style={{ marginBottom: 10 }} placeholder={'data pipeline software\netl jobs salary\nfree data connector\nfivetran vs stitch\nwhat is etl'} />
          <button className="kt-btn" onClick={runAudit}>Audit terms</button>
          <div style={{ marginTop: 16 }} dangerouslySetInnerHTML={{ __html: auditOut }} />
        </div>
        <div style={{ display: auditMode === 'negMode' ? 'block' : 'none' }}>
          <span className="kt-label">Paste search terms to scan</span>
          <textarea ref={negInputRef} className="kt-textarea" rows={7} style={{ marginBottom: 10 }} placeholder="Paste raw search terms here" />
          <button className="kt-btn" onClick={genNegatives}>Generate negatives</button>
          <div style={{ marginTop: 16 }} dangerouslySetInnerHTML={{ __html: negOut }} />
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Explainer title="Deep dive into labels">
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 0 }}>Intent labels -- how this tool classifies keywords</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Bottom funnel</p>
          <p style={{ marginBottom: 4 }}>The buyer is in active evaluation. Queries signal a decision is close -- demo, pricing, comparison, alternative, and vendor terms. These searches have the highest purchase intent and typically deliver the strongest ROI.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Prioritize exact match. Dedicate a separate ad group. Use your highest bids and most conversion-focused landing page.</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Mid funnel</p>
          <p style={{ marginBottom: 4 }}>The buyer is aware of the problem and researching solutions. Queries include category terms, software comparisons, and solution language. They are building a shortlist but have not committed to a vendor.</p>
          <p style={{ marginBottom: 4 }}>Mid funnel is better understood as a transition zone than a discrete stage. B2B buyers rarely follow a linear path, so the most effective approach is to test MOFU assets across TOFU and BOFU simultaneously and let performance data tell you where they actually resonate. Overcomplicating the MOFU layer often creates unnecessary structure around buyer behavior that does not exist in practice.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Use phrase match. Push case studies, comparisons, and testimonials. Nurture with retargeting.</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Top funnel</p>
          <p style={{ marginBottom: 4 }}>The buyer is learning about the problem space. Queries are informational -- "what is," "how to," "guide to." Purchase intent is low.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Use only if you have TOFU content to support it. Do not bid on informational queries without a dedicated landing page and a clear nurture path.</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Impression share flags -- what to do with each signal</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Protect and deepen</p>
          <p style={{ marginBottom: 4 }}>High IS + strong conversions. Your ad is dominant on this keyword and it is converting well. You are in a strong position.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Expand exact match coverage. Add title-informed variants. Defend against competitors bidding on the same terms.</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Scale opportunity</p>
          <p style={{ marginBottom: 4 }}>Low IS + strong conversions. The keyword converts when you show up but you are not showing up enough -- you are leaving pipeline on the table.</p>
          <p style={{ marginBottom: 4 }}>If new budget is not available, reallocate. Identify your lowest-performing channel based on pipeline contribution and cost efficiency, not just CPL. Pull a portion of that budget into the opportunity, enough to generate meaningful data but not so much that you lose the baseline for comparison. Reassess on a defined cadence, every two to four weeks, and scale the reallocation incrementally based on what the data shows. Avoid zeroing out a channel in one move. You need the baseline to know whether the shift is actually working.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Increase bids or budget on this term. Check Lost IS (Budget) vs Lost IS (Rank) in Google Ads to identify the constraint.</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Efficiency problem</p>
          <p style={{ marginBottom: 4 }}>High IS + weak conversions. You are winning auctions but traffic is not converting. Visibility is high but quality is low.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Review ad copy and landing page alignment. Check if the keyword intent matches your offer. Pause or reduce bids until the conversion issue is diagnosed.</p>
          <p style={{ fontWeight: 600, color: '#1a1a19', marginBottom: 4, marginTop: 12 }}>Deprioritize</p>
          <p style={{ marginBottom: 4 }}>Low IS + weak conversions. You are neither dominant nor converting on this keyword.</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Action: Pause or move to a negative list. Redirect budget to converting terms before revisiting.</p>
          <p style={{ fontSize: 11, color: '#9b9a97' }}>
            Sources: <a href="https://support.google.com/google-ads/answer/2497703" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Google Ads Help: About impression share</a>, <a href="https://vehnta.com/google-ads-impression-share" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Vehnta: Google Ads Impression Share Guide</a>, <a href="https://business.google.com/uk/resources/articles/explore-the-b2b-marketing-funnel-with-google-ads" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Google: B2B Marketing Funnel with Google Ads</a>, <a href="https://perrill.com/guide-to-a-full-funnel-google-ads-strategy" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>Perrill: Full-Funnel Google Ads Strategy</a>, Ciente: SaaS Marketing Funnels: The Linear Journey Is A Lie, Lean Summits: B2B Buyer Journey in 2025, Abacum: Marketing Budget Allocation Guide, Directive: B2B Marketing Budget Benchmarks for 2026
          </p>
        </Explainer>
      </div>
    </div>
  );
}
