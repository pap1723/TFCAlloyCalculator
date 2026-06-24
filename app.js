'use strict';

// TerraFirmaCraft alloy data. Edit these recipes if a modpack changes ratios.
const ALLOYS = [
  { name: 'Bronze', ingredients: { Copper: [88, 92], Tin: [8, 12] }, group: 'Primitive' },
  { name: 'Bismuth Bronze', ingredients: { Copper: [50, 65], Zinc: [20, 30], Bismuth: [10, 20] }, group: 'Primitive' },
  { name: 'Black Bronze', ingredients: { Copper: [50, 70], Silver: [10, 25], Gold: [10, 25] }, group: 'Primitive' },
  { name: 'Brass', ingredients: { Copper: [88, 92], Zinc: [8, 12] }, group: 'Utility' },
  { name: 'Rose Gold', ingredients: { Copper: [15, 30], Gold: [70, 85] }, group: 'Utility' },
  { name: 'Sterling Silver', ingredients: { Copper: [20, 40], Silver: [60, 80] }, group: 'Utility' },
  { name: 'Weak Steel', ingredients: { Steel: [50, 70], Nickel: [15, 25], 'Black Bronze': [15, 25] }, group: 'Steel Path' },
  { name: 'Weak Blue Steel', ingredients: { 'Black Steel': [50, 55], Steel: [20, 25], 'Bismuth Bronze': [10, 15], 'Sterling Silver': [10, 15] }, group: 'Steel Path' },
  { name: 'Weak Red Steel', ingredients: { 'Black Steel': [50, 55], Steel: [20, 25], Brass: [10, 15], 'Rose Gold': [10, 15] }, group: 'Steel Path' },
];

const METALS = Array.from(new Set(ALLOYS.flatMap(a => Object.keys(a.ingredients)))).sort((a, b) => a.localeCompare(b));

const rowsEl = document.querySelector('#rows');
const rowTemplate = document.querySelector('#rowTemplate');
const resultBadge = document.querySelector('#resultBadge');
const totalUnitsEl = document.querySelector('#totalUnits');
const matchingAlloyEl = document.querySelector('#matchingAlloy');
const statusTextEl = document.querySelector('#statusText');
const compositionEl = document.querySelector('#composition');
const warningsEl = document.querySelector('#warnings');
const targetAlloyEl = document.querySelector('#targetAlloy');
const plannedBatchEl = document.querySelector('#plannedBatch');
const planOutputEl = document.querySelector('#planOutput');
const recipeCardsEl = document.querySelector('#recipeCards');
let activeAmountInput = null;

function fmt(num, digits = 2) {
  if (!Number.isFinite(num)) return '0';
  const rounded = Number(num.toFixed(digits));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function populateMetalSelect(select) {
  select.innerHTML = METALS.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
}

function addRow(metal = 'Copper', amount = '') {
  const node = rowTemplate.content.firstElementChild.cloneNode(true);
  const select = node.querySelector('.metal-select');
  const input = node.querySelector('.amount-input');
  populateMetalSelect(select);
  select.value = metal;
  input.value = amount;
  input.addEventListener('focus', () => { activeAmountInput = input; });
  input.addEventListener('input', update);
  select.addEventListener('change', update);
  node.querySelector('.remove-row').addEventListener('click', () => {
    node.remove();
    if (!rowsEl.children.length) addRow();
    update();
  });
  rowsEl.appendChild(node);
  update();
}

function getMixture() {
  const mix = {};
  [...rowsEl.querySelectorAll('.metal-row')].forEach(row => {
    const metal = row.querySelector('.metal-select').value;
    const amount = Number(row.querySelector('.amount-input').value);
    if (metal && Number.isFinite(amount) && amount > 0) {
      mix[metal] = (mix[metal] || 0) + amount;
    }
  });
  return mix;
}

function totalOf(mix) {
  return Object.values(mix).reduce((sum, value) => sum + value, 0);
}

function percentages(mix) {
  const total = totalOf(mix);
  const out = {};
  Object.entries(mix).forEach(([metal, amount]) => {
    out[metal] = total > 0 ? amount / total * 100 : 0;
  });
  return out;
}

function matchesRecipe(mix, alloy) {
  const pcts = percentages(mix);
  const recipeMetals = Object.keys(alloy.ingredients);
  const mixMetals = Object.keys(mix).filter(m => mix[m] > 0);
  if (!mixMetals.length) return false;
  if (mixMetals.some(m => !recipeMetals.includes(m))) return false;
  if (recipeMetals.some(m => !(m in mix))) return false;
  return recipeMetals.every(m => {
    const [min, max] = alloy.ingredients[m];
    const pct = pcts[m] || 0;
    return pct + 1e-9 >= min && pct - 1e-9 <= max;
  });
}

function findMatches(mix) {
  return ALLOYS.filter(alloy => matchesRecipe(mix, alloy));
}

function update() {
  const mix = getMixture();
  const total = totalOf(mix);
  const matches = findMatches(mix);
  totalUnitsEl.textContent = fmt(total);
  matchingAlloyEl.textContent = matches.length ? matches.map(m => m.name).join(', ') : 'None';
  compositionEl.innerHTML = renderComposition(mix);
  warningsEl.innerHTML = renderWarnings(mix, matches);

  if (total <= 0) {
    setBadge('Enter metals to begin', 'neutral');
    statusTextEl.textContent = 'Waiting';
  } else if (matches.length) {
    setBadge(`Valid ${matches[0].name}`, 'good');
    statusTextEl.textContent = matches.length > 1 ? 'Multiple matches' : 'Valid';
  } else {
    setBadge('No valid alloy', 'bad');
    statusTextEl.textContent = 'Unknown metal risk';
  }

  renderPlan();
  saveState();
}

function setBadge(text, cls) {
  resultBadge.textContent = text;
  resultBadge.className = `result-badge ${cls}`;
}

function renderComposition(mix) {
  const total = totalOf(mix);
  if (total <= 0) return '<p class="fine-print">Add metals to see percentage composition.</p>';
  return Object.entries(percentages(mix))
    .sort((a, b) => b[1] - a[1])
    .map(([metal, pct]) => {
      const amount = mix[metal];
      return `<div class="bar-row">
        <div class="bar-label"><strong>${escapeHtml(metal)}</strong><span>${fmt(amount)} units · ${fmt(pct)}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>
      </div>`;
    }).join('');
}

function renderWarnings(mix, matches) {
  const total = totalOf(mix);
  if (total <= 0) return '';
  if (matches.length) {
    const recipeText = recipeToText(matches[0]);
    return `<div class="note">This mix is inside the valid range for <strong>${escapeHtml(matches[0].name)}</strong>: ${recipeText}.</div>`;
  }
  const possible = ALLOYS.filter(alloy => Object.keys(mix).every(m => Object.keys(alloy.ingredients).includes(m)));
  if (!possible.length) {
    return '<div class="warning">Your mix includes metals that do not belong together in any built-in recipe.</div>';
  }
  return `<div class="warning">These metals can form ${possible.map(a => escapeHtml(a.name)).join(' or ')}, but the percentages are outside the valid range.</div>`;
}

function renderPlan() {
  const target = ALLOYS.find(a => a.name === targetAlloyEl.value) || ALLOYS[0];
  const mix = getMixture();
  const plan = calculatePlan(mix, target, Number(plannedBatchEl.value) || 100);
  if (!plan.ok) {
    planOutputEl.innerHTML = `<div class="warning">${escapeHtml(plan.message)}</div>`;
    return;
  }
  const additions = Object.entries(plan.additions).filter(([, amount]) => amount > 1e-7);
  if (!additions.length) {
    planOutputEl.innerHTML = `<div class="note">Your current mix already satisfies <strong>${escapeHtml(target.name)}</strong>.</div>`;
    return;
  }
  planOutputEl.innerHTML = `<div class="note"><strong>Add these metals</strong> to reach a valid ${escapeHtml(target.name)} mix at about ${fmt(plan.finalTotal)} total units:</div>
    <ul class="plan-list">${additions.map(([metal, amount]) => `<li>${escapeHtml(metal)}: <strong>${fmt(amount)}</strong> units</li>`).join('')}</ul>
    <p class="fine-print">Final target percentages: ${Object.entries(percentages(plan.finalMix)).map(([m, p]) => `${escapeHtml(m)} ${fmt(p)}%`).join(', ')}.</p>`;
}

function calculatePlan(currentMix, alloy, emptyBatchSize) {
  const ingredients = Object.keys(alloy.ingredients);
  const currentTotal = totalOf(currentMix);
  const forbidden = Object.keys(currentMix).filter(m => currentMix[m] > 0 && !ingredients.includes(m));
  if (forbidden.length) {
    return { ok: false, message: `${forbidden.join(', ')} cannot be part of ${alloy.name}. Remove it or pick a different target alloy.` };
  }

  if (currentTotal <= 0) {
    const finalMix = {};
    ingredients.forEach(m => {
      const [min, max] = alloy.ingredients[m];
      finalMix[m] = emptyBatchSize * ((min + max) / 2) / 100;
    });
    return { ok: true, additions: { ...finalMix }, finalMix, finalTotal: totalOf(finalMix) };
  }

  let low = Math.max(currentTotal, 1);
  ingredients.forEach(m => {
    const amount = currentMix[m] || 0;
    const [, max] = alloy.ingredients[m];
    low = Math.max(low, amount / (max / 100));
  });
  let high = low;
  let feasible = null;
  for (let i = 0; i < 80; i++) {
    const candidate = buildFeasibleMix(currentMix, alloy, high);
    if (candidate) { feasible = candidate; break; }
    high *= 1.5;
  }
  if (!feasible) return { ok: false, message: `No feasible addition plan found for ${alloy.name}.` };

  for (let i = 0; i < 90; i++) {
    const mid = (low + high) / 2;
    const candidate = buildFeasibleMix(currentMix, alloy, mid);
    if (candidate) { high = mid; feasible = candidate; }
    else low = mid;
  }

  const additions = {};
  Object.entries(feasible).forEach(([metal, amount]) => {
    additions[metal] = Math.max(0, amount - (currentMix[metal] || 0));
  });
  return { ok: true, additions, finalMix: feasible, finalTotal: totalOf(feasible) };
}

function buildFeasibleMix(currentMix, alloy, total) {
  const ingredients = Object.keys(alloy.ingredients);
  const lower = {};
  const upper = {};
  let lowerSum = 0;
  let upperSum = 0;

  ingredients.forEach(m => {
    const [min, max] = alloy.ingredients[m];
    lower[m] = Math.max(currentMix[m] || 0, total * min / 100);
    upper[m] = total * max / 100;
    lowerSum += lower[m];
    upperSum += upper[m];
  });

  if (lowerSum - total > 1e-7 || total - upperSum > 1e-7) return null;

  const finalMix = { ...lower };
  let remaining = total - lowerSum;
  for (const m of ingredients) {
    const room = upper[m] - finalMix[m];
    const add = Math.min(room, remaining);
    finalMix[m] += add;
    remaining -= add;
    if (remaining <= 1e-7) break;
  }
  return remaining <= 1e-5 ? finalMix : null;
}

function recipeToText(alloy) {
  return Object.entries(alloy.ingredients)
    .map(([metal, [min, max]]) => `${escapeHtml(metal)} ${min}-${max}%`)
    .join(', ');
}

function renderRecipes() {
  recipeCardsEl.innerHTML = ALLOYS.map(alloy => `<article class="recipe-card">
    <h3>${escapeHtml(alloy.name)}</h3>
    <ul>${Object.entries(alloy.ingredients).map(([metal, [min, max]]) => `<li>${escapeHtml(metal)}: ${min}-${max}%</li>`).join('')}</ul>
  </article>`).join('');
}

function populateTargets() {
  targetAlloyEl.innerHTML = ALLOYS.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${escapeHtml(a.group)})</option>`).join('');
}

function saveState() {
  const rows = [...rowsEl.querySelectorAll('.metal-row')].map(row => ({
    metal: row.querySelector('.metal-select').value,
    amount: row.querySelector('.amount-input').value,
  }));
  localStorage.setItem('tfcAlloyState', JSON.stringify({ rows, target: targetAlloyEl.value, batch: plannedBatchEl.value }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('tfcAlloyState') || 'null');
    if (saved?.rows?.length) {
      saved.rows.forEach(r => addRow(r.metal, r.amount));
      targetAlloyEl.value = saved.target || 'Bronze';
      plannedBatchEl.value = saved.batch || 100;
      update();
      return;
    }
  } catch (_) {}
  addRow('Copper', 90);
  addRow('Tin', 10);
}

function reset() {
  rowsEl.innerHTML = '';
  localStorage.removeItem('tfcAlloyState');
  addRow('Copper', '');
  addRow('Tin', '');
  targetAlloyEl.value = 'Bronze';
  plannedBatchEl.value = 100;
  update();
}

function copySummary() {
  const mix = getMixture();
  const total = totalOf(mix);
  const matches = findMatches(mix);
  const lines = [
    'TerraFirmaCraft Alloy Calculator',
    `Total: ${fmt(total)} units`,
    `Result: ${matches.length ? matches.map(m => m.name).join(', ') : 'No valid alloy'}`,
    'Composition:',
    ...Object.entries(percentages(mix)).map(([m, p]) => `- ${m}: ${fmt(mix[m])} units (${fmt(p)}%)`),
  ];
  navigator.clipboard?.writeText(lines.join('\n'));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

document.querySelector('#addRowBtn').addEventListener('click', () => addRow());
document.querySelector('#resetBtn').addEventListener('click', reset);
document.querySelector('#copySummaryBtn').addEventListener('click', copySummary);
targetAlloyEl.addEventListener('change', update);
plannedBatchEl.addEventListener('input', update);
document.querySelectorAll('.quick-add button').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!activeAmountInput) activeAmountInput = rowsEl.querySelector('.amount-input');
    const add = Number(btn.dataset.fill);
    activeAmountInput.value = fmt((Number(activeAmountInput.value) || 0) + add, 2);
    activeAmountInput.dispatchEvent(new Event('input'));
    activeAmountInput.focus();
  });
});

populateTargets();
renderRecipes();
loadState();
