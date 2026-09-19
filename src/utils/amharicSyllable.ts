import type { SingingUnit } from '../types/hymn';

/**
 * Split Amharic sentence text into default SingingUnits.
 * Uses Unicode code points and preserves word boundaries.
 */
export function parseTextToAmharicSingingUnits(
  text: string,
  idPrefix?: string
): SingingUnit[] {
  const units: SingingUnit[] = [];
  const words = text.trim().split(/\s+/);

  let idCounter = 1;

  words.forEach((word, wordIdx) => {
    const chars = Array.from(word);

    chars.forEach((char, charIdx) => {
      const isLastCharInWord = charIdx === chars.length - 1;
      const isLastWord = wordIdx === words.length - 1;

      units.push({
        id: idPrefix
          ? `syl_${idPrefix}_${idCounter++}`
          : `syl_am_${Date.now()}_${idCounter++}`,
        unitText: char,
        isWordBoundary: isLastCharInWord && !isLastWord,
        isExtended: false
      });
    });
  });

  return units;
}

/**
 * Reconstruct Amharic display text from SingingUnits.
 */
export function amharicSingingUnitsToDisplayText(
  units: SingingUnit[]
): string {
  let result = '';

  units.forEach(unit => {
    result += unit.unitText;

    if (unit.isWordBoundary) {
      result += ' ';
    }
  });

  return result;
}
