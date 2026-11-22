/**
 * Visual regression scenarios: deterministic states of the real app.
 *
 * Each scenario receives a fresh Playwright page already loaded, with
 * transitions and animations disabled, and returns when the state is ready.
 */
const SETTLE_MS = 500;

async function addMedia(page, media) {
  const inputs = await page.$$('input[type=file]');
  await inputs[0].setInputFiles(media.video);
  await page.waitForSelector('.studio.has-video', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await inputs[1].setInputFiles(media.audio);
  await page.waitForSelector('.library-select-all', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('.library-select-all');
  await page.click('button[title="Add to timeline"]');
  await page.waitForSelector('.tracks .track-content', { timeout: 30000 });
  await page.waitForTimeout(2500);
}

async function selectFirstClip(page) {
  const box = await (await page.$('.tracks .track-content')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
  await page.waitForTimeout(SETTLE_MS);
}

async function parkMouse(page) {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(SETTLE_MS);
}

export const scenarios = [
  {
    name: 'empty-1440',
    viewport: { width: 1440, height: 900 },
    run: async page => parkMouse(page)
  },
  {
    name: 'media-1440',
    viewport: { width: 1440, height: 900 },
    run: async (page, media) => {
      await addMedia(page, media);
      await parkMouse(page);
    }
  },
  {
    name: 'clip-selected-1440',
    viewport: { width: 1440, height: 900 },
    run: async (page, media) => {
      await addMedia(page, media);
      await selectFirstClip(page);
      await parkMouse(page);
    }
  },
  {
    name: 'volume-mode-1440',
    viewport: { width: 1440, height: 900 },
    run: async (page, media) => {
      await addMedia(page, media);
      await selectFirstClip(page);
      await page.click('.timeline-dock button[data-action="volume"]');
      await parkMouse(page);
    }
  },
  {
    name: 'pan-mode-1440',
    viewport: { width: 1440, height: 900 },
    run: async (page, media) => {
      await addMedia(page, media);
      await selectFirstClip(page);
      await page.click('.timeline-dock button[data-action="pan"]');
      await parkMouse(page);
    }
  },
  {
    name: 'cut-mode-1440',
    viewport: { width: 1440, height: 900 },
    run: async (page, media) => {
      await addMedia(page, media);
      await selectFirstClip(page);
      await page.click('.timeline-dock button[data-action="cut"]');
      await parkMouse(page);
    }
  },
  {
    name: 'clip-selected-1280x720',
    viewport: { width: 1280, height: 720 },
    run: async (page, media) => {
      await addMedia(page, media);
      await selectFirstClip(page);
      await parkMouse(page);
    }
  }
];
