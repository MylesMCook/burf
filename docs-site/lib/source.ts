import { loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { berthDark, berthLight } from './code-themes';
import { rehypeNowrapTokens } from './rehype-nowrap-tokens';
import { rehypeReference } from './rehype-reference';
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
      // Reference tables become linkable (lib/rehype-reference.ts), after
      // their code is held together.
      rehypePlugins: (plugins) => [...plugins, rehypeNowrapTokens, rehypeReference],
    }),
  },
  meta: { schema: metaSchema },
});

export const source = loader({
  baseUrl: '/',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});
