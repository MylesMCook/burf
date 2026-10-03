import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// The pages are the repository's docs/ folder, one level up, so the build's
// root is the repository.
const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default withMDX(config);
