// Amharic Hymn Studio - Core Data Types (Step 2B-4 Updated)

export type ApprovalStatus = 
  | 'DRAFT'
  | 'TRANSLATED'
  | 'ADAPTED'
  | 'ALIGNED'
  | 'REVIEWED'
  | 'APPROVED';

export type OmrValidationStatus = 
  | 'UNVERIFIED'
  | 'REVIEWING'
  | 'VERIFIED'
  | 'NEEDS_CORRECTION';

export type SectionType = 'VERSE' | 'CHORUS' | 'REFRAIN' | 'BRIDGE' | 'OTHER';

export type AlignmentType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'EXTENSION' | 'SKIP';

export type AlignmentItemStatus = 'PROPOSED' | 'MANUAL' | 'CONFIRMED';

export type MelodyExtractionMode = 'ORIGINAL_CHORD' | 'HIGHEST_NOTE' | 'LOWEST_NOTE';

export type AnchorVerificationStatus = 'UNVERIFIED' | 'MATCHED' | 'MISMATCH';

export type VisualTargetConfidence = 'NOT_INSPECTED' | 'EXACT' | 'APPROXIMATE' | 'UNAVAILABLE';

export interface RuntimeMappingResult {
  anchorId: string;
  measureNumber: number;
  beat: number;
  targetPitch: string;
  measureFound: boolean;
  staffEntryFound: boolean;
  voiceEntryFound: boolean;
  voiceId: string;
  graphicalNotesFound: string[];
  targetPitchFound: boolean;
  positionFound: boolean;
  svgTargetFound: boolean;
  confidence: VisualTargetConfidence;
  failureReason?: string;
}

export interface OsmdRuntimeObjectInspectorInfo {
  staffEntryConstructor: string;
  staffEntryKeys: string[];
  detectedChildArrays: string[];
  voiceEntryCandidatePath: string;
  voiceEntryConstructor: string;
  voiceEntryKeys: string[];
  voiceIdPathAndValue: string;
  graphicalNoteCandidatePath: string;
  graphicalNoteCount: number;
  graphicalNotePitchesFound: string[];
  targetPitchPath: string;
  positionAndShapePath: string;
  targetNoteFound: boolean;
  positionAndShapeFound: boolean;
  svgElementFound: boolean;
  finalConfidence: VisualTargetConfidence;
  failureReason?: string;
}

export interface AnchorDiagnosticInfo {
  anchorId: string;
  xmlPartId: string;
  xmlStaffNumber: number;
  xmlVoiceNumber: number;
  xmlMeasureNumber: number;
  xmlBeat: number;
  targetPitch: string;
  osmdMeasureListIndex?: number;
  osmdSourceMeasureNumber?: number;
  matchedStaffEntryTimestamp?: string;
  matchedVoiceId?: string;
  graphicalNotesFound?: string[];
  targetGraphicalNote?: string;
  positionAndShape?: string;
  renderBackend?: string;
  highlightTarget?: string;
  finalConfidence: VisualTargetConfidence;
  failureReason?: string;
  runtimeInspector?: OsmdRuntimeObjectInspectorInfo;
}

export interface SingingUnit {
  id: string;
  unitText: string;        // e.g. "내"
  isWordBoundary: boolean; // space after this unit?
  isExtended: boolean;     // melismatic / slur extension?
}

export interface LiteralTranslationLineData {
  id: string;
  koreanLineId: string;
  lineIndex: number;
  sectionType: SectionType;
  sectionNumber: number;
  koreanText: string;
  literalAmharicText: string;
  approvalStatus: ApprovalStatus;
}
export interface AmharicLyricLineData {
  id: string;
  koreanLineId: string;
  lineIndex: number;
  sectionType: SectionType;
  sectionNumber: number;
  displayText: string;
  singingUnits: SingingUnit[];
  approvalStatus: ApprovalStatus;
  nativeReview?: NativeReview;
}

export interface LyricLineData {
  id: string;
  lineIndex: number;
  sectionType: SectionType;
  sectionNumber: number;
  displayText: string;              // Authoritative sentence string
  singingUnits: SingingUnit[];      // Array of editable singing units
  approvalStatus: ApprovalStatus;
  nativeReview?: NativeReview;
}

export interface ReadOnlyNoteEvent {
  noteId: string;
  partId: string;
  measureNumber: number;
  pitch: string;         // e.g., "G4" or "REST"
  duration: number;      // Beats / Quarter duration
  durationType?: string; // "eighth", "quarter", etc.
  isRest: boolean;
  tie: 'start' | 'stop' | 'continue' | 'none';
  slur: 'start' | 'stop' | 'none';
}

export interface LyricReferenceVoice {
  id: string;          // Unique ID: e.g. "P1::staff1::voice1"
  partId: string;      // e.g. "P1"
  partName: string;    // e.g. "Soprano" or "Part P1"
  staffNumber: number; // 1 or 2
  voiceNumber: number; // 1 or 2
  noteCount?: number;
  anchorCount?: number;
  restCount?: number;
}

export interface LyricNoteAnchor {
  anchorId: string;     // Unique anchor ID e.g. "anc_m1_1"
  anchorIndex: number;  // 1-based chronological index within voice (e.g. 1, 2, 3...)
  measureNumber: number;
  beat: number;         // Beat onset position in measure e.g. 1.0, 2.5, etc.
  partId: string;
  staffNumber: number;
  voiceNumber: number;
  mainPitch: string;    // e.g. "G4" or "REST"
  chordPitches: string[];// All pitches if it's a chord e.g. ["G4", "B4", "D5"]
  derivedMelodyPitch?: string; // Calculated derived melody candidate pitch
  duration: number;
  durationType?: string;
  isRest: boolean;
  tie: 'start' | 'stop' | 'continue' | 'none';
  slur: 'start' | 'stop' | 'none';
}

export interface SyllableAlignmentItem {
  alignmentId: string;
  layerKey: string;          // e.g. "KOREAN_VERSE_1", "KOREAN_VERSE_2", "KOREAN_VERSE_3", "KOREAN_CHORUS"
  lineId: string;
  syllableId?: string;       // Primary singingUnitId
  authoritativeText?: string;// e.g. "내"
  singingUnitIds: string[];  // Unit IDs associated
  noteAnchorIds: string[];   // Anchor IDs associated
  alignmentType: AlignmentType;
  melisma: boolean;
  manuallyConfirmed: boolean;
  status: AlignmentItemStatus;// 'PROPOSED' | 'MANUAL' | 'CONFIRMED'
}

export interface OmrMetadata {
  engineName: 'Audiveris OMR' | 'External OMR';
  engineVersion?: string;
  sourcePdfName?: string;
  convertedAt?: string;
  validationStatus: OmrValidationStatus;
  validationNotes?: string;
  verifiedAt?: string;
}

export interface NativeReview {
  reviewerName: string;
  naturalWordingNotes: string;
  theologicalNotes: string;
  pronunciationNotes: string;
  syllableNotes: string;
  singabilityScore: number; // 1 to 5
  reviewedAt?: string;
}

export interface ScoreMetadata {
  fileName: string;
  fileType: string;
  fileSizeFormatted: string;
  title: string;
  composer: string;
  partCount: number;
}

export interface ScoreFilesState {
  originalScoreXml: string | null;  // Read-only original raw MusicXML from import or OMR
  amharicScoreXml: string | null;   // Null for now (Do not fake)
  bilingualScoreXml: string | null; // Null for now (Do not fake)
  metadata: ScoreMetadata | null;
  omrMetadata: OmrMetadata | null;  // OMR process and validation tracking
  sourcePdfName: string | null;     // Original PDF file reference
  omrDetectedLyrics?: string[];     // Separately preserved OCR/OMR detected lyrics
}

export interface HymnProject {
  id: string;
  titleKo: string;
  titleAm: string;
  titleEn: string;
  keySignature: string;
  timeSignature: string;
  tempoBpm: number;
  status: ApprovalStatus;
  scores: ScoreFilesState;
  authoritativeKoreanLyrics: LyricLineData[];
  literalTranslations: LiteralTranslationLineData[];
  amharicLyrics: AmharicLyricLineData[];
  extractedNotesSequence: ReadOnlyNoteEvent[];
  selectedVoice?: LyricReferenceVoice;
  alignments: SyllableAlignmentItem[];
  createdAt: string;
  updatedAt: string;
}
