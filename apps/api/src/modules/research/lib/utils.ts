import { dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

/**
 * Local-time timestamp for dump file names: `2026-11-14-22-00-52`.
 * Sorts chronologically and keeps every run of a session side by side.
 */
export function timestampForFileName(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
}

export const resolveFileName = (fileName: string) => {
  return resolve(
    process.cwd(),
    'src',
    'modules',
    'research',
    'temp',
    `${fileName}.json`,
  );
};

/** TEMPORARY: reads back a JSON file written by this stage's debug dumps. */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

/** TEMPORARY: reads back a JSON file written by this stage's debug dumps. */
export async function writeJsonFile(
  filePath: string,
  data: object,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function getRandom(array: any, count: number) {
  const arrayCopy = [...array];

  // Fisher-Yates mixing
  for (let i = arrayCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
  }

  return arrayCopy.slice(0, count);
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');

  return slug.slice(0, 8).replace(/-$/, ''); // Pašalina brūkšnelį, jei kirpimas pataikė ant jo
}

// TODO: reikia igyvendinti placiau ir patobulinti
export const languageByCountry: Record<string, string> = {
  LT: 'Lithuanian',
  LV: 'Latvian',
  EE: 'Estonian',
  DE: 'German',
  HU: 'Hungarian',
  PL: 'Polish',
  ES: 'Spanish',
};

/**
 * ISO 639-1 codes for the search query operators (`lang:lt`). Kept next to
 * `languageByCountry` so a new market adds its language in one place: the
 * country decides the language name, the name decides the code. A language
 * missing here searches without the operator instead of failing the run.
 */
export const languageCodeByLanguage: Record<string, string> = {
  Lithuanian: 'lt',
  Latvian: 'lv',
  Estonian: 'et',
  German: 'de',
  Hungarian: 'hu',
  Polish: 'pl',
  Spanish: 'es',
};

