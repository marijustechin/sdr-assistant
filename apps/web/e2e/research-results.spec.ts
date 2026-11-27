import { expect, test } from '@playwright/test';

const API_URL = 'http://127.0.0.1:4100';

test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/__reset`);
});

test('lists researches with status, result availability and honest counts', async ({
  page,
}, testInfo) => {
  await page.goto('/researches');

  await expect(page.getByRole('heading', { name: 'Researches' })).toBeVisible();

  const rows = page.locator('.research-list-item');
  await expect(rows).toHaveCount(9);

  const firstRow = rows.first();
  await expect(firstRow).toContainText('Netherlands');
  await expect(firstRow).toContainText('Company profiles available');
  await expect(firstRow).toContainText('60 company profiles · 60 offers');

  const profilesRow = rows.filter({ hasText: 'Germany' });
  await expect(profilesRow).toContainText('Company profiles available');
  await expect(profilesRow).toContainText('6 company profiles · 5 offers');
  await expect(
    profilesRow.getByText('Completed', { exact: true }),
  ).toBeVisible();

  const emptyRow = rows
    .filter({ hasText: 'Lithuania' })
    .filter({ hasText: 'Industrial Catalogue' });
  await expect(emptyRow).toContainText('Completed — no companies found');
  await expect(emptyRow).toContainText('0 company profiles · 0 offers');

  const historyRow = rows
    .filter({ hasText: 'Hungary' })
    .filter({ hasText: 'Industrial Catalogue' });
  await expect(historyRow).toContainText('Completed — profiles not persisted');
  await expect(historyRow).not.toContainText('0 company profiles');

  const unsupportedRow = rows.filter({ hasText: 'Latvia' });
  await expect(unsupportedRow).toContainText('Result unavailable');
  await expect(unsupportedRow).not.toContainText('0 company profiles');

  const failedRow = rows
    .filter({ hasText: 'Hungary' })
    .filter({ hasText: 'Thermo Abachi Cladding' });
  await expect(failedRow).toContainText('Research not completed');
  await expect(failedRow.getByText('Failed', { exact: true })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('sdr-007-research-list-desktop.png'),
    fullPage: true,
  });
});

test('searches, filters and sorts the research list locally', async ({
  page,
}) => {
  await page.goto('/researches');

  const rows = page.locator('.research-list-item');
  const count = page.getByRole('status').filter({ hasText: 'researches' });

  await expect(count).toHaveText('Showing 9 of 9 researches');

  await page.getByLabel('Search researches').fill('job-profiles');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Germany');
  await expect(count).toHaveText('Showing 1 of 9 researches');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(rows).toHaveCount(9);

  await page
    .getByLabel('Product')
    .selectOption({ label: 'Industrial Catalogue' });
  await expect(rows).toHaveCount(7);

  await page.getByLabel('Country').selectOption('Germany');
  await expect(rows).toHaveCount(1);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Result availability').selectOption('historical');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Country').selectOption('Hungary');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Hungary');
  await expect(rows.first()).toContainText('Industrial Catalogue');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Execution status').selectOption('FAILED');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Thermo Abachi Cladding');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Sort').selectOption('companies');
  await expect(rows.first()).toContainText('Netherlands');
  await page.getByLabel('Sort').selectOption('oldest');
  await expect(rows.first()).toContainText('Thermo Abachi Cladding');
});

test('shows the automatic Stage 05 running state in Contacts', async ({
  page,
}) => {
  await page.goto('/researches/job-stage05-running');
  await page.getByRole('tab', { name: /Contacts/ }).click();
  await expect(
    page.getByText('Stage 05 Contact Discovery is running…'),
  ).toBeVisible();
  await expect(page.locator('.stage05-company')).toHaveCount(0);
});

test('presents the versioned company workspace, offers, prices and contacts', async ({
  page,
}, testInfo) => {
  await page.goto('/researches/job-profiles');

  await expect(
    page.getByRole('heading', { name: 'Industrial Catalogue' }),
  ).toBeVisible();
  await expect(page.locator('.research-header')).toContainText('Germany');
  await expect(page.getByText('Research completed.')).toBeVisible();

  const metric = (label: string) =>
    page.locator('.metric').filter({ hasText: label });

  await expect(metric('Company profiles').locator('.metric-value')).toHaveText(
    '6',
  );
  await expect(metric('Product offers').locator('.metric-value')).toHaveText(
    '5',
  );
  await expect(
    metric('Companies with email').locator('.metric-value'),
  ).toHaveText('2');
  await expect(
    metric('Companies with phone').locator('.metric-value'),
  ).toHaveText('2');

  const companiesTab = page.getByRole('tab', { name: /Companies/ });
  await expect(companiesTab).toHaveAttribute('aria-selected', 'true');
  await expect(companiesTab).toContainText('6');
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();

  const cards = page.locator('.company-card');
  await expect(cards).toHaveCount(6);
  await expect(page.getByText('Showing 1–6 of 6 companies')).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('sdr-007-research-companies-desktop.png'),
    fullPage: true,
  });

  await page.getByLabel('Search companies').fill('Alpha');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Showing 1–1 of 1 companies')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByLabel('Profiling status').selectOption('needs_review');
  await expect(cards).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByLabel('Email availability').selectOption('has');
  await expect(cards).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByLabel('Phone availability').selectOption('has');
  await expect(cards).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByLabel('Sort companies').selectOption('offers');
  await expect(cards.first()).toContainText('Alpha Sauna OÜ');

  const alpha = cards.filter({ hasText: 'Alpha Sauna OÜ' });
  const alphaChevron = alpha.locator('.company-chevron');
  await expect(alphaChevron).toBeVisible();
  await expect(alphaChevron).toHaveCSS('transform', 'none');
  await alpha.locator('.company-summary').click();
  await expect(alpha).toHaveJSProperty('open', true);
  await expect(alphaChevron).not.toHaveCSS('transform', 'none');

  await expect(alpha.getByText('Registration number')).toBeVisible();
  await expect(alpha.getByText('VAT number')).toBeVisible();
  await expect(alpha.getByText('Synthetic 1')).toBeVisible();
  await expect(alpha.getByText('Tallinn')).toBeVisible();
  await expect(alpha.getByText('Estonia', { exact: true })).toBeVisible();
  await expect(alpha.getByText('sales@alpha-sauna.test')).toBeVisible();
  await expect(alpha.getByText('+372 6000 0001')).toBeVisible();
  await expect(
    alpha.getByText('From 1,250 EUR/m² · incl. VAT · Bench A'),
  ).toBeVisible();
  await expect(
    alpha.getByText('medienos_rusis', { exact: true }),
  ).toBeVisible();
  await expect(alpha.getByText('apdorojimas', { exact: true })).toBeVisible();
  await expect(
    alpha.locator('a[href="https://alpha-sauna.test/bench"]').first(),
  ).toBeVisible();

  const beta = cards.filter({ hasText: 'beta-wood.test' });
  await beta.locator('.company-summary').click();
  await expect(beta.locator('.company-name')).toHaveText('beta-wood.test');
  await expect(beta.getByText('No published price.')).toBeVisible();

  const gamma = cards.filter({ hasText: 'Gamma Heat GmbH' });
  await gamma.locator('.company-summary').click();
  await expect(
    gamma.getByText('0 EUR/pc · excl. VAT', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(
    gamma.getByText('Source link unavailable').first(),
  ).toBeVisible();

  await page.getByRole('tab', { name: /Contacts/ }).click();
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Contacts/ })).toContainText('3');

  const totals = page.locator('.contact-totals dd');
  await expect(totals.nth(0)).toHaveText('3');
  await expect(totals.nth(1)).toHaveText('4');
  await expect(totals.nth(2)).toHaveText('1');
  await expect(page.locator('.stage05-company')).toHaveCount(3);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('sdr-007-research-contacts-desktop.png'),
    fullPage: true,
  });
  await expect(
    page.getByText('Partner / distributor contacts').first(),
  ).toBeHidden();

  await page.getByLabel('Search contacts').fill('gamma');
  await expect(page.locator('.stage05-company')).toHaveCount(1);
  await page.getByLabel('Search contacts').fill('');

  const alphaContacts = page
    .locator('.stage05-company')
    .filter({ hasText: 'Alpha Sauna OÜ' });
  await expect(alphaContacts.getByText('sales@alpha-sauna.test')).toBeVisible();
  await expect(alphaContacts.getByText('info@alpha-sauna.test')).toBeVisible();
  await alphaContacts.locator('summary').click();
  await expect(
    alphaContacts.getByText('Partner / distributor contacts'),
  ).toBeVisible();
  await expect(
    alphaContacts.getByText('partner@distributor.test'),
  ).toBeVisible();
  await expect(alphaContacts.getByText('+372 6000 0001')).toBeVisible();
  await expect(
    alphaContacts.getByText('Synthetic 1, Tallinn, Estonia'),
  ).toBeVisible();

  await page.getByRole('button', { name: /Excluded companies/ }).click();
  await expect(page.locator('.stage05-excluded-list .contact-row')).toHaveCount(
    1,
  );
  await expect(page.getByText('No usable company email found')).toBeVisible();
  await page.getByRole('button', { name: /Retained companies/ }).click();

  const communicationTab = page.getByRole('tab', { name: /Communication/ });
  await expect(communicationTab).toContainText('3');
  await expect(communicationTab).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.research-tab.planned')).toHaveCount(0);

  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.stage05-company')).toHaveCount(3);
});

test('presents the market table with prices, filters, evidence and safe links', async ({
  page,
}, testInfo) => {
  await page.goto('/researches/job-profiles');
  await expect(page.getByRole('tab', { name: /Contacts/ })).toContainText('3');

  const tabLabels = await page.getByRole('tab').allTextContents();
  expect(tabLabels).toEqual([
    'Overview',
    'Companies 6',
    'Market 5',
    'Contacts 3',
    'Communication 3',
    'Settings',
  ]);

  await page.getByRole('tab', { name: /Market/ }).click();
  await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();

  const marketMetric = (label: string) =>
    page.locator('.market-metric-grid .metric').filter({ hasText: label });

  await expect(
    marketMetric('Total discovered offers').locator('.metric-value'),
  ).toHaveText('5');
  await expect(
    marketMetric('Offers with structured prices').locator('.metric-value'),
  ).toHaveText('3');
  await expect(
    marketMetric('Companies with structured prices').locator('.metric-value'),
  ).toHaveText('3');

  const rows = page.locator('.market-table tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(
    page.getByText(
      'Showing 1–4 of 4 rows · 3 of 5 offers with structured prices',
    ),
  ).toBeVisible();

  await expect(
    page.getByRole('columnheader', { name: 'Company' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Price' })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Currency' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Unit' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'VAT' })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Source' }),
  ).toBeVisible();

  await expect(
    rows.filter({ hasText: 'Alpha Sauna OÜ' }).locator('.market-price'),
  ).toHaveText(['From 1,250', '1,490']);
  await expect(
    rows.filter({ hasText: 'Gamma Heat GmbH' }).locator('.market-price'),
  ).toHaveText('0');
  await expect(
    rows.filter({ hasText: 'Delta Klamp' }).locator('.market-price'),
  ).toHaveText('89');

  const compactSource = page
    .locator('.market-table a[href="https://alpha-sauna.test/bench"]')
    .first();
  await expect(compactSource).toHaveText('alpha-sauna.test');
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath('sdr-007-research-market-desktop.png'),
    fullPage: true,
  });

  await page.getByLabel('Search market').fill('Alpha');
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(rows).toHaveCount(4);

  await page.getByLabel('Price availability').selectOption('all');
  await expect(rows).toHaveCount(6);
  await expect(page.locator('.market-unavailable')).toHaveCount(2);
  await expect(
    page.getByText(
      'Showing 1–6 of 6 rows · 3 of 5 offers with structured prices',
    ),
  ).toBeVisible();

  const betaRow = rows.filter({ hasText: 'beta-wood.test' });
  await betaRow.locator('summary').click();
  await expect(
    betaRow.getByText('Synthetic historical market note.'),
  ).toBeVisible();
  await betaRow.locator('summary').click();

  await page.getByLabel('Price availability').selectOption('priced');
  await page.getByLabel('Product match').selectOption('a');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Product match').selectOption('b');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Product match').selectOption('all');

  await page.getByLabel('Currency').selectOption('USD');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Delta Klamp');
  await page.getByLabel('Currency').selectOption('all');

  await page.getByLabel('Unit').selectOption('pc');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Currency').selectOption('EUR');
  await page.getByLabel('Unit').selectOption('pc');

  await page.getByLabel('Sort market').selectOption('price-asc');
  await expect(rows.locator('.market-price')).toHaveText(['0', '1,490']);
  await page.getByLabel('Sort market').selectOption('price-desc');
  await expect(rows.locator('.market-price')).toHaveText(['1,490', '0']);
});

test('shows an honest Market empty state when only textual price evidence exists', async ({
  page,
}) => {
  await page.goto('/researches/job-malformed');
  await page.getByRole('tab', { name: /Market/ }).click();

  const marketMetric = (label: string) =>
    page.locator('.market-metric-grid .metric').filter({ hasText: label });

  await expect(
    marketMetric('Total discovered offers').locator('.metric-value'),
  ).toHaveText('1');
  await expect(
    marketMetric('Offers with structured prices').locator('.metric-value'),
  ).toHaveText('0');
  await expect(
    page.getByText('No structured prices were found for this research.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Show all offers' }).click();
  await expect(page.locator('.market-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.market-unavailable')).toHaveText('Not published');

  await page.locator('.market-table tbody tr summary').click();
  await expect(
    page.getByText('No additional textual evidence recorded.'),
  ).toBeVisible();
});

test('paginates Market rows when all unpriced offers are shown', async ({
  page,
}) => {
  await page.goto('/researches/job-many');
  await page.getByRole('tab', { name: /Market/ }).click();

  await expect(
    page.getByText('No structured prices were found for this research.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Show all offers' }).click();

  const rows = page.locator('.market-table tbody tr');
  await expect(rows).toHaveCount(20);
  await expect(
    page.getByText(
      'Showing 1–20 of 60 rows · 0 of 60 offers with structured prices',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 3 of 3')).toBeVisible();
  await expect(
    page.getByText(
      'Showing 41–60 of 60 rows · 0 of 60 offers with structured prices',
    ),
  ).toBeVisible();
});

test('distinguishes empty, historical, unsupported, null and partially unreadable results', async ({
  page,
}) => {
  await page.goto('/researches/job-empty');
  await expect(page.getByText('Research completed.')).toBeVisible();
  await expect(
    page.getByText(
      'The research completed and found no companies. This is a valid empty result, not a missing result.',
    ),
  ).toBeVisible();
  await expect(
    page
      .locator('.metric')
      .filter({ hasText: 'Company profiles' })
      .locator('.metric-value'),
  ).toHaveText('0');

  await page.getByRole('tab', { name: /Market/ }).click();
  await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();
  await expect(
    page.getByText('No product offers were recorded for this research.'),
  ).toBeVisible();
  await expect(page.locator('.market-metric-grid .metric-value')).toHaveText([
    '0',
    '0',
    '0',
  ]);

  await page.goto('/researches/job-history');
  await expect(
    page.getByText(
      'This research completed without persisted company profiles. Its stored completion label is “02-page-collection”.',
    ),
  ).toBeVisible();
  await expect(page.locator('.metric-note')).toHaveCount(4);
  await expect(page.getByText('02-page-collection').first()).toBeVisible();
  await page.getByRole('tab', { name: /Companies/ }).click();
  await expect(
    page.getByText(/without persisted company profiles/).first(),
  ).toBeVisible();
  await page.getByRole('tab', { name: /Market/ }).click();
  await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();
  await expect(
    page.getByText(/without persisted company profiles/).first(),
  ).toBeVisible();

  await page.goto('/researches/job-unsupported');
  await expect(
    page.getByText('The stored result uses an unrecognized format.'),
  ).toBeVisible();
  await expect(page.locator('.metric-note')).toHaveCount(4);

  await page.goto('/researches/job-null-result');
  await expect(
    page.getByText('No result was stored for this completed research.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(0);
  await expect(page.locator('.metric-note')).toHaveCount(4);

  await page.goto('/researches/job-malformed');
  await expect(
    page.getByText('2 company profiles could not be read and are not shown.'),
  ).toBeVisible();
  await expect(page.locator('.company-card')).toHaveCount(1);
  await expect(
    page
      .locator('.metric')
      .filter({ hasText: 'Company profiles' })
      .locator('.metric-value'),
  ).toHaveText('1');
});

test('paginates a large result set and does not truncate long evidence', async ({
  page,
}) => {
  await page.goto('/researches/job-many');

  await expect(page.getByText('Showing 1–20 of 60 companies')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 3 of 3')).toBeVisible();
  await expect(page.getByText('Showing 41–60 of 60 companies')).toBeVisible();

  await page.getByLabel('Search companies').fill('Synthetic Company 60');
  await expect(page.locator('.company-card')).toHaveCount(1);
  await page.locator('.company-card .company-summary').first().click();
  await page.locator('.company-card .offer-evidence summary').first().click();

  const quote = page
    .locator('.company-card .market-note .evidence-quote')
    .first();
  await expect(quote).toBeVisible();
  const length = await quote.evaluate(
    (element) => (element.textContent ?? '').length,
  );
  expect(length).toBeGreaterThan(20_000);
  await expect(page.getByText('truncated')).toHaveCount(0);
});

test('resumes a failed research and keeps polling', async ({ page }) => {
  await page.goto('/products/p-abachi');
  await page.getByLabel('Country').selectOption('HU');
  await page.getByRole('button', { name: 'Start research' }).click();

  await expect(page).toHaveURL(/\/researches\/job-fails-run$/);
  await expect(page.getByText('Research failed.')).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('button', { name: 'Resume research' }).click();

  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByText('Research resumed')).toBeVisible();
  await expect(page.getByText('Research is running…')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText('Research failed.')).toBeVisible({
    timeout: 15_000,
  });
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the workspace usable on a narrow screen', async ({
    page,
  }, testInfo) => {
    await page.goto('/researches/job-profiles');

    await expect(
      page.getByRole('heading', { name: 'Industrial Catalogue' }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: /Companies/ })).toBeVisible();
    await expect(page.getByLabel('Search companies')).toBeVisible();

    await page.locator('.company-card .company-summary').first().click();
    await expect(page.locator('.company-card[open]')).toHaveCount(1);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.getByRole('tab', { name: /Market/ }).click();
    await expect(page.getByRole('heading', { name: 'Market' })).toBeVisible();
    await expect(page.getByLabel('Search market')).toBeVisible();
    const marketOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(marketOverflow).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath('sdr-007-research-market-mobile.png'),
      fullPage: true,
    });

    await page.getByRole('tab', { name: /Contacts/ }).click();
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('sdr-007-research-contacts-mobile.png'),
      fullPage: true,
    });
  });
});
