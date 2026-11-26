import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

/** Synthetic configuration only; no real mailbox or credential is involved. */
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

test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/__reset`);
});

async function seedAccount(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const response = await request.post(`${API_URL}/email-accounts`, {
    data: { ...ACCOUNT, ...overrides },
  });

  expect(response.ok()).toBe(true);

  const payload: unknown = await response.json();
  const id =
    typeof payload === 'object' && payload !== null && 'id' in payload
      ? String(payload.id)
      : '';

  expect(id).not.toBe('');

  return { id };
}

async function openNewAccountForm(page: Page): Promise<void> {
  await page.goto('/settings/email-accounts');
  await page.getByRole('link', { name: 'Add account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts\/new$/);
}

async function fillAccountForm(
  page: Page,
  overrides: Record<string, string> = {},
): Promise<void> {
  const values = { ...ACCOUNT, ...overrides };

  await page.getByLabel('Account name').fill(values.name);
  await page.getByLabel('Sender name').fill(values.senderName);
  await page.getByLabel('Email address').fill(values.emailAddress);
  await page.getByLabel('SMTP host').fill(values.smtpHost);
  await page.getByLabel('SMTP port').fill(String(values.smtpPort));
  await page.getByLabel('SMTP security').selectOption(values.smtpSecurity);
  await page.getByLabel('SMTP username').fill(values.smtpUsername);
  await page.getByLabel('SMTP password').fill(values.smtpPassword);
  await page.getByLabel('IMAP host').fill(values.imapHost);
  await page.getByLabel('IMAP port').fill(String(values.imapPort));
  await page.getByLabel('IMAP security').selectOption(values.imapSecurity);
  await page.getByLabel('IMAP username').fill(values.imapUsername);
  await page.getByLabel('IMAP password').fill(values.imapPassword);
}

test('shows the empty email-account list inside Settings', async ({ page }) => {
  await page.goto('/settings/email-accounts');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Email accounts' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add the first account' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add account' })).toBeVisible();

  const section = page.getByRole('navigation', { name: 'Settings' });
  await expect(
    section.getByRole('link', { name: 'Email accounts' }),
  ).toHaveAttribute('aria-current', 'page');

  const mainNav = page.getByRole('navigation', { name: 'Main' });
  await expect(mainNav.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('creates an account with independent SMTP and IMAP settings', async ({
  page,
}) => {
  await openNewAccountForm(page);

  await expect(page.getByLabel('SMTP port')).toHaveValue('587');
  await expect(page.getByLabel('SMTP security')).toHaveValue('STARTTLS');
  await expect(page.getByLabel('IMAP port')).toHaveValue('993');
  await expect(page.getByLabel('IMAP security')).toHaveValue('TLS');
  await expect(page.getByLabel('Enabled')).toBeChecked();

  await fillAccountForm(page);
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts$/);
  await expect(
    page.getByRole('heading', { level: 2, name: ACCOUNT.name }),
  ).toBeVisible();
  await expect(page.getByText(ACCOUNT.emailAddress)).toBeVisible();
  await expect(page.getByText(ACCOUNT.senderName)).toBeVisible();
  await expect(page.getByText('smtp.example.test:587')).toBeVisible();
  await expect(page.getByText('imap.example.test:993')).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByText('Email account created')).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: ACCOUNT.name }),
  ).toBeVisible();
});

test('validates the account form before calling the API', async ({ page }) => {
  await openNewAccountForm(page);

  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('SMTP port').fill('70000');
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page.getByText('Account name is required.')).toBeVisible();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(
    page.getByText('SMTP port must be between 1 and 65535.'),
  ).toBeVisible();
  await expect(page.getByText('SMTP password is required.')).toBeVisible();
  await expect(page.getByText('IMAP host is required.')).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/email-accounts\/new$/);

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('Check the highlighted fields'),
  ).toBeVisible();
});

test('edits an account and leaves password fields empty', async ({
  page,
  request,
}) => {
  const { id } = await seedAccount(request);

  await page.goto('/settings/email-accounts');
  await page.getByRole('link', { name: 'Edit' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/settings/email-accounts/${id}/edit$`),
  );
  await expect(page.getByLabel('Account name')).toHaveValue(ACCOUNT.name);
  await expect(page.getByLabel('Sender name')).toHaveValue(ACCOUNT.senderName);
  await expect(page.getByLabel('SMTP password')).toHaveValue('');
  await expect(page.getByLabel('IMAP password')).toHaveValue('');
  await expect(
    page.getByText(
      'The SMTP password is configured. Leave this field empty to keep it.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'The IMAP password is configured. Leave this field empty to keep it.',
    ),
  ).toBeVisible();

  await page.getByLabel('Sender name').fill('Updated Sales Team');
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts$/);
  await expect(page.getByText('Updated Sales Team')).toBeVisible();
  await expect(page.getByText(ACCOUNT.emailAddress)).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByText('Email account updated')).toBeVisible();
});

test('disables and enables an account from the list', async ({
  page,
  request,
}) => {
  await seedAccount(request);

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();
  await expect(row.getByText('Enabled', { exact: true })).toBeVisible();

  await row.getByRole('button', { name: 'Disable' }).click();
  await expect(row.getByText('Disabled', { exact: true })).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByText('Email account disabled')).toBeVisible();

  await row.getByRole('button', { name: 'Enable' }).click();
  await expect(row.getByText('Enabled', { exact: true })).toBeVisible();
  await expect(notifications.getByText('Email account enabled')).toBeVisible();
});

test('shows API failure feedback and stays on the form', async ({ page }) => {
  await openNewAccountForm(page);
  await fillAccountForm(page, { emailAddress: 'sales@reject.test' });

  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts\/new$/);
  await expect(page.locator('.form-error')).toHaveText(
    'The mailbox provider refused this account.',
  );

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('The email account was not saved'),
  ).toBeVisible();
  await expect(
    notifications.getByText('The mailbox provider refused this account.'),
  ).toBeVisible();
});

test('shows Not tested states for a fresh account', async ({
  page,
  request,
}) => {
  await seedAccount(request);

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();

  await expect(row.getByText(/SMTP · Not tested/)).toBeVisible();
  await expect(row.getByText(/IMAP · Not tested/)).toBeVisible();
  await expect(row.getByText('Not checked yet.').first()).toBeVisible();
  await expect(
    row.getByRole('button', { name: 'Test connections' }),
  ).not.toBeDisabled();
});

test('tests both connections and reports a full success', async ({
  page,
  request,
}) => {
  await seedAccount(request);

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();
  await row.getByRole('button', { name: 'Test connections' }).click();

  // The action is still running: the button is busy and cannot be clicked
  // again, which is how a duplicate request is prevented.
  await expect(row.getByRole('button', { name: 'Testing…' })).toBeDisabled();
  await expect(
    row.getByRole('button', { name: 'Test connections' }),
  ).toHaveCount(0);

  await expect(row.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(row.getByText(/IMAP · Verified/)).toBeVisible();
  await expect(row.getByText(/Last checked 2026-/).first()).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('Both connections verified'),
  ).toBeVisible();

  await page.reload();
  await expect(row.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(row.getByText(/IMAP · Verified/)).toBeVisible();
});

test('keeps independent results when SMTP succeeds and IMAP fails', async ({
  page,
  request,
}) => {
  await seedAccount(request, { imapHost: 'fail.imap.test' });

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();
  await row.getByRole('button', { name: 'Test connections' }).click();

  await expect(row.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(row.getByText(/IMAP · Failed/)).toBeVisible();
  await expect(
    row.getByText('The server rejected the saved username or password.'),
  ).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('One connection verified'),
  ).toBeVisible();
});

test('keeps independent results when SMTP fails and IMAP succeeds', async ({
  page,
  request,
}) => {
  await seedAccount(request, { smtpHost: 'fail.smtp.test' });

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();
  await row.getByRole('button', { name: 'Test connections' }).click();

  await expect(row.getByText(/SMTP · Failed/)).toBeVisible();
  await expect(row.getByText(/IMAP · Verified/)).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('One connection verified'),
  ).toBeVisible();
});

test('reports a failure when both protocols fail', async ({
  page,
  request,
}) => {
  await seedAccount(request, {
    smtpHost: 'fail.smtp.test',
    imapHost: 'fail.imap.test',
  });

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();
  await row.getByRole('button', { name: 'Test connections' }).click();

  await expect(row.getByText(/SMTP · Failed/)).toBeVisible();
  await expect(row.getByText(/IMAP · Failed/)).toBeVisible();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(
    notifications.getByText('Connection tests failed'),
  ).toBeVisible();
});

test('does not test a disabled account', async ({ page, request }) => {
  await seedAccount(request, { enabled: false });

  await page.goto('/settings/email-accounts');

  const row = page.locator('.product-item').first();

  await expect(row.getByText('Disabled', { exact: true })).toBeVisible();
  await expect(
    row.getByRole('button', { name: 'Test connections' }),
  ).toBeDisabled();
  await expect(row.getByText(/SMTP · Not tested/)).toBeVisible();
  await expect(row.getByText(/IMAP · Not tested/)).toBeVisible();
});

test('tests each protocol from the edit form', async ({ page, request }) => {
  await seedAccount(request);

  await page.goto('/settings/email-accounts');
  await page.getByRole('link', { name: 'Edit' }).click();

  await page.getByRole('button', { name: 'Test SMTP connection' }).click();

  await expect(page.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(page.getByText(/IMAP · Not tested/)).toBeVisible();

  await page.getByRole('button', { name: 'Test IMAP connection' }).click();

  await expect(page.getByText(/IMAP · Verified/)).toBeVisible();
  await expect(page.getByText(/SMTP · Verified/)).toBeVisible();
});

test('requires saving before a new or modified account can be tested', async ({
  page,
}) => {
  await openNewAccountForm(page);

  await expect(
    page.getByRole('button', { name: 'Test SMTP connection' }),
  ).toBeDisabled();
  await expect(
    page.getByText('Save this account before testing the connections.'),
  ).toBeVisible();

  await fillAccountForm(page);
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts$/);
  await page.getByRole('link', { name: 'Edit' }).click();

  const smtpTest = page.getByRole('button', {
    name: 'Test SMTP connection',
  });

  await expect(smtpTest).not.toBeDisabled();

  await page.getByLabel('Sender name').fill('Edited Sender');

  await expect(smtpTest).toBeDisabled();
  await expect(
    page.getByText('Save your changes before testing the connections.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts$/);
  await page.getByRole('link', { name: 'Edit' }).click();

  await expect(
    page.getByRole('button', { name: 'Test SMTP connection' }),
  ).not.toBeDisabled();
});

test('invalidates only the verification of the changed protocol', async ({
  page,
  request,
}) => {
  const { id } = await seedAccount(request);

  await request.post(`${API_URL}/email-accounts/${id}/test-smtp`);
  await request.post(`${API_URL}/email-accounts/${id}/test-imap`);

  await page.goto('/settings/email-accounts');
  await expect(page.getByText(/SMTP · Verified/)).toBeVisible();
  await expect(page.getByText(/IMAP · Verified/)).toBeVisible();

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('SMTP host').fill('smtp.changed.test');
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page).toHaveURL(/\/settings\/email-accounts$/);

  const row = page.locator('.product-item').first();

  await expect(row.getByText(/SMTP · Not tested/)).toBeVisible();
  await expect(row.getByText(/IMAP · Verified/)).toBeVisible();
});

test('initializes usernames from the email address without overwriting custom values', async ({
  page,
}) => {
  await openNewAccountForm(page);

  await page.getByLabel('Email address').fill('first.mailbox@example.test');

  await expect(page.getByLabel('SMTP username')).toHaveValue(
    'first.mailbox@example.test',
  );
  await expect(page.getByLabel('IMAP username')).toHaveValue(
    'first.mailbox@example.test',
  );

  await page.getByLabel('SMTP username').fill('custom-smtp-user');
  await page.getByLabel('Email address').fill('second.mailbox@example.test');

  await expect(page.getByLabel('SMTP username')).toHaveValue(
    'custom-smtp-user',
  );
  await expect(page.getByLabel('IMAP username')).toHaveValue(
    'second.mailbox@example.test',
  );
});

test('lays the form out in two columns on wide screens and stacks it on narrow screens', async ({
  page,
}) => {
  await openNewAccountForm(page);

  const smtpCard = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Outgoing mail (SMTP)' }),
  });
  const imapCard = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Incoming mail (IMAP)' }),
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(100);

  const wideSmtp = await smtpCard.boundingBox();
  const wideImap = await imapCard.boundingBox();
  const wideSender = await page.getByLabel('Sender name').boundingBox();
  const wideEmail = await page.getByLabel('Email address').boundingBox();

  expect(wideSmtp).not.toBeNull();
  expect(wideImap).not.toBeNull();
  expect(wideSender).not.toBeNull();
  expect(wideEmail).not.toBeNull();

  if (
    wideSmtp === null ||
    wideImap === null ||
    wideSender === null ||
    wideEmail === null
  ) {
    throw new Error('Expected a rendered form');
  }

  expect(wideImap.x).toBeGreaterThan(wideSmtp.x + 100);
  expect(Math.abs(wideImap.y - wideSmtp.y)).toBeLessThan(40);
  expect(wideEmail.x).toBeGreaterThan(wideSender.x + 100);
  expect(Math.abs(wideEmail.y - wideSender.y)).toBeLessThan(40);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);

  const narrowSmtp = await smtpCard.boundingBox();
  const narrowImap = await imapCard.boundingBox();

  expect(narrowSmtp).not.toBeNull();
  expect(narrowImap).not.toBeNull();

  if (narrowSmtp === null || narrowImap === null) {
    throw new Error('Expected a rendered form');
  }

  expect(narrowImap.y).toBeGreaterThan(narrowSmtp.y + 100);
  expect(Math.abs(narrowImap.x - narrowSmtp.x)).toBeLessThan(5);
});
