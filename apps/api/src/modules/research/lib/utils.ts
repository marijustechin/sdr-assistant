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
