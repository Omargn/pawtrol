import { useState } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "@/ui/useTheme";

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  // In state, not module scope, so a Fast Refresh or a remounted root never shares a cache across trees.
  const [queryClient] = useState(() => new QueryClient());
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...base,
          colors: { ...base.colors, background: colors.background, card: colors.surface, primary: colors.accent },
        }}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
