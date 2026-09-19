import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { 
  LyricNoteAnchor, 
  VisualTargetConfidence, 
  AnchorDiagnosticInfo, 
  OsmdRuntimeObjectInspectorInfo 
} from '../types/hymn';

export interface OsmdMappingResult extends AnchorDiagnosticInfo {
  targetGraphicalNoteObj?: any;
  svgElementObj?: SVGElement | null;
}

/**
 * Robustly inspects an object shape without circular reference crashes.
 */
function inspectObjectShape(obj: any): { constructorName: string; keys: string[]; childArrays: string[] } {
  if (!obj || typeof obj !== 'object') {
    return { constructorName: typeof obj, keys: [], childArrays: [] };
  }

  const constructorName = obj.constructor?.name || 'Object';
  const keys = Object.keys(obj);
  const childArrays: string[] = [];

  for (const k of keys) {
    try {
      if (Array.isArray(obj[k])) {
        childArrays.push(`${k}: Array(${obj[k].length})`);
      }
    } catch (e) {}
  }

  return { constructorName, keys, childArrays };
}

/**
 * Robustly finds all GraphicalVoiceEntry objects from a GraphicalStaffEntry across all possible OSMD property names.
 */
function extractVoiceEntriesFromStaffEntry(staffEntry: any): { path: string; voiceEntries: any[] } {
  if (!staffEntry) return { path: 'None', voiceEntries: [] };

  // Known candidates & dynamic reflection
  const candidates = [
    'voiceEntries',
    'VoiceEntries',
    'graphicalVoiceEntries',
    'vocalStaffEntries',
    'vocalVoiceEntries',
    'entries'
  ];

  for (const prop of candidates) {
    if (Array.isArray(staffEntry[prop]) && staffEntry[prop].length > 0) {
      return { path: `staffEntry.${prop}`, voiceEntries: staffEntry[prop] };
    }
  }

  // Dynamic scan for any Array property containing objects
  for (const key of Object.keys(staffEntry)) {
    try {
      const val = staffEntry[key];
      if (Array.isArray(val) && val.length > 0) {
        const firstItem = val[0];
        if (firstItem && typeof firstItem === 'object') {
          const cName = firstItem.constructor?.name || '';
          if (cName.includes('Voice') || cName.includes('Entry') || firstItem.notes || firstItem.Notes) {
            return { path: `staffEntry.${key} [ctor: ${cName}]`, voiceEntries: val };
          }
        }
      }
    } catch (e) {}
  }

  return { path: 'None (No array matching VoiceEntries)', voiceEntries: [] };
}

/**
 * Robustly finds all GraphicalNote objects from a GraphicalVoiceEntry across all possible OSMD property names.
 */
function extractNotesFromVoiceEntry(voiceEntry: any): { path: string; notes: any[] } {
  if (!voiceEntry) return { path: 'None', notes: [] };

  const candidates = ['notes', 'Notes', 'graphicalNotes', 'GraphicalNotes', 'vocalNotes'];

  for (const prop of candidates) {
    if (Array.isArray(voiceEntry[prop]) && voiceEntry[prop].length > 0) {
      return { path: `voiceEntry.${prop}`, notes: voiceEntry[prop] };
    }
  }

  // Dynamic scan for any Array property containing objects with sourceNote / pitch
  for (const key of Object.keys(voiceEntry)) {
    try {
      const val = voiceEntry[key];
      if (Array.isArray(val) && val.length > 0) {
        const firstItem = val[0];
        if (firstItem && typeof firstItem === 'object') {
          if (firstItem.sourceNote || firstItem.SourceNote || firstItem.pitch || firstItem.Pitch || firstItem.PositionAndShape) {
            return { path: `voiceEntry.${key}`, notes: val };
          }
        }
      }
    } catch (e) {}
  }

  return { path: 'None (No array matching GraphicalNotes)', notes: [] };
}

/**
 * Safely extracts Pitch properties from a GraphicalNote or SourceNote.
 */
function extractPitchFromGraphicalNote(gNote: any): { pitchStr: string; details: string; pitchObj: any } {
  if (!gNote) return { pitchStr: 'UNKNOWN', details: 'N/A', pitchObj: null };

  const sNote = gNote.sourceNote || gNote.SourceNote || gNote;
  const pitchObj = sNote.pitch || sNote.Pitch || (gNote.Pitch || gNote.pitch);

  if (!pitchObj) {
    return { pitchStr: 'NO_PITCH_OBJ', details: 'No Pitch object on GraphicalNote', pitchObj: null };
  }

  const octave = (pitchObj.Octave ?? pitchObj.octave ?? 1) + 3;

  // OSMD Pitch FundamentalNote is chromatic halftone index (0=C, 2=D, 4=E, 5=F, 7=G, 9=A, 11=B)
  const fnVal = pitchObj.FundamentalNote ?? pitchObj.fundamentalNote ?? 0;
  const stepMap: Record<number, string> = {
    0: 'C', 1: 'C',
    2: 'D', 3: 'D',
    4: 'E',
    5: 'F', 6: 'F',
    7: 'G', 8: 'G',
    9: 'A', 10: 'A',
    11: 'B'
  };
  const stepChar = stepMap[fnVal] || 'C';

  // Accidental Half Tones resolution
  let accHalf = pitchObj.AccidentalHalfTones ?? pitchObj.accidentalHalfTones;
  if (accHalf === undefined && (pitchObj.Accidental !== undefined || pitchObj.accidental !== undefined || pitchObj.alter !== undefined)) {
    const acc = pitchObj.Accidental ?? pitchObj.accidental ?? pitchObj.alter;
    if (acc === 1 || acc === -1 || acc === 'FLAT' || acc === 'flat') accHalf = -1;
    else if (acc === 0 || acc === 1 || acc === 'SHARP' || acc === 'sharp') accHalf = 1;
    else if (acc === 5 || acc === 'DOUBLEFLAT') accHalf = -2;
    else if (acc === 4 || acc === 'DOUBLESHARP') accHalf = 2;
    else accHalf = 0;
  }

  let accSym = '';
  if (accHalf === -1) accSym = '♭';
  else if (accHalf === 1) accSym = '♯';
  else if (accHalf === -2) accSym = '𝄫';
  else if (accHalf === 2) accSym = '𝄪';

  const pitchStr = `${stepChar}${accSym}${octave}`;
  const halfTone = pitchObj.getHalfTone ? pitchObj.getHalfTone() : (pitchObj.halfTone ?? 'N/A');

  const details = `Pitch: ${pitchStr} (fn: ${fnVal}, accHalf: ${accHalf}, octave: ${octave}, halfTone: ${halfTone})`;
  return { pitchStr, details, pitchObj };
}

/**
 * Finds the exact OSMD Graphical Note Target for a given LyricNoteAnchor and derived melody pitch.
 * Strictly populates OsmdRuntimeObjectInspectorInfo with actual runtime reflection evidence.
 */
export function findOsmdGraphicalNoteTarget(
  osmd: OpenSheetMusicDisplay | null,
  anchor: LyricNoteAnchor,
  derivedMelodyPitch?: string
): OsmdMappingResult {
  const targetPitch = derivedMelodyPitch || anchor.mainPitch;

  const baseResult: OsmdMappingResult = {
    anchorId: anchor.anchorId,
    xmlPartId: anchor.partId,
    xmlStaffNumber: anchor.staffNumber,
    xmlVoiceNumber: anchor.voiceNumber,
    xmlMeasureNumber: anchor.measureNumber,
    xmlBeat: anchor.beat,
    targetPitch,
    finalConfidence: 'UNAVAILABLE',
    renderBackend: 'SVG'
  };

  if (!osmd || !osmd.GraphicSheet || !osmd.GraphicSheet.MeasureList) {
    const inspector: OsmdRuntimeObjectInspectorInfo = {
      staffEntryConstructor: 'N/A',
      staffEntryKeys: [],
      detectedChildArrays: [],
      voiceEntryCandidatePath: 'N/A',
      voiceEntryConstructor: 'N/A',
      voiceEntryKeys: [],
      voiceIdPathAndValue: 'N/A',
      graphicalNoteCandidatePath: 'N/A',
      graphicalNoteCount: 0,
      graphicalNotePitchesFound: [],
      targetPitchPath: 'N/A',
      positionAndShapePath: 'N/A',
      targetNoteFound: false,
      positionAndShapeFound: false,
      svgElementFound: false,
      finalConfidence: 'UNAVAILABLE',
      failureReason: 'OSMD GraphicSheet MeasureList not initialized'
    };

    return {
      ...baseResult,
      failureReason: 'OSMD GraphicSheet MeasureList not initialized',
      runtimeInspector: inspector
    };
  }

  try {
    const graphicSheet = osmd.GraphicSheet;
    const measureList = graphicSheet.MeasureList;
    const staffIndex = Math.max(0, anchor.staffNumber - 1);

    let osmdMeasureListIndex: number | undefined = undefined;
    let osmdSourceMeasureNumber: number | undefined = undefined;
    let matchedStaffEntryTimestamp: string | undefined = undefined;
    let matchedVoiceId: string | undefined = undefined;
    const graphicalNotesFound: string[] = [];
    let targetGraphicalNote: string | undefined = undefined;
    let positionAndShape: string | undefined = undefined;
    let highlightTarget: string | undefined = undefined;
    let finalConfidence: VisualTargetConfidence = 'UNAVAILABLE';
    let failureReason = '';
    let targetMeasure: any = null;

    // 1. Locate Measure in OSMD MeasureList (Handles Pickup measure M.0 & 0-based indexing)
    for (let mIdx = 0; mIdx < measureList.length; mIdx++) {
      const staffMeasures = measureList[mIdx];
      if (!staffMeasures || staffMeasures.length <= staffIndex) continue;

      const gMeasure = staffMeasures[staffIndex];
      if (!gMeasure) continue;

      const sourceMeasureNum = gMeasure.MeasureNumber ?? gMeasure.parentSourceMeasure?.MeasureNumber;
      if (sourceMeasureNum === anchor.measureNumber || mIdx === anchor.measureNumber) {
        targetMeasure = gMeasure;
        osmdMeasureListIndex = mIdx;
        osmdSourceMeasureNumber = sourceMeasureNum;
        break;
      }
    }

    if (!targetMeasure) {
      const inspector: OsmdRuntimeObjectInspectorInfo = {
        staffEntryConstructor: 'N/A',
        staffEntryKeys: [],
        detectedChildArrays: [],
        voiceEntryCandidatePath: 'N/A',
        voiceEntryConstructor: 'N/A',
        voiceEntryKeys: [],
        voiceIdPathAndValue: 'N/A',
        graphicalNoteCandidatePath: 'N/A',
        graphicalNoteCount: 0,
        graphicalNotePitchesFound: [],
        targetPitchPath: 'N/A',
        positionAndShapePath: 'N/A',
        targetNoteFound: false,
        positionAndShapeFound: false,
        svgElementFound: false,
        finalConfidence: 'UNAVAILABLE',
        failureReason: `Measure M.${anchor.measureNumber} not found in OSMD MeasureList`
      };

      return {
        ...baseResult,
        osmdMeasureListIndex,
        osmdSourceMeasureNumber,
        finalConfidence: 'UNAVAILABLE',
        failureReason: `Measure M.${anchor.measureNumber} not found in OSMD MeasureList`,
        runtimeInspector: inspector
      };
    }

    // 2. Extract StaffEntries from targetMeasure
    let staffEntriesList: any[] = [];
    if (Array.isArray(targetMeasure.staffEntries)) staffEntriesList = targetMeasure.staffEntries;
    else if (Array.isArray(targetMeasure.StaffEntries)) staffEntriesList = targetMeasure.StaffEntries;
    else if (Array.isArray(targetMeasure.staffEntriesList)) staffEntriesList = targetMeasure.staffEntriesList;
    else {
      // Find any array on targetMeasure
      for (const k of Object.keys(targetMeasure)) {
        if (Array.isArray(targetMeasure[k]) && targetMeasure[k].length > 0) {
          staffEntriesList = targetMeasure[k];
          break;
        }
      }
    }

    let targetStaffEntry: any = null;
    let minTsDiff = Number.MAX_VALUE;
    const expectedReal = (anchor.beat - 1) / 4.0;

    staffEntriesList.forEach((se: any, seIdx: number) => {
      const tsReal = se.relInMeasureTimestamp
        ? (se.relInMeasureTimestamp.RealValue ?? (se.relInMeasureTimestamp.numerator / se.relInMeasureTimestamp.denominator))
        : seIdx;

      const diff = Math.abs(tsReal - expectedReal);
      if (diff < minTsDiff) {
        minTsDiff = diff;
        targetStaffEntry = se;
        matchedStaffEntryTimestamp = `relInMeasureTimestamp: ${se.relInMeasureTimestamp?.toString() ?? tsReal} (RealValue: ${tsReal.toFixed(3)})`;
      }
    });

    if (!targetStaffEntry && staffEntriesList.length > 0) {
      targetStaffEntry = staffEntriesList[0];
    }

    // Inspect StaffEntry Runtime Object
    const staffEntryShape = inspectObjectShape(targetStaffEntry);
    const { path: voiceEntryPath, voiceEntries } = extractVoiceEntriesFromStaffEntry(targetStaffEntry);

  let targetVoiceEntry: any = null;
    let voiceIdPathAndValue = 'N/A';

    if (voiceEntries.length > 0) {
      voiceEntries.forEach((ve: any) => {
        const vId = ve.parentVoiceEntry?.parentVoice?.VoiceId ?? ve.parentVoiceEntry?.parentVoice?.voiceId ?? ve.parentVoice?.VoiceId ?? ve.parentVoice?.voiceId ?? ve.VoiceId ?? ve.voiceId ?? '1';
        if (!targetVoiceEntry || vId.toString() === anchor.voiceNumber.toString()) {
          targetVoiceEntry = ve;
          matchedVoiceId = `VoiceId: ${vId}`;
          voiceIdPathAndValue = `Path: ${voiceEntryPath}[].VoiceId, Value: ${vId}`;
        }
      });
      if (!targetVoiceEntry) targetVoiceEntry = voiceEntries[0];
    }

    const voiceEntryShape = inspectObjectShape(targetVoiceEntry);
    const { path: graphicalNotePath, notes: graphicalNotesList } = extractNotesFromVoiceEntry(targetVoiceEntry);

    let targetGNoteObj: any = null;
    let targetPitchPath = 'N/A';

    graphicalNotesList.forEach((gNote: any, gIdx: number) => {
      const { pitchStr, details } = extractPitchFromGraphicalNote(gNote);
      graphicalNotesFound.push(pitchStr);

      const stepChar = pitchStr.charAt(0);
      const pitchAlt = pitchStr.replace('♭', 'b').replace('♯', '#');
      const pitchPlain = pitchStr.replace('♭', '').replace('♯', '');

      if (
        pitchStr === targetPitch ||
        pitchAlt === targetPitch ||
        pitchPlain === targetPitch ||
        (targetPitch.startsWith(stepChar) && Math.abs(parseInt(pitchStr.slice(-1) || '4', 10) - parseInt(targetPitch.slice(-1) || '4', 10)) <= 0)
      ) {
        targetGNoteObj = gNote;
        targetGraphicalNote = details;
        targetPitchPath = `${graphicalNotePath}[${gIdx}].sourceNote.Pitch -> ${pitchStr}`;
      }
    });

    // 4. PositionAndShape & SVG Element Resolution
    let positionAndShapePath = 'N/A';
    let positionAndShapeFound = false;
    let svgElementFound = false;
    let svgElementObj: SVGElement | null = null;

    if (targetGNoteObj) {
      const pos = targetGNoteObj.PositionAndShape || targetGNoteObj.positionAndShape || targetStaffEntry?.PositionAndShape;
      svgElementObj = targetGNoteObj.getSVGGElement ? targetGNoteObj.getSVGGElement() : null;

      if (pos) {
        positionAndShapeFound = true;
        const absX = pos.AbsolutePosition?.x ?? pos.absolutePosition?.x ?? 0;
        const absY = pos.AbsolutePosition?.y ?? pos.absolutePosition?.y ?? 0;
        const w = pos.SizeWidth ?? pos.sizeWidth ?? 0;
        const h = pos.SizeHeight ?? pos.sizeHeight ?? 0;
        positionAndShape = `AbsolutePos: (${absX.toFixed(2)}, ${absY.toFixed(2)}), BBox: w=${w.toFixed(2)}, h=${h.toFixed(2)}`;
        positionAndShapePath = `targetGNoteObj.PositionAndShape: (${absX.toFixed(2)}, ${absY.toFixed(2)})`;
      }

      if (svgElementObj) {
        svgElementFound = true;
        highlightTarget = `SVG Element: <${svgElementObj.tagName}> id="${svgElementObj.id || 'none'}" class="${svgElementObj.getAttribute('class') || 'none'}"`;
        finalConfidence = 'EXACT';
      } else if (positionAndShapeFound) {
        highlightTarget = `PositionAndShape (${positionAndShape})`;
        finalConfidence = 'EXACT';
      } else {
        highlightTarget = 'Chord StaffEntry (GraphicalNote isolated, rendered position unverified)';
        finalConfidence = 'APPROXIMATE';
      }
    } else if (targetStaffEntry) {
      highlightTarget = 'StaffEntry Chord Onset (Specific pitch GraphicalNote not isolated)';
      finalConfidence = 'APPROXIMATE';
      failureReason = `Could not isolate exact GraphicalNote for ${targetPitch}`;
    } else {
      highlightTarget = 'None';
      finalConfidence = 'UNAVAILABLE';
      failureReason = `StaffEntry not found in measure ${anchor.measureNumber}`;
    }

    const runtimeInspector: OsmdRuntimeObjectInspectorInfo = {
      staffEntryConstructor: staffEntryShape.constructorName,
      staffEntryKeys: staffEntryShape.keys,
      detectedChildArrays: staffEntryShape.childArrays,
      voiceEntryCandidatePath: voiceEntryPath,
      voiceEntryConstructor: voiceEntryShape.constructorName,
      voiceEntryKeys: voiceEntryShape.keys,
      voiceIdPathAndValue,
      graphicalNoteCandidatePath: graphicalNotePath,
      graphicalNoteCount: graphicalNotesList.length,
      graphicalNotePitchesFound: graphicalNotesFound,
      targetPitchPath,
      positionAndShapePath,
      targetNoteFound: !!targetGNoteObj,
      positionAndShapeFound,
      svgElementFound,
      finalConfidence,
      failureReason: failureReason || undefined
    };

    return {
      anchorId: anchor.anchorId,
      xmlPartId: anchor.partId,
      xmlStaffNumber: anchor.staffNumber,
      xmlVoiceNumber: anchor.voiceNumber,
      xmlMeasureNumber: anchor.measureNumber,
      xmlBeat: anchor.beat,
      targetPitch,
      osmdMeasureListIndex,
      osmdSourceMeasureNumber,
      matchedStaffEntryTimestamp,
      matchedVoiceId,
      graphicalNotesFound,
      targetGraphicalNote,
      positionAndShape,
      renderBackend: 'SVG',
      highlightTarget,
      finalConfidence,
      failureReason: failureReason || undefined,
      targetGraphicalNoteObj: targetGNoteObj,
      svgElementObj,
      runtimeInspector
    };
  } catch (err: any) {
    const inspector: OsmdRuntimeObjectInspectorInfo = {
      staffEntryConstructor: 'Error',
      staffEntryKeys: [],
      detectedChildArrays: [],
      voiceEntryCandidatePath: 'Error',
      voiceEntryConstructor: 'Error',
      voiceEntryKeys: [],
      voiceIdPathAndValue: 'Error',
      graphicalNoteCandidatePath: 'Error',
      graphicalNoteCount: 0,
      graphicalNotePitchesFound: [],
      targetPitchPath: 'Error',
      positionAndShapePath: 'Error',
      targetNoteFound: false,
      positionAndShapeFound: false,
      svgElementFound: false,
      finalConfidence: 'UNAVAILABLE',
      failureReason: `OSMD GraphicSheet mapping exception: ${err?.message || err}`
    };

    return {
      ...baseResult,
      finalConfidence: 'UNAVAILABLE',
      failureReason: `OSMD GraphicSheet mapping exception: ${err?.message || err}`,
      runtimeInspector: inspector
    };
  }
}

