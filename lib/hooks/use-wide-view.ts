import * as React from "react";
import { useWindowDimensions } from "react-native";

const WIDE_VIEW_MIN_WIDTH = 769;

function useWideView() {
  const { width } = useWindowDimensions();
  const isWeb = process.env.EXPO_OS === "web";
  const [hasMounted, setHasMounted] = React.useState(!isWeb);

  React.useEffect(() => {
    if (!isWeb) {
      return;
    }

    setHasMounted(true);
  }, [isWeb]);

  return hasMounted && width >= WIDE_VIEW_MIN_WIDTH;
}

export { useWideView };
