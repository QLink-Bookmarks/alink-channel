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
  getReservedHeight,
  getTransitionMinHeight,
  interpolateSectionHeight,
} from "../lib/section-accordion";

const MODE_SETTLED = 0;
const MODE_MOVING = 1;
const SECTION_EASING = Easing.bezier(0.2, 0, 0, 1);
const MIN_RETARGET_MS = 80;

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
  opening: K | null;
  openingCap: number | undefined;
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
  listMaxHeight: number | undefined;
  reservesHeight: boolean;
  getAvailableHeight: () => number | undefined;
};

function settledState<K extends string>(key: K | null, token: number): AccordionState<K> {
  return {
    settledKey: key,
    mounted: key == null ? [] : [key],
    frozen: {},
    opening: null,
    openingCap: undefined,
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
  listMaxHeight,
  reservesHeight,
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
  const latestRef = React.useRef({
    openKey,
    minHeight,
    headersHeight,
    listMaxHeight,
    reservesHeight,
    getAvailableHeight,
  });

  React.useLayoutEffect(() => {
    stateRef.current = state;
    latestRef.current = {
      openKey,
      minHeight,
      headersHeight,
      listMaxHeight,
      reservesHeight,
      getAvailableHeight,
    };
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

  const getReserved = React.useCallback(
    (frozen: Partial<Record<K, number>>, target: number, previous: number | undefined) => {
      const { reservesHeight: reserves, headersHeight: headers } = latestRef.current;
      if (!reserves) {
        return previous;
      }
      const closing = Object.values(frozen) as number[];
      return getTransitionMinHeight(previous, getReservedHeight(headers, closing, target));
    },
    [],
  );

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

  const retarget = React.useCallback(
    (key: K, target: number, token: number) => {
      targetRef.current[key] = target;
      scheduleOnUI(() => {
        "worklet";
        if (mode.value !== MODE_MOVING) {
          return;
        }
        const running = plan.value;
        const at = progress.value;
        const from: SectionHeights = {};
        for (const name of Object.keys(running.to)) {
          from[name] = interpolateSectionHeight(running, name, at);
        }
        plan.value = { from, to: { ...running.to, [key]: target } };
        progress.value = 0;
        progress.value = withTiming(
          1,
          {
            duration: Math.max(MIN_RETARGET_MS, (1 - at) * SECTION_TRANSITION_MS),
            easing: SECTION_EASING,
          },
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
        isMoving: true,
        transitionMinHeight: getReserved(frozen, target, transitionMinHeight),
      });
      startTransition(openKey, target, token);
      return;
    }

    pendingRef.current = { key: openKey, token };
    setState({
      ...current,
      mounted: [...current.mounted, openKey],
      frozen,
      opening: openKey,
      openingCap,
      isMoving: true,
      transitionMinHeight,
    });
  }, [getAvailableList, getReserved, isReady, isReducedMotion, openKey, startTransition]);

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
      const current = stateRef.current;
      if (!current.isMoving || current.opening !== key) {
        return;
      }
      const target = getOpenTarget(natural, getAvailableList());
      const pending = pendingRef.current;
      if (pending && pending.key === key && pending.token === tokenRef.current) {
        pendingRef.current = null;
        setState((value) => ({
          ...value,
          transitionMinHeight: getReserved(value.frozen, target, value.transitionMinHeight),
        }));
        startTransition(key, target, pending.token);
        return;
      }
      if (pendingRef.current || Math.abs((targetRef.current[key] ?? 0) - target) <= 0.5) {
        return;
      }
      setState((value) => ({
        ...value,
        transitionMinHeight: getReserved(value.frozen, target, value.transitionMinHeight),
      }));
      retarget(key, target, tokenRef.current);
    },
    [getAvailableList, getReserved, retarget, startTransition],
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
    mounted: state.mounted,
    frozen: state.frozen,
    opening: state.opening,
    openingCap: state.openingCap,
    displayMinHeight,
    handleMeasure,
    handleVisibleLayout,
  };
}

export { MODE_MOVING, MODE_SETTLED, useSectionAccordion };
export type { SectionMotion };
