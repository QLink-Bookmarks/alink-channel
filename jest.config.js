const ignoredPaths = [
  "<rootDir>/tests/e2e/",
  "<rootDir>/e2e/",
  "<rootDir>/storybook-static/",
  "<rootDir>/dist/",
];

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Unit tests are colocated `*.test.ts(x)` files. Playwright specs use `*.spec.ts`.
  testMatch: ["**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", ...ignoredPaths],
  modulePathIgnorePatterns: ignoredPaths,
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|nativewind|@rn-primitives|lucide-react-native))",
    "/node_modules/react-native-reanimated/plugin/",
  ],
};
