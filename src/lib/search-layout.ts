/**
 * Utility for keyboard layout swapping (EN <-> RU), transliteration, and multi-word matching
 */

const EN_KEYS = "`~qwertyuiop[]{}asdfghjkl;'\"zxcvbnm,.<>?@#$^&";
const RU_KEYS = "ёЁйцукенгшщзхъХЪфывапролджэЭячсмитьбюБЮ,.\"№;:?";

const EN_TO_RU: Record<string, string> = {};
const RU_TO_EN: Record<string, string> = {};

for (let i = 0; i < Math.min(EN_KEYS.length, RU_KEYS.length); i++) {
  const enChar = EN_KEYS[i];
  const ruChar = RU_KEYS[i];
  EN_TO_RU[enChar] = ruChar;
  RU_TO_EN[ruChar] = enChar;
}

export function switchKeyboardLayout(text: string): string {
  if (!text) return "";
  let toRu = "";
  let toEn = "";
  let hasEn = false;
  let hasRu = false;

  for (const ch of text) {
    if (EN_TO_RU[ch]) {
      toRu += EN_TO_RU[ch];
      hasEn = true;
    } else {
      toRu += ch;
    }

    if (RU_TO_EN[ch]) {
      toEn += RU_TO_EN[ch];
      hasRu = true;
    } else {
      toEn += ch;
    }
  }

  if (hasEn && !hasRu) return toRu;
  if (hasRu && !hasEn) return toEn;
  return toRu !== text ? toRu : toEn;
}

const RU_TRANSLIT_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
};

export function transliterateRuToEn(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .split("")
    .map((c) => RU_TRANSLIT_MAP[c] ?? c)
    .join("");
}

export function transliterateEnToRu(text: string): string {
  if (!text) return "";
  let s = text
    .toLowerCase()
    .replace(/coca/g, "кока")
    .replace(/cola/g, "кола")
    .replace(/zero/g, "зеро")
    .replace(/snickers/g, "сникерс")
    .replace(/lays/g, "лейс")
    .replace(/red bull/g, "ред булл")
    .replace(/sch/g, "щ")
    .replace(/sh/g, "ш")
    .replace(/ch/g, "ч")
    .replace(/zh/g, "ж")
    .replace(/ts/g, "ц")
    .replace(/ya/g, "я")
    .replace(/yu/g, "ю")
    .replace(/yo/g, "ё");

  const enToRuPhonetic: Record<string, string> = {
    a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х",
    i: "и", j: "дж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п",
    q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс",
    y: "й", z: "з"
  };

  return s
    .split("")
    .map((c) => enToRuPhonetic[c] ?? c)
    .join("");
}

/**
 * Returns distinct search query variants:
 * - Original query
 * - Swapped keyboard layout (RU <-> EN)
 * - Transliterated RU -> EN
 * - Transliterated EN -> RU
 */
export function getSearchVariants(rawQuery: string): string[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const set = new Set<string>();
  set.add(query);

  const swapped = switchKeyboardLayout(rawQuery).toLowerCase().trim();
  if (swapped && swapped !== query) {
    set.add(swapped);
  }

  const translitEn = transliterateRuToEn(query).trim();
  if (translitEn && translitEn !== query) {
    set.add(translitEn);
  }

  const translitRu = transliterateEnToRu(query).trim();
  if (translitRu && translitRu !== query) {
    set.add(translitRu);
  }

  if (swapped && swapped !== query) {
    const swappedTranslitEn = transliterateRuToEn(swapped).trim();
    if (swappedTranslitEn) set.add(swappedTranslitEn);
    const swappedTranslitRu = transliterateEnToRu(swapped).trim();
    if (swappedTranslitRu) set.add(swappedTranslitRu);
  }

  return Array.from(set);
}

/**
 * Checks whether target text matches any of the query variants.
 * Supports tokenized matching where all words in a query variant must be present in target.
 */
export function matchSearchQuery(
  targetText: string,
  variants: string[],
): { isMatch: boolean; score: number } {
  const normalizedTarget = targetText.toLowerCase();
  const cleanTargetWords = normalizedTarget.replace(/[-_.,/]/g, " ").split(/\s+/).filter(Boolean);

  let bestScore = -1;

  for (const variant of variants) {
    // 1. Direct full substring match
    const fullIdx = normalizedTarget.indexOf(variant);
    if (fullIdx !== -1) {
      const score = (fullIdx === 0 ? 1000 : 500) + variant.length * 10 - fullIdx;
      if (score > bestScore) bestScore = score;
      continue;
    }

    // 2. Multi-word / tokenized match
    const queryTokens = variant.split(/\s+/).filter(Boolean);
    if (queryTokens.length > 0) {
      let allTokensMatch = true;
      let tokenScore = 300;

      for (const token of queryTokens) {
        const found = cleanTargetWords.some((w) => w.includes(token)) || normalizedTarget.includes(token);
        if (!found) {
          allTokensMatch = false;
          break;
        }
        tokenScore += token.length * 5;
      }

      if (allTokensMatch && tokenScore > bestScore) {
        bestScore = tokenScore;
      }
    }
  }

  return {
    isMatch: bestScore >= 0,
    score: bestScore,
  };
}
