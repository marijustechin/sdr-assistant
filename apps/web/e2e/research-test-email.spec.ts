import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

/**
 * Synthetic mailbox and signature. No real credential, SMTP server or email is
 * involved: the mock API answers the test-send request.
 */
const ACCOUNT = {
  name: 'Outreach mailbox',
  senderName: 'Ema Seller',
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
  signatureName: 'Best regards,',
  signatureCompany: 'Synthetic Trading',
  signaturePhone: '+370 6000 0000',
  signatureWebsite: 'https://example.test',
  signatureWhatsapp: 'https://wa.me/37060000000',
  signatureText: 'Monday to Friday',
};

test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/__reset`);
});

async function seedAccount(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/email-accounts`, {
    data: ACCOUNT,
  });

  expect(response.ok()).toBe(true);

  const payload: unknown = await response.json();

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('id' in payload) ||
    typeof payload.id !== 'string'
  ) {
    throw new Error('The mock API did not create an email account.');
  }

  return payload.id;
}

async function assignAccount(
  request: APIRequestContext,
  researchId: string,
  emailAccountId: string,
): Promise<void> {
  const response = await request.patch(
    `${API_URL}/research/${researchId}/communication/email-account`,
    { data: { emailAccountId } },
  );

  expect(response.ok()).toBe(true);
}

async function openSettings(
  page: Page,
  researchId = 'job-profiles',
): Promise<void> {
  await page.goto(`/researches/${researchId}`);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Initial email' }),
  ).toBeVisible();
}

async function saveComposition(page: Page): Promise<void> {
  await page.getByLabel('Subject').fill('Supply partnership');
  await page
    .getByLabel('Message')
    .fill('Hello,\n\nWe would like to discuss supply.');
  await page.getByRole('button', { name: 'Save initial email' }).click();
  await expect(page.getByText('Initial email saved')).toBeVisible();
}

async function openTestEmailForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Send test email' }).click();
  await expect(page.getByLabel('Test recipient')).toBeVisible();
}

test('sends one test email to a manually entered recipient', async ({
  page,
  request,
}, testInfo) => {
  const accountId = await seedAccount(request);
  await assignAccount(request, 'job-profiles', accountId);
  await openSettings(page);
  await saveComposition(page);

  await expect(
    page.getByRole('button', { name: 'Send test email' }),
  ).toBeEnabled();
  await openTestEmailForm(page);

  await page.getByLabel('Test recipient').fill('test@example.test');
  await page.getByRole('button', { name: 'Send test', exact: true }).click();

  await expect(page.getByText('Sending test email…')).toBeVisible();
  await expect(
    page.getByText('Test email sent to test@example.test.'),
  ).toBeVisible();

  // The form remains available and the action completed exactly once.
  await expect(
    page.getByRole('button', { name: 'Send test', exact: true }),
  ).toBeEnabled();
  await expect(page.getByText(/Test email sent to/)).toHaveCount(1);

  await page.screenshot({
    path: testInfo.outputPath('sdr-010-test-email-desktop.png'),
    fullPage: true,
  });
});

test('validates the test recipient before sending', async ({
  page,
  request,
}) => {
  const accountId = await seedAccount(request);
  await assignAccount(request, 'job-profiles', accountId);
  await openSettings(page);
  await saveComposition(page);
  await openTestEmailForm(page);

  await page.getByLabel('Test recipient').fill('not-an-email');
  await page.getByRole('button', { name: 'Send test', exact: true }).click();

  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText(/Test email sent to/)).toHaveCount(0);
  await expect(page.getByText(/mail server rejected/)).toHaveCount(0);
});

test('shows definitive and uncertain SMTP failures', async ({
  page,
  request,
}) => {
  const accountId = await seedAccount(request);
  await assignAccount(request, 'job-profiles', accountId);
  await openSettings(page);
  await saveComposition(page);
  await openTestEmailForm(page);

  await page.getByLabel('Test recipient').fill('fail@example.test');
  await page.getByRole('button', { name: 'Send test', exact: true }).click();

  await expect(
    page.getByText('The mail server rejected the test message (SMTP 550).'),
  ).toBeVisible();
  await expect(
    page.getByText(/may or may not have been delivered/),
  ).toHaveCount(0);

  await page.getByLabel('Test recipient').fill('uncertain@example.test');
  await page.getByRole('button', { name: 'Send test', exact: true }).click();

  await expect(
    page.getByText(/may or may not have been delivered/),
  ).toBeVisible();
  await expect(page.getByText(/Test email sent to/)).toHaveCount(0);
});

test('requires saving the composition before sending', async ({
  page,
  request,
}) => {
  const accountId = await seedAccount(request);
  await assignAccount(request, 'job-profiles', accountId);
  await openSettings(page);

  await expect(
    page.getByRole('button', { name: 'Send test email' }),
  ).toBeDisabled();
  await expect(
    page.getByText('Save the initial email before sending a test.'),
  ).toBeVisible();

  await saveComposition(page);

  await expect(
    page.getByRole('button', { name: 'Send test email' }),
  ).toBeEnabled();
});
