/**
 * Readable, self-contained HTML edition of the book.
 * Photos are referenced by relative path inside the bundle, never by host path.
 */

import { partitionPassages, partitionStories, acceptedClaimsFor, openQuestionsFrom, claimText } from './select.mjs';
import { UNKNOWN_LABEL } from '../contracts/types.mjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function renderBookHtml({ snapshot, passages = [], branch, assetPaths = new Map(), options = {} }) {
  const people = new Map((snapshot.people || []).map((p) => [p.id, p]));
  const focusId = options.focusPersonId || branch?.focusPersonId || (snapshot.people || [])[0]?.id;
  const focus = people.get(focusId);
  const title = (options.title || 'Osmy Roots: The Family Book').replace(/^Roots(?=:)/, 'Osmy Roots');
  const dedication = options.dedication || 'For Dad.';

  const register = new Map();
  let n = 0;
  for (const s of snapshot.sources || []) { if (!register.has(s.id)) register.set(s.id, { number: ++n, source: s }); }
  const cite = (ids) => {
    const nums = [...new Set((ids || []).map((i) => register.get(i)?.number).filter(Boolean))];
    return nums.length ? `<sup class="cite">[${nums.join(',')}]</sup>` : '';
  };

  const { current, stale } = partitionPassages(passages, snapshot.version);
  const { accepted: stories, notes } = partitionStories(snapshot.stories, focusId);
  const facts = acceptedClaimsFor(snapshot.claims, focusId);
  const open = openQuestionsFrom(snapshot);

  const photo = (id) => {
    const rel = assetPaths.get(id);
    return rel ? `<figure><img src="${esc(rel)}" alt="Family photograph"></figure>` : '';
  };

  const levels = branch?.levels || new Map();
  const byLevel = new Map();
  for (const [id, lvl] of levels.entries()) {
    if (!people.has(id)) continue;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(id);
  }
  const branchHtml = [...byLevel.keys()].sort((a, b) => b - a).map((lvl) => `
    <div class="gen"><span class="gen-label">Generation ${lvl === 0 ? 'youngest' : `-${lvl}`}</span>
      <div class="gen-row">${byLevel.get(lvl).map((id) => {
    const p = people.get(id);
    const sourceIds = new Set();
    for (const c of snapshot.claims || []) if (c.subjectId === id) (c.sourceIds || []).forEach((s) => sourceIds.add(s));
    return `<div class="card${id === focusId ? ' focus' : ''}">
          <div class="card-name">${esc(p.displayNameEn || p.id)}</div>
          ${p.originalName && p.originalName !== p.displayNameEn ? `<div class="card-orig">${esc(p.originalName)}</div>` : ''}
          <div class="card-years">${esc(p.lifeYears?.label || UNKNOWN_LABEL)}</div>
          <div class="card-cite">${cite([...sourceIds])}</div>
        </div>`;
  }).join('')}</div>
    </div>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{--ink:#1b1b20;--muted:#6b6b76;--rule:#ddd8d0;--paper:#fbfaf8;--accent:#5a3d28;--card:#f6f4f0;}
  @media (prefers-color-scheme:dark){:root{--ink:#eceaea;--muted:#a6a2a8;--rule:#3a3a40;--paper:#17171a;--accent:#c8a582;--card:#212127;}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.65 Georgia,"Times New Roman",serif;padding:0 20px 80px}
  main{max-width:760px;margin:0 auto}
  h1{font:600 30px/1.25 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:48px 0 4px}
  h2{font:600 18px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;
     margin:44px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
  .subtitle{color:var(--muted);margin:0 0 8px}
  .dedication{color:var(--accent);font-size:19px;margin:28px 0 8px}
  figure{margin:0 0 14px}
  img{max-width:100%;height:auto;display:block;border-radius:3px}
  .photos{display:flex;gap:12px;flex-wrap:wrap}
  .photos figure{flex:1 1 200px;min-width:0}
  .gen{margin:0 0 14px}
  .gen-label{font:600 11px/1 -apple-system,Segoe UI,sans-serif;color:var(--muted);
    text-transform:uppercase;letter-spacing:.07em}
  .gen-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;overflow-x:auto}
  .card{background:var(--card);border:1px solid var(--rule);border-radius:4px;
    padding:8px 10px;min-width:150px;flex:0 1 auto}
  .card.focus{border-color:var(--accent);border-width:1.5px}
  .card-name{font:600 13px/1.3 -apple-system,Segoe UI,sans-serif}
  .card-orig{font-size:12px;color:var(--muted)}
  .card-years{font-size:12px;color:var(--muted);margin-top:2px}
  .cite{color:var(--accent);font-size:11px}
  ul{padding-left:20px}
  li{margin:5px 0}
  .passage{border-left:3px solid var(--accent);padding:2px 0 2px 16px;margin:16px 0}
  .locator{font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);
    word-break:break-all;margin-top:4px}
  .note{background:var(--card);border:1px solid var(--rule);border-radius:4px;
    padding:12px 14px;font-size:13px;color:var(--muted);margin:18px 0}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;display:block;overflow-x:auto}
  td{border-bottom:1px solid var(--rule);padding:7px 8px;vertical-align:top}
  td:first-child{color:var(--muted);white-space:nowrap;width:1%}
  footer{margin-top:56px;padding-top:16px;border-top:1px solid var(--rule);
    font-size:12px;color:var(--muted)}
</style></head><body><main>

<h1>${esc(title)}</h1>
${focus ? `<p class="subtitle">${esc(focus.displayNameEn)}${focus.originalName && focus.originalName !== focus.displayNameEn ? ` · ${esc(focus.originalName)}` : ''} · ${esc(focus.lifeYears?.label || UNKNOWN_LABEL)}</p>` : ''}
${focus && (focus.photoIds || [])[0] ? photo(focus.photoIds[0]) : ''}
<p class="dedication">${esc(dedication)}</p>

<h2>The family branch</h2>
${branchHtml || '<p class="subtitle">No branch was selected.</p>'}
<p class="note">Bracketed numbers cite the numbered sources below. Unknown values are shown as “Unknown” rather than filled in. This branch shows ${byLevel.size ? [...byLevel.values()].reduce((a, b) => a + b.length, 0) : 0} people; the full project retains ${(snapshot.people || []).length}.</p>

<h2>Complete family register</h2>
<table>${[...people.values()].map((p) => `<tr id="person-${esc(p.id)}"><td>${esc(p.id)}</td><td>${esc(p.displayNameEn)}<br><span class="subtitle">${esc(p.lifeYears?.label || UNKNOWN_LABEL)}</span></td><td>${cite((snapshot.claims || []).filter((c) => c.subjectId === p.id).flatMap((c) => c.sourceIds || []))}</td></tr>`).join('')}</table>

${focus ? `<h2>${esc(focus.displayNameEn)}</h2>
${(focus.photoIds || []).length > 1 ? `<div class="photos">${(focus.photoIds || []).slice(0, 4).map(photo).join('')}</div>` : ''}
${facts.length ? `<table>${facts.map((c) => `<tr><td>${esc(String(c.predicate || '').replace(/^relationship_/, '').replace(/_/g, ' '))}</td><td>${esc(claimText(c, people).replace(/^[a-z ]+: /, ''))} ${cite(c.sourceIds)}</td></tr>`).join('')}</table>` : '<p class="subtitle">No accepted facts are recorded for this person yet.</p>'}
${current.length ? `${current.filter((p) => !p.personId || p.personId === focusId).map((p) => `<div class="passage">${esc(p.text)}${(p.sourceLocators || []).length ? `<div class="locator">Source: ${esc((p.sourceLocators || []).join('; '))}</div>` : ''}</div>`).join('')}` : ''}
${stories.length ? `<h2>Family recollections</h2><ul>${stories.map((s) => `<li>${s.attributedTo ? `<em>Remembered by ${esc(s.attributedTo)}.</em> ` : '<em>Family recollection.</em> '}${esc(s.text)} ${cite(s.sourceIds)}</li>`).join('')}</ul>` : ''}
` : ''}

<h2>Family photographs</h2>
<div class="photos">${(snapshot.assets || []).filter((a) => String(a.mediaType).startsWith('image/') && assetPaths.has(a.id)).map((a) => `<figure><img src="${esc(assetPaths.get(a.id))}" alt="${esc(a.caption || a.originalName || 'Supplied family photograph')}"><figcaption>${esc(a.caption || a.originalName || 'Supplied family photograph')}</figcaption></figure>`).join('')}</div>
${(snapshot.stories || []).some((s) => s.subjectId !== focusId && s.status === 'accepted') ? `<h2>Other reviewed recollections</h2><ul>${(snapshot.stories || []).filter((s) => s.subjectId !== focusId && s.status === 'accepted').map((s) => `<li><strong>${esc(people.get(s.subjectId)?.displayNameEn || s.subjectId)}.</strong> ${s.attributedTo ? `Remembered by ${esc(s.attributedTo)}. ` : 'Family recollection. '}${esc(s.text)} ${cite(s.sourceIds)}</li>`).join('')}</ul>` : ''}

<h2>Sources</h2>
<ol>${[...register.values()].sort((a, b) => a.number - b.number).map(({ source }) => `<li><strong>${esc(source.title || source.id)}</strong><div class="locator">${esc(source.kind || 'source')}${source.origin ? ` · ${esc(source.origin)}` : ''} · ${esc(source.originalLocator || '')}${source.unresolved ? ' · original document not supplied' : ''}</div></li>`).join('')}</ol>

<h2>Still to discover</h2>
${open.length ? `<ul>${open.slice(0, 40).map((q) => `<li>${esc(q.text)}</li>`).join('')}</ul>` : '<p class="subtitle">No unresolved items were recorded at export time.</p>'}

${stale.length ? `<div class="note"><strong>${stale.length} passage(s) were excluded as stale.</strong> They were written against an older project version and must be regenerated before they can be printed as current.</div>` : ''}
${notes.length ? `<div class="note">${notes.length} unreviewed note(s) are stored in the project but are deliberately kept out of the biography.</div>` : ''}

<footer>
Generated ${esc(new Date().toISOString().slice(0, 10))} from reviewed family evidence. Project version ${esc(snapshot.version)}.
Imported records are supplied family evidence, not new archive discoveries. An accepted recollection remains a recollection.
</footer>
</main></body></html>`;
}
