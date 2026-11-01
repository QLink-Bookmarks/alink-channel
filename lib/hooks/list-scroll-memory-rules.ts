type ListVariant = "wide" | "mobile";

type RestoreStatus = "idle" | "pending" | "settling" | "done" | "cancelled";

type RestoreFrame = {
  contentKey: string;
  isLoading: boolean;
  hasContent: boolean;
  contentHeight: number;
  viewportHeight: number;
  bottomInset: number;
};

function getListMemoryKey(pathname: string, variant: ListVariant) {
  const path = pathname.split(/[?#]/)[0] ?? "";
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return `${trimmed || "/"}::${variant}`;
}

function getListFilterKey(memoryKey: string, field: string) {
  return `${memoryKey}::${field}`;
}

function getMaxScrollOffset(contentHeight: number, viewportHeight: number, bottomInset = 0) {
  return Math.max(0, contentHeight - viewportHeight + Math.max(0, bottomInset));
}

function clampScrollOffset(
  offsetY: number,
  contentHeight: number,
  viewportHeight: number,
  bottomInset = 0,
) {
  return Math.min(offsetY, getMaxScrollOffset(contentHeight, viewportHeight, bottomInset));
}

class ScrollRestorer {
  status: RestoreStatus;
  readonly savedOffset: number;
  private readonly contentKey: string;
  private lastTarget: number | null = null;

  constructor(savedOffset: number | undefined, contentKey: string) {
    this.savedOffset = savedOffset ?? 0;
    this.contentKey = contentKey;
    this.status = this.savedOffset > 0 ? "pending" : "idle";
  }

  get isActive() {
    return this.status === "pending" || this.status === "settling";
  }

  get hasScrolled() {
    return this.lastTarget != null;
  }

  cancel() {
    if (this.isActive) {
      this.status = "cancelled";
    }
  }

  finish() {
    if (this.isActive) {
      this.status = "done";
    }
  }

  next(frame: RestoreFrame): number | null {
    if (!this.isActive) {
      return null;
    }
    if (frame.contentKey !== this.contentKey) {
      this.cancel();
      return null;
    }
    if (frame.isLoading) {
      return null;
    }
    if (!frame.hasContent) {
      this.cancel();
      return null;
    }
    if (frame.contentHeight <= 0 || frame.viewportHeight <= 0) {
      return null;
    }

    const target = clampScrollOffset(
      this.savedOffset,
      frame.contentHeight,
      frame.viewportHeight,
      frame.bottomInset,
    );
    this.status = target >= this.savedOffset ? "done" : "settling";

    if (target <= 0 || target === this.lastTarget) {
      return null;
    }
    this.lastTarget = target;
    return target;
  }

  isOwnScroll(offsetY: number) {
    return this.lastTarget != null && Math.abs(offsetY - this.lastTarget) <= 1;
  }
}

export {
  ScrollRestorer,
  clampScrollOffset,
  getListFilterKey,
  getListMemoryKey,
  getMaxScrollOffset,
};
export type { ListVariant, RestoreFrame, RestoreStatus };
