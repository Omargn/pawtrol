/** Mimics the Supabase query builder: every chain method returns itself, and the chain resolves like a promise once awaited. */
export function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  for (const method of ["select", "order", "eq", "gt", "lt", "limit", "insert", "in", "is"]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled: any, onRejected: any) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}
