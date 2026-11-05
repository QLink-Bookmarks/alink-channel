type FolderNameGuide = {
  /** Text before the name. */
  before: string;
  /** The folder name, shown bold and italic. */
  name: string;
  /** Text after the name. */
  after: string;
};

const HANGUL_SYLLABLE_FIRST = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;
const HANGUL_FINALS = 28;

/** `true`/`false` for a Hangul syllable with/without a final consonant, `null` for anything else. */
function hasFinalConsonant(char: string): boolean | null {
  const code = char.codePointAt(0);
  if (code == null || code < HANGUL_SYLLABLE_FIRST || code > HANGUL_SYLLABLE_LAST) {
    return null;
  }
  return (code - HANGUL_SYLLABLE_FIRST) % HANGUL_FINALS !== 0;
}

/**
 * Guidance above the name re-entry field, split so the name can be emphasised:
 * - name ending in a Hangul syllable with a final consonant: `삭제하려면 {이름}을 입력해주세요.`
 * - name ending in a Hangul syllable without one: `삭제하려면 {이름}를 입력해주세요.`
 * - anything else (Latin, digits, jamo, emoji, symbols): `삭제하려면 아래에 {이름} 입력해주세요.`
 */
function getFolderNameGuide(folderName: string): FolderNameGuide {
  const name = folderName.trim();
  const lastChar = Array.from(name).at(-1) ?? "";
  const final = hasFinalConsonant(lastChar);
  if (final === null) {
    return { before: "삭제하려면 아래에 ", name, after: " 입력해주세요." };
  }
  return { before: "삭제하려면 ", name, after: final ? "을 입력해주세요." : "를 입력해주세요." };
}

export { getFolderNameGuide };
export type { FolderNameGuide };
