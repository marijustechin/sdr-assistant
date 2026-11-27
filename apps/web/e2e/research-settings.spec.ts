import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

/** Synthetic mailbox configuration; no real credential or connection exists. */
const ACCOUNT = {
  name: 'Outreach mailbox',
  senderName: 'Sales Team',
  emailAddress: 'sales@example.test',
  enabled: true,
  smtpHost: 'smtp.example.test',
  smtpPort: 587,
  smtpSecurity: 'STARTTLS',
  smtpUsername: 'smtp-user',
  smtpPassword: 'synthetic-smtp-secret',
  imapHost: 'imap.example.test',
  imapPort: 993,
  imapSecurity: 'TLS',
  imapUsername: 'imap-user',
  imapPassword: 'synthetic-imap-secret',
};

type SeededAccount = {
  readonly id: string;
  readonly name: string;
  readonly emailAddress: string;
};

test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/__reset`);
});

async function seedAccount(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
): Promise<SeededAccount> {
  const response = await request.post(`${API_URL}/email-accounts`, {
    data: { ...ACCOUNT, ...overrides },
  });

  expect(response.ok()).toBe(true);

  const payload: unknown = await response.json();

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('id' in payload) ||
    !('name' in payload) ||
    !('emailAddress' in payload)
  ) {
    throw new Error('The mock API did not create an email account.');
  }

  return {
    id: String(payload.id),
    name: String(payload.name),
    emailAddress: String(payload.emailAddress),
  };
}

async function assignViaApi(
  request: APIRequestContext,
  researchId: string,
  emailAccountId: string | null,
): Promise<void> {
  const response = await request.patch(
    `${API_URL}/research/${researchId}/communication/email-account`,
    { data: { emailAccountId } },
  );

  expect(response.ok()).toBe(true);
}

async function openSettings(page: Page, researchId: string): Promise<void> {
  await page.goto(`/researches/${researchId}`);
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Email account' }),
  ).toBeVisible();
}

test('opens the Settings tab with an unassigned research and no accounts', async ({
  page,
}) => {
  await openSettings(page, 'job-profiles');

  const panel = page.getByRole('tabpanel');

  await expect(
    panel.getByText('No email account is assigned to this research.'),
  ).toBeVisible();
  await expect(
    panel.getByText(/No email accounts are configured yet/),
  ).toBeVisible();
  await expect(
    panel.getByRole('link', { name: 'Manage email accounts' }),
  ).toHaveAttribute('href', '/settings/email-accounts');
  await expect(
    panel.getByRole('button', { name: 'Remove assignment' }),
  ).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('assigns an enabled account with verification and restores it after reload', async ({
  page,
  request,
}, testInfo) => {
  const account = await seedAccount(request);

  expect(
    (
      await request.post(`${API_URL}/email-accounts/${account.id}/test-smtp`)
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`${API_URL}/email-accounts/${account.id}/test-imap`)
    ).ok(),
  ).toBe(true);

  await openSettings(page, 'job-profiles');

  const panel = page.getByRole('tabpanel');

  await expect(
    panel.getByRole('button', { name: 'Remove assignment' }),
  ).toHaveCount(0);

  await page.getByLabel('Assign an email account').selectOption(account.id);
  await page.getByRole('button', { name: 'Assign account' }).click();

  await expect(panel.getByText(account.name, { exact: true })).toBeVisible();
  await expect(
    panel.getByText(account.emailAddress, { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(panel.getByText(/IMAP · Verified/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove assignment' }),
  ).toBeVisible();
  await expect(panel.getByText('synthetic-smtp-secret')).toHaveCount(0);
  await expect(panel.getByText('synthetic-imap-secret')).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath('sdr-008-email-account-assigned-desktop.png'),
    fullPage: true,
  });

  // A full reload reads the persisted assignment from the API again.
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(panel.getByText(account.name, { exact: true })).toBeVisible();
  await expect(panel.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove assignment' }),
  ).toBeVisible();
});

test('changes and removes the assignment', async ({ page, request }) => {
  const first = await seedAccount(request);
  const second = await seedAccount(request, {
    name: 'Second mailbox',
    emailAddress: 'second@example.test',
  });

  await assignViaApi(request, 'job-profiles', first.id);
  await openSettings(page, 'job-profiles');

  const panel = page.getByRole('tabpanel');
  const select = page.getByLabel('Change the assigned email account');

  await expect(panel.getByText(first.name, { exact: true })).toBeVisible();
  await expect(select.locator('option')).toHaveText([
    'Select an enabled email account',
    `${first.name} — ${first.emailAddress}`,
    `${second.name} — ${second.emailAddress}`,
  ]);

  await select.selectOption(second.id);
  await page.getByRole('button', { name: 'Change account' }).click();

  await expect(panel.getByText(second.name, { exact: true })).toBeVisible();
  await expect(
    panel.getByText(second.emailAddress, { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(first.name, { exact: true })).toHaveCount(0);

  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(panel.getByText(second.name, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Remove assignment' }).click();

  await expect(
    panel.getByText('No email account is assigned to this research.'),
  ).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(
    panel.getByText('No email account is assigned to this research.'),
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Remove assignment' }),
  ).toHaveCount(0);
});

test('allows multiple researches to share one account', async ({
  page,
  request,
}) => {
  const account = await seedAccount(request);

  await assignViaApi(request, 'job-profiles', account.id);
  await openSettings(page, 'job-empty');

  async function expectAssigned(): Promise<void> {
    await expect(
      page.getByRole('tabpanel').getByText(account.name, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('tabpanel').getByText(account.emailAddress, {
        exact: true,
      }),
    ).toBeVisible();
  }

  await expect(
    page.getByText('No email account is assigned to this research.'),
  ).toBeVisible();

  await page.getByLabel('Assign an email account').selectOption(account.id);
  await page.getByRole('button', { name: 'Assign account' }).click();
  await expectAssigned();

  await openSettings(page, 'job-profiles');
  await expectAssigned();
});

test('keeps a disabled assigned account and never replaces it silently', async ({
  page,
  request,
}, testInfo) => {
  const assigned = await seedAccount(request);
  const alternative = await seedAccount(request, {
    name: 'Alternative mailbox',
    emailAddress: 'alternative@example.test',
  });

  await assignViaApi(request, 'job-profiles', assigned.id);

  const disabled = await request.patch(
    `${API_URL}/email-accounts/${assigned.id}`,
    { data: { enabled: false } },
  );

  expect(disabled.ok()).toBe(true);

  await openSettings(page, 'job-profiles');

  const panel = page.getByRole('tabpanel');

  await expect(panel.getByText(assigned.name, { exact: true })).toBeVisible();
  await expect(panel.getByText('Disabled', { exact: true })).toBeVisible();
  await expect(panel.getByText(/This account is disabled/)).toBeVisible();

  const select = page.getByLabel('Change the assigned email account');

  await expect(select.locator('option')).toHaveText([
    'Select an enabled email account',
    `${alternative.name} — ${alternative.emailAddress}`,
  ]);

  await page.screenshot({
    path: testInfo.outputPath('sdr-008-email-account-disabled-desktop.png'),
    fullPage: true,
  });

  // The disabled account is still assigned after a reload; it was not replaced.
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(panel.getByText(assigned.name, { exact: true })).toBeVisible();
  await expect(panel.getByText('Disabled', { exact: true })).toBeVisible();

  // It can be changed explicitly.
  await page
    .getByLabel('Change the assigned email account')
    .selectOption(alternative.id);
  await page.getByRole('button', { name: 'Change account' }).click();

  await expect(
    panel.getByText(alternative.name, { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('Disabled', { exact: true })).toHaveCount(0);
});

test('handles an assigned account that no longer exists', async ({
  page,
  request,
}) => {
  await seedAccount(request);
  await assignViaApi(request, 'job-profiles', 'missing-account');

  await openSettings(page, 'job-profiles');

  const panel = page.getByRole('tabpanel');

  await expect(
    panel.getByText('The assigned email account is no longer available.'),
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Remove assignment' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Remove assignment' }).click();

  await expect(
    panel.getByText('No email account is assigned to this research.'),
  ).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(
    panel.getByText('No email account is assigned to this research.'),
  ).toBeVisible();
});
