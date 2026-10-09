import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'design/branding');
const require = createRequire(join(root, 'app/package.json'));
const { chromium } = require('@playwright/test');
const masters = {
  'burf-app-icon': '0fa5957c250f4ecbe0c67932124fe90e555d251c743458bbf0926bb6f1af51fa',
  'burf-mark': 'efd5f08419200c8d6b5692963d8a47a846590734ba3b1d8ef0046acdccc5e987',
  'burf-wordmark': '93d846a0a52dc93a35b65487082051f9aacec28b04aa3c510f106c775badbf51',
  'burf-wordmark-smiling': 'c4dd790e72f6f5ec4f7870504852456ff4d118f81b7c44fb33b7fba3e91f03e2',
};
let browser;
let page;
before(async () => { browser = await chromium.launch(); page = await browser.newPage(); });
after(async () => { await browser?.close(); });

test('approved masters stay byte-identical and deployed SVGs use the masters', async () => {
  for (const [name, digest] of Object.entries(masters)) {
    const master = await readFile(join(brand, `${name}.svg`));
    assert.equal(createHash('sha256').update(master).digest('hex'), digest, name);
    for (const dir of ['app/public/branding', 'site/assets/branding', 'docs-site/public/branding']) {
      assert.deepEqual(await readFile(join(root, dir, `${name}.svg`)), master);
    }
    assert.ok((await readFile(join(brand, 'originals', `${name}-quiver.svg`))).length > 0);
  }
  const icon = await readFile(join(brand, 'burf-app-icon.svg'));
  for (const path of ['app/public/favicon.svg', 'site/assets/favicon.svg', 'site/demo/favicon.svg', 'docs-site/app/icon.svg']) {
    assert.deepEqual(await readFile(join(root, path)), icon);
  }
});

async function pixels(data) {
  return page.evaluate(async (encoded) => {
    const img = new Image();
    img.src = `data:image/png;base64,${encoded}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    let opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 255) { colors.add(`${d[i]},${d[i+1]},${d[i+2]}`); opaque++; }
    }
    const alpha = (x, y) => d[(y * c.width + x) * 4 + 3];
    return { width: c.width, height: c.height, colors: [...colors], opaque,
      corners: [alpha(0, 0), alpha(c.width-1, 0), alpha(0, c.height-1), alpha(c.width-1, c.height-1)],
      markCounter: alpha(Math.floor((381.7-296)/162*c.width), Math.floor((353-246)/162*c.height)) };
  }, data.toString('base64'));
}

test('production PNGs retain transparency, palette, aspect ratio and the b counter', async () => {
  for (const file of await readdir(join(brand, 'exports'))) {
    if (!file.endsWith('.png')) continue;
    const p = await pixels(await readFile(join(brand, 'exports', file)));
    const width = Number(/-(\d+)\.png$/.exec(file)[1]);
    assert.equal(p.width, width, file);
    assert.equal(p.height, file.includes('wordmark') ? width * 412 / 620 : width, file);
    assert.deepEqual(p.corners, [0, 0, 0, 0], file);
    assert.ok(p.opaque > 0 && p.opaque < p.width * p.height, file);
    assert.ok(p.colors.includes('78,42,74'), `plum: ${file}`);
    if (!file.startsWith('burf-mark-')) {
      // At 16/24px the underline is subpixel and blends with the plum tile.
      const coral = width >= 32 ? p.colors.includes('228,137,94') : p.colors.some((color) => {
        const [r, g, b] = color.split(',').map(Number);
        return r > g + 40 && g >= b;
      });
      assert.ok(coral, `coral stroke: ${file}`);
    }
    if (file.startsWith('burf-mark-')) assert.ok(p.markCounter < 64, `transparent counter: ${file}`);
    if (file.includes('smiling')) assert.ok(p.colors.includes('255,245,228'), `face: ${file}`);
  }
});

test('Windows ICO contains transparent native-resolution frames', async () => {
  const b = await readFile(join(root, 'app/src-tauri/icons/icon.ico'));
  assert.equal(b.readUInt16LE(0), 0);
  assert.equal(b.readUInt16LE(2), 1);
  const sizes = [];
  for (let i = 0; i < b.readUInt16LE(4); i++) {
    const pos = 6 + 16 * i;
    const width = b[pos] || 256;
    const offset = b.readUInt32LE(pos + 12);
    const length = b.readUInt32LE(pos + 8);
    assert.ok(offset + length <= b.length);
    const p = await pixels(b.subarray(offset, offset + length));
    assert.equal(p.width, width);
    assert.equal(p.height, width);
    assert.deepEqual(p.corners, [0, 0, 0, 0]);
    sizes.push(width);
  }
  assert.deepEqual(sizes, [16, 24, 32, 48, 64, 256]);
  assert.deepEqual(b, await readFile(join(brand, 'exports/burf-app-icon.ico')));
});

test('macOS ICNS includes its full-resolution transparent master', async () => {
  const b = await readFile(join(root, 'app/src-tauri/icons/icon.icns'));
  assert.equal(b.toString('ascii', 0, 4), 'icns');
  assert.equal(b.readUInt32BE(4), b.length);
  const chunks = new Map();
  for (let pos = 8; pos < b.length;) {
    const size = b.readUInt32BE(pos + 4);
    assert.ok(size >= 8 && pos + size <= b.length);
    chunks.set(b.toString('ascii', pos, pos + 4), b.subarray(pos + 8, pos + size));
    pos += size;
  }
  const p = await pixels(chunks.get('ic10'));
  assert.deepEqual([...chunks.keys()], [...chunks.keys()].sort(), 'deterministic ICNS order');
  assert.equal(p.width, 1024);
  assert.equal(p.height, 1024);
  assert.deepEqual(p.corners, [0, 0, 0, 0]);
  assert.ok(p.colors.includes('228,137,94'));
  assert.deepEqual(b, await readFile(join(brand, 'exports/burf-app-icon.icns')));
});
