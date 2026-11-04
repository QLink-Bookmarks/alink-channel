import type { ProposalChange, ProposalNotice, ProposalStatusLine } from "../../lib/proposal-state";
import { formatNumber } from "../../lib/split-import-ranges";

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const RIEUL_FINAL = 8;

const SPOKEN_FINALS: Record<string, number> = {
  "0": 21,
  "1": RIEUL_FINAL,
  "3": 16,
  "6": 1,
  "7": RIEUL_FINAL,
  "8": RIEUL_FINAL,
  l: RIEUL_FINAL,
  m: 16,
  n: 4,
  r: RIEUL_FINAL,
};

function getFinalConsonant(word: string) {
  const trimmed = word.trim();
  const code = trimmed.codePointAt(trimmed.length - 1) ?? 0;
  if (code >= HANGUL_START && code <= HANGUL_END) {
    return (code - HANGUL_START) % 28;
  }
  const last = trimmed.slice(-1).toLowerCase();
  return /[0-9a-z]/.test(last) ? (SPOKEN_FINALS[last] ?? 0) : -1;
}

function getRoParticle(word: string) {
  const final = getFinalConsonant(word);
  return final > 0 && final !== RIEUL_FINAL ? "으로" : "로";
}

function withEul(word: string) {
  return `‘${word}’${getFinalConsonant(word) > 0 ? "을" : "를"}`;
}

function withRo(word: string) {
  return `‘${word}’${getRoParticle(word)}`;
}

function withWa(word: string) {
  return `‘${word}’${getFinalConsonant(word) > 0 ? "과" : "와"}`;
}

function excludedNote(name: string | null) {
  return name ? ` 새 폴더 ${withEul(name)} 가져오기에서 제외해요.` : "";
}

type ChangeMessage = { message: string; undoLabel: string | null };

function includedNote(name: string | null) {
  return name ? ` 새 폴더 ${withEul(name)} 다시 가져와요.` : "";
}

function getChangeMessage(change: ProposalChange): { message: string; undoLabel: string } {
  switch (change.type) {
    case "remove":
      return {
        message: `${withEul(change.linkTitle)} 가져오지 않아요.${excludedNote(change.excludedFolder)}`,
        undoLabel: "다시 넣기",
      };
    case "move":
      return {
        message: `${withEul(change.linkTitle)} ${withRo(change.toName)} 옮겼어요.${excludedNote(change.excludedFolder)}`,
        undoLabel: "옮기기 취소",
      };
    case "merge":
      return {
        message: `‘${change.fromName}’의 링크 ${formatNumber(change.count)}개를 ${change.toKind === "existing" ? "기존" : "새"} 폴더 ${withRo(change.toName)} 합쳤어요.`,
        undoLabel: "합치기 취소",
      };
    case "remove-all":
      return {
        message: `‘${change.folderName}’의 링크 ${formatNumber(change.count)}개를 가져오지 않아요.${excludedNote(change.excludedFolder)}`,
        undoLabel: "모두 빼기 취소",
      };
    case "restore-all":
      return {
        message: `‘${change.folderName}’에 링크 ${formatNumber(change.count)}개를 다시 넣었어요.${includedNote(change.includedFolder)}`,
        undoLabel: "넣기 취소",
      };
    case "restore":
      return {
        message: `${withEul(change.linkTitle)} ‘${change.toName}’에 다시 넣었어요.${includedNote(change.includedFolder)}`,
        undoLabel: "넣기 취소",
      };
  }
}

function getNoticeMessage(notice: ProposalNotice) {
  return `공유 폴더와 같은 이름은 쓸 수 없어서 ${withRo(notice.name)} 그대로 뒀어요.`;
}

function getStatusMessage(line: ProposalStatusLine): ChangeMessage {
  if (line.kind === "notice") {
    return { message: getNoticeMessage(line.notice), undoLabel: null };
  }
  const { message, undoLabel } = getChangeMessage(line.change);
  return { message: line.isAfterUndo ? `되돌렸어요. 이전 변경: ${message}` : message, undoLabel };
}

function getAddCaption(addCount: number, newFolderCount: number) {
  if (addCount === 0) {
    return "가져올 링크가 없어요";
  }
  const links = `링크 ${formatNumber(addCount)}개`;
  return newFolderCount > 0
    ? `${links}와 새 폴더 ${formatNumber(newFolderCount)}개를 추가해요`
    : `${links}를 추가해요`;
}

function getImportButtonLabel(addCount: number) {
  return addCount > 0 ? `링크 ${formatNumber(addCount)}개 가져오기` : "가져오기";
}

function getConflictNote(name: string, conflictWith: string) {
  return `공유 중인 내 폴더 ${withWa(conflictWith)} 이름이 같아서 ${withRo(name)} 따로 만들어요.`;
}

export {
  getRoParticle,
  getAddCaption,
  getChangeMessage,
  getConflictNote,
  getImportButtonLabel,
  getNoticeMessage,
  getStatusMessage,
  withEul,
  withRo,
  withWa,
};
