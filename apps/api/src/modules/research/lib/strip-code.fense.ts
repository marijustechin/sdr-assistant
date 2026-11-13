export function stripCodeFence(raw: string): string {
  let content = raw.trim();

  if (content.startsWith('```')) {
    content = content.slice(3);

    if (content.toLowerCase().startsWith('json')) {
      content = content.slice(4);
    }

    content = content.trimStart();
  }

  if (content.endsWith('```')) {
    content = content.slice(0, -3);
  }

  return content.trim();
}
