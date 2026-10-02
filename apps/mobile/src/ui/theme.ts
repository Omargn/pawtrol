/**
 * Design tokens: the only place raw colors and sizes are written. Components
 * read them through `useTheme()` so light and dark stay in step.
 *
 * `lost` and `found` are domain colors, not decoration: every surface that
 * shows a report uses them for its kind, so they must stay distinguishable
 * from each other and from `danger` in both schemes (and never be the only
 * signal — pair them with a label or icon).
 */
const palette = {
  light: {
    background: "#FFF9F3",
    surface: "#FFFFFF",
    surfaceMuted: "#F6EDE3",
    border: "#E8DCCF",
    text: "#1F1712",
    textSecondary: "#6E6157",
    accent: "#D9622B",
    onAccent: "#FFFFFF",
    lost: "#C9372C",
    found: "#2F7D4F",
    danger: "#B3261E",
  },
  dark: {
    background: "#17120E",
    surface: "#221B16",
    surfaceMuted: "#2D251F",
    border: "#3D332B",
    text: "#F7EFE7",
    textSecondary: "#B8AA9E",
    accent: "#F08A55",
    onAccent: "#1F1712",
    lost: "#F2766B",
    found: "#6BC793",
    danger: "#FF8A80",
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type ThemeColors = { [K in keyof (typeof palette)["light"]]: string };

export const colors: Record<ColorScheme, ThemeColors> = palette;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const typography = {
  title: { fontSize: 28, fontWeight: "700", lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: "600", lineHeight: 26 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
} as const;

