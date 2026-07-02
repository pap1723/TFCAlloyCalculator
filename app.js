'use strict';

// Edit these defaults for your server/modpack. A profile can also be imported/exported in the UI.
const DEFAULT_UNIT_DEFS = [
  { id: 'mb', label: 'mB', mb: 1, quick: true, locked: true },
  { id: 'unit10', label: '10 mB unit', mb: 10, quick: true },
  { id: 'nugget', label: 'Nugget / Small Item', mb: 10, quick: false },
  { id: 'ingot', label: 'Ingot / Mold', mb: 100, quick: true, locked: true },
  { id: 'double_ingot', label: 'Double ingot', mb: 200, quick: false },
  { id: 'sheet', label: 'Sheet', mb: 200, quick: false },
  { id: 'double_sheet', label: 'Double sheet', mb: 400, quick: false },
  { id: 'vessel', label: 'Vessel', mb: 400, quick: true },
];

let unitDefs = loadUnitDefs();

const DEFAULT_PROFILES = [
  {
    id: 'tfc-default',
    name: 'TFC Default',
    notes: 'Default TerraFirmaCraft alloy ratios. Modpacks can override these values.',
    alloys: [
      { name: 'Bronze', ingredients: { Copper: [88, 92], Tin: [8, 12] }, group: 'Primitive' },
      { name: 'Bismuth Bronze', ingredients: { Copper: [50, 65], Zinc: [20, 30], Bismuth: [10, 20] }, group: 'Primitive' },
      { name: 'Black Bronze', ingredients: { Copper: [50, 70], Silver: [10, 25], Gold: [10, 25] }, group: 'Primitive' },
      { name: 'Brass', ingredients: { Copper: [88, 92], Zinc: [8, 12] }, group: 'Utility' },
      { name: 'Rose Gold', ingredients: { Copper: [15, 30], Gold: [70, 85] }, group: 'Utility' },
      { name: 'Sterling Silver', ingredients: { Copper: [20, 40], Silver: [60, 80] }, group: 'Utility' },
      { name: 'Weak Steel', ingredients: { Steel: [50, 70], Nickel: [15, 25], 'Black Bronze': [15, 25] }, group: 'Steel Path' },
      { name: 'Weak Blue Steel', ingredients: { 'Black Steel': [50, 55], Steel: [20, 25], 'Bismuth Bronze': [10, 15], 'Sterling Silver': [10, 15] }, group: 'Steel Path' },
      { name: 'Weak Red Steel', ingredients: { 'Black Steel': [50, 55], Steel: [20, 25], Brass: [10, 15], 'Rose Gold': [10, 15] }, group: 'Steel Path' },
    ],
  },
];

let profiles = loadProfiles();
let activeProfileId = localStorage.getItem('tfcActiveProfile') || profiles[0].id;
let activeAmountInput = null;

const els = {
  rows: document.querySelector('#rows'),
  rowTemplate: document.querySelector('#rowTemplate'),
  resultBadge: document.querySelector('#resultBadge'),
  totalUnits: document.querySelector('#totalUnits'),
  capacityStatus: document.querySelector('#capacityStatus'),
  matchingAlloy: document.querySelector('#matchingAlloy'),
  statusText: document.querySelector('#statusText'),
  composition: document.querySelector('#composition'),
  warnings: document.querySelector('#warnings'),
  targetAlloy: document.querySelector('#targetAlloy'),
  plannedBatch: document.querySelector('#plannedBatch'),
  plannedUnit: document.querySelector('#plannedUnit'),
  granularity: document.querySelector('#granularity'),
  planOutput: document.querySelector('#planOutput'),
  possibleOutput: document.querySelector('#possibleOutput'),
  correctionOutput: document.querySelector('#correctionOutput'),
  recipeCards: document.querySelector('#recipeCards'),
  profileSelect: document.querySelector('#profileSelect'),
  capacityAmount: document.querySelector('#capacityAmount'),
  capacityUnit: document.querySelector('#capacityUnit'),
  unitReference: document.querySelector('#unitReference'),
  profileJson: document.querySelector('#profileJson'),
  profileMessage: document.querySelector('#profileMessage'),
  unitSettingsRows: document.querySelector('#unitSettingsRows'),
  unitSettingsJson: document.querySelector('#unitSettingsJson'),
  unitSettingsMessage: document.querySelector('#unitSettingsMessage'),
};

function activeProfile() {
  return profiles.find(p => p.id === activeProfileId) || profiles[0];
}

function alloys() {
  return activeProfile().alloys;
}

function metals() {
  return Array.from(new Set(alloys().flatMap(a => Object.keys(a.ingredients)))).sort((a, b) => a.localeCompare(b));
}

function unitById(id) {
  return unitDefs.find(u => u.id === id) || unitDefs[0];
}

function mbUnit() {
  return unitDefs.find(u => u.id === 'mb') || { id: 'mb', label: 'mB', mb: 1, quick: true, locked: true };
}

function fmt(num, digits = 2) {
  if (!Number.isFinite(num)) return '0';
  const rounded = Number(num.toFixed(digits));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtMb(mb) {
  return `${fmt(mb)} mB`;
}


function ingotUnit() {
  return unitDefs.find(u => u.id === 'ingot') || { id: 'ingot', label: 'Ingot / Mold', mb: 100, quick: true, locked: true };
}

function nearlyWhole(value, epsilon = 1e-7) {
  return Math.abs(value - Math.round(value)) < epsilon;
}

function amountRemainder(amount, step) {
  if (!Number.isFinite(amount) || !Number.isFinite(step) || step <= 0) return 0;
  const remainder = amount % step;
  return remainder < 1e-7 ? 0 : remainder;
}

function formatTotalOutput(total) {
  const ingot = ingotUnit();
  const ingotMb = Number(ingot.mb) || 100;
  if (total <= 0) return `${fmtMb(total)} = 0 ${escapeHtml(ingot.label)}`;
  const ingots = total / ingotMb;
  const rem = amountRemainder(total, ingotMb);
  const main = `${fmtMb(total)} = ${fmt(ingots, 4)} ${escapeHtml(ingot.label)}${nearlyWhole(ingots) ? '' : 's'}`;
  if (!rem) return `${main} (full molds)`;
  return `${main} · ${fmtMb(ingotMb - rem)} short of ${fmt(Math.ceil(ingots), 0)} or ${fmtMb(rem)} over ${fmt(Math.floor(ingots), 0)}`;
}

function formatUnitBreakdown(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return fmtMb(0);
  const units = unitDefs
    .filter(u => u.mb > 0 && u.id !== 'mb')
    .sort((a, b) => b.mb - a.mb);
  let remaining = amount;
  const parts = [];
  for (const unit of units) {
    if (unit.mb <= remaining + 1e-7) {
      const count = Math.floor((remaining + 1e-7) / unit.mb);
      if (count > 0) {
        parts.push(`${fmt(count, 0)} × ${escapeHtml(unit.label)}`);
        remaining -= count * unit.mb;
      }
    }
  }
  if (remaining > 1e-6) parts.push(`${fmtMb(remaining)}`);
  return parts.length ? `${fmtMb(amount)} (${parts.join(' + ')})` : fmtMb(amount);
}

function renderIngotRoundingCorrections(mix, candidateAlloys = []) {
  const total = totalOf(mix);
  const ingot = ingotUnit();
  const ingotMb = Number(ingot.mb) || 100;
  if (total <= 0 || ingotMb <= 0) return '';
  const rem = amountRemainder(total, ingotMb);
  if (!rem) {
    return `<div class="mini-card"><h3>Full ${escapeHtml(ingot.label)} output</h3><p>Total output is already a whole number of ${escapeHtml(ingot.label)}s: <strong>${fmt(total / ingotMb, 4)}</strong>.</p></div>`;
  }

  const downTotal = Math.floor(total / ingotMb) * ingotMb;
  const upTotal = Math.ceil(total / ingotMb) * ingotMb;
  const downAmount = total - downTotal;
  const upAmount = upTotal - total;
  const matchingCandidates = candidateAlloys.filter(a => matchesRecipe(mix, a) || Object.keys(mix).every(m => Object.keys(a.ingredients).includes(m)));
  const cap = capacityMb();

  let addHtml = `<p>Add <strong>${formatUnitBreakdown(upAmount)}</strong> total to reach <strong>${fmt(upTotal / ingotMb, 0)} ${escapeHtml(ingot.label)}s</strong>.</p>`;
  const addPlans = matchingCandidates
    .map(alloy => ({ alloy, plan: calculatePlan(mix, alloy, upTotal) }))
    .filter(item => item.plan.ok && Math.abs(item.plan.finalTotal - upTotal) < Math.max(1e-4, ingotMb * 1e-8))
    .slice(0, 3);
  if (addPlans.length) {
    addHtml += addPlans.map(({ alloy, plan }) => {
      const items = Object.entries(plan.additions).filter(([, amount]) => amount > 1e-6);
      return `<div class="sub-card"><strong>Add while keeping ${escapeHtml(alloy.name)}:</strong><ul class="plan-list">${items.map(([m, amount]) => `<li>${escapeHtml(m)}: <strong>${formatUnitBreakdown(amount)}</strong></li>`).join('') || '<li>No additions needed.</li>'}</ul></div>`;
    }).join('');
  } else if (matchingCandidates.length) {
    addHtml += `<p class="fine-print">No exact additive recipe was found for the next full ${escapeHtml(ingot.label)}. Add with care or use the Batch Planner for a nearby larger output.</p>`;
  }
  if (Number.isFinite(cap) && upTotal > cap) {
    addHtml += `<div class="warning">Adding up to the next full ${escapeHtml(ingot.label)} would exceed capacity by ${fmtMb(upTotal - cap)}.</div>`;
  }

  let removeHtml = '';
  if (downTotal > 0) {
    const factor = downAmount / total;
    removeHtml = `<p>Remove or avoid <strong>${formatUnitBreakdown(downAmount)}</strong> total to reach <strong>${fmt(downTotal / ingotMb, 0)} ${escapeHtml(ingot.label)}s</strong>.</p>`;
    removeHtml += `<div class="sub-card"><strong>Proportional removal keeps the same percentages:</strong><ul class="plan-list">${Object.entries(mix).map(([m, amount]) => `<li>${escapeHtml(m)}: remove <strong>${formatUnitBreakdown(amount * factor)}</strong></li>`).join('')}</ul></div>`;
  } else {
    removeHtml = `<p>The current total is less than one ${escapeHtml(ingot.label)}, so only the add-up option makes a usable full output.</p>`;
  }

  return `<div class="mini-card">
    <h3>Round output to full ${escapeHtml(ingot.label)}s</h3>
    <p>Current output is <strong>${formatTotalOutput(total)}</strong>.</p>
    ${addHtml}
    ${removeHtml}
  </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'profile';
}

function populateUnitSelect(select, includeMbOnly = false) {
  const units = includeMbOnly ? unitDefs.filter(u => u.quick || ['mb', 'unit10', 'ingot', 'vessel'].includes(u.id)) : unitDefs;
  select.innerHTML = units.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.label)}</option>`).join('');
}

function populateMetalSelect(select, selected) {
  const list = metals();
  select.innerHTML = list.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (selected && list.includes(selected)) select.value = selected;
}

function populateProfileSelect() {
  els.profileSelect.innerHTML = profiles.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  if (!profiles.some(p => p.id === activeProfileId)) activeProfileId = profiles[0].id;
  els.profileSelect.value = activeProfileId;
}

function populateTargets(selected) {
  const currentAlloys = alloys();
  els.targetAlloy.innerHTML = currentAlloys.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)} (${escapeHtml(a.group || 'Alloy')})</option>`).join('');
  if (selected && currentAlloys.some(a => a.name === selected)) els.targetAlloy.value = selected;
}

function renderUnitReference() {
  els.unitReference.innerHTML = unitDefs.map(u => `<div><strong>${escapeHtml(u.label)}</strong><span>${fmtMb(u.mb)}</span></div>`).join('');
}

function addRow(metal = 'Copper', amount = '', unit = 'mb') {
  const node = els.rowTemplate.content.firstElementChild.cloneNode(true);
  const select = node.querySelector('.metal-select');
  const input = node.querySelector('.amount-input');
  const unitSelect = node.querySelector('.unit-select');
  populateMetalSelect(select, metal);
  populateUnitSelect(unitSelect);
  unitSelect.value = unitById(unit).id;
  input.value = amount;
  input.addEventListener('focus', () => { activeAmountInput = input; });
  input.addEventListener('input', update);
  select.addEventListener('change', update);
  unitSelect.addEventListener('change', update);
  node.querySelector('.remove-row').addEventListener('click', () => {
    node.remove();
    if (!els.rows.children.length) addRow();
    update();
  });
  els.rows.appendChild(node);
  update();
}

function refreshRowMetalOptions() {
  [...els.rows.querySelectorAll('.metal-row')].forEach(row => {
    const select = row.querySelector('.metal-select');
    const old = select.value;
    populateMetalSelect(select, old);
  });
}

function rowAmountMb(row) {
  const amount = Number(row.querySelector('.amount-input').value);
  const unitId = row.querySelector('.unit-select').value;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount * unitById(unitId).mb;
}

function getMixture() {
  const mix = {};
  [...els.rows.querySelectorAll('.metal-row')].forEach(row => {
    const metal = row.querySelector('.metal-select').value;
    const mb = rowAmountMb(row);
    if (metal && mb > 0) mix[metal] = (mix[metal] || 0) + mb;
  });
  return mix;
}

function totalOf(mix) {
  return Object.values(mix).reduce((sum, value) => sum + value, 0);
}

function percentages(mix) {
  const total = totalOf(mix);
  const out = {};
  Object.entries(mix).forEach(([metal, amount]) => { out[metal] = total > 0 ? amount / total * 100 : 0; });
  return out;
}

function capacityMb() {
  const amount = Number(els.capacityAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) return Infinity;
  return amount * unitById(els.capacityUnit.value).mb;
}

function targetBatchMb() {
  const amount = Math.max(1, Number(els.plannedBatch.value) || 1);
  return amount * unitById(els.plannedUnit.value).mb;
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
  return alloys().filter(alloy => matchesRecipe(mix, alloy));
}

function update() {
  const mix = getMixture();
  const total = totalOf(mix);
  const matches = findMatches(mix);
  const cap = capacityMb();

  els.totalUnits.textContent = formatTotalOutput(total);
  els.capacityStatus.textContent = Number.isFinite(cap) ? `${fmtMb(Math.max(0, cap - total))} free` : 'No limit';
  els.matchingAlloy.textContent = matches.length ? matches.map(m => m.name).join(', ') : 'None';
  els.composition.innerHTML = renderComposition(mix);
  els.warnings.innerHTML = renderWarnings(mix, matches, cap);

  if (total <= 0) {
    setBadge('Enter metals to begin', 'neutral');
    els.statusText.textContent = 'Waiting';
  } else if (Number.isFinite(cap) && total > cap) {
    setBadge('Over capacity', 'warn');
    els.statusText.textContent = 'Too full';
  } else if (matches.length) {
    setBadge(`Valid ${matches[0].name}`, 'good');
    els.statusText.textContent = matches.length > 1 ? 'Multiple matches' : 'Valid';
  } else {
    setBadge('No valid alloy', 'bad');
    els.statusText.textContent = 'Unknown metal risk';
  }

  renderPossible();
  renderCorrections();
  renderPlan();
  saveState();
}

function setBadge(text, cls) {
  els.resultBadge.textContent = text;
  els.resultBadge.className = `result-badge ${cls}`;
}

function renderComposition(mix) {
  const total = totalOf(mix);
  if (total <= 0) return '<p class="fine-print">Add metals to see percentage composition.</p>';
  return Object.entries(percentages(mix)).sort((a, b) => b[1] - a[1]).map(([metal, pct]) => {
    const amount = mix[metal];
    return `<div class="bar-row">
      <div class="bar-label"><strong>${escapeHtml(metal)}</strong><span>${fmtMb(amount)} · ${fmt(pct)}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>
    </div>`;
  }).join('');
}

function renderWarnings(mix, matches, cap) {
  const total = totalOf(mix);
  const parts = [];
  if (total <= 0) return '';
  if (Number.isFinite(cap) && total > cap) {
    parts.push(`<div class="warning">Current mix is ${fmtMb(total - cap)} over the selected capacity.</div>`);
  }
  if (matches.length) {
    parts.push(`<div class="note">This mix is inside the valid range for <strong>${escapeHtml(matches[0].name)}</strong>: ${recipeToText(matches[0])}.</div>`);
  } else {
    const possible = alloys().filter(alloy => Object.keys(mix).every(m => Object.keys(alloy.ingredients).includes(m)));
    if (!possible.length) parts.push('<div class="warning">Your mix includes metals that do not belong together in any built-in recipe for this profile.</div>');
    else parts.push(`<div class="warning">These metals can form ${possible.map(a => escapeHtml(a.name)).join(' or ')}, but the percentages are outside the valid range.</div>`);
  }
  return parts.join('');
}

function renderPossible() {
  const mix = getMixture();
  const total = totalOf(mix);
  if (total <= 0) {
    els.possibleOutput.innerHTML = `<div class="mini-card"><h3>Start with a metal</h3><p>Add a current mix to see which alloys are still possible.</p></div>`;
    return;
  }
  const cap = capacityMb();
  const possible = alloys().map(alloy => ({ alloy, plan: calculatePlan(mix, alloy, Math.max(targetBatchMb(), total)) }))
    .filter(item => item.plan.ok)
    .sort((a, b) => a.plan.finalTotal - b.plan.finalTotal);

  if (!possible.length) {
    els.possibleOutput.innerHTML = `<div class="warning">No built-in alloy can be made from this exact set of metals without removing at least one metal.</div>`;
    return;
  }

  els.possibleOutput.innerHTML = possible.slice(0, 8).map(({ alloy, plan }) => {
    const additions = Object.entries(plan.additions).filter(([, amount]) => amount > 1e-6);
    const overCap = Number.isFinite(cap) && plan.finalTotal > cap;
    const additionText = additions.length
      ? additions.map(([m, amount]) => `<li>${escapeHtml(m)}: <strong>${fmtMb(amount)}</strong></li>`).join('')
      : '<li>No additions needed.</li>';
    return `<div class="mini-card">
      <h3>${escapeHtml(alloy.name)}${overCap ? ' <span class="fine-print">(over capacity)</span>' : ''}</h3>
      <p>Smallest feasible final mix: <strong>${fmtMb(plan.finalTotal)}</strong>. Final composition: ${compositionText(plan.finalMix)}.</p>
      <ul class="plan-list">${additionText}</ul>
    </div>`;
  }).join('');
}

function renderCorrections() {
  const mix = getMixture();
  const total = totalOf(mix);
  const matches = findMatches(mix);
  if (total <= 0) {
    els.correctionOutput.innerHTML = `<div class="mini-card"><h3>No correction needed yet</h3><p>Enter a mix first.</p></div>`;
    return;
  }
  if (matches.length) {
    const ingotHtml = renderIngotRoundingCorrections(mix, matches);
    els.correctionOutput.innerHTML = `<div class="note">No correction needed. Current mix is valid for ${matches.map(m => `<strong>${escapeHtml(m.name)}</strong>`).join(', ')}.</div>${ingotHtml}`;
    return;
  }

  const sameMetalRecipes = alloys().filter(alloy => Object.keys(mix).every(m => Object.keys(alloy.ingredients).includes(m)));
  const cards = [];
  const roundingHtml = renderIngotRoundingCorrections(mix, matches.length ? matches : sameMetalRecipes);
  if (roundingHtml) cards.push(roundingHtml);
  if (!sameMetalRecipes.length) {
    const offending = Object.keys(mix).filter(m => !alloys().some(a => Object.keys(a.ingredients).includes(m)));
    const allMixMetals = Object.keys(mix);
    cards.push(`<div class="warning"><strong>Incompatible ingredients.</strong> This exact combination does not fit any recipe. ${offending.length ? `Unknown-to-profile metal(s): ${offending.map(escapeHtml).join(', ')}.` : 'At least one metal must be removed or the target changed.'}</div>`);
    const removableHints = alloys().filter(a => Object.keys(a.ingredients).some(m => allMixMetals.includes(m))).slice(0, 5);
    removableHints.forEach(a => {
      const forbidden = allMixMetals.filter(m => !Object.keys(a.ingredients).includes(m));
      cards.push(`<div class="mini-card"><h3>Pivot to ${escapeHtml(a.name)}</h3><p>Remove or avoid: <strong>${forbidden.map(escapeHtml).join(', ') || 'nothing'}</strong>. Then use the planner for additions.</p></div>`);
    });
  } else {
    const pcts = percentages(mix);
    sameMetalRecipes.forEach(alloy => {
      const issues = Object.entries(alloy.ingredients).map(([metal, [min, max]]) => {
        const pct = pcts[metal] || 0;
        if (pct < min) return `${metal} is low (${fmt(pct)}%, needs ${min}-${max}%)`;
        if (pct > max) return `${metal} is high (${fmt(pct)}%, needs ${min}-${max}%)`;
        return null;
      }).filter(Boolean);
      const plan = calculatePlan(mix, alloy, Math.max(total, targetBatchMb()));
      const additions = plan.ok ? Object.entries(plan.additions).filter(([, amount]) => amount > 1e-6) : [];
      cards.push(`<div class="mini-card">
        <h3>Fix toward ${escapeHtml(alloy.name)}</h3>
        <p>${issues.map(escapeHtml).join('; ') || 'Percentages are close, but at least one required metal is missing.'}</p>
        ${additions.length ? `<p>Recovery additions:</p><ul class="plan-list">${additions.map(([m, amount]) => `<li>${escapeHtml(m)}: <strong>${fmtMb(amount)}</strong></li>`).join('')}</ul>` : '<p>No additive-only recovery found.</p>'}
      </div>`);
    });
  }
  els.correctionOutput.innerHTML = cards.join('');
}

function renderPlan() {
  const target = alloys().find(a => a.name === els.targetAlloy.value) || alloys()[0];
  if (!target) {
    els.planOutput.innerHTML = '<div class="warning">No alloys are defined in this profile.</div>';
    return;
  }
  const desiredMb = targetBatchMb();
  const granularity = Number(els.granularity.value) || 1;
  const cap = capacityMb();
  const rangeRows = Object.entries(target.ingredients).map(([metal, [min, max]]) => {
    const low = desiredMb * min / 100;
    const high = desiredMb * max / 100;
    return `<tr><td>${escapeHtml(metal)}</td><td>${min}-${max}%</td><td>${fmtMb(low)} - ${fmtMb(high)}</td></tr>`;
  }).join('');
  const recipe = closestRecipe(target, desiredMb, granularity);
  const currentPlan = calculatePlan(getMixture(), target, desiredMb);

  const recipeHtml = recipe.ok
    ? `<div class="note"><strong>Closest simple recipe</strong> for ${fmtMb(recipe.total)} using ${fmtMb(granularity)} steps:</div>
       <ul class="plan-list">${Object.entries(recipe.mix).map(([m, amount]) => `<li>${escapeHtml(m)}: <strong>${fmtMb(amount)}</strong> (${asCommonUnits(amount)})</li>`).join('')}</ul>
       <p class="fine-print">Composition: ${compositionText(recipe.mix)}. Score favors midpoint percentages and fewer pieces.</p>`
    : `<div class="warning">${escapeHtml(recipe.message)}</div>`;

  const currentHtml = currentPlan.ok
    ? `<div class="mini-card"><h3>From current mix</h3><p>Smallest additive plan ends at <strong>${fmtMb(currentPlan.finalTotal)}</strong>${Number.isFinite(cap) && currentPlan.finalTotal > cap ? ' and exceeds the selected capacity' : ''}.</p><ul class="plan-list">${Object.entries(currentPlan.additions).filter(([, amount]) => amount > 1e-6).map(([m, amount]) => `<li>${escapeHtml(m)}: <strong>${fmtMb(amount)}</strong></li>`).join('') || '<li>No additions needed.</li>'}</ul></div>`
    : `<div class="warning">From current mix: ${escapeHtml(currentPlan.message)}</div>`;

  els.planOutput.innerHTML = `<table class="range-table"><thead><tr><th>Metal</th><th>Valid %</th><th>Valid amount for ${fmtMb(desiredMb)}</th></tr></thead><tbody>${rangeRows}</tbody></table>${recipeHtml}${currentHtml}`;
}

function calculatePlan(currentMix, alloy, emptyBatchSize) {
  const ingredients = Object.keys(alloy.ingredients);
  const currentTotal = totalOf(currentMix);
  const forbidden = Object.keys(currentMix).filter(m => currentMix[m] > 0 && !ingredients.includes(m));
  if (forbidden.length) return { ok: false, message: `${forbidden.join(', ')} cannot be part of ${alloy.name}. Remove it or pick a different target alloy.` };

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
  let high = Math.max(low, emptyBatchSize);
  let feasible = null;
  for (let i = 0; i < 100; i++) {
    const candidate = buildFeasibleMix(currentMix, alloy, high);
    if (candidate) { feasible = candidate; break; }
    high *= 1.35;
  }
  if (!feasible) return { ok: false, message: `No additive recovery plan found for ${alloy.name}.` };

  low = Math.max(currentTotal, 1);
  ingredients.forEach(m => {
    const amount = currentMix[m] || 0;
    const [, max] = alloy.ingredients[m];
    low = Math.max(low, amount / (max / 100));
  });
  for (let i = 0; i < 90; i++) {
    const mid = (low + high) / 2;
    const candidate = buildFeasibleMix(currentMix, alloy, mid);
    if (candidate) { high = mid; feasible = candidate; }
    else low = mid;
  }

  const additions = {};
  Object.entries(feasible).forEach(([metal, amount]) => { additions[metal] = Math.max(0, amount - (currentMix[metal] || 0)); });
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

function closestRecipe(alloy, desiredMb, granularity) {
  const ingredients = Object.keys(alloy.ingredients);
  const roundedTotal = Math.max(granularity, Math.round(desiredMb / granularity) * granularity);
  if (roundedTotal / granularity > 2000) {
    return { ok: false, message: 'Batch is too large for discrete search at this granularity. Use a larger recipe step.' };
  }
  const ranges = ingredients.map(m => {
    const [min, max] = alloy.ingredients[m];
    return {
      metal: m,
      min: Math.ceil((roundedTotal * min / 100) / granularity) * granularity,
      max: Math.floor((roundedTotal * max / 100) / granularity) * granularity,
      mid: roundedTotal * ((min + max) / 2) / 100,
    };
  });
  if (ranges.some(r => r.min > r.max)) return { ok: false, message: `No exact ${fmtMb(granularity)}-step recipe fits ${fmtMb(roundedTotal)}. Try smaller steps or a larger batch.` };

  let best = null;
  function recurse(index, remaining, mix) {
    if (index === ranges.length - 1) {
      const r = ranges[index];
      if (remaining < r.min - 1e-9 || remaining > r.max + 1e-9) return;
      const candidate = { ...mix, [r.metal]: remaining };
      scoreCandidate(candidate);
      return;
    }
    const r = ranges[index];
    const minRest = ranges.slice(index + 1).reduce((s, x) => s + x.min, 0);
    const maxRest = ranges.slice(index + 1).reduce((s, x) => s + x.max, 0);
    for (let amt = r.min; amt <= r.max + 1e-9; amt += granularity) {
      const rest = remaining - amt;
      if (rest < minRest - 1e-9 || rest > maxRest + 1e-9) continue;
      recurse(index + 1, rest, { ...mix, [r.metal]: amt });
    }
  }
  function scoreCandidate(mix) {
    const midpointPenalty = ranges.reduce((s, r) => s + Math.abs((mix[r.metal] || 0) - r.mid), 0);
    const pieces = Object.values(mix).reduce((s, amount) => s + Math.ceil(amount / granularity), 0);
    const score = midpointPenalty * 1000 + pieces;
    if (!best || score < best.score) best = { score, mix };
  }
  recurse(0, roundedTotal, {});
  return best ? { ok: true, mix: best.mix, total: roundedTotal } : { ok: false, message: 'No valid simple recipe found. Try a smaller step size.' };
}

function recipeToText(alloy) {
  return Object.entries(alloy.ingredients).map(([metal, [min, max]]) => `${escapeHtml(metal)} ${min}-${max}%`).join(', ');
}

function compositionText(mix) {
  return Object.entries(percentages(mix)).map(([m, p]) => `${escapeHtml(m)} ${fmt(p)}%`).join(', ');
}

function asCommonUnits(mb) {
  const ingotMb = unitById('ingot').mb || 100;
  const unit10Mb = unitById('unit10').mb || 10;
  if (Math.abs(mb % ingotMb) < 1e-8) return `${fmt(mb / ingotMb)} ${unitById('ingot').label}`;
  if (Math.abs(mb % unit10Mb) < 1e-8) return `${fmt(mb / unit10Mb)} × ${unitById('unit10').label}`;
  return `${fmt(mb)} mB`;
}

function renderRecipes() {
  els.recipeCards.innerHTML = alloys().map(alloy => `<article class="recipe-card">
    <h3>${escapeHtml(alloy.name)}</h3>
    <ul>${Object.entries(alloy.ingredients).map(([metal, [min, max]]) => `<li>${escapeHtml(metal)}: ${min}-${max}%</li>`).join('')}</ul>
  </article>`).join('');
}

function profileForExport() {
  const p = activeProfile();
  return { id: p.id, name: p.name, notes: p.notes || '', alloys: p.alloys };
}

function updateProfileJsonBox() {
  els.profileJson.value = JSON.stringify(profileForExport(), null, 2);
}

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('Profile JSON must be an object.');
  if (!Array.isArray(profile.alloys) || !profile.alloys.length) throw new Error('Profile must include a non-empty alloys array.');
  profile.alloys.forEach((alloy, index) => {
    if (!alloy.name || typeof alloy.name !== 'string') throw new Error(`Alloy at index ${index} needs a name.`);
    if (!alloy.ingredients || typeof alloy.ingredients !== 'object') throw new Error(`${alloy.name} needs ingredients.`);
    let minSum = 0;
    let maxSum = 0;
    Object.entries(alloy.ingredients).forEach(([metal, range]) => {
      if (!metal || !Array.isArray(range) || range.length !== 2) throw new Error(`${alloy.name} has an invalid range.`);
      const [min, max] = range.map(Number);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) throw new Error(`${alloy.name} has an invalid range for ${metal}.`);
      minSum += min;
      maxSum += max;
    });
    if (minSum > 100 + 1e-9 || maxSum < 100 - 1e-9) throw new Error(`${alloy.name} ranges cannot add up to 100%.`);
  });
  return {
    id: slugify(profile.id || profile.name || `custom-${Date.now()}`),
    name: String(profile.name || profile.id || 'Custom Profile'),
    notes: String(profile.notes || ''),
    alloys: profile.alloys.map(a => ({ name: a.name, group: a.group || 'Custom', ingredients: a.ingredients })),
  };
}

function applyProfile(profile, makeActive = true) {
  const valid = validateProfile(profile);
  let id = valid.id;
  const existingIndex = profiles.findIndex(p => p.id === id);
  if (existingIndex >= 0) profiles[existingIndex] = valid;
  else profiles.push(valid);
  if (makeActive) activeProfileId = id;
  persistProfiles();
  rebuildForProfile();
  showProfileMessage(`Applied profile: ${valid.name}`, 'note');
}

function showProfileMessage(message, cls = 'note') {
  els.profileMessage.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
}

function cloneCurrentProfile() {
  const p = profileForExport();
  p.id = `${slugify(p.name)}-custom-${Date.now()}`;
  p.name = `${p.name} Custom`;
  applyProfile(p);
}

function exportProfileToClipboard() {
  updateProfileJsonBox();
  navigator.clipboard?.writeText(els.profileJson.value);
  showProfileMessage('Profile JSON copied to the textbox and clipboard.', 'note');
}

function downloadProfile() {
  updateProfileJsonBox();
  const blob = new Blob([els.profileJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activeProfile().id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importProfileFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { applyProfile(JSON.parse(String(reader.result))); }
    catch (err) { showProfileMessage(err.message || 'Could not import profile.', 'warning'); }
  };
  reader.readAsText(file);
}


function cloneUnits(units) {
  return units.map(u => ({
    id: slugify(u.id || u.label),
    label: String(u.label || u.id || 'Custom unit'),
    mb: Number(u.mb),
    quick: Boolean(u.quick),
    locked: Boolean(u.locked),
  }));
}

function validateUnits(units) {
  if (!Array.isArray(units) || !units.length) throw new Error('Unit settings must be a non-empty array.');
  const seen = new Set();
  const out = units.map((unit, index) => {
    const label = String(unit.label || unit.name || '').trim();
    if (!label) throw new Error(`Unit at row ${index + 1} needs a label.`);
    const mb = Number(unit.mb);
    if (!Number.isFinite(mb) || mb <= 0) throw new Error(`${label} needs a positive mB amount.`);
    let id = slugify(unit.id || label);
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return { id, label, mb, quick: Boolean(unit.quick), locked: Boolean(unit.locked) };
  });
  const mb = out.find(u => u.id === 'mb') || { id: 'mb', label: 'mB', mb: 1, quick: true, locked: true };
  mb.mb = 1;
  mb.quick = true;
  mb.locked = true;
  if (!out.some(u => u.id === 'mb')) out.unshift(mb);
  return out;
}

function loadUnitDefs() {
  try {
    const saved = JSON.parse(localStorage.getItem('tfcUnitDefs') || 'null');
    if (Array.isArray(saved) && saved.length) return validateUnits(saved);
  } catch (_) {}
  return cloneUnits(DEFAULT_UNIT_DEFS);
}

function persistUnitDefs() {
  localStorage.setItem('tfcUnitDefs', JSON.stringify(unitDefs));
}

function unitSettingsForExport() {
  return validateUnits(unitDefs).map(({ id, label, mb, quick, locked }) => ({ id, label, mb, quick, locked }));
}

function updateUnitSettingsJsonBox() {
  els.unitSettingsJson.value = JSON.stringify(unitSettingsForExport(), null, 2);
}

function renderUnitSettings() {
  els.unitSettingsRows.innerHTML = unitDefs.map(unit => `<tr data-unit-id="${escapeHtml(unit.id)}">
    <td><input class="unit-label-input" value="${escapeHtml(unit.label)}" ${unit.id === 'mb' ? 'readonly' : ''}></td>
    <td><input class="unit-mb-input" type="number" min="0.0001" step="0.01" value="${escapeHtml(unit.mb)}" ${unit.id === 'mb' ? 'readonly' : ''}></td>
    <td><label class="checkbox-field"><input class="unit-quick-input" type="checkbox" ${unit.quick ? 'checked' : ''}> Quick</label></td>
    <td><button class="remove-unit-row danger" ${unit.locked ? 'disabled title="Required unit"' : ''}>×</button></td>
  </tr>`).join('');
  els.unitSettingsRows.querySelectorAll('input').forEach(input => input.addEventListener('input', () => collectUnitSettings(false)));
  els.unitSettingsRows.querySelectorAll('.remove-unit-row').forEach(button => button.addEventListener('click', () => {
    const id = button.closest('tr').dataset.unitId;
    unitDefs = unitDefs.filter(u => u.id !== id || u.locked);
    applyUnitDefs(unitDefs, 'Removed unit/item.');
  }));
  updateUnitSettingsJsonBox();
}

function collectUnitSettings(shouldApply = true) {
  const rows = [...els.unitSettingsRows.querySelectorAll('tr')];
  const next = rows.map(row => {
    const existing = unitById(row.dataset.unitId);
    const label = row.querySelector('.unit-label-input').value.trim();
    return {
      id: existing.id,
      label: label || existing.label,
      mb: Number(row.querySelector('.unit-mb-input').value),
      quick: row.querySelector('.unit-quick-input').checked,
      locked: existing.locked,
    };
  });
  if (!shouldApply) {
    try { els.unitSettingsJson.value = JSON.stringify(validateUnits(next), null, 2); }
    catch (_) {}
    return;
  }
  applyUnitDefs(next, 'Saved unit settings.');
}

function applyUnitDefs(nextUnits, message = 'Applied unit settings.') {
  const oldRowUnits = [...els.rows.querySelectorAll('.unit-select')].map(select => select.value);
  const oldCapacityUnit = els.capacityUnit.value;
  const oldPlannedUnit = els.plannedUnit.value;
  unitDefs = validateUnits(nextUnits);
  persistUnitDefs();
  refreshAllUnitSelects(oldRowUnits, oldCapacityUnit, oldPlannedUnit);
  renderUnitReference();
  renderGranularityOptions();
  renderUnitSettings();
  showUnitSettingsMessage(message, 'note');
  update();
}

function refreshAllUnitSelects(rowUnits = [], capacityUnit = 'mb', plannedUnit = 'mb') {
  populateUnitSelect(els.capacityUnit, true);
  els.capacityUnit.value = unitDefs.some(u => u.id === capacityUnit) ? capacityUnit : 'mb';
  populateUnitSelect(els.plannedUnit, true);
  els.plannedUnit.value = unitDefs.some(u => u.id === plannedUnit) ? plannedUnit : 'mb';
  [...els.rows.querySelectorAll('.unit-select')].forEach((select, index) => {
    const previous = rowUnits[index] || select.value;
    populateUnitSelect(select);
    select.value = unitDefs.some(u => u.id === previous) ? previous : 'mb';
  });
}

function renderGranularityOptions() {
  const options = [
    { value: 1, label: '1 mB' },
    { value: unitById('unit10').mb || 10, label: unitById('unit10').label || '10 mB unit' },
    { value: unitById('ingot').mb || 100, label: unitById('ingot').label || 'Whole ingots / molds' },
  ];
  const current = els.granularity.value;
  els.granularity.innerHTML = options.map(g => `<option value="${escapeHtml(g.value)}">${escapeHtml(g.label)} (${fmtMb(Number(g.value))})</option>`).join('');
  els.granularity.value = [...els.granularity.options].some(o => o.value === current) ? current : String(options[1].value);
}

function addUnitSettingRow() {
  const id = `custom-${Date.now()}`;
  unitDefs.push({ id, label: 'Custom item', mb: 100, quick: false, locked: false });
  applyUnitDefs(unitDefs, 'Added custom unit/item. Edit its name and mB amount, then save.');
}

function exportUnitSettingsToClipboard() {
  updateUnitSettingsJsonBox();
  navigator.clipboard?.writeText(els.unitSettingsJson.value);
  showUnitSettingsMessage('Unit JSON copied to the textbox and clipboard.', 'note');
}

function downloadUnitSettings() {
  updateUnitSettingsJsonBox();
  const blob = new Blob([els.unitSettingsJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tfc-unit-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importUnitSettingsFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { applyUnitDefs(JSON.parse(String(reader.result)), 'Imported unit settings.'); }
    catch (err) { showUnitSettingsMessage(err.message || 'Could not import unit settings.', 'warning'); }
  };
  reader.readAsText(file);
}

function resetUnitSettings() {
  unitDefs = cloneUnits(DEFAULT_UNIT_DEFS);
  applyUnitDefs(unitDefs, 'Reset unit settings to defaults.');
}

function showUnitSettingsMessage(message, cls = 'note') {
  els.unitSettingsMessage.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
}

function loadProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem('tfcProfiles') || 'null');
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (_) {}
  return structuredClone(DEFAULT_PROFILES);
}

function persistProfiles() {
  localStorage.setItem('tfcProfiles', JSON.stringify(profiles));
  localStorage.setItem('tfcActiveProfile', activeProfileId);
}

function saveState() {
  const rows = [...els.rows.querySelectorAll('.metal-row')].map(row => ({
    metal: row.querySelector('.metal-select').value,
    amount: row.querySelector('.amount-input').value,
    unit: row.querySelector('.unit-select').value,
  }));
  localStorage.setItem('tfcAlloyState', JSON.stringify({
    rows,
    target: els.targetAlloy.value,
    batch: els.plannedBatch.value,
    plannedUnit: els.plannedUnit.value,
    granularity: els.granularity.value,
    capacityAmount: els.capacityAmount.value,
    capacityUnit: els.capacityUnit.value,
    profileId: activeProfileId,
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('tfcAlloyState') || 'null');
    if (saved) {
      activeProfileId = saved.profileId || activeProfileId;
      rebuildForProfile(false);
      els.capacityAmount.value = saved.capacityAmount || 3000;
      els.capacityUnit.value = saved.capacityUnit || 'mb';
      els.plannedBatch.value = saved.batch || 400;
      els.plannedUnit.value = saved.plannedUnit || 'mb';
      els.granularity.value = saved.granularity || String(unitById('unit10').mb || 10);
      if (saved.rows?.length) {
        els.rows.innerHTML = '';
        saved.rows.forEach(r => addRow(r.metal, r.amount, r.unit || 'mb'));
      }
      if (saved.target) populateTargets(saved.target);
      update();
      return;
    }
  } catch (_) {}
  addRow('Copper', 360, 'mb');
  addRow('Tin', 40, 'mb');
}

function reset() {
  els.rows.innerHTML = '';
  localStorage.removeItem('tfcAlloyState');
  els.capacityAmount.value = 3000;
  els.capacityUnit.value = 'mb';
  els.plannedBatch.value = 400;
  els.plannedUnit.value = 'mb';
  els.granularity.value = String(unitById('unit10').mb || 10);
  addRow('Copper', '', 'mb');
  addRow('Tin', '', 'mb');
  populateTargets('Bronze');
  update();
}

function copySummary() {
  const mix = getMixture();
  const matches = findMatches(mix);
  const lines = [
    'TerraFirmaCraft Alloy Calculator',
    `Profile: ${activeProfile().name}`,
    `Total: ${formatTotalOutput(totalOf(mix))}`, 
    `Result: ${matches.length ? matches.map(m => m.name).join(', ') : 'No valid alloy'}`,
    'Composition:',
    ...Object.entries(percentages(mix)).map(([m, p]) => `- ${m}: ${fmtMb(mix[m])} (${fmt(p)}%)`),
  ];
  navigator.clipboard?.writeText(lines.join('\n'));
}

function rebuildForProfile(shouldUpdate = true) {
  populateProfileSelect();
  refreshRowMetalOptions();
  populateTargets(els.targetAlloy.value || 'Bronze');
  renderRecipes();
  updateProfileJsonBox();
  persistProfiles();
  if (shouldUpdate) update();
}

function init() {
  populateUnitSelect(els.capacityUnit, true);
  populateUnitSelect(els.plannedUnit, true);
  els.capacityUnit.value = 'mb';
  els.plannedUnit.value = 'mb';
  renderGranularityOptions();
  renderUnitReference();
  renderUnitSettings();
  rebuildForProfile(false);
  loadState();

  document.querySelector('#addRowBtn').addEventListener('click', () => addRow());
  document.querySelector('#resetBtn').addEventListener('click', reset);
  document.querySelector('#copySummaryBtn').addEventListener('click', copySummary);
  els.profileSelect.addEventListener('change', () => { activeProfileId = els.profileSelect.value; rebuildForProfile(); });
  els.targetAlloy.addEventListener('change', update);
  els.plannedBatch.addEventListener('input', update);
  els.plannedUnit.addEventListener('change', update);
  els.granularity.addEventListener('change', update);
  els.capacityAmount.addEventListener('input', update);
  els.capacityUnit.addEventListener('change', update);
  document.querySelector('#cloneProfileBtn').addEventListener('click', cloneCurrentProfile);
  document.querySelector('#exportProfileBtn').addEventListener('click', exportProfileToClipboard);
  document.querySelector('#downloadProfileBtn').addEventListener('click', downloadProfile);
  document.querySelector('#applyProfileJsonBtn').addEventListener('click', () => {
    try { applyProfile(JSON.parse(els.profileJson.value)); }
    catch (err) { showProfileMessage(err.message || 'Could not apply profile JSON.', 'warning'); }
  });
  document.querySelector('#importProfileInput').addEventListener('change', event => importProfileFile(event.target.files?.[0]));
  document.querySelector('#addUnitBtn').addEventListener('click', addUnitSettingRow);
  document.querySelector('#saveUnitSettingsBtn').addEventListener('click', () => {
    try { collectUnitSettings(true); }
    catch (err) { showUnitSettingsMessage(err.message || 'Could not save unit settings.', 'warning'); }
  });
  document.querySelector('#resetUnitSettingsBtn').addEventListener('click', resetUnitSettings);
  document.querySelector('#exportUnitSettingsBtn').addEventListener('click', exportUnitSettingsToClipboard);
  document.querySelector('#downloadUnitSettingsBtn').addEventListener('click', downloadUnitSettings);
  document.querySelector('#applyUnitJsonBtn').addEventListener('click', () => {
    try { applyUnitDefs(JSON.parse(els.unitSettingsJson.value), 'Applied unit settings from JSON.'); }
    catch (err) { showUnitSettingsMessage(err.message || 'Could not apply unit JSON.', 'warning'); }
  });
  document.querySelector('#importUnitSettingsInput').addEventListener('change', event => importUnitSettingsFile(event.target.files?.[0]));
  document.querySelectorAll('.quick-add button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!activeAmountInput) activeAmountInput = els.rows.querySelector('.amount-input');
      if (!activeAmountInput) return;
      const row = activeAmountInput.closest('.metal-row');
      const fill = Number(btn.dataset.fill);
      const add = fill === 100 ? 100 / unitById(row.querySelector('.unit-select').value).mb : fill;
      activeAmountInput.value = fmt((Number(activeAmountInput.value) || 0) + add, 2);
      activeAmountInput.dispatchEvent(new Event('input'));
      activeAmountInput.focus();
    });
  });
  update();
}

init();
