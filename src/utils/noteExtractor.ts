import type { ReadOnlyNoteEvent } from '../types/hymn';

/**
 * Extracts a read-only note sequence from a MusicXML raw XML string.
 * Does NOT modify the original MusicXML document.
 */
export function extractReadOnlyNoteSequence(xmlContent: string): ReadOnlyNoteEvent[] {
  const noteEvents: ReadOnlyNoteEvent[] = [];

  if (!xmlContent) return noteEvents;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

    const parts = xmlDoc.querySelectorAll('part');
    let globalNoteIdx = 1;

    parts.forEach((partEl) => {
      const partId = partEl.getAttribute('id') || 'P1';
      const measures = partEl.querySelectorAll('measure');

      measures.forEach((measureEl) => {
        const measureNumStr = measureEl.getAttribute('number');
        const measureNumber = measureNumStr ? parseInt(measureNumStr, 10) : 1;

        const notes = measureEl.querySelectorAll('note');

        notes.forEach((noteEl) => {
          // Ignore grace notes or chord secondary notes if needed, but capture primary pitch/rest
          const isGrace = noteEl.querySelector('grace') !== null;
          if (isGrace) return;

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

          const durationVal = parseInt(noteEl.querySelector('duration')?.textContent || '1', 10);
          const typeStr = noteEl.querySelector('type')?.textContent || undefined;

          // Check Tie
          let tieVal: 'start' | 'stop' | 'continue' | 'none' = 'none';
          const tieEl = noteEl.querySelector('tie');
          if (tieEl) {
            const type = tieEl.getAttribute('type');
            if (type === 'start') tieVal = 'start';
            else if (type === 'stop') tieVal = 'stop';
            else if (type === 'continue') tieVal = 'continue';
          }

          // Check Slur
          let slurVal: 'start' | 'stop' | 'none' = 'none';
          const slurEl = noteEl.querySelector('slur');
          if (slurEl) {
            const type = slurEl.getAttribute('type');
            if (type === 'start') slurVal = 'start';
            else if (type === 'stop') slurVal = 'stop';
          }

          noteEvents.push({
            noteId: `n_m${measureNumber}_${globalNoteIdx++}`,
            partId,
            measureNumber,
            pitch: pitchStr,
            duration: durationVal,
            durationType: typeStr,
            isRest,
            tie: tieVal,
            slur: slurVal
          });
        });
      });
    });
  } catch (err) {
    console.error('Failed to extract read-only note sequence:', err);
  }

  return noteEvents;
}
