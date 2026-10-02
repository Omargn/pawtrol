import { useColorScheme } from "react-native";
import { colors, type ColorScheme } from "@/ui/theme";

/** The current scheme's colors. Follows the system setting; there is no in-app override yet. */
export function useTheme() {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: colors[scheme] };
}
