import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

const SYNTHETIC_BYTES = Buffer.from('synthetic price list bytes');

/**
 * Synthetic mailbox configuration and signature. No real credential, mailbox or
 * contact is used; every value is invented test data.
 */
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
  emailAccountId: string,
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
    page.getByRole('heading', { level: 2, name: 'Initial email' }),
  ).toBeVisible();
}

test('signature settings persist and appear in the research email preview', async ({
  page,
  request,
}, testInfo) => {
  const account = await seedAccount(request);

  // Signature is edited on the global email account, not on the research.
  await page.goto(`/settings/email-accounts/${account.id}/edit`);

  await page.getByLabel('Closing greeting').fill('Best regards,');
  await page.getByLabel('Company name').fill('Synthetic Trading');
  await page.getByLabel('Telephone number').fill('+370 6000 0000');
  await page.getByLabel('Website link').fill('https://example.test');
  await page.getByLabel('WhatsApp link').fill('https://wa.me/37060000000');
  await page.getByLabel('Additional signature text').fill('Monday to Friday');

  await page.getByRole('button', { name: 'Save account' }).click();
  await page.waitForURL('**/settings/email-accounts');
  await expect(page.getByText('Email account updated')).toBeVisible();

  // A full navigation reads the persisted signature back from the API.
  await page.goto(`/settings/email-accounts/${account.id}/edit`);
  await expect(page.getByLabel('Closing greeting')).toHaveValue(
    'Best regards,',
  );
  await expect(page.getByLabel('Company name')).toHaveValue(
    'Synthetic Trading',
  );
  await expect(page.getByLabel('Telephone number')).toHaveValue(
    '+370 6000 0000',
  );
  await expect(page.getByLabel('Website link')).toHaveValue(
    'https://example.test',
  );
  await expect(page.getByLabel('WhatsApp link')).toHaveValue(
    'https://wa.me/37060000000',
  );
  await expect(page.getByLabel('Additional signature text')).toHaveValue(
    'Monday to Friday',
  );

  await assignViaApi(request, 'job-profiles', account.id);
  await openSettings(page, 'job-profiles');

  await page.getByLabel('Subject').fill('Supply partnership');
  await page
    .getByLabel('Message')
    .fill('Hello,\n\nWe would like to discuss supply.');
  await page.getByRole('button', { name: 'Save initial email' }).click();
  await expect(page.getByText('Initial email saved')).toBeVisible();

  const panel = page.getByRole('tabpanel');

  await expect(
    panel.getByRole('heading', { level: 3, name: 'Signature' }),
  ).toBeVisible();
  await expect(
    panel.getByRole('heading', { level: 3, name: 'Preview' }),
  ).toBeVisible();

  // The signature is shown alone and inside the complete email preview.
  await expect(panel.getByText('Best regards,')).toHaveCount(2);
  await expect(panel.getByText('Sales Team')).toHaveCount(2);
  await expect(panel.getByText('Synthetic Trading')).toHaveCount(2);
  await expect(panel.getByText('+370 6000 0000')).toHaveCount(2);
  await expect(panel.getByText('Monday to Friday')).toHaveCount(2);

  // Both blocks use the approved order: closing greeting (from signatureName),
  // sender name (the account's existing senderName), company, telephone,
  // website, WhatsApp and additional text last.
  const signatureBlocks = panel.locator('.email-signature');

  await expect(signatureBlocks).toHaveCount(2);

  for (let index = 0; index < 2; index += 1) {
    const text = await signatureBlocks.nth(index).innerText();
    const positions = [
      'Best regards,',
      'Sales Team',
      'Synthetic Trading',
      '+370 6000 0000',
      'https://example.test',
      'https://wa.me/37060000000',
      'Monday to Friday',
    ].map((value) => text.indexOf(value));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(
      positions,
    );
  }

  const websiteLinks = panel.getByRole('link', {
    name: 'https://example.test',
  });
  await expect(websiteLinks).toHaveCount(2);
  await expect(websiteLinks.first()).toHaveAttribute(
    'href',
    'https://example.test/',
  );

  const whatsappLinks = panel.getByRole('link', {
    name: 'https://wa.me/37060000000',
  });
  await expect(whatsappLinks).toHaveCount(2);
  await expect(whatsappLinks.first()).toHaveAttribute(
    'href',
    'https://wa.me/37060000000',
  );

  // The complete preview carries the subject and the owner-authored message.
  const preview = panel.locator('.email-preview');

  await expect(preview.getByText('Supply partnership')).toBeVisible();
  await expect(
    preview.getByText(/We would like to discuss supply/),
  ).toBeVisible();

  // Sending exists only as an explicit single test send; there is no automatic,
  // bulk or campaign control on this screen.
  await expect(
    panel.getByRole('button', { name: 'Send test email' }),
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: /send all|campaign|start outreach/i }),
  ).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath('sdr-010-signature-preview-desktop.png'),
    fullPage: true,
  });
});

test('adds, lists, previews and removes research attachments', async ({
  page,
}, testInfo) => {
  await openSettings(page, 'job-profiles');

  await page.getByLabel('Attachment file').setInputFiles({
    name: 'price-list.pdf',
    mimeType: 'application/pdf',
    buffer: SYNTHETIC_BYTES,
  });
  await page.getByRole('button', { name: 'Upload attachment' }).click();

  await expect(page.getByText('Attachment uploaded')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove price-list.pdf' }),
  ).toBeVisible();
  await expect(page.getByText('Attachments (1)')).toBeVisible();

  const firstRow = page
    .locator('.attachment-row')
    .filter({ hasText: 'price-list.pdf' })
    .first();
  await expect(firstRow).toContainText(`${SYNTHETIC_BYTES.length} B`);

  await page.getByLabel('Attachment file').setInputFiles({
    name: 'company-profile.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('second synthetic attachment'),
  });
  await page.getByRole('button', { name: 'Upload attachment' }).click();

  await expect(
    page.getByRole('button', { name: 'Remove company-profile.pdf' }),
  ).toBeVisible();
  await expect(page.getByText('Attachments (2)')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('sdr-010-attachments-desktop.png'),
    fullPage: true,
  });

  // A full reload reads the persisted attachment metadata back.
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(
    page.getByRole('button', { name: 'Remove price-list.pdf' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove company-profile.pdf' }),
  ).toBeVisible();
  await expect(page.getByText('Attachments (2)')).toBeVisible();

  await page.getByRole('button', { name: 'Remove price-list.pdf' }).click();
  await expect(page.getByText('Attachment removed')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove price-list.pdf' }),
  ).toHaveCount(0);
  await expect(page.getByText('Attachments (1)')).toBeVisible();

  // The removal survives another full reload.
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();

  await expect(
    page.getByRole('button', { name: 'Remove company-profile.pdf' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove price-list.pdf' }),
  ).toHaveCount(0);
  await expect(page.getByText('Attachments (1)')).toBeVisible();
});

test('refuses an attachment above the configured per-file limit', async ({
  page,
}) => {
  await openSettings(page, 'job-profiles');

  await page.getByLabel('Attachment file').setInputFiles({
    name: 'too-large.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await page.getByRole('button', { name: 'Upload attachment' }).click();

  await expect(page.getByText('The attachment was not uploaded')).toBeVisible();
  await expect(
    page.getByText('Each attachment must be at most 10.0 MB.'),
  ).toBeVisible();
  await expect(page.getByText('Attachments (0)')).toBeVisible();
  await expect(page.getByText('No attachments yet.')).toBeVisible();
});
