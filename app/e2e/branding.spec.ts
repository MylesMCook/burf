import { expect, mockOnly, test } from './fixtures';

for (const theme of ['berth-dark', 'berth-light']) {
  test(`the production Burf icon loads in About on ${theme}`, async ({ app }, info) => {
    mockOnly('branding acceptance uses synthetic app state');
    await app.open({ theme });
    const about = await app.openSettings('about');
    const logo = about.getByRole('img', { name: 'Burf', exact: true });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', '/branding/burf-app-icon.svg');
    await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 1024 && el.naturalHeight === 1024)).toBe(true);
    const bounds = await logo.boundingBox();
    expect(bounds?.width).toBe(64);
    expect(bounds?.height).toBe(64);
    await about.screenshot({ path: info.outputPath(`${theme}-branding.png`) });
  });
}
