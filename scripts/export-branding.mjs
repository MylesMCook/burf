// Render the unmodified SVG masters and package their exact PNG icon frames.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'design/branding');
const out = join(source, 'exports');
const require = createRequire(join(root, 'app/package.json'));
const { chromium } = require('@playwright/test');
const copy = async (from, to) => {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
};
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const name of ['burf-app-icon', 'burf-wordmark', 'burf-wordmark-smiling', 'burf-mark']) {
    const svg = await readFile(join(source, `${name}.svg`), 'utf8');
    const sizes = name === 'burf-app-icon' ? [16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024]
      : name === 'burf-mark' ? [16, 24, 32, 48, 64, 128, 256, 512]
        : [620, 1240];
    for (const width of sizes) {
      const png = await page.evaluate(async ({ svg, width }) => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        if (doc.querySelector('parsererror')) throw new Error('Invalid SVG');
        const el = doc.documentElement;
        const height = Math.round(width * Number(el.getAttribute('height')) / Number(el.getAttribute('width')));
        // Set the raster viewport before decoding, rather than shrinking a
        // large decoded bitmap (which can miss subpixel strokes at 16px).
        el.setAttribute('width', String(width));
        el.setAttribute('height', String(height));
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(doc))}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/png').split(',')[1];
      }, { svg, width });
      await writeFile(join(out, `${name}-${width}.png`), Buffer.from(png, 'base64'));
    }
  }
} finally {
  await browser.close();
}

// Modern macOS ICNS representations contain PNGs. Each one is rendered from
// the vector at its own resolution; packaging never resamples the artwork.
const representations = { ic07: 128, ic08: 256, ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512, icp4: 16, icp5: 32, icp6: 64 };
const chunks = [];
for (const tag of Object.keys(representations).sort()) {
  const png = await readFile(join(out, `burf-app-icon-${representations[tag]}.png`));
  const header = Buffer.alloc(8);
  header.write(tag, 0, 4, 'ascii');
  header.writeUInt32BE(png.length + 8, 4);
  chunks.push(Buffer.concat([header, png]));
}
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0, 4, 'ascii');
icnsHeader.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
await writeFile(join(out, 'burf-app-icon.icns'), Buffer.concat([icnsHeader, ...chunks]));

// Store exact vector-rendered PNGs in ICO's standard directory.
const sizes = [16, 24, 32, 48, 64, 256];
const frames = await Promise.all(sizes.map((size) => readFile(join(out, `burf-app-icon-${size}.png`))));
const directory = Buffer.alloc(6 + 16 * frames.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
for (const [i, frame] of frames.entries()) {
  const entry = 6 + i * 16;
  directory[entry] = directory[entry + 1] = sizes[i] === 256 ? 0 : sizes[i];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await writeFile(join(out, 'burf-app-icon.ico'), Buffer.concat([directory, ...frames]));

for (const destination of ['app/public/favicon.svg', 'site/assets/favicon.svg', 'site/demo/favicon.svg', 'docs-site/app/icon.svg']) {
  await copy(join(source, 'burf-app-icon.svg'), join(root, destination));
}
for (const directory of ['app/public/branding', 'site/assets/branding', 'docs-site/public/branding']) {
  for (const name of ['burf-app-icon', 'burf-wordmark', 'burf-wordmark-smiling', 'burf-mark']) {
    await copy(join(source, `${name}.svg`), join(root, directory, `${name}.svg`));
  }
}
for (const destination of ['site/assets/apple-touch-icon.png', 'docs-site/app/apple-icon.png', 'internal/box/phoneui/apple-touch-icon.png']) {
  await copy(join(out, 'burf-app-icon-180.png'), join(root, destination));
}
for (const size of [192, 512]) await copy(join(out, `burf-app-icon-${size}.png`), join(root, `internal/box/phoneui/icon-${size}.png`));
await copy(join(out, 'burf-app-icon-512.png'), join(root, 'docs-site/public/branding/burf-app-icon-512.png'));
await copy(join(out, 'burf-app-icon-1024.png'), join(root, 'design/logo/burf-icon-1024.png'));
await copy(join(source, 'burf-mark.svg'), join(root, 'design/logo/burf-mark.svg'));
console.log('Burf SVG masters rendered and production assets synchronized.');
