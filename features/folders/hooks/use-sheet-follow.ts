import * as React from "react";
import {
  type SharedValue,
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
} from "react-native-reanimated";

import type { SheetMotion } from "@/components/layout/sheet-context";

import { MODE_MOVING } from "../lib/section-accordion";

const SHEET_LEAD_FRAMES = process.env.EXPO_OS === "web" ? 0 : 1;
const FOLLOW_OFF = 0;
const FOLLOW_WATCHING = 1;
const FOLLOW_ACTIVE = 2;

type FollowState = {
  phase: number;
  token: number;
  ignoredTarget: number | null;
  start: number;
  target: number;
  base: number;
  moved: number;
};

const FOLLOW_OFF_STATE: FollowState = {
  phase: FOLLOW_OFF,
  token: 0,
  ignoredTarget: null,
  start: 0,
  target: 0,
  base: 0,
  moved: 0,
};

type SheetFollowOptions = {
  sheet: SheetMotion | null;
  mode: SharedValue<number>;
  progress: SharedValue<number>;
  onArrive: (token: number) => void;
  onStop: (token: number) => void;
};

function useSheetFollow({ sheet, mode, progress, onArrive, onStop }: SheetFollowOptions) {
  const follow = useSharedValue<FollowState>(FOLLOW_OFF_STATE);

  const watchSheet = React.useCallback(
    (token: number) => {
      "worklet";
      follow.value = sheet
        ? { ...FOLLOW_OFF_STATE, phase: FOLLOW_WATCHING, token, ignoredTarget: sheet.target.value }
        : FOLLOW_OFF_STATE;
    },
    [follow, sheet],
  );

  const stopWatching = React.useCallback(() => {
    "worklet";
    follow.value = FOLLOW_OFF_STATE;
  }, [follow]);

  useAnimatedReaction(
    () => (sheet ? { position: sheet.position.value, target: sheet.target.value } : null),
    (current) => {
      const state = follow.value;
      if (current == null || state.phase === FOLLOW_OFF || mode.value !== MODE_MOVING) {
        return;
      }
      const { position, target } = current;
      if (target != null && target !== state.ignoredTarget) {
        if (state.phase !== FOLLOW_ACTIVE || target !== state.target) {
          if (Math.abs(target - position) < 1) {
            return;
          }
          cancelAnimation(progress);
          follow.value = {
            ...state,
            phase: FOLLOW_ACTIVE,
            start: position,
            target,
            base: progress.value,
            moved: 0,
          };
          return;
        }
        const moved = Math.min(
          1,
          Math.max(0, (position - state.start) / (state.target - state.start)),
        );
        if (moved >= 0.999) {
          follow.value = FOLLOW_OFF_STATE;
          onArrive(state.token);
          return;
        }
        const lead = Math.min(1, moved + SHEET_LEAD_FRAMES * Math.max(0, moved - state.moved));
        follow.value = { ...state, moved };
        progress.value = state.base + (1 - state.base) * lead;
        return;
      }
      if (state.phase !== FOLLOW_ACTIVE) {
        return;
      }
      if (Math.abs(position - state.target) < 1) {
        follow.value = FOLLOW_OFF_STATE;
        onArrive(state.token);
        return;
      }
      follow.value = { ...state, phase: FOLLOW_WATCHING, ignoredTarget: target };
      onStop(state.token);
    },
    [sheet],
  );

  return { watchSheet, stopWatching };
}

export { useSheetFollow };
