import type { Page } from "@playwright/test";

type SectionKey = "mine" | "shared";
type Box = { top: number; height: number };
type MotionFrame = {
  t: number;
  headers: Record<SectionKey, Box | null>;
  lists: Record<SectionKey, Box | null>;
};
type MotionSample = { frames: MotionFrame[]; final: Omit<MotionFrame, "t"> };

async function sampleSectionMotion(
  page: Page,
  options: { scope?: string; clicks: { at: number; section: SectionKey }[]; durationMs?: number },
): Promise<MotionSample> {
  return page.evaluate(
    ({ scope, clicks, durationMs }) => {
      const labels = { mine: "내 폴더", shared: "공유 폴더" } as const;
      const keys = ["mine", "shared"] as const;
      const scopes = document.querySelectorAll(scope);
      const root = (scopes[scopes.length - 1] as HTMLElement | undefined) ?? document.body;
      const toggleOf = (key: SectionKey) =>
        root.querySelector<HTMLElement>(
          `[role="button"][aria-label^="${labels[key]} 접기"], [role="button"][aria-label^="${labels[key]} 펼치기"]`,
        );
      const visible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        let top = rect.top;
        let bottom = rect.bottom;
        for (let node = element.parentElement; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.overflowY !== "visible" || style.overflowX !== "visible") {
            const clip = node.getBoundingClientRect();
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
        }
        return { top, height: Math.max(0, bottom - top) };
      };
      const measure = () => {
        const headers = {} as MotionFrame["headers"];
        const lists = {} as MotionFrame["lists"];
        for (const key of keys) {
          const toggle = toggleOf(key);
          const rect = toggle?.getBoundingClientRect();
          headers[key] = rect ? { top: rect.top, height: rect.height } : null;
          const list = root.querySelector<HTMLElement>(`[aria-label="${labels[key]} 목록"]`);
          lists[key] = list ? visible(list) : null;
        }
        return { headers, lists };
      };
      return new Promise<MotionSample>((resolve) => {
        const frames: MotionFrame[] = [{ t: -1, ...measure() }];
        const start = performance.now();
        for (const click of clicks) {
          const fire = () => toggleOf(click.section)?.click();
          if (click.at <= 0) fire();
          else setTimeout(fire, click.at);
        }
        const channel = new MessageChannel();
        const times: number[] = [];
        channel.port1.onmessage = () => {
          frames.push({ t: (times.shift() ?? performance.now()) - start, ...measure() });
        };
        const tick = (time: number) => {
          times.push(time);
          channel.port2.postMessage(0);
          if (time - start < durationMs) {
            requestAnimationFrame(tick);
          } else {
            setTimeout(() => resolve({ frames, final: measure() }), 500);
          }
        };
        requestAnimationFrame(tick);
      });
    },
    {
      scope: options.scope ?? "body",
      clicks: options.clicks,
      durationMs: options.durationMs ?? 500,
    },
  );
}

async function settleSections(page: Page, scope = "body") {
  await page.evaluate(
    (selector) =>
      new Promise<void>((resolve) => {
        const scopes = document.querySelectorAll(selector);
        const root = (scopes[scopes.length - 1] as HTMLElement | undefined) ?? document.body;
        const read = () =>
          Array.from(
            root.querySelectorAll<HTMLElement>(
              '[aria-label*="폴더 접기"], [aria-label*="폴더 펼치기"], [aria-label$="폴더 목록"]',
            ),
          )
            .map((node) => {
              const rect = node.getBoundingClientRect();
              return `${Math.round(rect.top)}:${Math.round(rect.height)}`;
            })
            .join("|");
        const started = performance.now();
        let last = read();
        let stable = 0;
        const tick = () => {
          const next = read();
          stable = next === last ? stable + 1 : 0;
          last = next;
          if (stable >= 8 || performance.now() - started > 3000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    scope,
  );
}

const height = (box: Box | null) => box?.height ?? 0;

function movingFrames(sample: MotionSample, key: SectionKey) {
  let count = 0;
  for (let index = 1; index < sample.frames.length; index += 1) {
    if (
      Math.abs(
        height(sample.frames[index].lists[key]) - height(sample.frames[index - 1].lists[key]),
      ) > 0.5
    ) {
      count += 1;
    }
  }
  return count;
}

function headerJump(sample: MotionSample, key: SectionKey) {
  const tops = sample.frames
    .map((frame) => frame.headers[key]?.top)
    .filter((v): v is number => v != null);
  const steps = tops.slice(1).map((top, index) => Math.abs(top - tops[index]));
  const travel = steps.reduce((sum, step) => sum + step, 0);
  return travel < 4 ? 0 : Math.max(...steps) / travel;
}

function maxOverlap(sample: MotionSample) {
  const overlap = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  let worst = 0;
  for (const frame of sample.frames) {
    for (const key of ["mine", "shared"] as const) {
      const list = frame.lists[key];
      if (!list || list.height <= 1) continue;
      for (const other of ["mine", "shared"] as const) {
        const header = frame.headers[other];
        if (header) worst = Math.max(worst, overlap(list, header));
        const otherList = frame.lists[other];
        if (other !== key && otherList && otherList.height > 1)
          worst = Math.max(worst, overlap(list, otherList));
      }
    }
  }
  return worst;
}

function syncError(sample: MotionSample, opening: SectionKey, closing: SectionKey) {
  const closeStart = height(sample.frames[0].lists[closing]);
  const openEnd = height(sample.final.lists[opening]);
  let worst = 0;
  for (const frame of sample.frames.slice(1)) {
    const pClose = closeStart > 0 ? 1 - height(frame.lists[closing]) / closeStart : 1;
    const pOpen = openEnd > 0 ? height(frame.lists[opening]) / openEnd : 1;
    worst = Math.max(worst, Math.abs(Math.min(1, pOpen) - Math.min(1, Math.max(0, pClose))));
  }
  return worst;
}

export { headerJump, maxOverlap, movingFrames, sampleSectionMotion, settleSections, syncError };
export type { MotionFrame, MotionSample, SectionKey };
