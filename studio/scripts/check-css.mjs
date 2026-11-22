#!/usr/bin/env node
/**
 * CSS ratchet: design-token debt may only go down.
 *
 * Counts, in every stylesheet under src/ except styles/tokens.css:
 *  - hardColors:     color literals (#hex, rgb()/hsl() with numeric arguments)
 *  - important:      `!important`
 *  - backdropFilter: `backdrop-filter` (the old glass effect)
 *
 * Fails when a count is above css-budget.json. When a count drops, it asks to
 * lower the budget so the gain is locked in. Run: npm run lint:css
 * Pass --update to write the current counts as the new budget.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BUDGET_FILE = join(ROOT, 'css-budget.json');
const TOKENS = join(SRC, 'styles', 'tokens.css');

const HINTS = {
  hardColors: 'use a semantic token from src/styles/tokens.css',
  important: 'raise specificity or fix the rule order instead',
  backdropFilter: 'use a solid --surface-* token'
};

const METRICS = {
  hardColors: /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\(\s*[\d.]/g,
  important: /!important/g,
  backdropFilter: /backdrop-filter\s*:/g
};

const listCss = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listCss(path);
    }

    return entry.name.endsWith('.css') ? [path] : [];
  });

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

const totals = Object.fromEntries(Object.keys(METRICS).map(key => [key, 0]));
const perFile = [];

for (const file of listCss(SRC)) {
  if (file === TOKENS) {
    continue;
  }

  const css = stripComments(readFileSync(file, 'utf8'));
  const counts = Object.fromEntries(
    Object.entries(METRICS).map(([key, pattern]) => [key, (css.match(pattern) || []).length])
  );

  Object.entries(counts).forEach(([key, value]) => (totals[key] += value));
  perFile.push({ file: relative(ROOT, file), ...counts });
}

if (process.argv.includes('--update')) {
  writeFileSync(BUDGET_FILE, JSON.stringify(totals, null, 2) + '\n');
  console.log('css-budget.json updated:', totals);
  process.exit(0);
}

const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
let failed = false;
let improved = false;

for (const [key, value] of Object.entries(totals)) {
  const limit = budget[key] ?? 0;

  if (value > limit) {
    failed = true;
    console.error(`✖ ${key}: ${value} (budget ${limit}): ${HINTS[key]}. Top files:`);
    perFile
      .filter(entry => entry[key] > 0)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 5)
      .forEach(entry => console.error(`    ${entry.file}: ${entry[key]}`));
  } else if (value < limit) {
    improved = true;
    console.log(`✔ ${key}: ${value} (budget ${limit})`);
  } else {
    console.log(`✔ ${key}: ${value}`);
  }
}

if (improved && !failed) {
  console.log('Debt went down: run `npm run lint:css -- --update` to lock in the new budget.');
}

process.exit(failed ? 1 : 0);
