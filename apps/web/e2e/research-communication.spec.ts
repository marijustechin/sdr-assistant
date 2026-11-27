import { expect, test } from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/__reset`);
});

test('shows the automatically prepared recipient queue', async ({
  page,
}, testInfo) => {
  await page.goto('/researches/job-profiles');

  const communicationTab = page.getByRole('tab', { name: /Communication/ });
  await expect(communicationTab).toContainText('3');
  await communicationTab.click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Communication' }),
  ).toBeVisible();
  await expect(
    page.getByText('Prepared recipient queue', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Stage 05 publication/)).toBeVisible();
  await expect(page.getByText(/not yet eligible or authorized/)).toBeVisible();

  const totals = page.locator('.contact-totals dd');
  await expect(totals).toHaveText(['3', '3', '1']);

  const rows = page.locator('.recipient-queue-row');
  await expect(rows).toHaveCount(3);
  await expect(page.getByText('Showing 1–3 of 3 companies')).toBeVisible();

  const alpha = rows.filter({ hasText: 'Alpha Sauna OÜ' });
  await expect(alpha.getByText('sales@alpha-sauna.test')).toBeVisible();
  await expect(alpha.getByText('Sales / commercial mailbox')).toBeVisible();
  await expect(alpha.getByText('Prepared', { exact: true })).toBeVisible();
  await expect(alpha.getByText('1 alternative contact')).toBeVisible();

  // Alternative contacts are preserved behind an expandable disclosure.
  await alpha.locator('summary').click();
  await expect(alpha.getByText('info@alpha-sauna.test')).toBeVisible();

  // Partner, distributor and excluded-company contacts never enter the queue.
  await expect(page.getByText('partner@distributor.test')).toHaveCount(0);
  await expect(page.getByText('delta.test')).toHaveCount(0);

  // No sending control, delivery state or mailto link exists.
  await expect(page.getByRole('button', { name: /send/i })).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

  const gamma = rows.filter({ hasText: 'Gamma Heat GmbH' });
  await expect(gamma.getByText('General company mailbox')).toBeVisible();
  await expect(gamma.getByText('0 alternative contacts')).toBeVisible();

  await page.getByLabel('Search recipients').fill('gamma');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Gamma Heat GmbH');
  await expect(page.getByText('Showing 1–1 of 1 company')).toBeVisible();

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByText('Showing 1–3 of 3 companies')).toBeVisible();

  // Rendered evidence is taken after the client read settles, so it shows the
  // prepared queue rather than a transient loading label.
  await page.screenshot({
    path: testInfo.outputPath('sdr-009-recipient-queue-desktop.png'),
    fullPage: true,
  });
});

test('saves the initial email and restores it after reload', async ({
  page,
}, testInfo) => {
  await page.goto('/researches/job-profiles');
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Initial email' }),
  ).toBeVisible();

  const subject = page.getByLabel('Subject');
  const message = page.getByLabel('Message');

  await expect(subject).toHaveValue('');
  await expect(message).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'Save initial email' }),
  ).toBeDisabled();

  await subject.fill('Supply partnership');
  await message.fill('Hello,\n\nWe would like to discuss supply.');
  await page.getByRole('button', { name: 'Save initial email' }).click();

  await expect(page.getByText('Initial email saved')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('sdr-009-initial-email-desktop.png'),
    fullPage: true,
  });

  // A full reload reads the persisted words back from the communication API.
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(page.getByLabel('Subject')).toHaveValue('Supply partnership');
  await expect(page.getByLabel('Message')).toHaveValue(
    'Hello,\n\nWe would like to discuss supply.',
  );

  // The email-account assignment section remains available and unchanged.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Email account' }),
  ).toBeVisible();
});

test('handles a research without a published Stage 05 result', async ({
  page,
}) => {
  await page.goto('/researches/job-empty');
  await page.getByRole('tab', { name: /Communication/ }).click();

  await expect(
    page.getByText(/No published Stage 05 Contact Discovery result/),
  ).toBeVisible();
  await expect(page.getByText('Total companies')).toHaveCount(0);
  await expect(page.locator('.recipient-queue-row')).toHaveCount(0);
});
