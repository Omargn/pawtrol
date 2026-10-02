import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Wraps a renderHook() call with an isolated, retry-free QueryClient (or your own, to inspect its cache) for testing react-query hooks. */
export function createQueryWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }),
) {
  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return QueryWrapper;
}
