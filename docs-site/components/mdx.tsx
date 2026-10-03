import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { BookOpen, Compass, FileCode, Terminal } from 'lucide-react';
import type { MDXComponents } from 'mdx/types';
import { Callout } from './callout';
import { Scene } from './art/scenes';
import { Stage } from './stage';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout,
    Scene,
    Stage,
    Step,
    Steps,
    Tab,
    Tabs,
    // A few icons for Card's icon prop.
    BookOpen,
    Compass,
    FileCode,
    Terminal,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
