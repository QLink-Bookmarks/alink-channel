import * as React from "react";
import type { ScrollView, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";

import type { ProposalTarget } from "../lib/proposal-state";

import { create } from "zustand";

type DragLink = {
  key: string;
  title: string;
  url: string;
  target: ProposalTarget;
};

type DropTargetKind = "folder" | "shared";

type DropTargetInfo = {
  id: string;
  kind: DropTargetKind;
  target: ProposalTarget | null;
  name: string;
};

type LinkDragState = {
  link: DragLink | null;
  x: number;
  y: number;
  over: DropTargetInfo | null;
};

type Rect = { left: number; top: number; right: number; bottom: number };

const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX_SPEED = 14;
const RECENT_DRAG_MS = 400;
const PAN_MIN_DISTANCE = 4;

const useLinkDragStore = create<LinkDragState>(() => ({ link: null, x: 0, y: 0, over: null }));

const dropTargets = new Map<string, { info: DropTargetInfo; node: HTMLElement | null }>();
const scrollContainers = new Set<() => HTMLElement | null>();
let dropHandler: ((linkKey: string, target: ProposalTarget) => void) | null = null;
let lastDragEndAt = 0;
let frame: number | null = null;
let measuredTargets: { info: DropTargetInfo; rect: Rect; clips: Rect[] }[] | null = null;
let detachScrollListeners: (() => void) | null = null;

function toDomNode(node: unknown): HTMLElement | null {
  const element = node as HTMLElement | null;
  return element && typeof element.getBoundingClientRect === "function" ? element : null;
}

function contains(rect: Rect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function getScrollNodes() {
  const nodes: HTMLElement[] = [];
  for (const getNode of scrollContainers) {
    const node = getNode();
    if (node) {
      nodes.push(node);
    }
  }
  return nodes;
}

function measureTargets() {
  const scrollers = getScrollNodes().map((node) => ({ node, rect: node.getBoundingClientRect() }));
  const measured: { info: DropTargetInfo; rect: Rect; clips: Rect[] }[] = [];
  for (const { info, node } of dropTargets.values()) {
    if (!node || !node.isConnected) {
      continue;
    }
    measured.push({
      info,
      rect: node.getBoundingClientRect(),
      clips: scrollers.filter((scroller) => scroller.node.contains(node)).map((s) => s.rect),
    });
  }
  measuredTargets = measured;
  return measured;
}

function hitTest(x: number, y: number): DropTargetInfo | null {
  const targets = measuredTargets ?? measureTargets();
  for (const { info, rect, clips } of targets) {
    if (contains(rect, x, y) && clips.every((clip) => contains(clip, x, y))) {
      return info;
    }
  }
  return null;
}

function updatePointer(x: number, y: number) {
  const over = hitTest(x, y);
  const current = useLinkDragStore.getState();
  if (current.x === x && current.y === y && current.over?.id === over?.id) {
    return;
  }
  useLinkDragStore.setState({ x, y, over });
}

function autoScrollStep() {
  frame = null;
  const { link, x, y } = useLinkDragStore.getState();
  if (!link) {
    return;
  }
  let didScroll = false;
  for (const node of getScrollNodes()) {
    const rect = node.getBoundingClientRect();
    if (x < rect.left || x > rect.right) {
      continue;
    }
    const topGap = y - rect.top;
    const bottomGap = rect.bottom - y;
    let delta = 0;
    if (topGap >= -AUTO_SCROLL_EDGE && topGap < AUTO_SCROLL_EDGE) {
      delta = -Math.ceil(
        ((AUTO_SCROLL_EDGE - topGap) / (AUTO_SCROLL_EDGE * 2)) * AUTO_SCROLL_MAX_SPEED,
      );
    } else if (bottomGap >= -AUTO_SCROLL_EDGE && bottomGap < AUTO_SCROLL_EDGE) {
      delta = Math.ceil(
        ((AUTO_SCROLL_EDGE - bottomGap) / (AUTO_SCROLL_EDGE * 2)) * AUTO_SCROLL_MAX_SPEED,
      );
    }
    if (delta !== 0) {
      const before = node.scrollTop;
      node.scrollTop = before + delta;
      didScroll = didScroll || node.scrollTop !== before;
    }
  }
  if (didScroll) {
    measureTargets();
    useLinkDragStore.setState({ over: hitTest(x, y) });
  }
  frame = requestAnimationFrame(autoScrollStep);
}

function handleContainerScroll() {
  measuredTargets = null;
  const { link, x, y } = useLinkDragStore.getState();
  if (link) {
    updatePointer(x, y);
  }
}

function attachScrollListeners() {
  detachScrollListeners?.();
  const nodes = getScrollNodes();
  for (const node of nodes) {
    node.addEventListener("scroll", handleContainerScroll, { passive: true });
  }
  detachScrollListeners = () => {
    for (const node of nodes) {
      node.removeEventListener("scroll", handleContainerScroll);
    }
    detachScrollListeners = null;
  };
}

function startLinkDrag(link: DragLink, x: number, y: number) {
  measureTargets();
  attachScrollListeners();
  useLinkDragStore.setState({ link, x, y, over: null });
  updatePointer(x, y);
  if (frame == null && typeof requestAnimationFrame === "function") {
    frame = requestAnimationFrame(autoScrollStep);
  }
}

function stopDragTracking() {
  detachScrollListeners?.();
  if (frame != null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}

function moveLinkDrag(x: number, y: number) {
  if (useLinkDragStore.getState().link) {
    updatePointer(x, y);
  }
}

function endLinkDrag() {
  const { link, over } = useLinkDragStore.getState();
  stopDragTracking();
  if (!link) {
    return;
  }
  lastDragEndAt = Date.now();
  measuredTargets = null;
  useLinkDragStore.setState({ link: null, over: null });
  if (over?.kind === "folder" && over.target && over.target !== link.target) {
    dropHandler?.(link.key, over.target);
  }
}

function cancelLinkDrag() {
  stopDragTracking();
  measuredTargets = null;
  if (useLinkDragStore.getState().link) {
    lastDragEndAt = Date.now();
    useLinkDragStore.setState({ link: null, over: null });
  }
}

function wasRecentlyDragged() {
  return Date.now() - lastDragEndAt < RECENT_DRAG_MS;
}

function useLinkDragDrop(onDrop: (linkKey: string, target: ProposalTarget) => void) {
  React.useEffect(() => {
    dropHandler = onDrop;
    return () => {
      if (dropHandler === onDrop) {
        dropHandler = null;
      }
      cancelLinkDrag();
    };
  }, [onDrop]);
}

function useDropTarget(info: DropTargetInfo | null) {
  const nodeRef = React.useRef<HTMLElement | null>(null);
  const id = info?.id ?? null;
  const kind = info?.kind;
  const target = info?.target ?? null;
  const name = info?.name ?? "";

  React.useEffect(() => {
    if (id == null || kind == null) {
      return;
    }
    dropTargets.set(id, { info: { id, kind, target, name }, node: nodeRef.current });
    measuredTargets = null;
    return () => {
      dropTargets.delete(id);
      measuredTargets = null;
    };
  }, [id, kind, name, target]);

  return React.useCallback(
    (node: View | null) => {
      nodeRef.current = toDomNode(node);
      if (id != null) {
        const entry = dropTargets.get(id);
        if (entry) {
          entry.node = nodeRef.current;
          measuredTargets = null;
        }
      }
    },
    [id],
  );
}

function useDragScrollContainer() {
  const scrollRef = React.useRef<ScrollView | null>(null);

  React.useEffect(() => {
    const getNode = () => {
      const scrollView = scrollRef.current as
        | (ScrollView & { getScrollableNode?: () => unknown })
        | null;
      return toDomNode(scrollView?.getScrollableNode?.() ?? scrollView);
    };
    scrollContainers.add(getNode);
    return () => {
      scrollContainers.delete(getNode);
    };
  }, []);

  return scrollRef;
}

function useIsDropOver(id: string) {
  return useLinkDragStore((state) => state.link != null && state.over?.id === id);
}

function useIsDraggingLink(linkKey: string) {
  return useLinkDragStore((state) => state.link?.key === linkKey);
}

function useIsLinkDragActive() {
  return useLinkDragStore((state) => state.link != null);
}

function useLinkHandleGesture(link: DragLink) {
  const linkRef = React.useRef(link);
  linkRef.current = link;

  return React.useMemo(
    () =>
      Gesture.Pan()
        .minDistance(PAN_MIN_DISTANCE)
        .runOnJS(true)
        .onStart((event) => startLinkDrag(linkRef.current, event.absoluteX, event.absoluteY))
        .onUpdate((event) => moveLinkDrag(event.absoluteX, event.absoluteY))
        .onEnd(() => endLinkDrag())
        .onFinalize(() => cancelLinkDrag()),
    [],
  );
}

export {
  cancelLinkDrag,
  endLinkDrag,
  moveLinkDrag,
  startLinkDrag,
  useDragScrollContainer,
  useDropTarget,
  useIsDraggingLink,
  useIsDropOver,
  useIsLinkDragActive,
  useLinkDragDrop,
  useLinkDragStore,
  useLinkHandleGesture,
  wasRecentlyDragged,
};
export type { DragLink, DropTargetInfo, DropTargetKind, LinkDragState };
