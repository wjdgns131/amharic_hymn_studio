import type { LyricReferenceVoice } from '../types/hymn';

export interface ExtractedOmrLyricItem {
  anchorId: string;
  measureNumber: number;
  pitch: string;
  verseNumber: number;
  text: string;
  syllabic: 'single' | 'begin' | 'middle' | 'end' | 'none';
}

/**
 * Extracts existing <lyric> tags embedded within the MusicXML for a selected reference voice.
 * Preserves verse numbers (Verse 1, Verse 2, etc.) and syllabic details.
 */
export function extractExistingOmrLyrics(
  xmlContent: string,
  selectedVoice: LyricReferenceVoice
): ExtractedOmrLyricItem[] {
  const lyrics: ExtractedOmrLyricItem[] = [];
  if (!xmlContent || !selectedVoice) return lyrics;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const partEl = xmlDoc.querySelector(`part[id="${selectedVoice.partId}"]`) || xmlDoc.querySelector('part');

    if (!partEl) return lyrics;

    const measures = partEl.querySelectorAll('measure');
    let anchorCounter = 1;

    measures.forEach((measureEl) => {
      const measureNumStr = measureEl.getAttribute('number');
      const measureNumber = measureNumStr ? parseInt(measureNumStr, 10) : 1;
      const notes = measureEl.querySelectorAll('note');

      notes.forEach((noteEl) => {
        const isGrace = noteEl.querySelector('grace') !== null;
        if (isGrace) return;

        const staffVal = parseInt(noteEl.querySelector('staff')?.textContent || '1', 10);
        const voiceVal = parseInt(noteEl.querySelector('voice')?.textContent || '1', 10);

        if (staffVal !== selectedVoice.staffNumber || voiceVal !== selectedVoice.voiceNumber) {
          return;
        }

        const isChord = noteEl.querySelector('chord') !== null;
        const isRest = noteEl.querySelector('rest') !== null;

        let pitchStr = 'REST';
        if (!isRest) {
          const step = noteEl.querySelector('pitch > step')?.textContent || '';
          const alter = noteEl.querySelector('pitch > alter')?.textContent;
          const octave = noteEl.querySelector('pitch > octave')?.textContent || '';
          let alterSymbol = '';
          if (alter === '1') alterSymbol = '♯';
          else if (alter === '-1') alterSymbol = '♭';
          pitchStr = `${step}${alterSymbol}${octave}`;
        }

        const anchorId = `anc_m${measureNumber}_${anchorCounter}`;
        if (!isChord) {
          anchorCounter++;
        }

        // Extract <lyric> elements
        const lyricEls = noteEl.querySelectorAll('lyric');
        lyricEls.forEach((lyricEl) => {
          const verseNumStr = lyricEl.getAttribute('number') || lyricEl.getAttribute('name');
          const verseNumber = verseNumStr ? parseInt(verseNumStr, 10) || 1 : 1;

          const textEl = lyricEl.querySelector('text');
          const text = textEl?.textContent?.trim() || '';

          const syllabicEl = lyricEl.querySelector('syllabic');
          const syllabicVal = (syllabicEl?.textContent?.trim() as any) || 'single';

          if (text) {
            lyrics.push({
              anchorId,
              measureNumber,
              pitch: pitchStr,
              verseNumber,
              text,
              syllabic: syllabicVal
            });
          }
        });
      });
    });
  } catch (err) {
    console.error('Failed to extract existing OMR lyrics:', err);
  }

  return lyrics;
}
