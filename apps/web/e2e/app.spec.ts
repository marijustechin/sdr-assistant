import { expect, test } from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/__reset`);
});

test('renders the shell, navigation and theme switch', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Research workspace' }),
  ).toBeVisible();

  const mainNav = page.getByRole('navigation', { name: 'Main' });
  await expect(mainNav.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(mainNav.getByRole('link', { name: 'Products' })).toBeVisible();
  await expect(mainNav.getByRole('link', { name: 'Settings' })).toBeVisible();

  await expect(page.getByRole('group', { name: 'Colour theme' })).toBeVisible();
});

test('lists products and marks the section', async ({ page }) => {
  await page.goto('/products');

  await expect(
    page.getByRole('link', { name: 'Thermo Abachi Cladding' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Industrial Catalogue' }),
  ).toBeVisible();

  const section = page.getByRole('navigation', { name: 'Products' });
  await expect(
    section.getByRole('link', { name: 'All products' }),
  ).toHaveAttribute('aria-current', 'page');

  const mainNav = page.getByRole('navigation', { name: 'Main' });
  await expect(mainNav.getByRole('link', { name: 'Products' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('validates and saves research settings rendered from API metadata', async ({
  page,
}) => {
  await page.goto('/settings/research');

  await expect(
    page.getByRole('heading', { name: 'Research settings' }),
  ).toBeVisible();

  const section = page.getByRole('navigation', { name: 'Settings' });
  await expect(section.getByRole('link', { name: 'Research' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  const input = page.getByLabel('Results per query');
  await expect(input).toHaveValue('20');
  await expect(page.getByText('Default 20', { exact: false })).toBeVisible();
  await expect(page.getByText('Allowed 1–50', { exact: false })).toBeVisible();

  await input.fill('60');
  await page.getByRole('button', { name: 'Save settings' }).click();

  await expect(
    page.getByText('Results per query must be at most 50.'),
  ).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('Check the highlighted settings'),
  ).toBeVisible();

  await input.fill('30');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(notifications.getByText('Settings saved')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Results per query')).toHaveValue('30');
});

test('shows product tabs, history and the start form', async ({ page }) => {
  await page.goto('/products/p-abachi');

  await expect(
    page.getByRole('heading', { name: 'Thermo Abachi Cladding' }),
  ).toBeVisible();

  const section = page.getByRole('navigation', { name: 'Product' });
  await expect(section.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(section.getByRole('link', { name: 'Edit' })).toBeVisible();

  await expect(page.getByText('Research history')).toBeVisible();
  await expect(page.locator('.product-item')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Lithuania' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hungary' })).toBeVisible();

  await expect(page.getByLabel('Country')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start research' }),
  ).toBeVisible();
});

test('runs a research to completion and renders the result', async ({
  page,
}) => {
  await page.goto('/products/p-abachi');

  await page.getByLabel('Country').selectOption('LT');
  await page.getByRole('button', { name: 'Start research' }).click();

  await expect(page).toHaveURL(/\/researches\/job-complete$/);

  await expect(page.getByText('Research completed.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(
      'Company discovery finished: 12 companies, 9 with a domain.',
    ),
  ).toBeVisible();
  await expect(page.locator('.animate-spin')).toHaveCount(0);
});

test('renders a failed run with its error and recovery', async ({ page }) => {
  await page.goto('/products/p-abachi');

  await page.getByLabel('Country').selectOption('HU');
  await page.getByRole('button', { name: 'Start research' }).click();

  await expect(page).toHaveURL(/\/researches\/job-fails-run$/);
  await expect(page.getByText('Research failed.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Failed', { exact: true })).toBeVisible();

  await expect(page.locator('pre.error')).toContainText(
    'Company discovery failed: upstream timeout.',
  );
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
});

test('announces a stopped poller with a toast when the job disappears', async ({
  page,
}) => {
  await page.goto('/researches/job-vanishes');

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('Research updates stopped'),
  ).toBeVisible();
  await expect(
    notifications.getByRole('button', { name: 'Retry' }),
  ).toBeVisible();

  await expect(page.getByText('Research is not running.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
});

test('renders the app 404 page', async ({ page }) => {
  await page.goto('/products/does-not-exist');

  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});

test('switches theme and persists it', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'System' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('copies a completed result and confirms with a toast', async ({
  page,
}) => {
  await page.goto('/researches/job-done');

  await expect(
    page.getByText(
      'Company discovery finished: 12 companies, 9 with a domain.',
    ),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Copy' }).click();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('Result copied to clipboard'),
  ).toBeVisible();

  await notifications
    .getByRole('button', { name: 'Dismiss notification' })
    .click();
  await expect(notifications).toHaveCount(0);
});

test('shows back-to-top only on an overflowing page', async ({ page }) => {
  await page.goto('/products/p-long');

  await expect(page.getByRole('button', { name: 'Back to top' })).toHaveCount(
    0,
  );

  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });

  const backToTop = page.getByRole('button', { name: 'Back to top' });
  await expect(backToTop).toBeVisible();

  await backToTop.click();

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeLessThan(5);
});
