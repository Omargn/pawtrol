// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const {
  jsExtensions,
  tsExtensions,
  platformSubextensions,
  computeExpoExtensions,
} = require("eslint-config-expo/utils/extensions");

// eslint-config-expo's own resolver settings leave out platform-suffixed TypeScript files
// (`.native.tsx`, `.web.tsx`), so `import/no-unresolved` false-positives on platform splits.
const allExtensions = computeExpoExtensions([...jsExtensions, ...tsExtensions], platformSubextensions);

/**
 * The layer rules from docs/architecture.md, enforced instead of documented. `target` is the
 * importing file, `from` what it may not import.
 */
const layerZones = [
  {
    target: "./src/domain",
    from: ["./src/infrastructure", "./src/composition", "./src/hooks", "./src/features", "./src/app", "./src/ui"],
    message: "domain holds contracts and pure rules; it depends on nothing else in the app.",
  },
  {
    target: "./src/infrastructure",
    from: ["./src/composition", "./src/hooks", "./src/features", "./src/app", "./src/ui"],
    message: "Adapters receive their client as an argument; they don't reach up into the app.",
  },
  {
    target: ["./src/hooks", "./src/features", "./src/app", "./src/ui"],
    from: "./src/infrastructure",
    message: "Depend on the domain contract; only src/composition wires adapters.",
  },
  {
    target: ["./src/domain", "./src/infrastructure", "./src/hooks", "./src/features", "./src/app", "./src/ui"],
    from: "./src/composition/supabaseClient.ts",
    message: "Only src/composition may touch the Supabase client.",
  },
  {
    target: ["./src/app", "./src/ui"],
    from: "./src/composition",
    message: "Screens use hooks; hooks bind composition.",
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    settings: {
      "import/extensions": allExtensions,
      "import/resolver": {
        node: { extensions: allExtensions },
        typescript: { extensions: allExtensions },
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**", "src/test-utils/**"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            ...layerZones,
            {
              target: "./src",
              from: "./src/test-utils",
              message: "Fakes are for tests only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": ["error", { zones: layerZones }],
    },
  },
]);
