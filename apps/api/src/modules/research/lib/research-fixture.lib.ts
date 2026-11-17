import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { CreateResearchDto } from '../dto/create-research.dto.js';
import type { IdentifiedProduct } from '../stages/01-product-identification/product-identification.schema.js';
import { identifiedProductSchema } from '../stages/01-product-identification/product-identification.schema.js';
import type { PageForAssessment } from '../types.js';

const FIXTURE_VERSION = 1;

const FIXTURE_DIR = join(
  process.cwd(),
  'src',
  'modules',
  'research',
  'stages',
  '01-product-identification',
  'temp',
);

export type IdentificationFixtureInput = Pick<
  CreateResearchDto,
  'name' | 'description' | 'country'
>;

export type IdentificationFixture = {
  input: IdentificationFixtureInput;
  targetLanguage: string;
  product: IdentifiedProduct;
  pages: PageForAssessment[];
};

type StoredIdentificationFixture = IdentificationFixture & {
  version: number;
  savedAt: string;
};

function fixtureFileName(name: string): string {
  const base = basename(name).replace(/\.json$/i, '');

  if (!/^[a-zA-Z0-9._-]+$/.test(base)) {
    throw new Error(
      `Invalid fixture name "${name}". Use letters, digits, dot, dash or underscore.`,
    );
  }

  return `${base}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function writeIdentificationFixture(
  name: string,
  fixture: IdentificationFixture,
): Promise<string> {
  const fileName = fixtureFileName(name);
  const filePath = join(FIXTURE_DIR, fileName);

  const stored: StoredIdentificationFixture = {
    version: FIXTURE_VERSION,
    savedAt: new Date().toISOString(),
    ...fixture,
  };

  await mkdir(FIXTURE_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(stored, null, 2), 'utf8');

  return filePath;
}

export async function readIdentificationFixture(
  name: string,
): Promise<IdentificationFixture> {
  const fileName = fixtureFileName(name);
  const filePath = join(FIXTURE_DIR, fileName);

  let raw: string;

  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read identification fixture ${filePath}`, {
      cause: error,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in identification fixture ${filePath}`, {
      cause: error,
    });
  }

  if (!isRecord(parsed)) {
    throw new Error(`Identification fixture ${filePath} is not a JSON object`);
  }

  if (parsed.version !== FIXTURE_VERSION) {
    throw new Error(
      `Unsupported identification fixture version in ${filePath}: ${String(parsed.version)}`,
    );
  }

  if (
    !isRecord(parsed.input) ||
    typeof parsed.input.name !== 'string' ||
    typeof parsed.input.country !== 'string' ||
    typeof parsed.targetLanguage !== 'string' ||
    !isRecord(parsed.product) ||
    !Array.isArray(parsed.pages)
  ) {
    throw new Error(`Identification fixture ${filePath} has an invalid shape`);
  }

  let product: IdentifiedProduct;

  try {
    product = identifiedProductSchema.parse(parsed.product);
  } catch (error) {
    throw new Error(
      `Identification fixture ${filePath} has an invalid product`,
      { cause: error },
    );
  }

  return {
    input: {
      name: parsed.input.name,
      description:
        typeof parsed.input.description === 'string'
          ? parsed.input.description
          : undefined,
      country: parsed.input.country,
    },
    targetLanguage: parsed.targetLanguage,
    product,
    pages: parsed.pages as PageForAssessment[],
  };
}
