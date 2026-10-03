import { useState } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocationProvider } from "@/hooks/useUserLocation";
import { useTheme } from "@/ui/useTheme";

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  // In state, not module scope, so a Fast Refresh or a remounted root never shares a cache across trees.
  const [queryClient] = useState(() => new QueryClient());
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <ThemeProvider
          value={{
            ...base,
            colors: { ...base.colors, background: colors.background, card: colors.surface, primary: colors.accent },
          }}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="report/[id]" options={{ title: "", headerBackTitle: "Back" }} />
            <Stack.Screen name="chat/[id]" options={{ title: "", headerBackTitle: "Back" }} />
            <Stack.Screen name="sighting/[reportId]" options={{ title: "Add a sighting", presentation: "modal" }} />
            <Stack.Screen name="flag" options={{ title: "Report content", presentation: "modal" }} />
            <Stack.Screen name="moderation" options={{ title: "Moderation", headerBackTitle: "Back" }} />
            <Stack.Screen name="sign-in" options={{ title: "Sign in", presentation: "modal" }} />
          </Stack>
        </ThemeProvider>
      </LocationProvider>
    </QueryClientProvider>
  );
}
