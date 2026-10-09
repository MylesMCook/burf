export const appName = 'Burf';
// No fork-owned docs host has been configured yet.
export const siteUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3333';
export const landingUrl = 'https://github.com/MylesMCook/burf';

export const gitConfig = {
  user: 'MylesMCook',
  repo: 'burf',
  branch: 'main',
};

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

// The content lives in the repository's own docs/ folder; a page's path is
// relative to it.
export function editUrl(path: string) {
  return `${githubUrl}/blob/${gitConfig.branch}/docs/${path}`;
}
