import { useSafeAreaInsets } from "react-native-safe-area-context";

function useWideShellInsets() {
  const { top, bottom } = useSafeAreaInsets();
  return { top, bottom };
}

export { useWideShellInsets };
