import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createChunkedSecureStorage, type SessionStorage } from "@/infrastructure/storage/chunkedSecureStorage";

// Expo Router's static web render runs in Node, which has no window, so
// localStorage is only touched once actually running in a browser — the
// render pass never needs a persisted session.
const webStorage: SessionStorage = {
  getItem: async (key) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: async (key, value) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

/**
 * The app's one Supabase client. Only modules in src/composition import it
 * (enforced by ESLint); everything else depends on the domain contracts.
 */
export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: Platform.OS === "web" ? webStorage : createChunkedSecureStorage(SecureStore),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
