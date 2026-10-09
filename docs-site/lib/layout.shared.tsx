import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/logo';
import { DrawerLinks, SiteLink } from '@/components/site-header';

// On a laptop-sized screen the product header (components/site-header.tsx)
// carries the lockup, Burf on GitHub and GitHub, and the sidebar starts at
// search. On a phone, the docs' header has the lockup and a labelled
// "Burf on GitHub ↗", and the menu drawer starts with labelled links to the
// website and GitHub.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
      url: '/',
      children: <SiteLink className="berth-head-site" />,
    },
    themeSwitch: { mode: 'light-dark-system' },
    links: [{ type: 'custom', children: <DrawerLinks /> }],
  };
}
