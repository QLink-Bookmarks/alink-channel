import type { ReversalErrorKind } from "../../hooks/use-reversal-selection";
import { UNFILED_FOLDER_EMOJI, UNFILED_FOLDER_LABEL } from "../../lib/import-status-copy";
import type { ReversalCounts, ReversalFolderItem } from "../../lib/reversal-selection";

type FolderBadgeTone = "danger" | "muted" | "shared";

function getReversalFolderLabel(folder: ReversalFolderItem) {
  if (folder.kind === "UNFILED" || folder.name == null) {
    return { name: UNFILED_FOLDER_LABEL, emoji: UNFILED_FOLDER_EMOJI };
  }
  return { name: folder.name, emoji: folder.emoji };
}

function getReversalFolderIntro(
  folder: ReversalFolderItem,
  isRemoved: boolean,
): { badge: string | null; tone: FolderBadgeTone; description: string } {
  if (folder.isDone) {
    return { badge: "지웠어요", tone: "muted", description: "이 폴더는 이미 지웠어요." };
  }
  if (folder.kind === "UNFILED") {
    return {
      badge: null,
      tone: "muted",
      description: "이 가져오기로 미분류에 넣은 링크를 지워요.",
    };
  }
  if (folder.kind === "EXISTING") {
    return {
      badge: "기존 폴더",
      tone: "muted",
      description: "가져오기 전부터 있던 폴더라 폴더는 그대로 두고, 이번에 넣은 링크만 지워요.",
    };
  }
  if (folder.state === "SHARED") {
    return {
      badge: "공유 중",
      tone: "shared",
      description:
        "가져온 뒤 공유한 폴더라 함께 보는 사람이 있어요. 폴더는 남기고, 가져온 링크만 지워요.",
    };
  }
  if (folder.state === "DELETED") {
    return {
      badge: "이미 삭제됨",
      tone: "muted",
      description: "직접 지운 폴더예요. 남은 가져온 링크만 지울 수 있어요.",
    };
  }
  if (isRemoved) {
    return {
      badge: "폴더를 지워요",
      tone: "danger",
      description:
        "이 가져오기로 만든 폴더예요. 남기기로 한 링크와 가져온 뒤 직접 저장한 링크는 미분류로 옮겨요.",
    };
  }
  return {
    badge: "폴더를 남겨요",
    tone: "muted",
    description: "링크를 모두 남겨서 폴더도 그대로 둬요.",
  };
}

function getReversalHint(counts: ReversalCounts, options: { hasError: boolean }) {
  if (counts.links === 0 && counts.folders === 0) {
    return "지울 항목을 골라 주세요.";
  }
  const prefix = options.hasError ? "남은 " : "";
  const target = `${prefix}링크 ${counts.links}개 · 폴더 ${counts.folders}개를`;
  return counts.moved > 0
    ? `${target} 지우고, ${counts.moved}개는 미분류로 옮겨요`
    : `${target} 지워요`;
}

function getReversalErrorCopy(
  kind: ReversalErrorKind,
  options: { doneLinkCount: number; hasRemaining: boolean },
) {
  if (kind === "folder-shared") {
    return {
      title: "공유 중인 폴더는 되돌릴 수 없어요",
      description:
        "그 사이 공유된 폴더는 남기고, 안의 가져온 링크만 지우도록 다시 맞췄어요. 확인한 뒤 다시 시도해 주세요.",
    };
  }
  if (kind === "not-found") {
    return {
      title: "가져오기 기록을 찾을 수 없어요",
      description: "삭제되었거나 접근할 수 없는 기록이에요.",
    };
  }
  if (!options.hasRemaining) {
    return {
      title: "되돌리기를 끝냈어요",
      description: "고른 항목은 모두 지워졌어요. 창을 닫아 주세요.",
    };
  }
  if (options.doneLinkCount > 0) {
    return {
      title: "되돌리기를 끝내지 못했어요",
      description: `링크 ${options.doneLinkCount}개는 지웠지만, 나머지는 그대로 있어요. 다시 시도하면 남은 항목만 처리하고, 이미 지운 항목은 다시 건드리지 않아요.`,
    };
  }
  return {
    title: "되돌리기를 끝내지 못했어요",
    description:
      "서버에 연결하지 못해 아무것도 지우지 않았어요. 다시 시도하면 남은 항목만 처리해요.",
  };
}

function getHostLabel(url: string) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export {
  getHostLabel,
  getReversalErrorCopy,
  getReversalFolderIntro,
  getReversalFolderLabel,
  getReversalHint,
};
export type { FolderBadgeTone };
