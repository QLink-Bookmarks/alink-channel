import * as React from "react";
import { Easing, type SharedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import {
  SECTION_TRANSITION_MS,
  type SectionHeights,
  type SectionPlan,
  getAvailableListHeight,
  getOpenTarget,
  getPlanTargets,
  getTransitionMinHeight,
  interpolateSectionHeight,
} from "../lib/section-accordion";

const MODE_SETTLED = 0;
const MODE_MOVING = 1;
const SECTION_EASING = Easing.bezier(0.2, 0, 0, 1);

type SectionMotion = {
  mode: SharedValue<number>;
  progress: SharedValue<number>;
  plan: SharedValue<SectionPlan>;
  settledKey: SharedValue<string | null>;
};

type AccordionState<K extends string> = {
  settledKey: K | null;
  mounted: K[];
  frozen: Partial<Record<K, number>>;
  measuring: K | null;
  isMoving: boolean;
  transitionMinHeight: number | undefined;
  settleToken: number;
};

type SectionAccordionOptions<K extends string> = {
  openKey: K | null;
  isReady: boolean;
  isReducedMotion: boolean;
  minHeight: number | undefined;
  headersHeight: number;
  getAvailableHeight: () => number | undefined;
};

function settledState<K extends string>(key: K | null, token: number): AccordionState<K> {
  return {
    settledKey: key,
    mounted: key == null ? [] : [key],
    frozen: {},
    measuring: null,
    isMoving: false,
    transitionMinHeight: undefined,
    settleToken: token,
  };
}

function useSectionAccordion<K extends string>({
  openKey,
  isReady,
  isReducedMotion,
  minHeight,
  headersHeight,
  getAvailableHeight,
}: SectionAccordionOptions<K>) {
  const mode = useSharedValue(MODE_SETTLED);
  const progress = useSharedValue(1);
  const plan = useSharedValue<SectionPlan>({ from: {}, to: {} });
  const settledKeyValue = useSharedValue<string | null>(openKey);
  const motion = React.useMemo<SectionMotion>(
    () => ({ mode, progress, plan, settledKey: settledKeyValue }),
    [mode, plan, progress, settledKeyValue],
  );

  const [state, setState] = React.useState<AccordionState<K>>(() => settledState(openKey, 0));
  const stateRef = React.useRef(state);
  const previousRef = React.useRef({ openKey, isReady });
  const tokenRef = React.useRef(0);
  const pendingRef = React.useRef<{ key: K; token: number } | null>(null);
  const visibleRef = React.useRef<SectionHeights>({});
  const targetRef = React.useRef<SectionHeights>({});
  const settledMinRef = React.useRef(minHeight);
  const latestRef = React.useRef({ openKey, minHeight, headersHeight, getAvailableHeight });

  React.useLayoutEffect(() => {
    stateRef.current = state;
    latestRef.current = { openKey, minHeight, headersHeight, getAvailableHeight };
  });

  const finishTransition = React.useCallback((token: number) => {
    if (token !== tokenRef.current) {
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

  const startTransition = React.useCallback(
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
        const isMoving = mode.value === MODE_MOVING;
        const running = plan.value;
        for (const name of Object.keys(to)) {
          from[name] = isMoving
            ? interpolateSectionHeight(running, name, progress.value)
            : name === settledKey
              ? (settledHeights[name] ?? 0)
              : 0;
        }
        plan.value = { from, to };
        mode.value = MODE_MOVING;
        progress.value = 0;
        progress.value = withTiming(
          1,
          { duration: SECTION_TRANSITION_MS, easing: SECTION_EASING },
          (finished) => {
            if (finished) {
              scheduleOnRN(finishTransition, token);
            }
          },
        );
      });
    },
    [finishTransition, mode, plan, progress],
  );

  const getTarget = React.useCallback((natural: number) => {
    const {
      minHeight: nextMin,
      headersHeight: headers,
      getAvailableHeight: getAvailable,
    } = latestRef.current;
    const available = getAvailableListHeight({
      availableTotal: getAvailable(),
      minHeight: nextMin,
      headersHeight: headers,
    });
    return getOpenTarget(natural, available);
  }, []);

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

    const knownNatural =
      openKey == null
        ? 0
        : current.mounted.includes(openKey)
          ? (targetRef.current[openKey] ?? visibleRef.current[openKey])
          : undefined;

    if (openKey == null || knownNatural != null) {
      const target = openKey == null ? 0 : getTarget(knownNatural ?? 0);
      if (openKey != null) {
        frozen[openKey] = target;
      }
      setState({
        ...current,
        frozen,
        measuring: null,
        isMoving: true,
        transitionMinHeight,
      });
      startTransition(openKey, target, token);
      return;
    }

    pendingRef.current = { key: openKey, token };
    setState({
      ...current,
      mounted: [...current.mounted, openKey],
      frozen,
      measuring: openKey,
      isMoving: true,
      transitionMinHeight,
    });
  }, [getTarget, isReady, isReducedMotion, openKey, startTransition]);

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
      const pending = pendingRef.current;
      if (!pending || pending.key !== key || pending.token !== tokenRef.current) {
        return;
      }
      pendingRef.current = null;
      const target = getTarget(natural);
      setState((current) => ({
        ...current,
        measuring: null,
        frozen: { ...current.frozen, [key]: target },
      }));
      startTransition(key, target, pending.token);
    },
    [getTarget, startTransition],
  );

  const handleVisibleLayout = React.useCallback((key: K, height: number) => {
    const current = stateRef.current;
    if (current.isMoving || current.settledKey !== key) {
      return;
    }
    visibleRef.current[key] = height;
  }, []);

  const displayMinHeight = state.isMoving ? (state.transitionMinHeight ?? minHeight) : minHeight;

  return {
    motion,
    settledKey: state.settledKey,
    mounted: state.mounted,
    frozen: state.frozen,
    measuring: state.measuring,
    displayMinHeight,
    handleMeasure,
    handleVisibleLayout,
  };
}

export { MODE_MOVING, MODE_SETTLED, useSectionAccordion };
export type { SectionMotion };
