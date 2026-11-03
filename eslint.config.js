const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  globalIgnores([
    ".expo/**",
    ".storybook-static/**",
    "storybook-static/**",
    "**/storybook.requires.ts",
    "docs/**",
    ".playwright-cli/**",
    ".agents/skills/impeccable/**",
    ".claude/skills/impeccable/**",
    "build/**",
    "coverage/**",
    "dist/**",
    "node_modules/**",
    "output/**",
    "web-build/**",
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: [
      "*.config.js",
      "*.config.cjs",
      "babel.config.js",
      "metro.config.js",
      "postcss.config.js",
      "tailwind.config.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
