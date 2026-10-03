import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
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
    links: [
      {
        type: 'main',
        text: 'Website',
        url: landingUrl,
        external: true,
      },
    ],
  };
}
