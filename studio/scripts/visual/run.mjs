#!/usr/bin/env node
/**
 * Visual regression check against a local baseline.
 *
 *   npm run visual:baseline   capture the current UI (before a change)
 *   npm run visual:check      capture again and diff pixel by pixel
 *
 * Needs the dev servers running (Go API :8080, Vite :8081) and FFmpeg to
 * generate the test media. Baselines are local, not committed: rendering
 * differs across operating systems, so only same-machine comparisons are reliable.
 *
 * Env: CHROMIUM_PATH to use a specific Chromium binary.
 * Options: --url <app url>  --only <scenario name>  --threshold <max % of changed pixels>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { scenarios } from './scenarios.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, '.visual');
const DIRS = {
  baseline: join(OUT, 'baseline'),
  current: join(OUT, 'current'),
  diff: join(OUT, 'diff'),
  media: join(OUT, 'media')
};
const NO_MOTION =
  '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';

const args = process.argv.slice(2);
const mode = args[0];
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const url = option('url', 'http://127.0.0.1:8081/');
const only = option('only', null);
const threshold = Number(option('threshold', '0'));

if (!['baseline', 'check'].includes(mode)) {
  console.error(
    'Usage: node scripts/visual/run.mjs <baseline|check> [--url] [--only] [--threshold]'
  );
  process.exit(2);
}

function ensureMedia() {
  mkdirSync(DIRS.media, { recursive: true });
  const video = join(DIRS.media, 'video.mp4');
  const audio = join(DIRS.media, 'music.wav');
  const ffmpeg = (...ffArgs) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...ffArgs]);

  if (!existsSync(video)) {
    ffmpeg(
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=1280x720:rate=25:duration=20',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=20',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      video
    );
  }

  if (!existsSync(audio)) {
    ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', '-af', 'volume=0.5', audio);
  }

  return { video, audio };
}

async function capture(browser, scenario, media, dir) {
  const page = await browser.newPage({ viewport: scenario.viewport });
  page.on('pageerror', error => console.warn(`  [${scenario.name}] page error: ${error.message}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  // The initial loader removes itself at the end of its animation: wait before freezing motion
  await page
    .waitForSelector('#initial-loader', { state: 'detached', timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: NO_MOTION });
  await scenario.run(page, media);
  const file = join(dir, `${scenario.name}.png`);
  await page.screenshot({ path: file });
  await page.close();
  return file;
}

function compare(name) {
  const a = PNG.sync.read(readFileSync(join(DIRS.baseline, `${name}.png`)));
  const b = PNG.sync.read(readFileSync(join(DIRS.current, `${name}.png`)));

  if (a.width !== b.width || a.height !== b.height) {
    return { name, changed: Infinity, percent: 100 };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const percent = (100 * changed) / (a.width * a.height);

  if (changed > 0) {
    writeFileSync(join(DIRS.diff, `${name}.png`), PNG.sync.write(diff));
  }

  return { name, changed, percent };
}

const selected = scenarios.filter(scenario => !only || scenario.name === only);
const target = mode === 'baseline' ? DIRS.baseline : DIRS.current;
rmSync(target, { recursive: true, force: true });
rmSync(DIRS.diff, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
mkdirSync(DIRS.diff, { recursive: true });

const media = ensureMedia();
// CHROMIUM_PATH: optional, for environments where Playwright's own browser is not installed
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

try {
  for (const scenario of selected) {
    await capture(browser, scenario, media, target);
    console.log(`  captured ${scenario.name}`);
  }
} finally {
  await browser.close();
}

if (mode === 'baseline') {
  console.log(`Baseline saved in ${DIRS.baseline}`);
  process.exit(0);
}

let failed = false;

for (const scenario of selected) {
  if (!existsSync(join(DIRS.baseline, `${scenario.name}.png`))) {
    console.error(`✖ ${scenario.name}: no baseline, run npm run visual:baseline first`);
    failed = true;
    continue;
  }

  const { name, changed, percent } = compare(scenario.name);
  const ok = percent <= threshold;
  failed ||= !ok;
  console.log(
    `${ok ? '✔' : '✖'} ${name}: ${changed === 0 ? 'identical' : `${changed} px (${percent.toFixed(3)}%)`}`
  );
}

if (failed) {
  console.error(`Differences saved in ${DIRS.diff}`);
}

process.exit(failed ? 1 : 0);
