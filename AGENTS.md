# AGENTS.md

## Package Manager

- Use Bun for all package and script commands.
- Always prefer `bun install`, `bun start`, `bun storybook`, and `bun storybook:web`.
- Do not add Yarn or npm lockfiles.

## Project Structure

- `app/` contains Expo Router routes and route layouts. Keep route files thin.
- `components/ui/` contains shared UI primitives.
- Domain-specific code belongs in `features/{domain}/`.
- Feature folders may contain `api.ts`, `queries.ts`, `mutations.ts`, `hooks/`, `components/`, and `types.ts`.
- Shared utilities belong in `lib/`.
- App-level providers belong in `providers/`.
- Global client state belongs in `stores/`.
- Use a feature-based structure rather than full Atomic Design folders.

## Expo and React Native

- Prefer Expo and React Native best practices already used in this repo.
- Use platform-specific files such as `.web.tsx`, `.ios.tsx`, or `.android.tsx` for substantial platform-specific behavior under the `features/`.
- `Platform.select()` is not preferred, but acceptable for common components under `components/ui/`.
- Avoid adding native modules unless they are Expo-compatible and necessary.
- Keep route files focused on navigation and screen composition; move business logic into features and hooks.

## Library Preferences

- Never use modules removed from React Native such as Picker, WebView, SafeAreaView, or AsyncStorage (use SecureStore instead)
- Never use legacy expo-permissions
- `expo-audio` not `expo-av`
- `expo-video` not `expo-av`
- `expo-image` with `source="sf:name"` for SF Symbols, not `expo-symbols` or `@expo/vector-icons`
- `react-native-safe-area-context` not react-native SafeAreaView
- `process.env.EXPO_OS` not `Platform.OS`
- `React.use` not `React.useContext`
- `expo-image` Image component instead of intrinsic element `img`
- `expo-glass-effect` for liquid glass backdrops

## Components

- Always prefer `components/ui` components over raw React Native primitives for shared UI. For example, use `components/ui/text` before `react-native` `Text`.
- Use NativeWind `className` for styling and shadcn-style token management.
- React Native elements used directly must include a `className` unless the element cannot accept one.
- Use theme tokens such as `bg-primary`, `text-foreground`, `border-border`, and `text-muted-foreground` instead of hard-coded colors.
- Add or update Storybook stories when shared UI behavior changes.

## Behavior

- Use `<ScrollView contentInsetAdjustmentBehavior="automatic" />` instead of `<SafeAreaView>` for smarter safe area insets
- `contentInsetAdjustmentBehavior="automatic"` should be applied to FlatList and SectionList as well
- Use flexbox instead of Dimensions API
- ALWAYS prefer `useWindowDimensions` over `Dimensions.get()` to measure screen size
- Always wrap root component in a scroll view for responsiveness for Screens (under `app/`)
- When a route belongs to a `Stack`, its first child should almost always be a `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` set
- When adding a `ScrollView` to the page it should almost always be the first component inside the route component
- Never use intrinsic elements like 'img' or 'div' unless in a webview or Expo DOM component

## Styling

- Prefer `gap` for spacing between sibling elements.
- Prefer container padding over child margins where possible.
- Always account for safe area, either with stack headers, tabs, or ScrollView/FlatList `contentInsetAdjustmentBehavior="automatic"`
- Ensure both top and bottom safe area insets are accounted for
- Do not use `StyleSheet` for new code.

## Icons and Storybook

- Use `lucide-react-native` carefully because Vite Storybook can break on some imports.
- In `.stories.tsx` files, always import Lucide icons from `lucide-react-native/icons`.
- If a component itself must change icon imports for Storybook Vite, gate that path with:

```ts
const isStorybookVite = typeof process !== "undefined" && process.env.STORYBOOK_VITE === "true";
```

- `bun storybook` runs Expo/Metro-based Storybook.
- `bun storybook:web` runs Vite-based Storybook.
- Vite-only errors should be handled with a targeted `isStorybookVite` branch.

## Testing and Captures

- Use Playwright as the primary automated test tool for web user flows. Derive durable behavior tests for new or changed flows from the confirmed Test Criteria and keep them in `tests/e2e/` with `playwright.config.ts` tracked in Git. Do not backfill unrelated existing features solely to add coverage.
- Use Jest for unit tests of pure logic, hooks, and shared components. Keep tests colocated as `*.test.ts` or `*.test.tsx` next to the code, and add or update them for new or changed pure logic. Playwright stays the tool for user flows.
- Run unit tests with `bun run test:unit`. Do not use `bun test`; it runs Bun's own test runner instead of Jest.
- NativeWind classes are not compiled to styles under Jest. Assert text, roles, and behavior in component tests, not styles.
- Run durable web tests with `bun test:e2e`; Playwright starts the Expo web server through `bun web` with `EXPO_WEB_DEV_HYDRATE=1`, so pages hydrate like the static export, and reuses any server already on port 8081 (`reuseExistingServer`), so stop a plain `bun web` there first. Assert observable behavior after user actions; a screenshot alone does not establish that a Test Criterion passed.
- Make loading, empty, error, and retry cases repeatable with controlled API responses. Also exercise the real server for server-dependent success paths when relevant.
- Test web wide and web mobile for affected flows. When a responsive breakpoint changes, check both `768px` and `769px` viewport widths.
- For each UI change, inspect and capture the affected screens on web wide, web mobile, and iOS when those platforms are in scope. Verify relevant iOS interactions in a simulator; Playwright browser tests do not verify native iOS behavior.
- Keep one-off Playwright scripts for detailed UI inspection or screenshots, and their captures, under ignored `e2e/`, `.playwright-cli/`, or `output/`. Do not commit screenshot-only scripts or visual snapshot baselines as durable tests.
- Report test results and capture filenames in the PR, following the issue workflow's image handling rules. Mark only Test Criteria that were actually verified as passed.

## Hooks and API

- Use custom hooks for reusable stateful logic.
- Use React Query custom hooks for server state.
- Name query hooks `use{Domain}Query` or `use{DomainPlural}Query`.
- Name mutation hooks `use{Action}{Domain}Mutation`.
- Keep query keys in the owning feature, usually `features/{domain}/queries.ts`.
- Use `lib/api-client.ts` only as the shared HTTP client.
- Put endpoint-specific service functions in `features/{domain}/api.ts`.
- Query and mutation hooks should call feature API functions, not raw axios directly.
- Pass `authToken` per request when Authorization is needed.
- Cookies are not used by default; do not enable `withCredentials` unless a specific endpoint requires it.

## Code Style

- Be cautious of unterminated strings. Ensure nested backticks are escaped; never forget to escape quotes correctly.
- Use kebab-case for file names, for example `channel-card.tsx`.
- Use PascalCase for React components.
- Use camelCase for functions and variables.
- Event handler implementations should use `handle` prefixes, such as `handlePress`.
- Event handler props should use `on` prefixes, such as `onPress`.
- Non-event functions should use descriptive camelCase names.
- Use `use`-prefixed camelCase names for hooks.
- Keep exported types explicit and colocated with the feature that owns them.
- Always remove old route files when moving or restructuring navigation
- Never use special characters in file names

## Animation Practices

- Add entering and exiting animations when animations required for state changes
- Use layout animations when items are added/removed from lists
- Use `useAnimatedStyle` for scroll-driven animations
- Prefer `interpolate` with "clamp" for bounded values
- You can't pass PlatformColors to reanimated views or styles; use static colors instead
- Keep animations under 300ms for responsive feel
- Use spring animations for natural movement
- Avoid animating layout properties (width, height) when possible — prefer transforms

## API Server Connection

- Regardless of the BASE_URL in the env var, check `http://localhost:8080/openapi` for API info.
- If local server is not alive, check `https://dev.api.archivelink.app/openapi`.

## References

Consult these resources as needed:

```
references/
  rhf-zod-form-guide.md  Form control guide
  route-structure.md     Route conventions, dynamic routes, groups, folder organization
  search.md              Search bar with headers, useSearch hook, filtering patterns
  visual-effects.md      Blur (expo-blur) and liquid glass (expo-glass-effect)
```
