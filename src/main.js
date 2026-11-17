import { Viewer } from './viewer.js';
import { PRINTERS, UPCOMING, SEVERITY } from '../data/index.js';

const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const state = { printer: null, code: null, step: 0, query: '' };

const viewer = new Viewer($('#stage'), { onPick: showPick });

// ---------- Navegação ----------
function selectPrinter(id, { silent = false } = {}) {
  const p = PRINTERS.find((x) => x.id === id) || PRINTERS[0];
  if (state.printer !== p) {
    state.printer = p;
    viewer.setPrinter(p);
  }
  state.code = null;
  state.step = 0;
  hidePick();
  render();
  if (!silent) syncHash();
}

function selectCode(code, { silent = false } = {}) {
  state.code = code;
  state.step = 0;
  hidePick();
  render();
  if (!silent) syncHash();
}

function goStep(i) {
  if (!state.code) return;
  state.step = Math.max(0, Math.min(state.code.steps.length - 1, i));
  hidePick();
  renderStep();
  renderDetailSteps();
}

function openSetUntil(steps, i) {
  const open = new Set();
  for (let k = 0; k <= i; k++) {
    (steps[k].open || []).forEach((x) => open.add(x));
    (steps[k].close || []).forEach((x) => open.delete(x));
  }
  return [...open];
}

// ---------- Hash (#impressora--codigo) ----------
function syncHash() {
  const h = state.printer.id + (state.code ? `--${slug(state.code.code)}` : '');
  if (location.hash.slice(1) !== h) location.hash = h;
}

function fromHash() {
  const [pid, cslug] = location.hash.slice(1).split('--');
  const p = PRINTERS.find((x) => x.id === pid) || state.printer || PRINTERS[0];
  if (state.printer !== p) { state.printer = p; viewer.setPrinter(p); }
  const code = cslug ? p.codes.find((c) => slug(c.code) === cslug) : null;
  if (code !== state.code || !code) { state.code = code || null; state.step = 0; }
  render();
}
window.addEventListener('hashchange', fromHash);

// ---------- Render ----------
function render() {
  renderPrinters();
  renderCodes();
  renderDetail();
  renderStep();
  $('#machine-chip').innerHTML = `<b>${esc(state.printer.brand)} ${esc(state.printer.model)}</b><span>${esc(state.printer.type)}</span>`;
}

function renderPrinters() {
  $('#printers').innerHTML =
    PRINTERS.map((p) => `
      <button class="printer ${p === state.printer ? 'active' : ''}" data-id="${p.id}">
        <span class="b">${esc(p.brand)}</span><span class="m">${esc(p.model)}</span>
        <span class="t">${p.codes.length} códigos · ${esc(p.type.split('·')[0].trim())}</span>
      </button>`).join('') +
    UPCOMING.map((u) => `
      <div class="printer soon"><span class="b">${esc(u.brand)}</span><span class="m">${esc(u.model)}</span><span class="t">Em breve · ${esc(u.type)}</span></div>`).join('');
  $('#printers').querySelectorAll('button.printer').forEach((b) => b.addEventListener('click', () => selectPrinter(b.dataset.id)));
}

function codeItem(c, p, showPrinter) {
  const active = c === state.code;
  return `<button class="code-item ${active ? 'active' : ''}" data-p="${p.id}" data-c="${esc(c.code)}">
    <span class="c">${esc(c.code)}</span><span class="ti">${esc(c.title)}</span>
    <span class="meta"><span class="sev ${c.severity}">${SEVERITY[c.severity].label}</span>${showPrinter ? `· ${esc(p.brand)} ${esc(p.model)}` : `· ${esc(c.system)}`}</span>
  </button>`;
}

function renderCodes() {
  const q = norm(state.query.trim());
  let html;
  if (q) {
    const hits = [];
    for (const p of PRINTERS) for (const c of p.codes) {
      if (norm(c.code).includes(q) || norm(c.title).includes(q) || norm(c.system).includes(q)) hits.push(codeItem(c, p, true));
    }
    $('#codes-title').textContent = `Resultados (${hits.length})`;
    html = hits.join('') || '<div class="empty">Nenhum código encontrado. A base ainda é de demonstração.</div>';
  } else {
    $('#codes-title').textContent = `Códigos de erro · ${state.printer.brand}`;
    html = state.printer.codes.map((c) => codeItem(c, state.printer, false)).join('');
  }
  $('#codes').innerHTML = html;
  $('#codes').querySelectorAll('.code-item').forEach((b) => b.addEventListener('click', () => {
    const p = PRINTERS.find((x) => x.id === b.dataset.p);
    if (p !== state.printer) { state.printer = p; viewer.setPrinter(p); }
    selectCode(p.codes.find((c) => c.code === b.dataset.c));
    if (window.matchMedia('(max-width: 980px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

function partName(id) {
  return state.printer.parts.find((p) => p.id === id);
}

function renderDetail() {
  const el = $('#detail');
  const c = state.code;
  if (!c) {
    el.innerHTML = `
      <div class="welcome">
        <div class="eyebrow">Protótipo de demonstração</div>
        <h2>Do código de erro até a peça, em 3D</h2>
        <p>Escolha um equipamento e um código de erro. O guia abre a máquina passo a passo, mostra onde está o problema e qual peça sai.</p>
        <ol>
          <li>Digite o código que aparece no painel</li>
          <li>Siga os passos com ‹ ›, ou use as setas do teclado</li>
          <li>Toque em qualquer peça pra ver o nome</li>
          <li>Use <b>Raio-X</b> e <b>Explodir</b> pra ver o lado de dentro</li>
        </ol>
        ${disclaimer()}
      </div>`;
    return;
  }
  const sev = SEVERITY[c.severity];
  el.innerHTML = `
    <div class="eyebrow">${esc(state.printer.brand)} ${esc(state.printer.model)}</div>
    <div class="bigcode">${esc(c.code)}</div>
    <h2>${esc(c.title)}</h2>
    <div class="tags"><span class="sev ${c.severity}" title="${esc(sev.hint)}">${sev.label}</span><span class="tag">${esc(c.system)}</span></div>
    <p>${esc(c.description)}</p>
    ${c.warning ? `<div class="callout warn">⚠ ${esc(c.warning)}</div>` : ''}
    <h4>Causas prováveis</h4>
    <ul>${c.causes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h4>Peças envolvidas</h4>
    <div class="part-chips">${c.parts.map((id) => {
      const p = partName(id);
      return p ? `<button class="part-chip" data-part="${id}">${esc(p.name)}${p.pn ? `<small>${esc(p.pn)}</small>` : ''}</button>` : '';
    }).join('')}</div>
    ${c.clear ? `<div class="callout info"><b>Limpar o erro:</b> ${esc(c.clear)}</div>` : ''}
    ${c.tip ? `<div class="callout tip"><b>Dica de campo:</b> ${esc(c.tip)}</div>` : ''}
    <h4>Passo a passo</h4>
    <ol class="steps" id="detail-steps"></ol>
    <div class="source">Fonte: <a href="${esc(c.source.url)}" target="_blank" rel="noopener">${esc(c.source.label)}</a></div>
    ${disclaimer()}`;
  el.querySelectorAll('.part-chip').forEach((b) => b.addEventListener('click', () => {
    viewer.pick(b.dataset.part);
    showPick(partName(b.dataset.part));
  }));
  renderDetailSteps();
}

function renderDetailSteps() {
  const ol = $('#detail-steps');
  if (!ol || !state.code) return;
  ol.innerHTML = state.code.steps.map((s, i) =>
    `<li><button class="${i === state.step ? 'active' : i < state.step ? 'done' : ''}" data-i="${i}"><b>${esc(s.title)}</b></button></li>`).join('');
  ol.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => goStep(+b.dataset.i)));
}

function disclaimer() {
  return `<div class="disclaimer">Modelos 3D simplificados e originais, não são o CAD dos fabricantes. Procedimentos resumidos pra demonstração: confirme sempre no service manual oficial do equipamento. Marcas citadas pertencem aos seus donos.</div>`;
}

function renderStep() {
  const card = $('#step-card');
  const c = state.code;
  viewer.setScreen(c);
  if (!c) {
    viewer.apply({ view: 'iso' });
    card.innerHTML = `<div><div class="k">PRONTO</div><h3>Escolha um código de erro</h3><p>Ou toque nas peças pra explorar o ${esc(state.printer.model)}.</p></div>`;
    return;
  }
  const s = c.steps[state.step];
  const n = c.steps.length;
  viewer.apply({ ...s, open: openSetUntil(c.steps, state.step) });
  card.innerHTML = `
    <div>
      <div class="k">${esc(c.code)} · PASSO ${state.step + 1}/${n}</div>
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.text)}</p>
    </div>
    <div class="nav">
      <button class="prev" aria-label="Passo anterior" ${state.step === 0 ? 'disabled' : ''}>‹</button>
      <button class="next" aria-label="Próximo passo" ${state.step === n - 1 ? 'disabled' : ''}>›</button>
    </div>
    <div class="progress">${c.steps.map((_, i) => `<i class="${i <= state.step ? 'on' : ''}"></i>`).join('')}</div>`;
  card.querySelector('.prev').addEventListener('click', () => goStep(state.step - 1));
  card.querySelector('.next').addEventListener('click', () => goStep(state.step + 1));
}

// ---------- Peça selecionada ----------
let pickTimer;
function showPick(def) {
  if (!def) return;
  const el = $('#pick-info');
  el.innerHTML = `<b>${esc(def.name)}</b>${def.pn ? `<small>${esc(def.pn)}</small>` : ''}`;
  el.hidden = false;
  clearTimeout(pickTimer);
  pickTimer = setTimeout(hidePick, 4000);
}
function hidePick() { $('#pick-info').hidden = true; }

// ---------- Ferramentas ----------
function toggle(btn, fn) {
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', on);
    fn(on);
  });
}
toggle($('#btn-xray'), (on) => viewer.setXray(on));
toggle($('#btn-explode'), (on) => viewer.setExplode(on));
toggle($('#btn-rotate'), (on) => viewer.setAutoRotate(on));
$('#btn-reset').addEventListener('click', () => {
  if (state.code) renderStep(); else viewer.resetView();
});

$('#search').addEventListener('input', (e) => { state.query = e.target.value; renderCodes(); });
$('#search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#codes .code-item')?.click();
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') goStep(state.step + 1);
  if (e.key === 'ArrowLeft') goStep(state.step - 1);
});

// ---------- Início ----------
if (location.hash.length > 1) fromHash();
else selectPrinter(PRINTERS[0].id, { silent: true });
