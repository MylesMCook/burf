import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Globe } from 'lucide-react';
import { Logo } from '@/components/logo';
import { githubUrl, landingUrl } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
      url: '/',
    },
    githubUrl,
    themeSwitch: { mode: 'light-dark-system' },
    // The website sits beside GitHub in the sidebar's footer, out of the way
    // of the pages.
    links: [
      {
        type: 'icon',
        text: 'Website',
        label: 'berthd.app, the website',
        icon: <Globe />,
        url: landingUrl,
        external: true,
      },
    ],
  };
}
