import type { ProposalChange } from "../../lib/proposal-state";

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const RIEUL_FINAL = 8;

function getFinalConsonant(word: string) {
  const code = word.trim().codePointAt(word.trim().length - 1) ?? 0;
  if (code < HANGUL_START || code > HANGUL_END) {
    return -1;
  }
  return (code - HANGUL_START) % 28;
}

function withEul(word: string) {
  return `‘${word}’${getFinalConsonant(word) > 0 ? "을" : "를"}`;
}

function withRo(word: string) {
  const final = getFinalConsonant(word);
  return `‘${word}’${final > 0 && final !== RIEUL_FINAL ? "으로" : "로"}`;
}

function withWa(word: string) {
  return `‘${word}’${getFinalConsonant(word) > 0 ? "과" : "와"}`;
}

function excludedNote(name: string | null) {
  return name ? ` 새 폴더 ${withEul(name)} 가져오기에서 제외해요.` : "";
}

type ChangeMessage = { message: string; undoLabel: string | null };

function getChangeMessage(change: ProposalChange): ChangeMessage {
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
        message: `‘${change.fromName}’의 링크 ${change.count}개를 ${change.toKind === "existing" ? "기존" : "새"} 폴더 ${withRo(change.toName)} 합쳤어요.`,
        undoLabel: "합치기 취소",
      };
    case "rename-blocked":
      return {
        message: `공유 폴더와 같은 이름은 쓸 수 없어서 ${withRo(change.name)} 그대로 뒀어요.`,
        undoLabel: null,
      };
  }
}

function getConflictNote(name: string, conflictWith: string) {
  return `공유 중인 내 폴더 ${withWa(conflictWith)} 이름이 같아서 ${withRo(name)} 따로 만들어요.`;
}

export { getChangeMessage, getConflictNote, withEul, withRo, withWa };
