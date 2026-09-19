import type { LyricReferenceVoice, LyricNoteAnchor, MelodyExtractionMode } from '../types/hymn';

/**
 * Calculates a numerical MIDI note value from pitch string (e.g. "C4" -> 60, "E♭4" -> 63, "REST" -> -999)
 * for accurate highest/lowest pitch sorting.
 */
export function getPitchMidiValue(pitchStr: string): number {
  if (!pitchStr || pitchStr === 'REST') return -999;
  const match = pitchStr.match(/^([A-G])([♯♭]?)(-?\d+)$/);
  if (!match) return -999;

  const stepMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const stepVal = stepMap[match[1]] ?? 0;
  let alterVal = 0;
  if (match[2] === '♯') alterVal = 1;
  else if (match[2] === '♭') alterVal = -1;

  const octave = parseInt(match[3], 10);
  return (octave + 1) * 12 + stepVal + alterVal;
}

/**
 * Computes the derived melody candidate pitch from chord pitches based on the selected MelodyExtractionMode.
 */
export function getDerivedMelodyPitch(
  chordPitches: string[],
  mainPitch: string,
  mode: MelodyExtractionMode
): string {
  const validPitches = chordPitches.length > 0 ? chordPitches : [mainPitch];
  const nonRestPitches = validPitches.filter(p => p !== 'REST');

  if (nonRestPitches.length === 0) return 'REST';

  if (mode === 'ORIGINAL_CHORD') {
    return nonRestPitches.join(' / ');
  }

  const sorted = [...nonRestPitches].sort((a, b) => getPitchMidiValue(a) - getPitchMidiValue(b));

  if (mode === 'HIGHEST_NOTE') {
    return sorted[sorted.length - 1];
  } else if (mode === 'LOWEST_NOTE') {
    return sorted[0];
  }

  return sorted[sorted.length - 1];
}

export interface AnchorComparisonRow {
  index: number;
  measureNumber: number;
  beat: number;
  originalChord: string;
  highestPitch: string;
  lowestPitch: string;
  isRest: boolean;
}

/**
 * Generates comparison rows for the first N anchors of a voice (Original Chord vs Highest Pitch vs Lowest Pitch).
 */
export function generateAnchorComparisonRows(
  xmlContent: string,
  voice: LyricReferenceVoice,
  limit: number = 15
): AnchorComparisonRow[] {
  const anchors = extractLyricNoteAnchors(xmlContent, voice);
  return anchors.slice(0, limit).map((a) => ({
    index: a.anchorIndex,
    measureNumber: a.measureNumber,
    beat: a.beat,
    originalChord: a.chordPitches.length > 0 ? a.chordPitches.join(' / ') : a.mainPitch,
    highestPitch: getDerivedMelodyPitch(a.chordPitches, a.mainPitch, 'HIGHEST_NOTE'),
    lowestPitch: getDerivedMelodyPitch(a.chordPitches, a.mainPitch, 'LOWEST_NOTE'),
    isRest: a.isRest
  }));
}

/**
 * Detects available parts, staves, and voices in a MusicXML document.
 * Computes exact note, anchor (chord collapsed), and rest statistics for debug transparency.
 * Guarantees a unique ID per voice: `partId::staffNumber::voiceNumber`.
 */
export function detectAvailableVoices(xmlContent: string): LyricReferenceVoice[] {
  const voicesMap = new Map<string, LyricReferenceVoice>();
  if (!xmlContent) return [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const scoreParts = xmlDoc.querySelectorAll('score-part');

    // Create lookup map for Part Names
    const partNamesMap = new Map<string, string>();
    scoreParts.forEach(sp => {
      const pId = sp.getAttribute('id') || 'P1';
      const pName = sp.querySelector('part-name')?.textContent?.trim() || `Part ${pId}`;
      partNamesMap.set(pId, pName);
    });

    const parts = xmlDoc.querySelectorAll('part');

    parts.forEach((partEl) => {
      const partId = partEl.getAttribute('id') || 'P1';
      const partName = partNamesMap.get(partId) || `Part ${partId}`;
      const measures = partEl.querySelectorAll('measure');

      measures.forEach((measureEl) => {
        const notes = measureEl.querySelectorAll('note');

        notes.forEach((noteEl) => {
          const isGrace = noteEl.querySelector('grace') !== null;
          if (isGrace) return;

          const staffVal = parseInt(noteEl.querySelector('staff')?.textContent || '1', 10);
          const voiceVal = parseInt(noteEl.querySelector('voice')?.textContent || '1', 10);
          const isChord = noteEl.querySelector('chord') !== null;
          const isRest = noteEl.querySelector('rest') !== null;

          const uniqueId = `${partId}::staff${staffVal}::voice${voiceVal}`;

          if (!voicesMap.has(uniqueId)) {
            voicesMap.set(uniqueId, {
              id: uniqueId,
              partId,
              partName,
              staffNumber: staffVal,
              voiceNumber: voiceVal,
              noteCount: 0,
              anchorCount: 0,
              restCount: 0
            });
          }

          const entry = voicesMap.get(uniqueId)!;
          entry.noteCount = (entry.noteCount || 0) + 1;

          if (isRest) {
            entry.restCount = (entry.restCount || 0) + 1;
            entry.anchorCount = (entry.anchorCount || 0) + 1;
          } else if (!isChord) {
            // Main anchor event (non-chord secondary note)
            entry.anchorCount = (entry.anchorCount || 0) + 1;
          }
        });
      });
    });
  } catch (err) {
    console.error('Failed to detect available voices:', err);
  }

  const result = Array.from(voicesMap.values());

  // Default fallback if detection yields empty
  if (result.length === 0) {
    result.push({
      id: 'P1::staff1::voice1',
      partId: 'P1',
      partName: 'Part P1',
      staffNumber: 1,
      voiceNumber: 1,
      noteCount: 0,
      anchorCount: 0,
      restCount: 0
    });
  }

  return result;
}

/**
 * Extracts a chronological sequence of Lyric Note Anchors from a specified reference voice.
 * Automatically collapses chords occurring on the same onset into a single anchor event.
 */
export function extractLyricNoteAnchors(
  xmlContent: string,
  selectedVoice: LyricReferenceVoice
): LyricNoteAnchor[] {
  const anchors: LyricNoteAnchor[] = [];
  if (!xmlContent || !selectedVoice) return anchors;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const partEl = xmlDoc.querySelector(`part[id="${selectedVoice.partId}"]`) || xmlDoc.querySelector('part');

    if (!partEl) return anchors;

    const measures = partEl.querySelectorAll('measure');
    let anchorCounter = 1;
    let currentDivisions = 4; // Default fallback divisions (quarter note = 4)

    measures.forEach((measureEl) => {
      const measureNumStr = measureEl.getAttribute('number');
      const measureNumber = measureNumStr ? parseInt(measureNumStr, 10) : 1;

      // Update divisions if specified in attributes
      const divEl = measureEl.querySelector('attributes > divisions');
      if (divEl && divEl.textContent) {
        const parsedDiv = parseInt(divEl.textContent, 10);
        if (!isNaN(parsedDiv) && parsedDiv > 0) {
          currentDivisions = parsedDiv;
        }
      }

      let measureDurationSum = 0;
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
        const durationVal = parseInt(noteEl.querySelector('duration')?.textContent || '1', 10);

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

        // CHORD COLLAPSING LOGIC
        if (isChord && anchors.length > 0) {
          const lastAnchor = anchors[anchors.length - 1];
          if (!lastAnchor.chordPitches.includes(pitchStr)) {
            lastAnchor.chordPitches.push(pitchStr);
          }
        } else {
          // Calculate beat onset in measure (1-based quarter beat)
          const rawBeat = 1.0 + (measureDurationSum / currentDivisions);
          const formattedBeat = Math.round(rawBeat * 100) / 100;

          anchors.push({
            anchorId: `anc_m${measureNumber}_${anchorCounter}`,
            anchorIndex: anchorCounter,
            measureNumber,
            beat: formattedBeat,
            partId: selectedVoice.partId,
            staffNumber: selectedVoice.staffNumber,
            voiceNumber: selectedVoice.voiceNumber,
            mainPitch: pitchStr,
            chordPitches: isRest ? [] : [pitchStr],
            duration: durationVal,
            durationType: typeStr,
            isRest,
            tie: tieVal,
            slur: slurVal
          });

          anchorCounter++;
          measureDurationSum += durationVal;
        }
      });
    });
  } catch (err) {
    console.error('Failed to extract lyric note anchors:', err);
  }

  return anchors;
}
