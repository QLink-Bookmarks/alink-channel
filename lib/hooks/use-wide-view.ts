import * as React from "react";
import { useWindowDimensions } from "react-native";

const WIDE_VIEW_MIN_WIDTH = 769;

function subscribeToNothing() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function useIsWindowMeasured() {
  return React.useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
}

type WideViewState = {
  isResolved: boolean;
  isWideView: boolean;
};

function useWideViewState(): WideViewState {
  const { width } = useWindowDimensions();
  const isResolved = useIsWindowMeasured();

  return {
    isResolved,
    isWideView: isResolved && width >= WIDE_VIEW_MIN_WIDTH,
  };
}

function useWideView() {
  return useWideViewState().isWideView;
}

export { useWideView, useWideViewState };
