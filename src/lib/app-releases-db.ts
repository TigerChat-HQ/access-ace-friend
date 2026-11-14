export type ReleaseDbResult<T> = { data: T | null; error: { message: string } | null };
export type ReleaseDbQuery<T> = PromiseLike<ReleaseDbResult<T>> & {
  eq: (column: string, value: unknown) => ReleaseDbQuery<T>;
  in: (column: string, values: readonly unknown[]) => ReleaseDbQuery<T>;
  order: (column: string, options: { ascending: boolean }) => ReleaseDbQuery<T>;
  limit: (count: number) => ReleaseDbQuery<T>;
  maybeSingle: () => Promise<ReleaseDbResult<T>>;
};
export type ReleaseDbTable = {
  select: (columns: string) => ReleaseDbQuery<unknown[]>;
  insert: (values: Record<string, unknown>) => Promise<ReleaseDbResult<unknown>>;
};
export const appReleasesTable = () =>
  (undefined as unknown as { from: (table: string) => ReleaseDbTable }).from("app_releases");
