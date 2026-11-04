import * as React from "react";
import { Easing, type SharedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import type { SheetMotion } from "@/components/layout/sheet";

import {
  MODE_MOVING,
  MODE_SETTLED,
  SECTION_TRANSITION_MS,
  type SectionHeights,
  type SectionPlan,
  getAvailableListHeight,
  getOpenTarget,
  getPlanTargets,
  getRemainingDuration,
  getTransitionMinHeight,
  interpolateSectionHeight,
  interpolateSectionOpenness,
} from "../lib/section-accordion";
import { useSheetFollow } from "./use-sheet-follow";

const SECTION_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const FOLDER_SECTIONS_SHEET_TIMING = { duration: SECTION_TRANSITION_MS, easing: SECTION_EASING };

function timingToEnd(duration: number, onEnd: (token: number) => void, token: number) {
  "worklet";
  return withTiming(1, { duration, easing: SECTION_EASING }, (finished) => {
    if (finished) {
      scheduleOnRN(onEnd, token);
    }
  });
}

type SectionMotion = {
  mode: SharedValue<number>;
  progress: SharedValue<number>;
  plan: SharedValue<SectionPlan>;
  settledKey: SharedValue<string | null>;
};

type MotionRequest<K extends string> = {
  id: number;
  kind: "start" | "retarget";
  key: K | null;
  target: number;
  token: number;
};

type AccordionState<K extends string> = {
  settledKey: K | null;
  mounted: K[];
  frozen: Partial<Record<K, number>>;
  opening: K | null;
  openingCap: number | undefined;
  openingTarget: number;
  isMoving: boolean;
  isStarted: boolean;
  transitionMinHeight: number | undefined;
  reportedMinHeight: number | undefined;
  request: MotionRequest<K> | null;
  settleToken: number;
};

type SectionAccordionOptions<K extends string> = {
  openKey: K | null;
  isReady: boolean;
  isReducedMotion: boolean;
  minHeight: number | undefined;
  headersHeight: number;
  listMaxHeight: number | undefined;
  sheet: SheetMotion | null;
  getAvailableHeight: () => number | undefined;
};

function settledState<K extends string>(key: K | null, token: number): AccordionState<K> {
  return {
    settledKey: key,
    mounted: key == null ? [] : [key],
    frozen: {},
    opening: null,
    openingCap: undefined,
    openingTarget: 0,
    isMoving: false,
    isStarted: false,
    transitionMinHeight: undefined,
    reportedMinHeight: undefined,
    request: null,
    settleToken: token,
  };
}

function useSectionAccordion<K extends string>({
  openKey,
  isReady,
  isReducedMotion,
  minHeight,
  headersHeight,
  listMaxHeight,
  sheet,
  getAvailableHeight,
}: SectionAccordionOptions<K>) {
  const mode = useSharedValue(MODE_SETTLED);
  const progress = useSharedValue(1);
  const plan = useSharedValue<SectionPlan>({ from: {}, to: {}, openFrom: {}, openTo: {} });
  const settledKeyValue = useSharedValue<string | null>(openKey);
  const motion = React.useMemo<SectionMotion>(
    () => ({ mode, progress, plan, settledKey: settledKeyValue }),
    [mode, plan, progress, settledKeyValue],
  );

  const [state, setState] = React.useState<AccordionState<K>>(() => settledState(openKey, 0));
  const stateRef = React.useRef(state);
  const previousRef = React.useRef({ openKey, isReady });
  const tokenRef = React.useRef(0);
  const requestIdRef = React.useRef(0);
  const handledRequestRef = React.useRef(0);
  const pendingRef = React.useRef<{ key: K; token: number } | null>(null);
  const visibleRef = React.useRef<SectionHeights>({});
  const targetRef = React.useRef<SectionHeights>({});
  const settledMinRef = React.useRef(minHeight);
  const isMountedRef = React.useRef(true);
  const framesRef = React.useRef(new Set<number>());
  const latestRef = React.useRef({
    openKey,
    minHeight,
    headersHeight,
    listMaxHeight,
    getAvailableHeight,
  });

  React.useLayoutEffect(() => {
    stateRef.current = state;
    latestRef.current = {
      openKey,
      minHeight,
      headersHeight,
      listMaxHeight,
      getAvailableHeight,
    };
  });

  const nextRequest = React.useCallback(
    (kind: MotionRequest<K>["kind"], key: K | null, target: number, token: number) => {
      requestIdRef.current += 1;
      return { id: requestIdRef.current, kind, key, target, token };
    },
    [],
  );

  const finishTransition = React.useCallback((token: number) => {
    if (!isMountedRef.current || token !== tokenRef.current) {
      return;
    }
    const key = latestRef.current.openKey;
    for (const mountedKey of stateRef.current.mounted) {
      if (mountedKey !== key) {
        delete visibleRef.current[mountedKey];
      }
    }
    if (key != null && targetRef.current[key] != null) {
      visibleRef.current[key] = targetRef.current[key];
    }
    setState(settledState(key, token));
  }, []);

  const finishWithSheet = React.useCallback(
    (token: number) => {
      "worklet";
      progress.value = 1;
      scheduleOnRN(finishTransition, token);
    },
    [finishTransition, progress],
  );

  const continueOnTiming = React.useCallback(
    (token: number) => {
      "worklet";
      progress.value = timingToEnd(getRemainingDuration(progress.value), finishTransition, token);
    },
    [finishTransition, progress],
  );

  const { watchSheet, stopWatching } = useSheetFollow({
    sheet,
    mode,
    progress,
    onArrive: finishWithSheet,
    onStop: continueOnTiming,
  });

  React.useEffect(() => {
    isMountedRef.current = true;
    const frames = framesRef.current;
    return () => {
      isMountedRef.current = false;
      for (const frame of frames) {
        cancelAnimationFrame(frame);
      }
      frames.clear();
    };
  }, []);

  const getAvailableList = React.useCallback(() => {
    const {
      minHeight: nextMin,
      headersHeight: headers,
      getAvailableHeight: getAvailable,
    } = latestRef.current;
    return getAvailableListHeight({
      availableTotal: getAvailable(),
      minHeight: nextMin,
      headersHeight: headers,
    });
  }, []);

  const runStart = React.useCallback(
    (key: K | null, target: number, token: number) => {
      const current = stateRef.current;
      const keys =
        key == null || current.mounted.includes(key) ? current.mounted : [...current.mounted, key];
      const to = getPlanTargets(keys, key, target);
      const settledKey = current.settledKey;
      const settledHeights: SectionHeights = {};
      if (settledKey != null) {
        settledHeights[settledKey] =
          visibleRef.current[settledKey] ?? targetRef.current[settledKey] ?? 0;
      }
      if (key != null) {
        targetRef.current[key] = target;
      }
      scheduleOnUI(() => {
        "worklet";
        const from: SectionHeights = {};
        const openFrom: SectionHeights = {};
        const openTo: SectionHeights = {};
        const isMoving = mode.value === MODE_MOVING;
        const running = plan.value;
        const names = Object.keys(to);
        if (settledKey != null && !names.includes(settledKey)) names.push(settledKey);
        for (const name of Object.keys(running.openTo)) {
          if (!names.includes(name)) names.push(name);
        }
        for (const name of names) {
          from[name] = isMoving
            ? interpolateSectionHeight(running, name, progress.value)
            : name === settledKey
              ? (settledHeights[name] ?? 0)
              : 0;
          openFrom[name] = isMoving
            ? interpolateSectionOpenness(running, name, progress.value)
            : name === settledKey
              ? 1
              : 0;
          openTo[name] = name === key ? 1 : 0;
        }
        plan.value = { from, to, openFrom, openTo };
        mode.value = MODE_MOVING;
        progress.value = 0;
        progress.value = timingToEnd(SECTION_TRANSITION_MS, finishTransition, token);
        let fromTotal = 0;
        let toTotal = 0;
        for (const name of names) {
          fromTotal += from[name] ?? 0;
          toTotal += to[name] ?? 0;
        }
        if (Math.abs(toTotal - fromTotal) > 1) {
          watchSheet(token);
        } else {
          stopWatching();
        }
      });
    },
    [finishTransition, mode, plan, progress, stopWatching, watchSheet],
  );

  const runRetarget = React.useCallback(
    (key: K, target: number, token: number) => {
      targetRef.current[key] = target;
      scheduleOnUI(() => {
        "worklet";
        if (mode.value !== MODE_MOVING) {
          return;
        }
        watchSheet(token);
        const running = plan.value;
        const at = progress.value;
        const from: SectionHeights = {};
        const openFrom: SectionHeights = {};
        for (const name of Object.keys(running.to)) {
          from[name] = interpolateSectionHeight(running, name, at);
        }
        for (const name of Object.keys(running.openTo)) {
          openFrom[name] = interpolateSectionOpenness(running, name, at);
        }
        plan.value = {
          from,
          to: { ...running.to, [key]: target },
          openFrom,
          openTo: running.openTo,
        };
        progress.value = 0;
        progress.value = timingToEnd(getRemainingDuration(at), finishTransition, token);
      });
    },
    [finishTransition, mode, plan, progress, watchSheet],
  );

  React.useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { openKey, isReady };
    if (previous.openKey === openKey && previous.isReady === isReady) {
      return;
    }
    tokenRef.current += 1;
    const token = tokenRef.current;
    pendingRef.current = null;
    const current = stateRef.current;
    if (!previous.isReady || !isReady || isReducedMotion) {
      setState(settledState(openKey, token));
      return;
    }

    const frozen: Partial<Record<K, number>> = {};
    for (const key of current.mounted) {
      if (key === openKey) continue;
      frozen[key] = current.frozen[key] ?? visibleRef.current[key] ?? targetRef.current[key] ?? 0;
    }
    const transitionMinHeight = current.isMoving
      ? current.transitionMinHeight
      : getTransitionMinHeight(settledMinRef.current, latestRef.current.minHeight);
    const reportedMinHeight = current.isMoving ? current.reportedMinHeight : settledMinRef.current;
    const availableList = getAvailableList();
    const cap = Math.min(latestRef.current.listMaxHeight ?? Infinity, availableList);
    const openingCap = Number.isFinite(cap) ? cap : undefined;

    const knownNatural =
      openKey == null
        ? 0
        : current.mounted.includes(openKey)
          ? (targetRef.current[openKey] ?? visibleRef.current[openKey])
          : undefined;

    if (openKey == null || knownNatural != null) {
      const target = openKey == null ? 0 : getOpenTarget(knownNatural ?? 0, availableList);
      setState({
        ...current,
        frozen,
        opening: openKey,
        openingCap,
        openingTarget: target,
        isMoving: true,
        isStarted: true,
        transitionMinHeight,
        reportedMinHeight,
        request: nextRequest("start", openKey, target, token),
      });
      return;
    }

    pendingRef.current = { key: openKey, token };
    setState({
      ...current,
      mounted: [...current.mounted, openKey],
      frozen,
      opening: openKey,
      openingCap,
      openingTarget: 0,
      isMoving: true,
      isStarted: false,
      transitionMinHeight,
      reportedMinHeight,
      request: null,
    });
  }, [getAvailableList, isReady, isReducedMotion, nextRequest, openKey]);

  React.useLayoutEffect(() => {
    const request = state.request;
    if (!request || request.id === handledRequestRef.current) {
      return;
    }
    handledRequestRef.current = request.id;
    const run = () => {
      if (request.token !== tokenRef.current) {
        return;
      }
      if (request.kind === "start") {
        runStart(request.key, request.target, request.token);
      } else if (request.key != null) {
        runRetarget(request.key, request.target, request.token);
      }
    };
    if (process.env.EXPO_OS === "web") {
      run();
      return;
    }
    const frames = framesRef.current;
    const frame = requestAnimationFrame(() => {
      frames.delete(frame);
      run();
    });
    frames.add(frame);
  }, [runRetarget, runStart, state.request]);

  React.useLayoutEffect(() => {
    if (state.isMoving || state.settleToken !== tokenRef.current) {
      return;
    }
    settledKeyValue.value = state.settledKey;
    mode.value = MODE_SETTLED;
    progress.value = 1;
  }, [mode, progress, settledKeyValue, state.isMoving, state.settledKey, state.settleToken]);

  React.useEffect(() => {
    if (!state.isMoving) {
      settledMinRef.current = minHeight;
    }
  }, [minHeight, state.isMoving]);

  const handleMeasure = React.useCallback(
    (key: K, natural: number) => {
      const target = getOpenTarget(natural, getAvailableList());
      const pending = pendingRef.current;
      if (pending && pending.key === key && pending.token === tokenRef.current) {
        pendingRef.current = null;
        targetRef.current[key] = target;
        setState((value) => ({
          ...value,
          openingTarget: target,
          isStarted: true,
          request: nextRequest("start", key, target, pending.token),
        }));
        return;
      }
      const current = stateRef.current;
      if (!current.isMoving || current.opening !== key) {
        return;
      }
      if (pendingRef.current || Math.abs((targetRef.current[key] ?? 0) - target) <= 0.5) {
        return;
      }
      targetRef.current[key] = target;
      const token = tokenRef.current;
      setState((value) => ({
        ...value,
        openingTarget: target,
        request: nextRequest("retarget", key, target, token),
      }));
    },
    [getAvailableList, nextRequest],
  );

  const handleVisibleLayout = React.useCallback((key: K, height: number) => {
    const current = stateRef.current;
    if (current.isMoving || current.settledKey !== key) {
      return;
    }
    visibleRef.current[key] = height;
  }, []);

  const displayMinHeight = state.isMoving ? (state.transitionMinHeight ?? minHeight) : minHeight;
  const reportedMinHeight = state.isMoving ? (state.reportedMinHeight ?? minHeight) : minHeight;
  const transitionHeight =
    state.isMoving && state.isStarted
      ? headersHeight + (state.opening == null ? 0 : state.openingTarget)
      : undefined;

  return {
    motion,
    mounted: state.mounted,
    frozen: state.frozen,
    opening: state.opening,
    openingCap: state.openingCap,
    openingTarget: state.openingTarget,
    isMoving: state.isMoving,
    displayMinHeight,
    reportedMinHeight,
    transitionHeight,
    handleMeasure,
    handleVisibleLayout,
  };
}

export { FOLDER_SECTIONS_SHEET_TIMING, useSectionAccordion };
export type { SectionMotion };
