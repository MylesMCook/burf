import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { berthDark, berthLight } from './code-themes';
import { rehypeNowrapTokens } from './rehype-nowrap-tokens';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

// The single source of truth is the repository's docs/ folder, next to the
// code it describes.
const docs = defineDocs({
  dir: '../docs',
  docs: {
    schema: pageSchema,
    // Quiet code, in the brand's neutrals (lib/code-themes.ts).
    mdxOptions: applyMdxPreset({
      rehypeCodeOptions: {
        themes: { light: berthLight, dark: berthDark },
      },
      rehypePlugins: (plugins) => [...plugins, rehypeNowrapTokens],
    }),
  },
  meta: { schema: metaSchema },
});

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});
