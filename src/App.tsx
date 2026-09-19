import React, { useState, useRef, useEffect } from 'react';
import type { HymnProject, ScoreFilesState, OmrValidationStatus, OmrMetadata, LyricLineData, LiteralTranslationLineData, AmharicLyricLineData, SyllableAlignmentItem, LyricReferenceVoice } from './types/hymn';
import { parseMusicXmlMetadata } from './utils/musicxmlParser';
import { extractMusicXmlFromMxl } from './utils/mxlExtractor';
import { parseTextToSingingUnits } from './utils/koreanSyllable';
import { extractReadOnlyNoteSequence } from './utils/noteExtractor';
import { ScoreViewer } from './components/ScoreViewer';
import { OmrValidationPanel } from './components/OmrValidationPanel';
import { KoreanLyricEditor } from './components/KoreanLyricEditor';
import { SyllableAlignmentEditor } from './components/SyllableAlignmentEditor';
import { NativeReviewEditor } from './components/NativeReviewEditor';
import { LiteralTranslationEditor } from './components/LiteralTranslationEditor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { exportProjectBackup } from './utils/projectBackup';
import './index.css';

const LOCAL_STORAGE_OMR_KEY = 'amharic_hymn_omr_metadata';
const LOCAL_STORAGE_LYRICS_KEY = 'amharic_hymn_authoritative_lyrics';
const LOCAL_STORAGE_ALIGNMENT_KEY = 'amharic_hymn_korean_alignment';
const LOCAL_STORAGE_AMHARIC_LYRICS_KEY = 'amharic_hymn_amharic_lyrics';
const LOCAL_STORAGE_LITERAL_TRANSLATION_KEY = 'amharic_hymn_literal_translations';

// Initial Authoritative Korean Lyrics for "495 내 영혼이 은총 입어"
const initialAuthoritativeKoreanLyrics: LyricLineData[] = [
  {
    id: 'ko_v1_l1',
    lineIndex: 1,
    sectionType: 'VERSE',
    sectionNumber: 1,
    displayText: '내 영혼이 은총 입어 중한 죄짐 벗고 보니',
    singingUnits: parseTextToSingingUnits('내 영혼이 은총 입어 중한 죄짐 벗고 보니', 'ko_v1_l1'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_v1_l2',
    lineIndex: 2,
    sectionType: 'VERSE',
    sectionNumber: 1,
    displayText: '슬픔 많은 이 세상도 천국으로 화하도다',
    singingUnits: parseTextToSingingUnits('슬픔 많은 이 세상도 천국으로 화하도다', 'ko_v1_l2'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_v2_l1',
    lineIndex: 3,
    sectionType: 'VERSE',
    sectionNumber: 2,
    displayText: '주의 얼굴 뵙기 전에 멀리 뵈던 하늘나라',
    singingUnits: parseTextToSingingUnits('주의 얼굴 뵙기 전에 멀리 뵈던 하늘나라', 'ko_v2_l1'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_v2_l2',
    lineIndex: 4,
    sectionType: 'VERSE',
    sectionNumber: 2,
    displayText: '내 맘 속에 이뤄지니 날로날로 가깝도다',
    singingUnits: parseTextToSingingUnits('내 맘 속에 이뤄지니 날로날로 가깝도다', 'ko_v2_l2'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_v3_l1',
    lineIndex: 5,
    sectionType: 'VERSE',
    sectionNumber: 3,
    displayText: '높은 산이 거친 들이 초막이나 궁궐이나',
    singingUnits: parseTextToSingingUnits('높은 산이 거친 들이 초막이나 궁궐이나', 'ko_v3_l1'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_v3_l2',
    lineIndex: 6,
    sectionType: 'VERSE',
    sectionNumber: 3,
    displayText: '내 주 예수 모신 곳이 그 어디나 하늘나라',
    singingUnits: parseTextToSingingUnits('내 주 예수 모신 곳이 그 어디나 하늘나라', 'ko_v3_l2'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_ch_l1',
    lineIndex: 7,
    sectionType: 'CHORUS',
    sectionNumber: 1,
    displayText: '할렐루야 찬양하세 내 모든 죄 사함받고',
    singingUnits: parseTextToSingingUnits('할렐루야 찬양하세 내 모든 죄 사함받고', 'ko_ch_l1'),
    approvalStatus: 'DRAFT'
  },
  {
    id: 'ko_ch_l2',
    lineIndex: 8,
    sectionType: 'CHORUS',
    sectionNumber: 1,
    displayText: '주 예수와 동행하니 그 어디나 하늘나라',
    singingUnits: parseTextToSingingUnits('주 예수와 동행하니 그 어디나 하늘나라', 'ko_ch_l2'),
    approvalStatus: 'DRAFT'
  }
];

// Helpers for localStorage Persistence
function loadPersistedOmrMetadata(): OmrMetadata | null {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_OMR_KEY);
    if (data) return JSON.parse(data) as OmrMetadata;
  } catch (err) {
    console.error('Failed to load persisted OMR metadata:', err);
  }
  return null;
}

function loadPersistedKoreanLyrics(): LyricLineData[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_LYRICS_KEY);
    if (data) return JSON.parse(data) as LyricLineData[];
  } catch (err) {
    console.error('Failed to load persisted Korean lyrics:', err);
  }
  return initialAuthoritativeKoreanLyrics;
}

function loadPersistedLiteralTranslations(): LiteralTranslationLineData[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_LITERAL_TRANSLATION_KEY);
    if (data) return JSON.parse(data) as LiteralTranslationLineData[];
  } catch (err) {
    console.error('Failed to load persisted Literal Translations:', err);
  }
  return [];
}
function loadPersistedAmharicLyrics(): AmharicLyricLineData[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_AMHARIC_LYRICS_KEY);
    if (data) return JSON.parse(data) as AmharicLyricLineData[];
  } catch (err) {
    console.error('Failed to load persisted Amharic lyrics:', err);
  }
  return initialAmharicLyrics;
}

function loadPersistedAlignments(): SyllableAlignmentItem[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_ALIGNMENT_KEY);
    if (data) return JSON.parse(data) as SyllableAlignmentItem[];
  } catch (err) {
    console.error('Failed to load persisted alignments:', err);
  }
  return [];
}

function migrateLegacyAlignmentUnitIds(
  lyrics: LyricLineData[],
  alignments: SyllableAlignmentItem[]
): SyllableAlignmentItem[] {
  const layerKeys = [
    'KOREAN_VERSE_1',
    'KOREAN_VERSE_2',
    'KOREAN_VERSE_3',
    'KOREAN_CHORUS'
  ];

  const getUnitsForLayer = (layerKey: string) =>
    lyrics
      .filter(line => {
        if (layerKey === 'KOREAN_VERSE_1') return line.sectionType === 'VERSE' && line.sectionNumber === 1;
        if (layerKey === 'KOREAN_VERSE_2') return line.sectionType === 'VERSE' && line.sectionNumber === 2;
        if (layerKey === 'KOREAN_VERSE_3') return line.sectionType === 'VERSE' && line.sectionNumber === 3;
        if (layerKey === 'KOREAN_CHORUS') return line.sectionType === 'CHORUS';
        return false;
      })
      .flatMap(line => line.singingUnits);

  let changed = false;
  let result = [...alignments];

  for (const layerKey of layerKeys) {
    const units = getUnitsForLayer(layerKey);
    const layerAlignments = result.filter(a => a.layerKey === layerKey);

    if (layerAlignments.length === 0) continue;

    const safeToMigrate =
      units.length === layerAlignments.length &&
      layerAlignments.every((alignment, index) =>
        alignment.singingUnitIds.length === 1 &&
        (!alignment.authoritativeText || alignment.authoritativeText === units[index]?.unitText)
      );

    if (!safeToMigrate) {
      console.warn(`Skipped legacy alignment ID migration for ${layerKey}: data shape/text mismatch.`);
      continue;
    }

    result = result.map(alignment => {
      if (alignment.layerKey !== layerKey) return alignment;

      const index = layerAlignments.indexOf(alignment);
      const unit = units[index];
      const oldUnitId = alignment.singingUnitIds[0];

      if (!unit || oldUnitId === unit.id) return alignment;

      changed = true;
      return {
        ...alignment,
        syllableId: unit.id,
        singingUnitIds: [unit.id]
      };
    });
  }

  if (changed) {
    localStorage.setItem(LOCAL_STORAGE_ALIGNMENT_KEY, JSON.stringify(result));
    console.info('Legacy alignment singing-unit IDs migrated to stable IDs.');
  }

  return result;
}

// Initial Empty Project State
const initialScoresState: ScoreFilesState = {
  originalScoreXml: null,
  amharicScoreXml: null,    // Do NOT fake
  bilingualScoreXml: null,  // Do NOT fake
  metadata: null,
  omrMetadata: loadPersistedOmrMetadata() || {
    engineName: 'Audiveris OMR',
    sourcePdfName: '495 내 영혼이 은총 입어.pdf',
    validationStatus: 'UNVERIFIED',
    convertedAt: new Date().toISOString()
  },
  sourcePdfName: '495 내 영혼이 은총 입어.pdf'
};

const initialLyricsState = loadPersistedKoreanLyrics();
const initialAmharicLyrics: AmharicLyricLineData[] = [];
const initialAlignmentsState = migrateLegacyAlignmentUnitIds(
  initialLyricsState,
  loadPersistedAlignments()
);

const initialProject: HymnProject = {
  id: 'hymn-001',
  titleKo: '495 내 영혼이 은총 입어',
  titleAm: '',
  titleEn: 'Since Christ My Soul from Sin Set Free',
  keySignature: 'Not provided',
  timeSignature: 'Not provided',
  tempoBpm: 85,
  status: 'DRAFT',
  scores: initialScoresState,
  authoritativeKoreanLyrics: initialLyricsState,
  literalTranslations: loadPersistedLiteralTranslations(),
  amharicLyrics: loadPersistedAmharicLyrics(),
  extractedNotesSequence: [],
  selectedVoice: {
    id: 'P1::staff1::voice1',
    partId: 'P1',
    partName: 'Primary Part / Melody',
    staffNumber: 1,
    voiceNumber: 1
  },
  alignments: initialAlignmentsState,
  createdAt: '2026-09-16',
  updatedAt: '2026-09-16'
};

const workflowSteps = [
  { step: 1, label: 'Source', desc: 'MusicXML & MXL Import' },
  { step: 2, label: 'Translation', desc: 'Literal Translation' },
  { step: 3, label: 'Adaptation', desc: 'Singable Adaptation' },
  { step: 4, label: 'Alignment', desc: 'Note-to-Syllable Matcher' },
  { step: 5, label: 'Native Review', desc: 'Ethiopian Reviewer Notes' },
  { step: 6, label: 'Score', desc: 'Bilingual Score Generation' },
  { step: 7, label: 'Export', desc: 'PDF / MusicXML Output' }
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [project, setProject] = useState<HymnProject>(initialProject);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate persisted state on mount
  useEffect(() => {
    const savedOmr = loadPersistedOmrMetadata();
    const savedLyrics = loadPersistedKoreanLyrics();
    const savedAmharicLyrics = loadPersistedAmharicLyrics();
    const savedAlignments = migrateLegacyAlignmentUnitIds(
      savedLyrics,
      loadPersistedAlignments()
    );
    
    setProject(prev => ({
      ...prev,
      scores: {
        ...prev.scores,
        omrMetadata: savedOmr || prev.scores.omrMetadata
      },
      authoritativeKoreanLyrics: savedLyrics,
      amharicLyrics: savedAmharicLyrics,
      alignments: savedAlignments
    }));
  }, []);

  // Trigger File Picker
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Process Selected File (.musicxml, .xml, .mxl)
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    const fileNameLower = file.name.toLowerCase();
    const isCompressedMxl = fileNameLower.endsWith('.mxl');
    const isPlainXml = fileNameLower.endsWith('.musicxml') || fileNameLower.endsWith('.xml');

    if (!isCompressedMxl && !isPlainXml) {
      setErrorMessage(`Unsupported file format "${file.name}". Please select a .musicxml, .xml, or compressed .mxl file.`);
      return;
    }

    try {
      let extractedXmlText = '';

      if (isCompressedMxl) {
        const arrayBuffer = await file.arrayBuffer();
        const extractResult = await extractMusicXmlFromMxl(arrayBuffer);
        extractedXmlText = extractResult.musicXmlContent;
      } else {
        extractedXmlText = await file.text();
      }

      // Parse metadata & read-only note sequence (without altering XML)
      const metadata = parseMusicXmlMetadata(extractedXmlText, file);
      const readOnlyNotes = extractReadOnlyNoteSequence(extractedXmlText);

      setProject(prev => ({
        ...prev,
        titleKo: metadata.title !== 'Not provided' ? metadata.title : prev.titleKo,
        extractedNotesSequence: readOnlyNotes,
        scores: {
          ...prev.scores,
          originalScoreXml: extractedXmlText,
          amharicScoreXml: null,
          bilingualScoreXml: null,
          metadata
        }
      }));

      // Automatically switch to Score Preview tab
      setActiveTab('score_preview');
    } catch (err: any) {
      console.error('File import error:', err);
      const msg = err?.message || 'Failed to parse MusicXML / MXL file.';
      setErrorMessage(`Import Error: ${msg}`);
    }
  };

  // Save OMR status & notes
  const handleSaveOmrStatusAndNotes = (newStatus: OmrValidationStatus, notes: string): boolean => {
    try {
      const updatedOmrMetadata: OmrMetadata = {
        engineName: project.scores.omrMetadata?.engineName || 'Audiveris OMR',
        sourcePdfName: project.scores.omrMetadata?.sourcePdfName || '495 내 영혼이 은총 입어.pdf',
        validationStatus: newStatus,
        validationNotes: notes,
        verifiedAt: newStatus === 'VERIFIED' ? new Date().toISOString() : project.scores.omrMetadata?.verifiedAt,
        convertedAt: project.scores.omrMetadata?.convertedAt || new Date().toISOString()
      };

      setProject(prev => ({
        ...prev,
        scores: { ...prev.scores, omrMetadata: updatedOmrMetadata }
      }));

      localStorage.setItem(LOCAL_STORAGE_OMR_KEY, JSON.stringify(updatedOmrMetadata));
      return true;
    } catch (err) {
      console.error('Failed to persist OMR metadata:', err);
      return false;
    }
  };

  // Save Authoritative Korean Lyrics
  const handleSaveKoreanLyrics = (updatedLyrics: LyricLineData[]) => {
    try {
      setProject(prev => ({
        ...prev,
        authoritativeKoreanLyrics: updatedLyrics
      }));
      localStorage.setItem(LOCAL_STORAGE_LYRICS_KEY, JSON.stringify(updatedLyrics));
    } catch (err) {
      console.error('Failed to persist Authoritative Korean Lyrics:', err);
    }
  };

  // Save Literal Translation data
const handleSaveLiteralTranslations = (updatedTranslations: LiteralTranslationLineData[]) => {
  try {
    setProject(prev => ({
      ...prev,
      literalTranslations: updatedTranslations
    }));

    localStorage.setItem(
      LOCAL_STORAGE_LITERAL_TRANSLATION_KEY,
      JSON.stringify(updatedTranslations)
    );
  } catch (err) {
    console.error('Failed to persist Literal Translations:', err);
  }
};
// Save Syllable Alignment Items
  const handleSaveAlignments = (updatedAlignments: SyllableAlignmentItem[], selectedVoice: LyricReferenceVoice) => {
    try {
      setProject(prev => {
        const allSingingUnits = prev.authoritativeKoreanLyrics.flatMap(line => line.singingUnits);

        const allUnitsAligned = allSingingUnits.length > 0 &&
          allSingingUnits.every(unit =>
            updatedAlignments.some(a =>
              a.singingUnitIds.includes(unit.id) &&
              a.status !== 'PROPOSED'
            )
          );

        const nextStatus =
          allUnitsAligned &&
          (prev.status === 'DRAFT' || prev.status === 'TRANSLATED' || prev.status === 'ADAPTED')
            ? 'ALIGNED'
            : prev.status;

        return {
          ...prev,
          selectedVoice,
          alignments: updatedAlignments,
          status: nextStatus
        };
      });

      localStorage.setItem(LOCAL_STORAGE_ALIGNMENT_KEY, JSON.stringify(updatedAlignments));
    } catch (err) {
      console.error('Failed to persist Syllable Alignments:', err);
    }
  };

  // Save Amharic Lyrics / Native Review data
  const handleSaveAmharicLyrics = (updatedLyrics: AmharicLyricLineData[]) => {
    try {
      setProject(prev => {
        const allLinesReviewed =
          updatedLyrics.length > 0 &&
          updatedLyrics.every(line =>
            line.approvalStatus === 'REVIEWED' &&
            Boolean(line.nativeReview?.reviewedAt)
          );

        const nextStatus =
          allLinesReviewed && prev.status === 'ALIGNED'
            ? 'REVIEWED'
            : !allLinesReviewed && prev.status === 'REVIEWED'
              ? 'ALIGNED'
              : prev.status;

        return {
          ...prev,
          amharicLyrics: updatedLyrics,
          status: nextStatus
        };
      });

      localStorage.setItem(
        LOCAL_STORAGE_AMHARIC_LYRICS_KEY,
        JSON.stringify(updatedLyrics)
      );
    } catch (err) {
      console.error('Failed to persist Amharic Lyrics:', err);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-app)' }}>
      
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".musicxml,.xml,.mxl"
        style={{ display: 'none' }}
      />

      {/* APP TOP HEADER */}
      <header style={{
        height: '56px',
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        userSelect: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: '#fff',
            fontSize: '18px'
          }}>
            🎵
          </div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '0.5px' }}>
              AMHARIC HYMN STUDIO
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Korean Hymn → Amharic Hymn
            </p>
          </div>
        </div>

        {/* Top Header Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {project.scores.metadata && (
            <div style={{ fontSize: '12px', color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              ✓ Score Loaded: {project.scores.metadata.fileName} ({project.scores.metadata.fileType})
            </div>
          )}
          {project.scores.omrMetadata && (
            <div style={{ fontSize: '12px', color: '#a78bfa', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              OMR Status: {project.scores.omrMetadata.validationStatus}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', backgroundColor: 'var(--bg-app)', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Unicode Ready:</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>한</span>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>አ마</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>EN</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER (SIDEBAR + WORKSPACE) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside style={{
          width: '260px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 12px',
          gap: '20px',
          overflowY: 'auto'
        }}>
          
          {/* Section: Project */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
              Project
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button className={`sidebar-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>🏠 Home Overview</button>
              <button className="sidebar-btn" onClick={handleImportClick}>📄 New Project</button>
            </div>
          </div>

          {/* Section: Source */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
              Source
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button className="sidebar-btn highlight-btn" onClick={handleImportClick}>
                🎼 Import MusicXML / MXL
              </button>
              <button className={`sidebar-btn ${activeTab === 'omr_pdf' ? 'active' : ''}`} onClick={() => setActiveTab('omr_pdf')}>
                📄 PDF / Image Score (Audiveris OMR)
              </button>
              <button className={`sidebar-btn ${activeTab === 'ko_lyrics' ? 'active' : ''}`} onClick={() => setActiveTab('ko_lyrics')}>
                📝 Korean Lyrics (Authoritative)
              </button>
              <button className={`sidebar-btn ${activeTab === 'ref_audio' ? 'active' : ''}`} onClick={() => setActiveTab('ref_audio')}>🎧 Reference Audio</button>
            </div>
          </div>

          {/* Section: Translation */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
              Translation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button className={`sidebar-btn ${activeTab === 'literal_trans' ? 'active' : ''}`} onClick={() => setActiveTab('literal_trans')}>📖 Literal Translation</button>
              <button className={`sidebar-btn ${activeTab === 'singable_adapt' ? 'active' : ''}`} onClick={() => setActiveTab('singable_adapt')}>🎤 Singable Adaptation</button>
              <button className={`sidebar-btn ${activeTab === 'native_review' ? 'active' : ''}`} onClick={() => setActiveTab('native_review')}>🇪🇹 Native Review</button>
            </div>
          </div>

          {/* Section: Music */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
              Music
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button className={`sidebar-btn ${activeTab === 'alignment' ? 'active' : ''}`} onClick={() => setActiveTab('alignment')}>
                🔗 Syllable Alignment (Korean)
              </button>
              <button className={`sidebar-btn ${activeTab === 'score_preview' ? 'active' : ''}`} onClick={() => setActiveTab('score_preview')}>🖼️ Score Preview</button>
            </div>
          </div>

          {/* Section: Export */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
              Export
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button className="sidebar-btn" onClick={() => exportProjectBackup(project)}>Project Backup (.json)</button>
            <button className="sidebar-btn" onClick={() => alert('Export functionality will be enabled in Step 3')}>📄 Amharic Score</button>
            <button className="sidebar-btn" onClick={() => alert('Export functionality will be enabled in Step 3')}>📑 Bilingual Score</button>
            <button className="sidebar-btn" onClick={() => alert('Export functionality will be enabled in Step 3')}>🎵 MusicXML</button>
            </div>
          </div>

        </aside>

        {/* MAIN WORKSPACE AREA */}
        <main style={{
          flex: 1,
          backgroundColor: 'var(--bg-app)',
          padding: '28px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>

          {/* GLOBAL ERROR BANNER */}
          {errorMessage && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '14px 18px',
              color: '#fca5a5',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div><strong>⚠️ {errorMessage}</strong></div>
              <button onClick={() => setErrorMessage(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          {/* VIEW TAB 1: SCORE PREVIEW */}
          {activeTab === 'score_preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* FILE INFORMATION PANEL */}
              {project.scores.metadata && (
                <div style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                      📁 Imported MusicXML File Information
                    </div>
                    {project.scores.omrMetadata && (
                      <span style={{ fontSize: '12px', color: '#a78bfa', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                        Source: {project.scores.omrMetadata.engineName} ({project.scores.omrMetadata.validationStatus})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>File Name</div>
                      <strong style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{project.scores.metadata.fileName}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>File Format</div>
                      <strong style={{ color: 'var(--accent-primary)' }}>{project.scores.metadata.fileType}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>File Size</div>
                      <strong style={{ color: 'var(--text-main)' }}>{project.scores.metadata.fileSizeFormatted}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Score Title</div>
                      <strong style={{ color: 'var(--text-main)' }}>{project.scores.metadata.title}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Composer</div>
                      <strong style={{ color: 'var(--text-main)' }}>{project.scores.metadata.composer}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Number of Parts</div>
                      <strong style={{ color: 'var(--text-main)' }}>{project.scores.metadata.partCount} Part(s)</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* RENDERED SCORE VIEWER */}
              <ScoreViewer
                xmlContent={project.scores.originalScoreXml}
                onError={(err) => setErrorMessage(err)}
              />
            </div>
          )}

          {/* VIEW TAB 2: OMR PDF WORKFLOW & VALIDATION */}
          {activeTab === 'omr_pdf' && (
            <OmrValidationPanel
              omrMetadata={project.scores.omrMetadata}
              onSaveStatusAndNotes={handleSaveOmrStatusAndNotes}
              onImportOmrXml={handleImportClick}
            />
          )}

          {/* VIEW TAB 3: AUTHORITATIVE KOREAN LYRICS EDITOR */}
          {activeTab === 'ko_lyrics' && (
            <KoreanLyricEditor
              lyrics={project.authoritativeKoreanLyrics}
              noteSequence={project.extractedNotesSequence}
              onSaveLyrics={handleSaveKoreanLyrics}
            />
          )}

          {/* VIEW TAB 4: SYLLABLE ALIGNMENT EDITOR */}
          {activeTab === 'alignment' && (
            <ErrorBoundary fallbackTitle="Alignment Editor Encountered an Issue">
              <SyllableAlignmentEditor
                xmlContent={project.scores.originalScoreXml}
                lyrics={project.authoritativeKoreanLyrics}
                omrStatus={project.scores.omrMetadata?.validationStatus}
                savedAlignments={project.alignments}
                selectedVoice={project.selectedVoice}
                onSaveAlignments={handleSaveAlignments}
              />
            </ErrorBoundary>
          )}

          {/* VIEW TAB 2: LITERAL TRANSLATION EDITOR */}
      {activeTab === 'literal_trans' && (
        <ErrorBoundary fallbackTitle="Literal Translation Editor Encountered an Issue">
          <LiteralTranslationEditor
            koreanLyrics={project.authoritativeKoreanLyrics}
            literalTranslations={project.literalTranslations}
            onSaveLiteralTranslations={handleSaveLiteralTranslations}
          />
        </ErrorBoundary>
      )}
      {/* VIEW TAB 5: NATIVE REVIEW EDITOR */}
          {activeTab === 'native_review' && (
            <ErrorBoundary fallbackTitle="Native Review Editor Encountered an Issue">
              <NativeReviewEditor
                koreanLyrics={project.authoritativeKoreanLyrics}
                amharicLyrics={project.amharicLyrics}
                onSaveAmharicLyrics={handleSaveAmharicLyrics}
              />
            </ErrorBoundary>
          )}

          {/* VIEW TAB 6: HOME OVERVIEW */}
          {activeTab === 'home' && (
            <>
              {/* HEADER */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Amharic Hymn Studio
                </h1>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Convert Korean hymns into singable Amharic hymns.
                </p>
              </div>

              {/* WORKFLOW INDICATOR */}
              <div style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' }}>
                  Workflow Status
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
                  {workflowSteps.map((s) => {
                    const allSingingUnits = project.authoritativeKoreanLyrics.flatMap(line => line.singingUnits);
                    const isAlignmentComplete =
                      allSingingUnits.length > 0 &&
                      allSingingUnits.every(unit =>
                        project.alignments.some(a =>
                          a.singingUnitIds.includes(unit.id) &&
                          a.status !== 'PROPOSED'
                        )
                      );

                    const isNativeReviewComplete =
                      project.amharicLyrics.length > 0 &&
                      project.amharicLyrics.every(line =>
                        line.approvalStatus === 'REVIEWED' &&
                        Boolean(line.nativeReview?.reviewedAt)
                      );

                    const isLoaded =
                      (s.step === 1 && project.scores.originalScoreXml !== null) ||
                      (s.step === 2 &&
                        project.authoritativeKoreanLyrics.length > 0 &&
                        project.authoritativeKoreanLyrics.every(line =>
                          project.literalTranslations.some(item =>
                            item.koreanLineId === line.id &&
                            item.literalAmharicText.trim().length > 0 &&
                            item.approvalStatus === 'TRANSLATED'
                          )
                        )) ||
                      (s.step === 4 && isAlignmentComplete) ||
                      (s.step === 5 && isNativeReviewComplete);
                    return (
                      <div key={s.step} style={{
                        backgroundColor: isLoaded ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                        border: `1px solid ${isLoaded ? '#10b981' : 'var(--border-color)'}`,
                        borderRadius: '8px',
                        padding: '12px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: isLoaded ? '#34d399' : 'var(--text-dim)',
                          backgroundColor: isLoaded ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-app)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          width: 'fit-content'
                        }}>
                          {isLoaded ? (s.step === 4 ? 'Complete' : 'Loaded') : `Step ${s.step}`}
                        </span>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {s.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTIONS CARD */}
              <div style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Get Started with Korean Syllable Alignment & MusicXML Import
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Align authoritative Korean syllables to musical note anchors or import a real MusicXML score file (.musicxml, .xml, compressed .mxl).
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setActiveTab('alignment')} style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🔗 Syllable Alignment Editor
                  </button>

                  <button onClick={handleImportClick} style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🎼 Select MusicXML / MXL File
                  </button>
                </div>
              </div>
            </>
          )}

          {/* OTHER TABS PLACEHOLDER */}
          {activeTab !== 'home' && activeTab !== 'score_preview' && activeTab !== 'omr_pdf' && activeTab !== 'ko_lyrics' && activeTab !== 'alignment' && activeTab !== 'native_review' && activeTab !== 'literal_trans' && (
            <div style={{ backgroundColor: 'var(--bg-panel)', borderRadius: '12px', padding: '48px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>WIP</div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px' }}>
                {activeTab.replace('_', ' ').toUpperCase()} Tab
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                This section will be implemented in Step 3 as per the roadmap.
              </p>
            </div>
          )}

        </main>
      </div>

      {/* Internal CSS for Sidebar Buttons */}
      <style>{`
        .sidebar-btn {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sidebar-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-main);
        }
        .sidebar-btn.active {
          background-color: var(--bg-card);
          color: var(--accent-primary);
          font-weight: 600;
        }
        .highlight-btn {
          background-color: rgba(59, 130, 246, 0.1);
          color: var(--accent-primary);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .highlight-btn:hover {
          background-color: rgba(59, 130, 246, 0.2);
        }
      `}</style>

    </div>
  );
};

export default App;



