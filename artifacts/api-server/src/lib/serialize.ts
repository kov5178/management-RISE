/**
 * Serialize a DB result by converting Date objects to ISO strings
 * so that Orval-generated Zod schemas (which expect string for timestamp fields) can parse them.
 */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
