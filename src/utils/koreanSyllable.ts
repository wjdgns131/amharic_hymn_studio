import type { SingingUnit } from '../types/hymn';

/**
 * Helper to split Korean sentence text into default SingingUnits, preserving word boundaries.
 * E.g., "내 영혼이 은총 입어" -> [{ unitText: '내' }, { unitText: '영' }, { unitText: '혼' }, { unitText: '이', isWordBoundary: true }, ...]
 */
export function parseTextToSingingUnits(text: string, idPrefix?: string): SingingUnit[] {
  const units: SingingUnit[] = [];
  const words = text.trim().split(/\s+/);

  let idCounter = 1;

  words.forEach((word, wordIdx) => {
    const chars = Array.from(word);
    chars.forEach((char, charIdx) => {
      const isLastCharInWord = charIdx === chars.length - 1;
      const isLastWord = wordIdx === words.length - 1;

      units.push({
        id: idPrefix ? `syl_${idPrefix}_${idCounter++}` : `syl_${Date.now()}_${idCounter++}`,
        unitText: char,
        isWordBoundary: isLastCharInWord && !isLastWord,
        isExtended: false
      });
    });
  });

  return units;
}

/**
 * Reconstructs display sentence text from an array of SingingUnits.
 */
export function singingUnitsToDisplayText(units: SingingUnit[]): string {
  let result = '';
  units.forEach(u => {
    result += u.unitText;
    if (u.isWordBoundary) {
      result += ' ';
    }
  });
  return result;
}
