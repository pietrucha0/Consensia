export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** First value of a query parameter (`?a=1&a=2` → "1"). */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
