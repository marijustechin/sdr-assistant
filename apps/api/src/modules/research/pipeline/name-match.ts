const MIN_WORD_LENGTH = 4;
const STEM_LENGTH = 6;

/** Lowercase, diacritics removed, everything but letters and digits becomes a space. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Crude stem: the first few characters, which covers Lithuanian inflection
 * (`dailylentė` / `dailylentės` / `dailylentei` all become `dailyl`) without a
 * stemming library.
 */
function stem(word: string): string {
  return word.slice(0, Math.min(STEM_LENGTH, word.length));
}

function nameWords(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((word) => word.length >= MIN_WORD_LENGTH);
}

function textStems(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter(Boolean)
      .map((word) => stem(word)),
  );
}

/**
 * True when every word of `name` appears in `text`, in any order and in any
 * grammatical form, with other words allowed between them.
 *
 * This is the literal matching rule of the triage prompt, executed
 * deterministically instead of trusting the model to apply it.
 */
export function containsName(text: string, name: string): boolean {
  return missingNameWords(text, name).length === 0;
}

/** The words of `name` that do not appear in `text`. */
export function missingNameWords(text: string, name: string): string[] {
  const words = nameWords(name);

  if (words.length === 0) {
    return [];
  }

  const stems = textStems(text);

  return words.filter((word) => !stems.has(stem(word)));
}

/**
 * Text normalized the way the name matching compares it: lowercase, diacritics
 * removed, only letters and digits, single spaces.
 */
export function normalizeForMatch(text: string): string {
  return normalize(text);
}

/** The stems of the words of `name`, the unit `containsName` compares. */
export function nameWordStems(name: string): string[] {
  return nameWords(name).map((word) => stem(word));
}
