/**
 * First complete JSON object in a model answer; trailing text is ignored.
 *
 * Shared by every stage that asks a model for one JSON object, so the parsing
 * rule (and its tolerance for prose after the object) cannot drift between
 * stages.
 */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{');

  if (start === -1) {
    throw new Error('No JSON object in the answer');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error('Unterminated JSON object in the answer');
}
