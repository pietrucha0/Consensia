/**
 * Escapes LIKE/ILIKE wildcards so user input is matched literally.
 * Prisma's `contains` wraps the value in `%…%` but does not escape `%`, `_` or `\` inside it,
 * so a search for "%" would otherwise match every row.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
