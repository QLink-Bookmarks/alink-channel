import type { LinkListItem } from "@/features/links/types";

import {
  formatLinkStatus,
  formatSummaryModelLabel,
  getDomainFromUrl,
  mapLinkListItem,
  mapTodoCounts,
} from "./link-card-mapper";

describe("mapTodoCounts", () => {
  it("returns null for a link without any todo, so the card shows nothing", () => {
    expect(mapTodoCounts({ open: 0, dueSoon: 0, overdue: 0, completed: 0 })).toBeNull();
  });

  it("returns null when the counts are missing", () => {
    expect(mapTodoCounts(undefined)).toBeNull();
    expect(mapTodoCounts(null)).toBeNull();
  });

  it("splits open todos into default (open − dueSoon − overdue), due soon and overdue", () => {
    expect(mapTodoCounts({ open: 5, dueSoon: 1, overdue: 2, completed: 3 })).toEqual({
      normal: 2,
      dueSoon: 1,
      overdue: 2,
      allDone: false,
      label: "할 일 2개, 임박 1개, 기한 지남 2개",
    });
  });

  it("leaves zero kinds out of the sentence", () => {
    expect(mapTodoCounts({ open: 1, dueSoon: 1, overdue: 0, completed: 0 })?.label).toBe(
      "임박 1개",
    );
    expect(mapTodoCounts({ open: 2, dueSoon: 0, overdue: 1, completed: 4 })?.label).toBe(
      "할 일 1개, 기한 지남 1개",
    );
    expect(mapTodoCounts({ open: 3, dueSoon: 0, overdue: 0, completed: 0 })?.label).toBe(
      "할 일 3개",
    );
  });

  it("marks a link whose todos are all completed", () => {
    expect(mapTodoCounts({ open: 0, dueSoon: 0, overdue: 0, completed: 2 })).toEqual({
      normal: 0,
      dueSoon: 0,
      overdue: 0,
      allDone: true,
      label: "할 일 모두 완료",
    });
  });

  it("never shows a negative default count when the server counts disagree", () => {
    const summary = mapTodoCounts({ open: 2, dueSoon: 2, overdue: 2, completed: 0 });
    expect(summary).toMatchObject({ normal: 0, dueSoon: 2, overdue: 0 });
    expect(summary?.label).toBe("임박 2개");
  });
});

describe("getDomainFromUrl", () => {
  it("drops www. and keeps the host", () => {
    expect(getDomainFromUrl("https://www.youtube.com/watch?v=1")).toBe("youtube.com");
    expect(getDomainFromUrl("https://m.blog.naver.com/a")).toBe("m.blog.naver.com");
  });

  it("returns the input when it is not a URL", () => {
    expect(getDomainFromUrl("not a url")).toBe("not a url");
  });
});

describe("formatLinkStatus", () => {
  it("shows generating and failed states only", () => {
    expect(formatLinkStatus("G", null)).toEqual({ label: "AI 생성 중...", variant: "progress" });
    expect(formatLinkStatus("F", "gpt-4o-mini")).toEqual({
      label: "gpt-4o-mini 생성 실패",
      variant: "error",
    });
    expect(formatLinkStatus("F", null)).toEqual({ label: "AI 생성 실패", variant: "error" });
    expect(formatLinkStatus("A", "gpt-4o-mini")).toEqual({ label: null, variant: null });
    expect(formatLinkStatus(undefined, undefined)).toEqual({ label: null, variant: null });
  });
});

describe("formatSummaryModelLabel", () => {
  it("names the model of a completed summary", () => {
    expect(formatSummaryModelLabel("A", "gpt-4o-mini")).toBe("요약 모델 - gpt-4o-mini");
    expect(formatSummaryModelLabel("G", "gpt-4o-mini")).toBeNull();
    expect(formatSummaryModelLabel("A", null)).toBeNull();
  });
});

describe("mapLinkListItem", () => {
  const item: LinkListItem = {
    id: 7,
    url: "https://www.notion.so/team/onboarding",
    title: "온보딩 문서",
    thumbnailUrl: null,
    faviconUrl: "https://cdn.example/dev-favicon-notion.png",
    isVideo: false,
    tags: ["업무"],
    createdAt: "2026-10-29T10:00:00.000Z",
    todoCounts: { open: 1, dueSoon: 0, overdue: 1, completed: 0 },
    status: "G",
    workModel: null,
    isFavorite: true,
  };

  it("maps the card fields from the list item", () => {
    expect(mapLinkListItem(item)).toEqual({
      id: 7,
      url: item.url,
      domain: "notion.so",
      title: "온보딩 문서",
      tags: ["업무"],
      thumbnailUrl: null,
      faviconUrl: "https://cdn.example/dev-favicon-notion.png",
      isVideo: false,
      todoCounts: { normal: 0, dueSoon: 0, overdue: 1, allDone: false, label: "기한 지남 1개" },
      statusLabel: "AI 생성 중...",
      statusVariant: "progress",
    });
  });

  it("treats missing preview fields as no image and not a video", () => {
    const legacy = {
      ...item,
      thumbnailUrl: undefined,
      faviconUrl: undefined,
      isVideo: undefined,
    } as unknown as LinkListItem;
    expect(mapLinkListItem(legacy)).toMatchObject({
      thumbnailUrl: null,
      faviconUrl: null,
      isVideo: false,
    });
  });
});
