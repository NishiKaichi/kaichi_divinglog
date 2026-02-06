export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9faf]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function chunkText(text: string, maxChars = 1800): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [text.slice(0, maxChars)];

  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChars && current) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

