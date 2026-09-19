import React, { useState, useEffect, useMemo } from 'react';
import type { 
  LyricLineData, 
  SyllableAlignmentItem, 
  LyricReferenceVoice, 
  OmrValidationStatus,
  AlignmentType,
  SingingUnit,
  AlignmentItemStatus,
  MelodyExtractionMode,
  AnchorVerificationStatus,
  VisualTargetConfidence,
  AnchorDiagnosticInfo
} from '../types/hymn';
import { ScoreViewer } from './ScoreViewer';
import { 
  detectAvailableVoices, 
  extractLyricNoteAnchors, 
  getDerivedMelodyPitch,
  generateAnchorComparisonRows
} from '../utils/lyricAnchorExtractor';

interface SyllableAlignmentEditorProps {
  xmlContent: string | null;
  lyrics: LyricLineData[];
  omrStatus?: OmrValidationStatus;
  savedAlignments: SyllableAlignmentItem[];
  selectedVoice?: LyricReferenceVoice;
  onSaveAlignments: (alignments: SyllableAlignmentItem[], voice: LyricReferenceVoice) => void;
}

export const SyllableAlignmentEditor: React.FC<SyllableAlignmentEditorProps> = ({
  xmlContent,
  lyrics,
  omrStatus,
  savedAlignments,
  selectedVoice,
  onSaveAlignments
}) => {
  const [activeLayerKey, setActiveLayerKey] = useState<string>('KOREAN_VERSE_1');
  const [currentVoice, setCurrentVoice] = useState<LyricReferenceVoice | undefined>(selectedVoice);
  const [alignments, setAlignments] = useState<SyllableAlignmentItem[]>(savedAlignments);
  
  // Melody Extraction Mode State (ORIGINAL_CHORD, HIGHEST_NOTE, LOWEST_NOTE)
  const [melodyExtractionMode, setMelodyExtractionMode] = useState<MelodyExtractionMode>(() => {
    try {
      const saved = localStorage.getItem('amharic_hymn_melody_extraction_mode');
      return (saved as MelodyExtractionMode) || 'HIGHEST_NOTE';
    } catch (e) {
      return 'HIGHEST_NOTE';
    }
  });

  // User Verification Status Map per Anchor (UNVERIFIED, MATCHED, MISMATCH)
  const [anchorVerificationMap, setAnchorVerificationMap] = useState<Record<string, AnchorVerificationStatus>>(() => {
    try {
      const saved = localStorage.getItem('amharic_hymn_anchor_verification');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Program Visual Target Confidence Map per Anchor (NOT_INSPECTED, EXACT, APPROXIMATE, UNAVAILABLE)
  const [visualConfidenceMap, setVisualConfidenceMap] = useState<Record<string, VisualTargetConfidence>>({});
  const [runtimeMappingResults, setRuntimeMappingResults] = useState<Record<string, AnchorDiagnosticInfo>>({});
  const [batchInspectTrigger, setBatchInspectTrigger] = useState<number>(0);
  const [anchorDiagnostic, setAnchorDiagnostic] = useState<AnchorDiagnosticInfo | null>(null);

  // Layer Start Anchor IDs per layer (KOREAN_VERSE_1, KOREAN_VERSE_2, KOREAN_VERSE_3, KOREAN_CHORUS)
  const [layerStartAnchorIds, setLayerStartAnchorIds] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('amharic_hymn_layer_start_anchors');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Interactive Controls
  const [sequentialMode, setSequentialMode] = useState<boolean>(true); // Fast auto-advance mode
  const [showDebugTable, setShowDebugTable] = useState<boolean>(true);
  const [showComparisonTable, setShowComparisonTable] = useState<boolean>(true);
  const [showVerificationPanel, setShowVerificationPanel] = useState<boolean>(true);
  
  // Selection states for manual click-to-connect and focus
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const layerKeys = [
    { key: 'KOREAN_VERSE_1', label: 'Verse 1' },
    { key: 'KOREAN_VERSE_2', label: 'Verse 2' },
    { key: 'KOREAN_VERSE_3', label: 'Verse 3' },
    { key: 'KOREAN_CHORUS', label: 'Chorus' }
  ];

  // 1. Safely detect available voices with unique IDs and statistics
  const availableVoices = useMemo(() => {
    if (!xmlContent) return [];
    return detectAvailableVoices(xmlContent);
  }, [xmlContent]);

  // 2. Validate currentVoice against availableVoices using unique ID (partId + staff + voice)
  useEffect(() => {
    if (availableVoices.length > 0) {
      const isValid = currentVoice && availableVoices.some(v => v.id === currentVoice.id);
      if (!isValid) {
        setCurrentVoice(availableVoices[0]);
      }
    }
  }, [availableVoices, currentVoice]);

  // 3. Extract note anchors for current valid voice
  const noteAnchors = useMemo(() => {
    if (!xmlContent || !currentVoice) return [];
    return extractLyricNoteAnchors(xmlContent, currentVoice);
  }, [xmlContent, currentVoice]);

  // 4. Generate comparison table data for P1 Voice 1 and P2 Voice 1 (First 15 anchors)
  const p1Voice1Obj = useMemo(() => {
    return availableVoices.find(v => v.partId === 'P1' && v.staffNumber === 1 && v.voiceNumber === 1) || availableVoices[0];
  }, [availableVoices]);

  const p2Voice1Obj = useMemo(() => {
    return availableVoices.find(v => v.partId === 'P2' && v.staffNumber === 1 && v.voiceNumber === 1) || availableVoices[1] || availableVoices[0];
  }, [availableVoices]);

  const p1ComparisonRows = useMemo(() => {
    if (!xmlContent || !p1Voice1Obj) return [];
    return generateAnchorComparisonRows(xmlContent, p1Voice1Obj, 15);
  }, [xmlContent, p1Voice1Obj]);

  const p2ComparisonRows = useMemo(() => {
    if (!xmlContent || !p2Voice1Obj) return [];
    return generateAnchorComparisonRows(xmlContent, p2Voice1Obj, 15);
  }, [xmlContent, p2Voice1Obj]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Callback when ScoreViewer evaluates visual target confidence for an anchor
  const handleVisualConfidenceEvaluated = (anchorId: string, confidence: VisualTargetConfidence) => {
    setVisualConfidenceMap(prev => {
      if (prev[anchorId] === confidence) return prev;
      return { ...prev, [anchorId]: confidence };
    });
  };

  // Batch Inspection Callback (#1~#64)
  const handleBatchInspectionEvaluated = (results: Record<string, AnchorDiagnosticInfo>) => {
    setRuntimeMappingResults(prev => ({ ...prev, ...results }));
    
    const updatedConf: Record<string, VisualTargetConfidence> = {};
    Object.keys(results).forEach(aId => {
      updatedConf[aId] = results[aId].finalConfidence;
    });
    setVisualConfidenceMap(prev => ({ ...prev, ...updatedConf }));

    const exacts = Object.values(results).filter(r => r.finalConfidence === 'EXACT').length;
    const totalCount = Object.keys(results).length;
    showToast(`✓ Batch inspection complete for Anchors #1–#${totalCount}: ${exacts}/${totalCount} EXACT Targets found.`);
  };

  const handleInspectAllAnchors = () => {
    setBatchInspectTrigger(prev => prev + 1);
    showToast(`🔬 Requesting batch OSMD GraphicSheet inspection for Anchors #1–#${noteAnchors.length}...`);
  };

  // Manual User Verification Status Action (Strictly user-driven, NEVER automatic)
  const handleUpdateVerificationStatus = (anchorId: string, status: AnchorVerificationStatus) => {
    const updated = { ...anchorVerificationMap, [anchorId]: status };
    setAnchorVerificationMap(updated);
    try {
      localStorage.setItem('amharic_hymn_anchor_verification', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save anchor verification map', e);
    }
    const anchorObj = noteAnchors.find(a => a.anchorId === anchorId);
    showToast(`Anchor #${anchorObj?.anchorIndex || ''} marked as: ${status}`);
  };

  // User Mismatch Notes state per anchorId
  const [mismatchNotes, setMismatchNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('amharic_hymn_mismatch_notes');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleUpdateMismatchNote = (anchorId: string, noteText: string) => {
    const updated = { ...mismatchNotes, [anchorId]: noteText };
    setMismatchNotes(updated);
    try {
      localStorage.setItem('amharic_hymn_mismatch_notes', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save mismatch notes', e);
    }
  };

  // Keyboard Verification Mode Shortcut Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (noteAnchors.length === 0) return;

      const currentIndex = noteAnchors.findIndex(a => a.anchorId === selectedAnchorId);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = currentIndex >= 0 && currentIndex < noteAnchors.length - 1 ? currentIndex + 1 : 0;
        const nextAnchor = noteAnchors[nextIndex];
        setSelectedAnchorId(nextAnchor.anchorId);
        showToast(`🔍 Focus -> Anchor #${nextAnchor.anchorIndex} (M.${nextAnchor.measureNumber})`);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : noteAnchors.length - 1;
        const prevAnchor = noteAnchors[prevIndex];
        setSelectedAnchorId(prevAnchor.anchorId);
        showToast(`🔍 Focus -> Anchor #${prevAnchor.anchorIndex} (M.${prevAnchor.measureNumber})`);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (selectedAnchorId) {
          handleUpdateVerificationStatus(selectedAnchorId, 'MATCHED');
        }
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (selectedAnchorId) {
          handleUpdateVerificationStatus(selectedAnchorId, 'MISMATCH');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (selectedAnchorId) {
          handleUpdateVerificationStatus(selectedAnchorId, 'UNVERIFIED');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [noteAnchors, selectedAnchorId, anchorVerificationMap]);

  // Handle Melody Extraction Mode Change
  const handleModeChange = (mode: MelodyExtractionMode) => {
    setMelodyExtractionMode(mode);
    try {
      localStorage.setItem('amharic_hymn_melody_extraction_mode', mode);
    } catch (e) {
      console.error('Failed to save melody extraction mode', e);
    }
    const currentLayerHasAlignments = alignments.some(a => a.layerKey === activeLayerKey);
    if (currentLayerHasAlignments) {
      showToast('⚠️ Melody extraction mode changed. Please re-verify syllable alignments.');
    } else {
      showToast(`🎵 Melody extraction mode set to: ${mode}`);
    }
  };

  // Save Layer Start Anchor ID
  const handleSetLayerStart = (anchorId: string) => {
    const updated = { ...layerStartAnchorIds, [activeLayerKey]: anchorId };
    setLayerStartAnchorIds(updated);
    try {
      localStorage.setItem('amharic_hymn_layer_start_anchors', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save layer start anchors to localStorage', e);
    }
    const anchorObj = noteAnchors.find(a => a.anchorId === anchorId);
    showToast(`📍 Layer Start set for ${activeLayerKey.replace('_', ' ')}: Anchor #${anchorObj?.anchorIndex || ''} (M.${anchorObj?.measureNumber || 1})`);
  };

  // Filter lyrics for active layer
  const activeLyrics = lyrics.filter(l => {
    if (activeLayerKey === 'KOREAN_VERSE_1') return l.sectionType === 'VERSE' && l.sectionNumber === 1;
    if (activeLayerKey === 'KOREAN_VERSE_2') return l.sectionType === 'VERSE' && l.sectionNumber === 2;
    if (activeLayerKey === 'KOREAN_VERSE_3') return l.sectionType === 'VERSE' && l.sectionNumber === 3;
    if (activeLayerKey === 'KOREAN_CHORUS') return l.sectionType === 'CHORUS';
    return true;
  });

  const activeSingingUnits: SingingUnit[] = [];
  activeLyrics.forEach(l => {
    l.singingUnits.forEach(u => activeSingingUnits.push(u));
  });

  const currentLayerAlignments = alignments.filter(a => a.layerKey === activeLayerKey);

  const isUnitAligned = (unitId: string) => {
    return currentLayerAlignments.some(a => a.singingUnitIds.includes(unitId));
  };

  const isAnchorAligned = (anchorId: string) => {
    return currentLayerAlignments.some(a => a.noteAnchorIds.includes(anchorId));
  };

  const getAlignmentForAnchor = (anchorId: string) => {
    return currentLayerAlignments.find(a => a.noteAnchorIds.includes(anchorId));
  };

  const getAlignmentForUnit = (unitId: string) => {
    return currentLayerAlignments.find(a => a.singingUnitIds.includes(unitId));
  };

  // Select first unaligned unit by default when switching layers
  useEffect(() => {
    const firstUnaligned = activeSingingUnits.find(u => !isUnitAligned(u.id));
    if (firstUnaligned) {
      setSelectedUnitId(firstUnaligned.id);
    } else if (activeSingingUnits.length > 0) {
      setSelectedUnitId(activeSingingUnits[0].id);
    }
  }, [activeLayerKey, alignments]);

  // Connect Selected Unit to Selected Anchor
  const handleConnectAnchor = (anchorId: string, type: AlignmentType = 'ONE_TO_ONE') => {
    if (!selectedUnitId || !currentVoice) return;

    const unitObj = activeSingingUnits.find(u => u.id === selectedUnitId);
    if (!unitObj) return;

    // Filter out existing alignment for this unit or anchor
    const filtered = alignments.filter(a => 
      !(a.layerKey === activeLayerKey && (a.singingUnitIds.includes(selectedUnitId) || a.noteAnchorIds.includes(anchorId)))
    );

    const newAlignment: SyllableAlignmentItem = {
      alignmentId: `align_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      layerKey: activeLayerKey,
      lineId: activeLyrics[0]?.id || 'line_1',
      syllableId: selectedUnitId,
      authoritativeText: unitObj.unitText,
      singingUnitIds: [selectedUnitId],
      noteAnchorIds: [anchorId],
      alignmentType: type,
      melisma: type === 'ONE_TO_MANY',
      manuallyConfirmed: true,
      status: 'MANUAL'
    };

    const updated = [...filtered, newAlignment];
    setAlignments(updated);

    // FAST SEQUENTIAL AUTO-ADVANCE MODE
    if (sequentialMode) {
      const nextUnalignedUnit = activeSingingUnits.find(u => u.id !== selectedUnitId && !updated.some(a => a.layerKey === activeLayerKey && a.singingUnitIds.includes(u.id)));
      if (nextUnalignedUnit) {
        setSelectedUnitId(nextUnalignedUnit.id);
      } else {
        setSelectedUnitId(null);
      }
    } else {
      setSelectedUnitId(null);
    }

    setSelectedAnchorId(anchorId);
    showToast(`✓ Connected "${unitObj.unitText}" → Note Anchor`);
  };

  // EXTEND PREVIOUS SYLLABLE (MELISMA)
  const handleExtendMelisma = (anchorId: string) => {
    if (!selectedUnitId) return;

    const existingAlign = getAlignmentForUnit(selectedUnitId);
    if (!existingAlign) {
      // If not yet aligned, align 1:1 first
      handleConnectAnchor(anchorId, 'ONE_TO_MANY');
      return;
    }

    // Append anchor to existing unit alignment
    if (!existingAlign.noteAnchorIds.includes(anchorId)) {
      const updated = alignments.map(a => {
        if (a.alignmentId === existingAlign.alignmentId) {
          return {
            ...a,
            noteAnchorIds: [...a.noteAnchorIds, anchorId],
            alignmentType: 'ONE_TO_MANY' as AlignmentType,
            melisma: true,
            status: 'MANUAL' as AlignmentItemStatus
          };
        }
        return a;
      });
      setAlignments(updated);
      showToast(`~ Extended melisma for "${existingAlign.authoritativeText}"`);
    }
  };

  // ⚡ LAYER-RELATIVE AUTO-ASSIST SEQUENTIAL ALIGNMENT (PROPOSED DRAFT)
  const handleAutoAssistAlign = () => {
    if (activeSingingUnits.length === 0 || noteAnchors.length === 0) {
      showToast('⚠️ Cannot run Auto-Assist: No singing units or note anchors available');
      return;
    }

    // Filter playable non-rest note anchors
    const playableAnchors = noteAnchors.filter(a => !a.isRest);
    const startAnchorId = layerStartAnchorIds[activeLayerKey];
    
    let startIdx = 0;
    if (startAnchorId) {
      const foundIdx = playableAnchors.findIndex(a => a.anchorId === startAnchorId);
      if (foundIdx >= 0) startIdx = foundIdx;
    }

    const targetAnchors = playableAnchors.slice(startIdx);
    const proposedAlignments: SyllableAlignmentItem[] = [...alignments.filter(a => a.layerKey !== activeLayerKey)];

    let proposedCount = 0;
    activeSingingUnits.forEach((unit, idx) => {
      if (idx < targetAnchors.length) {
        const anchor = targetAnchors[idx];
        proposedAlignments.push({
          alignmentId: `prop_${Date.now()}_${idx}`,
          layerKey: activeLayerKey,
          lineId: activeLyrics[0]?.id || 'line_1',
          syllableId: unit.id,
          authoritativeText: unit.unitText,
          singingUnitIds: [unit.id],
          noteAnchorIds: [anchor.anchorId],
          alignmentType: 'ONE_TO_ONE',
          melisma: false,
          manuallyConfirmed: false,
          status: 'PROPOSED'
        });
        proposedCount++;
      }
    });

    setAlignments(proposedAlignments);
    showToast(`⚡ Auto-Assist generated ${proposedCount} proposed alignments (Mode: ${melodyExtractionMode})`);
  };

  // Confirm All Proposed Alignments
  const handleConfirmAllProposed = () => {
    const updated = alignments.map(a => {
      if (a.layerKey === activeLayerKey && a.status === 'PROPOSED') {
        return { ...a, status: 'CONFIRMED' as AlignmentItemStatus, manuallyConfirmed: true };
      }
      return a;
    });
    setAlignments(updated);
    showToast('✓ All proposed alignments confirmed');
  };

  // Clear Layer Alignments
  const handleClearLayerAlignments = () => {
    const updated = alignments.filter(a => a.layerKey !== activeLayerKey);
    setAlignments(updated);
    showToast('✓ Layer alignments cleared');
  };

  const handleUnassign = (anchorId: string) => {
    const updated = alignments.filter(a => 
      !(a.layerKey === activeLayerKey && a.noteAnchorIds.includes(anchorId))
    );
    setAlignments(updated);
    showToast('✓ Alignment removed');
  };

  const handleSave = () => {
    if (currentVoice) {
      onSaveAlignments(alignments, currentVoice);
      showToast('✓ Korean Syllable Alignment saved');
    }
  };

  // Bi-directional Syllable & Anchor Card Focus Handlers
  const handleSelectUnitCard = (unitId: string) => {
    const newUnitId = selectedUnitId === unitId ? null : unitId;
    setSelectedUnitId(newUnitId);

    if (newUnitId) {
      const alignObj = getAlignmentForUnit(newUnitId);
      if (alignObj && alignObj.noteAnchorIds.length > 0) {
        const targetAnchorId = alignObj.noteAnchorIds[0];
        setSelectedAnchorId(targetAnchorId);
        const anchorEl = document.getElementById(`anchor_card_${targetAnchorId}`);
        if (anchorEl) {
          anchorEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    }
  };

  const handleSelectAnchorCard = (anchorId: string) => {
    setSelectedAnchorId(anchorId);
    const alignObj = getAlignmentForAnchor(anchorId);
    if (alignObj && alignObj.singingUnitIds.length > 0) {
      const targetUnitId = alignObj.singingUnitIds[0];
      setSelectedUnitId(targetUnitId);
      const unitEl = document.getElementById(`syllable_card_${targetUnitId}`);
      if (unitEl) {
        unitEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (selectedUnitId) {
      handleConnectAnchor(anchorId, 'ONE_TO_ONE');
    }
  };

  // Handle EMPTY SCORE STATE safely
  if (!xmlContent) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '48px 24px',
        textAlign: 'center',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎼</div>
        <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px' }}>
          No MusicXML Score Loaded
        </h3>
        <p style={{ fontSize: '14px', maxWidth: '480px', margin: '0 auto' }}>
          No MusicXML score is currently loaded. Please import a MusicXML / MXL score first to begin syllable alignment.
        </p>
      </div>
    );
  }

  // Handle NO DETECTED VOICE STATE safely
  if (availableVoices.length === 0 || !currentVoice) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '48px 24px',
        textAlign: 'center',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
        <h3 style={{ fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px' }}>
          Detecting Lyric Reference Voices...
        </h3>
        <p style={{ fontSize: '14px', maxWidth: '480px', margin: '0 auto' }}>
          Extracting parts, staves, and melody voices from the imported score. Please wait a moment.
        </p>
      </div>
    );
  }

  const alignedUnitsCount = activeSingingUnits.filter(u => isUnitAligned(u.id)).length;
  const totalUnitsCount = activeSingingUnits.length;
  const remainingCount = totalUnitsCount - alignedUnitsCount;

  // VERIFICATION SUMMARY & FULL ANCHORS VERIFICATION CALCULATIONS (#1~#64)
  const totalAnchorsCount = noteAnchors.length;
  const matchedCount = noteAnchors.filter(a => anchorVerificationMap[a.anchorId] === 'MATCHED').length;
  const mismatchCount = noteAnchors.filter(a => anchorVerificationMap[a.anchorId] === 'MISMATCH').length;
  const unverifiedCount = Math.max(0, totalAnchorsCount - matchedCount - mismatchCount);

  const exactConfidenceCount = noteAnchors.filter(a => visualConfidenceMap[a.anchorId] === 'EXACT').length;
  const approxConfidenceCount = noteAnchors.filter(a => visualConfidenceMap[a.anchorId] === 'APPROXIMATE').length;
  const unavailConfidenceCount = noteAnchors.filter(a => visualConfidenceMap[a.anchorId] === 'UNAVAILABLE' || !visualConfidenceMap[a.anchorId]).length;

  const isFullMelodyManuallyVerified = totalAnchorsCount > 0 && matchedCount === totalAnchorsCount && mismatchCount === 0 && unverifiedCount === 0;
  const mismatchedAnchors = noteAnchors.filter(a => anchorVerificationMap[a.anchorId] === 'MISMATCH');

  const currentLayerAnchorIds = currentLayerAlignments.flatMap(a => a.noteAnchorIds);
  const usedAnchorsInLayer = noteAnchors.filter(a => currentLayerAnchorIds.includes(a.anchorId));
  const configuredStartAnchor = noteAnchors.find(a => a.anchorId === layerStartAnchorIds[activeLayerKey]);
  const firstUsedAnchor = usedAnchorsInLayer[0];
  const lastUsedAnchor = usedAnchorsInLayer[usedAnchorsInLayer.length - 1];

  const effectiveStartAnchor = configuredStartAnchor || firstUsedAnchor;
  const minMeasure = usedAnchorsInLayer.length > 0 ? Math.min(...usedAnchorsInLayer.map(a => a.measureNumber)) : (effectiveStartAnchor?.measureNumber || 1);
  const maxMeasure = usedAnchorsInLayer.length > 0 ? Math.max(...usedAnchorsInLayer.map(a => a.measureNumber)) : (lastUsedAnchor?.measureNumber || 1);

  const selectedAnchorObj = noteAnchors.find(a => a.anchorId === selectedAnchorId);
  const activeMeasureNumber = selectedAnchorObj?.measureNumber || effectiveStartAnchor?.measureNumber || 1;
  const selectedMelodyPitch = selectedAnchorObj ? getDerivedMelodyPitch(selectedAnchorObj.chordPitches, selectedAnchorObj.mainPitch, melodyExtractionMode) : undefined;

  const allAnchors = noteAnchors;
  const inspected64Count = allAnchors.filter(a => runtimeMappingResults[a.anchorId] !== undefined).length;
  const exact64Count = allAnchors.filter(a => runtimeMappingResults[a.anchorId]?.finalConfidence === 'EXACT').length;
  const approx64Count = allAnchors.filter(a => runtimeMappingResults[a.anchorId]?.finalConfidence === 'APPROXIMATE').length;
  const unavail64Count = allAnchors.filter(a => runtimeMappingResults[a.anchorId]?.finalConfidence === 'UNAVAILABLE').length;
  const notInspected64Count = Math.max(0, allAnchors.length - inspected64Count);

  const nonExactAnchors = allAnchors.filter(a => {
    const conf = runtimeMappingResults[a.anchorId]?.finalConfidence;
    return conf === 'APPROXIMATE' || conf === 'UNAVAILABLE';
  });

  const first15Anchors = allAnchors.slice(0, 15);
  const isFirst15RegressionPassed = first15Anchors.length === 15 && first15Anchors.every(a => runtimeMappingResults[a.anchorId]?.finalConfidence === 'EXACT');

  const isFullMelodyRuntimeProven = allAnchors.length > 0 && inspected64Count === allAnchors.length && exact64Count === allAnchors.length && approx64Count === 0 && unavail64Count === 0 && notInspected64Count === 0 && isFirst15RegressionPassed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* OMR SAFETY WARNING BANNER */}
      {omrStatus !== 'VERIFIED' && (
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '8px',
          padding: '12px 18px',
          color: '#fbbf24',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <strong>⚠️ OMR Score Safety Notice:</strong> OMR score is not verified. Alignment may need to be redone after score correction.
          </div>
          <span style={{ fontSize: '11px', backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
            Status: {omrStatus || 'UNVERIFIED'}
          </span>
        </div>
      )}

      {/* TOP: SCORE PREVIEW (OSMD WITH MEASURE & NOTEHEAD SYNCHRONIZATION) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            🎼 Synchronized Score Preview (Measure & Notehead Auto-Scroll)
          </h3>
          {selectedAnchorId && (
            <span style={{ fontSize: '12px', color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '4px 10px', borderRadius: '6px' }}>
              Current Anchor: M.{activeMeasureNumber} (Derived Pitch: {selectedMelodyPitch || 'N/A'})
            </span>
          )}
        </div>
        <ScoreViewer 
          xmlContent={xmlContent} 
          selectedMeasureNumber={activeMeasureNumber} 
          selectedAnchor={selectedAnchorObj}
          selectedMelodyPitch={selectedMelodyPitch}
          anchorsToBatchInspect={noteAnchors}
          batchInspectionTrigger={batchInspectTrigger}
          onVisualConfidenceEvaluated={handleVisualConfidenceEvaluated}
          onDiagnosticInfoEvaluated={setAnchorDiagnostic}
          onBatchInspectionEvaluated={handleBatchInspectionEvaluated}
          onError={() => {}} 
        />
      </div>

      {/* ANCHOR DIAGNOSTIC REPORT PANEL */}
      {anchorDiagnostic && (
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #3b82f6',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔬</span>
              <strong style={{ fontSize: '14px', color: '#60a5fa' }}>
                Anchor #{selectedAnchorObj?.anchorIndex || ''} Runtime Diagnostic Report (OSMD GraphicSheet Object Pipeline)
              </strong>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: anchorDiagnostic.finalConfidence === 'EXACT' ? 'rgba(16, 185, 129, 0.2)' : (anchorDiagnostic.finalConfidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
              color: anchorDiagnostic.finalConfidence === 'EXACT' ? '#34d399' : (anchorDiagnostic.finalConfidence === 'APPROXIMATE' ? '#fbbf24' : '#fca5a5'),
              border: `1px solid ${anchorDiagnostic.finalConfidence === 'EXACT' ? 'rgba(16, 185, 129, 0.4)' : (anchorDiagnostic.finalConfidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)')}`
            }}>
              Final Confidence: {anchorDiagnostic.finalConfidence}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            backgroundColor: 'var(--bg-app)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div><strong>1. Part ID:</strong> {anchorDiagnostic.xmlPartId}</div>
            <div><strong>2. Staff Number:</strong> {anchorDiagnostic.xmlStaffNumber}</div>
            <div><strong>3. Voice Number:</strong> {anchorDiagnostic.xmlVoiceNumber}</div>
            <div><strong>4. XML Measure Number:</strong> M.{anchorDiagnostic.xmlMeasureNumber}</div>
            <div><strong>5. XML Beat (Onset):</strong> B.{anchorDiagnostic.xmlBeat}</div>
            <div><strong>6. Target Pitch:</strong> {anchorDiagnostic.targetPitch}</div>
            <div><strong>7. OSMD MeasureList Index:</strong> {anchorDiagnostic.osmdMeasureListIndex ?? 'N/A'}</div>
            <div><strong>8. OSMD Source Measure:</strong> {anchorDiagnostic.osmdSourceMeasureNumber ?? 'N/A'}</div>
            <div><strong>9. StaffEntry Timestamp:</strong> {anchorDiagnostic.matchedStaffEntryTimestamp || 'N/A'}</div>
            <div><strong>10. Matched Voice ID:</strong> {anchorDiagnostic.matchedVoiceId || 'N/A'}</div>
            <div><strong>11. Graphical Notes Found:</strong> {anchorDiagnostic.graphicalNotesFound?.join(', ') || 'None'}</div>
            <div><strong>12. Target GraphicalNote:</strong> {anchorDiagnostic.targetGraphicalNote || 'None'}</div>
            <div><strong>13. PositionAndShape:</strong> {anchorDiagnostic.positionAndShape || 'N/A'}</div>
            <div><strong>14. Render Backend:</strong> {anchorDiagnostic.renderBackend || 'SVG'}</div>
            <div style={{ gridColumn: '1 / -1', color: anchorDiagnostic.highlightTarget ? '#34d399' : '#fca5a5' }}>
              <strong>15. Highlight Target:</strong> {anchorDiagnostic.highlightTarget || 'None'}
            </div>
            {anchorDiagnostic.failureReason && (
              <div style={{ gridColumn: '1 / -1', color: '#fca5a5' }}>
                <strong>16. Failure Reason:</strong> {anchorDiagnostic.failureReason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OSMD RUNTIME OBJECT INSPECTOR PANEL (STEP 2B-5B-3A) */}
      {anchorDiagnostic?.runtimeInspector && (
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #8b5cf6',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔍</span>
              <strong style={{ fontSize: '14px', color: '#c084fc' }}>
                OSMD Runtime Object Inspector (Anchor #{selectedAnchorObj?.anchorIndex || 1} Deep Shallow Reflection)
              </strong>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              backgroundColor: anchorDiagnostic.runtimeInspector.targetNoteFound ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: anchorDiagnostic.runtimeInspector.targetNoteFound ? '#34d399' : '#fca5a5',
              border: `1px solid ${anchorDiagnostic.runtimeInspector.targetNoteFound ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
            }}>
              Target Note Found: {anchorDiagnostic.runtimeInspector.targetNoteFound ? 'YES (EXACT)' : 'NO (APPROX/UNAVAIL)'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            backgroundColor: 'var(--bg-app)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            lineHeight: '1.6'
          }}>
            <div><strong>1. StaffEntry Constructor:</strong> {anchorDiagnostic.runtimeInspector.staffEntryConstructor}</div>
            <div><strong>2. StaffEntry Keys:</strong> {anchorDiagnostic.runtimeInspector.staffEntryKeys.join(', ') || 'None'}</div>
            <div><strong>3. Detected Child Arrays:</strong> {anchorDiagnostic.runtimeInspector.detectedChildArrays.join(' | ') || 'None'}</div>
            <div><strong>4. VoiceEntry Candidate Path:</strong> {anchorDiagnostic.runtimeInspector.voiceEntryCandidatePath}</div>
            <div><strong>5. VoiceEntry Constructor:</strong> {anchorDiagnostic.runtimeInspector.voiceEntryConstructor}</div>
            <div><strong>6. VoiceEntry Keys:</strong> {anchorDiagnostic.runtimeInspector.voiceEntryKeys.join(', ') || 'None'}</div>
            <div><strong>7. Voice ID Path & Value:</strong> {anchorDiagnostic.runtimeInspector.voiceIdPathAndValue}</div>
            <div><strong>8. GraphicalNote Candidate Path:</strong> {anchorDiagnostic.runtimeInspector.graphicalNoteCandidatePath}</div>
            <div><strong>9. GraphicalNote Count:</strong> {anchorDiagnostic.runtimeInspector.graphicalNoteCount}</div>
            <div><strong>10. Pitches Found at Onset:</strong> {anchorDiagnostic.runtimeInspector.graphicalNotePitchesFound.join(', ') || 'None'}</div>
            <div><strong>11. Target Pitch Path:</strong> {anchorDiagnostic.runtimeInspector.targetPitchPath}</div>
            <div><strong>12. PositionAndShape Path:</strong> {anchorDiagnostic.runtimeInspector.positionAndShapePath}</div>
            <div><strong>13. PositionAndShape Found:</strong> {anchorDiagnostic.runtimeInspector.positionAndShapeFound ? 'YES' : 'NO'}</div>
            <div><strong>14. SVG Element Found:</strong> {anchorDiagnostic.runtimeInspector.svgElementFound ? 'YES' : 'NO'}</div>
            <div style={{ gridColumn: '1 / -1', color: anchorDiagnostic.runtimeInspector.finalConfidence === 'EXACT' ? '#34d399' : '#fbbf24' }}>
              <strong>15. Final Confidence:</strong> {anchorDiagnostic.runtimeInspector.finalConfidence}
            </div>
            {anchorDiagnostic.runtimeInspector.failureReason && (
              <div style={{ gridColumn: '1 / -1', color: '#fca5a5' }}>
                <strong>16. Failure Reason:</strong> {anchorDiagnostic.runtimeInspector.failureReason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MISMATCH REVIEW PANEL */}
      {mismatchedAnchors.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <strong style={{ fontSize: '15px', color: '#fca5a5' }}>
              Melody Candidate Mismatches ({mismatchedAnchors.length} item{mismatchedAnchors.length > 1 ? 's' : ''})
            </strong>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Review anchors where extracted Highest Candidate pitch does not match printed Soprano melody line. Provide a note/reason for reference.
          </div>
          <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 10px' }}>Anchor #</th>
                  <th style={{ padding: '8px 10px' }}>Measure & Beat</th>
                  <th style={{ padding: '8px 10px' }}>Original Chord</th>
                  <th style={{ padding: '8px 10px', color: '#fca5a5' }}>Highest Candidate</th>
                  <th style={{ padding: '8px 10px' }}>Reason / User Note</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Focus Action</th>
                </tr>
              </thead>
              <tbody>
                {mismatchedAnchors.map(anchor => {
                  const derivedHighest = getDerivedMelodyPitch(anchor.chordPitches, anchor.mainPitch, melodyExtractionMode);
                  const originalChord = anchor.chordPitches.length > 0 ? anchor.chordPitches.join(' / ') : anchor.mainPitch;
                  const currentNote = mismatchNotes[anchor.anchorId] || '';

                  return (
                    <tr key={anchor.anchorId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#fca5a5' }}>
                        #{anchor.anchorIndex}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        M.{anchor.measureNumber} B.{anchor.beat}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                        {originalChord}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#fca5a5' }}>
                        {derivedHighest}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          value={currentNote}
                          placeholder="e.g. Printed melody appears to be A♭4"
                          onChange={(e) => handleUpdateMismatchNote(anchor.anchorId, e.target.value)}
                          style={{
                            width: '100%',
                            backgroundColor: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedAnchorId(anchor.anchorId)}
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          🔍 Focus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ⚠️ NON-EXACT RUNTIME MAPPING REVIEW PANEL */}
      {nonExactAnchors.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <strong style={{ fontSize: '15px', color: '#fca5a5' }}>
              Non-EXACT Runtime Mapping Review ({nonExactAnchors.length} item{nonExactAnchors.length > 1 ? 's' : ''})
            </strong>
          </div>
          <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 8px' }}>Anchor #</th>
                  <th style={{ padding: '8px 8px' }}>Measure</th>
                  <th style={{ padding: '8px 8px' }}>Beat</th>
                  <th style={{ padding: '8px 8px', color: '#34d399' }}>Candidate</th>
                  <th style={{ padding: '8px 8px' }}>Graphical Notes Found</th>
                  <th style={{ padding: '8px 8px' }}>Confidence</th>
                  <th style={{ padding: '8px 8px' }}>Failure Reason</th>
                  <th style={{ padding: '8px 8px', textAlign: 'center' }}>Focus Action</th>
                </tr>
              </thead>
              <tbody>
                {nonExactAnchors.map(anchor => {
                  const derivedHighest = getDerivedMelodyPitch(anchor.chordPitches, anchor.mainPitch, melodyExtractionMode);
                  const diag = runtimeMappingResults[anchor.anchorId];
                  const conf = diag?.finalConfidence || 'UNAVAILABLE';

                  return (
                    <tr key={anchor.anchorId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 700, color: '#fca5a5' }}>#{anchor.anchorIndex}</td>
                      <td style={{ padding: '8px 8px' }}>M.{anchor.measureNumber}</td>
                      <td style={{ padding: '8px 8px' }}>B.{anchor.beat}</td>
                      <td style={{ padding: '8px 8px', fontWeight: 700, color: '#34d399' }}>{derivedHighest}</td>
                      <td style={{ padding: '8px 8px', fontFamily: 'monospace' }}>{diag?.graphicalNotesFound?.join(', ') || 'None'}</td>
                      <td style={{ padding: '8px 8px' }}>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          backgroundColor: conf === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: conf === 'APPROXIMATE' ? '#fbbf24' : '#fca5a5',
                          border: `1px solid ${conf === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                        }}>
                          {conf}
                        </span>
                      </td>
                      <td style={{ padding: '8px 8px', color: '#fca5a5', fontSize: '10px' }}>{diag?.failureReason || '-'}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedAnchorId(anchor.anchorId)}
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          🔍 Focus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 2B-5B-3D FULL RUNTIME EVIDENCE TABLE PANEL (#1–64) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid #8b5cf6',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔬</span>
            <strong style={{ fontSize: '15px', color: '#c084fc' }}>
              Full Runtime Evidence Table (#1–#{allAnchors.length}) — GraphicSheet Traversal Verification
            </strong>
          </div>
          <button
            onClick={handleInspectAllAnchors}
            style={{
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔬</span> Re-Inspect All Anchors #1–#{allAnchors.length} After Pitch Fix
          </button>
        </div>

        {/* FULL MELODY RE-VERIFIED SUCCESS BANNER */}
        {isFullMelodyRuntimeProven && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: '#34d399',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🎉</span>
            <span>Runtime Mapping Re-Verified After Pitch Enum Fix: 64/64 EXACT</span>
          </div>
        )}

        {/* SUMMARY COUNTS PANEL */}
        <div style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: 'var(--bg-app)',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ color: 'var(--text-main)', backgroundColor: 'var(--bg-panel)', padding: '3px 10px', borderRadius: '4px' }}>
            Runtime Inspected: {inspected64Count} / {allAnchors.length}
          </span>
          <span style={{ color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '3px 10px', borderRadius: '4px' }}>
            EXACT: {exact64Count}
          </span>
          <span style={{ color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '3px 10px', borderRadius: '4px' }}>
            APPROXIMATE: {approx64Count}
          </span>
          <span style={{ color: '#fca5a5', backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: '3px 10px', borderRadius: '4px' }}>
            UNAVAILABLE: {unavail64Count}
          </span>
          <span style={{ color: 'var(--text-dim)', backgroundColor: 'var(--bg-panel)', padding: '3px 10px', borderRadius: '4px' }}>
            NOT_INSPECTED: {notInspected64Count}
          </span>
        </div>

        {/* 12-COLUMN SCROLLABLE EVIDENCE TABLE */}
        <div style={{ overflowX: 'auto', maxHeight: '550px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-app)', zIndex: 1 }}>
              <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '8px 6px' }}>Anchor #</th>
                <th style={{ padding: '8px 6px' }}>Measure / Beat</th>
                <th style={{ padding: '8px 6px' }}>Original Chord</th>
                <th style={{ padding: '8px 6px', color: '#34d399' }}>Highest Candidate</th>
                <th style={{ padding: '8px 6px' }}>Voice ID</th>
                <th style={{ padding: '8px 6px' }}>Graphical Notes Found</th>
                <th style={{ padding: '8px 6px' }}>Target GraphicalNote</th>
                <th style={{ padding: '8px 6px' }}>PositionAndShape</th>
                <th style={{ padding: '8px 6px' }}>SVG Target</th>
                <th style={{ padding: '8px 6px' }}>Confidence</th>
                <th style={{ padding: '8px 6px' }}>Failure Reason</th>
                <th style={{ padding: '8px 6px', textAlign: 'center' }}>Focus Action</th>
              </tr>
            </thead>
            <tbody>
              {allAnchors.map((anchor) => {
                const derivedHighest = getDerivedMelodyPitch(anchor.chordPitches, anchor.mainPitch, melodyExtractionMode);
                const originalChordStr = anchor.chordPitches.length > 0 ? anchor.chordPitches.join(' / ') : anchor.mainPitch;
                const diag = runtimeMappingResults[anchor.anchorId];
                const confidence = diag ? diag.finalConfidence : 'NOT_INSPECTED';

                return (
                  <tr key={anchor.anchorId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700, color: '#c084fc' }}>
                      #{anchor.anchorIndex}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      M.{anchor.measureNumber} B.{anchor.beat}
                    </td>
                    <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>
                      {originalChordStr}
                    </td>
                    <td style={{ padding: '8px 6px', fontWeight: 700, color: '#34d399' }}>
                      {derivedHighest}
                    </td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>
                      {diag?.matchedVoiceId || 'N/A'}
                    </td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>
                      {diag?.graphicalNotesFound?.join(', ') || 'None'}
                    </td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', color: diag?.targetGraphicalNote ? '#34d399' : 'var(--text-muted)' }}>
                      {diag?.targetGraphicalNote || 'None'}
                    </td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: '10px' }}>
                      {diag?.positionAndShape || 'N/A'}
                    </td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: '10px', color: '#60a5fa' }}>
                      {diag?.highlightTarget || 'N/A'}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: confidence === 'EXACT' ? 'rgba(16, 185, 129, 0.2)' : (confidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.2)' : (confidence === 'UNAVAILABLE' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-panel)')),
                        color: confidence === 'EXACT' ? '#34d399' : (confidence === 'APPROXIMATE' ? '#fbbf24' : (confidence === 'UNAVAILABLE' ? '#fca5a5' : 'var(--text-dim)')),
                        border: `1px solid ${confidence === 'EXACT' ? 'rgba(16, 185, 129, 0.4)' : (confidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.4)' : (confidence === 'UNAVAILABLE' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'))}`
                      }}>
                        {confidence}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', color: '#fca5a5', fontSize: '10px' }}>
                      {diag?.failureReason || '-'}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedAnchorId(anchor.anchorId)}
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        🔍 Focus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MVP STEP 2B-5B-3 INTERACTIVE FULL MELODY CANDIDATE VERIFICATION PANEL (#1~#64) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <strong style={{ fontSize: '15px', color: '#34d399' }}>
              MVP Step 2B-5B-3 — Full Melody Line Visual Verification (Part P1 / Staff 1 / Voice 1)
            </strong>
            <span style={{
              fontSize: '11px',
              backgroundColor: isFullMelodyManuallyVerified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: isFullMelodyManuallyVerified ? '#34d399' : '#fbbf24',
              border: `1px solid ${isFullMelodyManuallyVerified ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
              padding: '3px 10px',
              borderRadius: '6px',
              fontWeight: 700
            }}>
              {isFullMelodyManuallyVerified ? '✓ Melody Line Manually Verified (64/64 MATCHED)' : `User Verification: ${matchedCount} / ${totalAnchorsCount} MATCHED`}
            </span>
          </div>

          <button
            onClick={() => setShowVerificationPanel(!showVerificationPanel)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {showVerificationPanel ? 'Hide Verification Panel' : 'Show Verification Panel'}
          </button>
        </div>

        {/* PROGRESS METRICS PANEL (CLEARLY SEPARATED) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px',
          backgroundColor: 'var(--bg-app)',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          {/* SECTION A: VISUAL MAPPING COVERAGE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.5px' }}>
              🎯 Visual Mapping Coverage (Program AST/OSMD Target)
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                EXACT: {exactConfidenceCount} / {totalAnchorsCount}
              </span>
              <span style={{ color: '#fbbf24', backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                APPROXIMATE: {approxConfidenceCount}
              </span>
              <span style={{ color: '#fca5a5', backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                UNAVAILABLE: {unavailConfidenceCount}
              </span>
            </div>
          </div>

          {/* SECTION B: USER MELODY VERIFICATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.5px' }}>
              👤 User Melody Verification (Manual Click / Keyboard)
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                MATCHED: {matchedCount} / {totalAnchorsCount}
              </span>
              <span style={{ color: '#fca5a5', backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                MISMATCH: {mismatchCount}
              </span>
              <span style={{ color: 'var(--text-dim)', backgroundColor: 'var(--bg-panel)', padding: '2px 8px', borderRadius: '4px' }}>
                UNVERIFIED: {unverifiedCount}
              </span>
            </div>
          </div>
        </div>

        {/* KEYBOARD SHORTCUT HELPER BANNER */}
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '11px',
          color: '#60a5fa',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <strong>⌨️ Keyboard Verification Shortcuts:</strong>
          <span><kbd style={{ background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: '3px' }}>Tab</kbd> Next Focus</span>
          <span><kbd style={{ background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: '3px' }}>Shift+Tab</kbd> Prev Focus</span>
          <span><kbd style={{ background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: '3px' }}>M</kbd> Set Match</span>
          <span><kbd style={{ background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: '3px' }}>X</kbd> Set Mismatch</span>
          <span><kbd style={{ background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: '3px' }}>R</kbd> Reset</span>
        </div>

        {showVerificationPanel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
              Click any anchor row or use keyboard navigation below to inspect its visual target on the sheet music preview above. Verify whether the extracted <strong>Highest Candidate Pitch</strong> corresponds to the printed Soprano melody line.
              <span style={{ color: '#fbbf24', display: 'block', marginTop: '4px' }}>
                Note: Visual Target Confidence (EXACT/APPROXIMATE) evaluates software rendering accuracy. Verification Status (MATCHED/MISMATCH) is strictly set by your manual click/keyboard.
              </span>
            </div>

            <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '8px', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-app)', zIndex: 1 }}>
                  <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 10px' }}>Anchor #</th>
                    <th style={{ padding: '8px 10px' }}>Measure & Beat</th>
                    <th style={{ padding: '8px 10px' }}>Original Chord</th>
                    <th style={{ padding: '8px 10px', color: '#34d399' }}>Highest Candidate</th>
                    <th style={{ padding: '8px 10px' }}>Visual Target Confidence</th>
                    <th style={{ padding: '8px 10px' }}>Verification Status</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {noteAnchors.map((anchor) => {
                    const isSelected = selectedAnchorId === anchor.anchorId;
                    const derivedHighest = getDerivedMelodyPitch(anchor.chordPitches, anchor.mainPitch, melodyExtractionMode);
                    const originalChord = anchor.chordPitches.length > 0 ? anchor.chordPitches.join(' / ') : anchor.mainPitch;
                    const vConfidence = visualConfidenceMap[anchor.anchorId] || 'UNAVAILABLE';
                    const vStatus = anchorVerificationMap[anchor.anchorId] || 'UNVERIFIED';

                    return (
                      <tr 
                        key={anchor.anchorId} 
                        onClick={() => setSelectedAnchorId(anchor.anchorId)}
                        style={{
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#a78bfa' }}>
                          #{anchor.anchorIndex}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-main)' }}>
                          M.{anchor.measureNumber} B.{anchor.beat}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                          {originalChord}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#34d399' }}>
                          {derivedHighest}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            backgroundColor: vConfidence === 'EXACT' ? 'rgba(16, 185, 129, 0.2)' : (vConfidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                            color: vConfidence === 'EXACT' ? '#34d399' : (vConfidence === 'APPROXIMATE' ? '#fbbf24' : '#fca5a5'),
                            border: `1px solid ${vConfidence === 'EXACT' ? 'rgba(16, 185, 129, 0.4)' : (vConfidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)')}`
                          }}>
                            {vConfidence === 'EXACT' ? '🎯 EXACT' : (vConfidence === 'APPROXIMATE' ? '⚠️ APPROXIMATE' : '❌ UNAVAILABLE')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            backgroundColor: vStatus === 'MATCHED' ? '#064e3b' : (vStatus === 'MISMATCH' ? '#7f1d1d' : 'var(--bg-card)'),
                            color: vStatus === 'MATCHED' ? '#34d399' : (vStatus === 'MISMATCH' ? '#fca5a5' : 'var(--text-dim)'),
                            border: `1px solid ${vStatus === 'MATCHED' ? '#10b981' : (vStatus === 'MISMATCH' ? '#ef4444' : 'var(--border-color)')}`
                          }}>
                            {vStatus === 'MATCHED' ? '✓ MATCHED' : (vStatus === 'MISMATCH' ? '✕ MISMATCH' : 'UNVERIFIED')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedAnchorId(anchor.anchorId)}
                              title="Focus & Scroll to Note"
                              style={{
                                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'var(--bg-card)',
                                color: '#60a5fa',
                                border: '1px solid var(--border-color)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              🔍 Focus
                            </button>
                            <button
                              onClick={() => handleUpdateVerificationStatus(anchor.anchorId, 'MATCHED')}
                              style={{
                                backgroundColor: vStatus === 'MATCHED' ? '#10b981' : 'var(--bg-card)',
                                color: vStatus === 'MATCHED' ? '#ffffff' : '#34d399',
                                border: '1px solid var(--border-color)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              ✓ Match
                            </button>
                            <button
                              onClick={() => handleUpdateVerificationStatus(anchor.anchorId, 'MISMATCH')}
                              style={{
                                backgroundColor: vStatus === 'MISMATCH' ? '#ef4444' : 'var(--bg-card)',
                                color: vStatus === 'MISMATCH' ? '#ffffff' : '#fca5a5',
                                border: '1px solid var(--border-color)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              ✕ Mismatch
                            </button>
                            <button
                              onClick={() => handleUpdateVerificationStatus(anchor.anchorId, 'UNVERIFIED')}
                              style={{
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-dim)',
                                border: '1px solid var(--border-color)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              ↺ Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2B-5A COMPARISON TABLE PANEL: FIRST 15 ANCHORS FOR P1 VOICE 1 vs P2 VOICE 1 */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>?뱤</span>
            <strong style={{ fontSize: '14px', color: '#60a5fa' }}>
              Melody-Line Extraction Reference Inspector (First 15 Anchors)
            </strong>
          </div>
          <button
            onClick={() => setShowComparisonTable(!showComparisonTable)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {showComparisonTable ? 'Hide Table' : 'Show Table'}
          </button>
        </div>

        {showComparisonTable && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* PART P1 VOICE 1 COMPARISON TABLE */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Part P1 — Voice 1 ({p1Voice1Obj ? p1Voice1Obj.partName : 'P1'})</span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>First 15 Anchors</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '4px 6px' }}>Idx</th>
                    <th style={{ padding: '4px 6px' }}>Meas</th>
                    <th style={{ padding: '4px 6px' }}>Beat</th>
                    <th style={{ padding: '4px 6px' }}>Original Chord</th>
                    <th style={{ padding: '4px 6px', color: '#34d399' }}>Highest</th>
                    <th style={{ padding: '4px 6px', color: '#fbbf24' }}>Lowest</th>
                  </tr>
                </thead>
                <tbody>
                  {p1ComparisonRows.map((row) => (
                    <tr key={row.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700, color: '#a78bfa' }}>#{row.index}</td>
                      <td style={{ padding: '4px 6px' }}>M.{row.measureNumber}</td>
                      <td style={{ padding: '4px 6px' }}>B.{row.beat}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--text-main)', fontWeight: 600 }}>{row.originalChord}</td>
                      <td style={{ padding: '4px 6px', color: '#34d399', fontWeight: 700 }}>{row.highestPitch}</td>
                      <td style={{ padding: '4px 6px', color: '#fbbf24', fontWeight: 700 }}>{row.lowestPitch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PART P2 VOICE 1 COMPARISON TABLE */}
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Part P2 — Voice 1 ({p2Voice1Obj ? p2Voice1Obj.partName : 'P2'})</span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>First 15 Anchors</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '4px 6px' }}>Idx</th>
                    <th style={{ padding: '4px 6px' }}>Meas</th>
                    <th style={{ padding: '4px 6px' }}>Beat</th>
                    <th style={{ padding: '4px 6px' }}>Original Chord</th>
                    <th style={{ padding: '4px 6px', color: '#34d399' }}>Highest</th>
                    <th style={{ padding: '4px 6px', color: '#fbbf24' }}>Lowest</th>
                  </tr>
                </thead>
                <tbody>
                  {p2ComparisonRows.map((row) => (
                    <tr key={row.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700, color: '#a78bfa' }}>#{row.index}</td>
                      <td style={{ padding: '4px 6px' }}>M.{row.measureNumber}</td>
                      <td style={{ padding: '4px 6px' }}>B.{row.beat}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--text-main)', fontWeight: 600 }}>{row.originalChord}</td>
                      <td style={{ padding: '4px 6px', color: '#34d399', fontWeight: 700 }}>{row.highestPitch}</td>
                      <td style={{ padding: '4px 6px', color: '#fbbf24', fontWeight: 700 }}>{row.lowestPitch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DEBUG SECTION: DETECTED MUSICXML VOICES SUMMARY TABLE */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🔍</span>
            <strong style={{ fontSize: '14px', color: '#a78bfa' }}>
              Detected MusicXML Voices Summary (Debug & Reference Inspector)
            </strong>
          </div>
          <button
            onClick={() => setShowDebugTable(!showDebugTable)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {showDebugTable ? 'Hide Table' : 'Show Table'}
          </button>
        </div>

        {showDebugTable && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px' }}>Part ID</th>
                  <th style={{ padding: '8px 12px' }}>Part Name</th>
                  <th style={{ padding: '8px 12px' }}>Staff</th>
                  <th style={{ padding: '8px 12px' }}>Voice</th>
                  <th style={{ padding: '8px 12px' }}>Note Events</th>
                  <th style={{ padding: '8px 12px' }}>Chord Anchors</th>
                  <th style={{ padding: '8px 12px' }}>Rest Events</th>
                  <th style={{ padding: '8px 12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {availableVoices.map((av) => {
                  const isSelected = currentVoice.id === av.id;
                  return (
                    <tr key={av.id} style={{
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#60a5fa' }}>{av.partId}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-main)' }}>{av.partName}</td>
                      <td style={{ padding: '8px 12px' }}>Staff {av.staffNumber}</td>
                      <td style={{ padding: '8px 12px' }}>Voice {av.voiceNumber}</td>
                      <td style={{ padding: '8px 12px' }}>{av.noteCount}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#34d399' }}>{av.anchorCount}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{av.restCount}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button
                          onClick={() => setCurrentVoice(av)}
                          disabled={isSelected}
                          style={{
                            backgroundColor: isSelected ? '#10b981' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: isSelected ? 'default' : 'pointer'
                          }}
                        >
                          {isSelected ? '✓ Active Voice' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MIDDLE: CONTROLS & LAYER SELECTION & MELODY EXTRACTION MODE */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Verse Layer Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, marginRight: '4px' }}>
              Lyric Layer:
            </span>
            {layerKeys.map(l => (
              <button
                key={l.key}
                onClick={() => setActiveLayerKey(l.key)}
                style={{
                  backgroundColor: activeLayerKey === l.key ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: activeLayerKey === l.key ? '#ffffff' : 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Lyric Reference Voice Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>
              Lyric Reference Voice:
            </label>
            <select
              value={currentVoice.id}
              onChange={(e) => {
                const found = availableVoices.find(av => av.id === e.target.value);
                if (found) setCurrentVoice(found);
              }}
              style={{
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {availableVoices.map((av) => (
                <option key={av.id} value={av.id}>
                  Part {av.partId} ({av.partName}) — Staff {av.staffNumber} — Voice {av.voiceNumber} ({av.anchorCount} anchors)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* MELODY NOTE EXTRACTION MODE CONTROLS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-app)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa' }}>
              🎵 Melody Extraction Mode:
            </span>

            <button
              onClick={() => handleModeChange('ORIGINAL_CHORD')}
              style={{
                backgroundColor: melodyExtractionMode === 'ORIGINAL_CHORD' ? 'rgba(59, 130, 246, 0.3)' : 'var(--bg-card)',
                color: melodyExtractionMode === 'ORIGINAL_CHORD' ? '#60a5fa' : 'var(--text-muted)',
                border: `1px solid ${melodyExtractionMode === 'ORIGINAL_CHORD' ? '#3b82f6' : 'var(--border-color)'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🎹 Original Chord Anchor
            </button>

            <button
              onClick={() => handleModeChange('HIGHEST_NOTE')}
              style={{
                backgroundColor: melodyExtractionMode === 'HIGHEST_NOTE' ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)',
                color: melodyExtractionMode === 'HIGHEST_NOTE' ? '#34d399' : 'var(--text-muted)',
                border: `1px solid ${melodyExtractionMode === 'HIGHEST_NOTE' ? '#10b981' : 'var(--border-color)'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              燧놅툘 Highest Note of Chord
            </button>

            <button
              onClick={() => handleModeChange('LOWEST_NOTE')}
              style={{
                backgroundColor: melodyExtractionMode === 'LOWEST_NOTE' ? 'rgba(245, 158, 11, 0.25)' : 'var(--bg-card)',
                color: melodyExtractionMode === 'LOWEST_NOTE' ? '#fbbf24' : 'var(--text-muted)',
                border: `1px solid ${melodyExtractionMode === 'LOWEST_NOTE' ? '#f59e0b' : 'var(--border-color)'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              燧뉛툘 Lowest Note of Chord
            </button>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Selected Mode: <strong style={{ color: '#ffffff' }}>{melodyExtractionMode}</strong> (Derived Candidate)
          </span>
        </div>

        {/* STEP 2B-5 VERIFICATION SUMMARY PANEL */}
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          borderRadius: '10px',
          padding: '16px 20px',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>?뱥</span>
              <strong style={{ fontSize: '14px', color: '#60a5fa' }}>
                Alignment Verification Summary — {activeLayerKey.replace('_', ' ')}
              </strong>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px' }}>
              Layer Start: {configuredStartAnchor ? `Anchor #${configuredStartAnchor.anchorIndex}` : 'Default (Anchor #1)'}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
            backgroundColor: 'var(--bg-app)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '12px'
          }}>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '11px' }}>📍 Start Anchor:</span>
              <strong style={{ color: '#34d399', fontSize: '13px' }}>
                {effectiveStartAnchor ? `#${effectiveStartAnchor.anchorIndex} (M.${effectiveStartAnchor.measureNumber}, B.${effectiveStartAnchor.beat}, ${getDerivedMelodyPitch(effectiveStartAnchor.chordPitches, effectiveStartAnchor.mainPitch, melodyExtractionMode)})` : 'None'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '11px' }}>🏁 End Anchor:</span>
              <strong style={{ color: '#fbbf24', fontSize: '13px' }}>
                {lastUsedAnchor ? `#${lastUsedAnchor.anchorIndex} (M.${lastUsedAnchor.measureNumber}, B.${lastUsedAnchor.beat}, ${getDerivedMelodyPitch(lastUsedAnchor.chordPitches, lastUsedAnchor.mainPitch, melodyExtractionMode)})` : 'None'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '11px' }}>🎼 Measure Range:</span>
              <strong style={{ color: '#a78bfa', fontSize: '13px' }}>
                {usedAnchorsInLayer.length > 0 ? `M.${minMeasure} ~ M.${maxMeasure} (${maxMeasure - minMeasure + 1} M)` : 'N/A'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '11px' }}>⚓ Total Anchors Used:</span>
              <strong style={{ color: '#60a5fa', fontSize: '13px' }}>
                {usedAnchorsInLayer.length} Anchors
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '11px' }}>🔤 Syllables Aligned:</span>
              <strong style={{ color: alignedUnitsCount === totalUnitsCount && totalUnitsCount > 0 ? '#34d399' : '#f59e0b', fontSize: '13px' }}>
                {alignedUnitsCount} / {totalUnitsCount} Units
              </strong>
            </div>
          </div>

          <div style={{
            fontSize: '12px',
            color: '#fbbf24',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            padding: '8px 12px',
            lineHeight: '1.4'
          }}>
            <strong>⚠️ Note on Alignment Verification:</strong> Completeness (e.g. 32/32) indicates structural coverage only, NOT musical correctness. Verify layer start anchor, measure range, and note pitches visually before confirming.
          </div>
        </div>

        {/* AUTO-ASSIST & QUICK TOOLBAR ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleAutoAssistAlign}
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                color: '#a78bfa',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ⚡ Auto-Assist Sequential Alignment (From Layer Start)
            </button>

            <button
              onClick={handleConfirmAllProposed}
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              ✓ Confirm All Proposed
            </button>

            <button
              onClick={handleClearLayerAlignments}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              🗑️ Clear Layer
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSequentialMode(!sequentialMode)}
              style={{
                backgroundColor: sequentialMode ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-card)',
                color: sequentialMode ? '#60a5fa' : 'var(--text-muted)',
                border: `1px solid ${sequentialMode ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-color)'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⏩ Sequential Click Mode: {sequentialMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* PROGRESS BAR & SAVE ACTION */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <strong style={{ color: 'var(--text-main)' }}>Alignment Progress ({activeLayerKey.replace('_', ' ')}):</strong>
            <span style={{ color: '#34d399', fontWeight: 700 }}>
              Aligned: {alignedUnitsCount} / {totalUnitsCount}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>
              (Remaining: {remainingCount})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {toastMessage && (
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                {toastMessage}
              </span>
            )}
            <button onClick={handleSave} style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              💾 Save Alignment
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM: TIMELINE GRID (KOREAN UNITS + NOTE ANCHORS) */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        
        {/* Step 1: Korean Singing Units Selection Row */}
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', marginBottom: '8px', textTransform: 'uppercase' }}>
            Step 1: Select Authoritative Korean Syllable Unit
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {activeSingingUnits.map(unit => {
              const aligned = isUnitAligned(unit.id);
              const isSelected = selectedUnitId === unit.id;
              const unitAlignObj = getAlignmentForUnit(unit.id);
              const isProposed = unitAlignObj?.status === 'PROPOSED';

              return (
                <div
                  id={`syllable_card_${unit.id}`}
                  key={unit.id}
                  onClick={() => handleSelectUnitCard(unit.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isSelected 
                      ? 'rgba(59, 130, 246, 0.4)' 
                      : (isProposed ? 'rgba(139, 92, 246, 0.25)' : (aligned ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)')),
                    border: `2px solid ${isSelected ? '#3b82f6' : (isProposed ? '#a78bfa' : (aligned ? '#10b981' : 'var(--border-color)'))}`,
                    color: isSelected ? '#ffffff' : (isProposed ? '#c4b5fd' : (aligned ? '#34d399' : 'var(--text-main)')),
                    fontFamily: 'var(--font-family-korean)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {unit.unitText}
                {unit.isWordBoundary && <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>|</span>}
                  {isProposed && <span style={{ fontSize: '9px', color: '#a78bfa' }}>P</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Note Anchor Selection & Alignment Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', margin: 0 }}>
              Step 2: Select Musical Note Anchor & Connect (Sequential Mode Active)
            </h4>

            {selectedUnitId && selectedAnchorId && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleConnectAnchor(selectedAnchorId, 'ONE_TO_ONE')} style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  🔗 Connect Selected Syllable → Note Anchor
                </button>

                <button onClick={() => handleExtendMelisma(selectedAnchorId)} style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  ~ Extend Melisma (-)
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', backgroundColor: 'var(--bg-app)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {noteAnchors.map((anchor) => {
              const aligned = isAnchorAligned(anchor.anchorId);
              const isSelected = selectedAnchorId === anchor.anchorId;
              const alignmentObj = getAlignmentForAnchor(anchor.anchorId);
              const isProposed = alignmentObj?.status === 'PROPOSED';
              const isMelisma = alignmentObj?.melisma;
              const isLayerStart = layerStartAnchorIds[activeLayerKey] === anchor.anchorId;

              // Calculate derived melody candidate pitch for display
              const derivedMelodyPitch = getDerivedMelodyPitch(anchor.chordPitches, anchor.mainPitch, melodyExtractionMode);
              const originalChordText = anchor.chordPitches.length > 0 ? anchor.chordPitches.join(' / ') : anchor.mainPitch;

              const vConfidence = visualConfidenceMap[anchor.anchorId] || (anchor.chordPitches.length > 1 ? 'APPROXIMATE' : 'EXACT');
              const vStatus = anchorVerificationMap[anchor.anchorId] || 'UNVERIFIED';

              // Find unit text for aligned anchor
              let assignedUnitText = '';
              if (alignmentObj) {
                const foundUnit = activeSingingUnits.find(u => alignmentObj.singingUnitIds.includes(u.id));
                if (foundUnit) assignedUnitText = foundUnit.unitText;
              }

              return (
                <div
                  id={`anchor_card_${anchor.anchorId}`}
                  key={anchor.anchorId}
                  onClick={() => handleSelectAnchorCard(anchor.anchorId)}
                  style={{
                    minWidth: '125px',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isSelected 
                      ? 'rgba(59, 130, 246, 0.3)' 
                      : (anchor.isRest 
                          ? '#1e1b4b' 
                          : (isMelisma 
                              ? 'rgba(245, 158, 11, 0.2)' 
                              : (isProposed ? 'rgba(139, 92, 246, 0.2)' : (aligned ? '#064e3b' : 'var(--bg-card)')))),
                    border: `2px solid ${isLayerStart ? '#34d399' : (isSelected ? '#3b82f6' : (isMelisma ? '#f59e0b' : (isProposed ? '#a78bfa' : (aligned ? '#10b981' : 'var(--border-color)'))))}`,
                    color: 'var(--text-main)',
                    position: 'relative'
                  }}
                >
                  {/* Layer Start Badge */}
                  {isLayerStart && (
                    <span style={{
                      position: 'absolute',
                      top: '-8px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      ★ Start
                    </span>
                  )}

                  {/* Header Badges: Index, Measure & Beat */}
                  <div style={{ display: 'flex', gap: '4px', fontSize: '10px', fontWeight: 700 }}>
                    <span style={{ color: '#a78bfa' }}>#{anchor.anchorIndex}</span>
                    <span style={{ color: 'var(--text-dim)' }}>M.{anchor.measureNumber}</span>
                    <span style={{ color: '#60a5fa' }}>B.{anchor.beat}</span>
                  </div>

                  {/* Program System Visual Confidence Badge */}
                  <div style={{ fontSize: '9px', fontWeight: 600, color: vConfidence === 'EXACT' ? '#34d399' : (vConfidence === 'APPROXIMATE' ? '#fbbf24' : '#fca5a5') }}>
                    {vConfidence === 'EXACT' ? '🎯 EXACT' : (vConfidence === 'APPROXIMATE' ? '⚠️ APPROX' : '❌ UNAVAIL')}
                  </div>

                  {/* User Manual Verification Status Badge */}
                  <div style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '3px',
                    backgroundColor: vStatus === 'MATCHED' ? '#064e3b' : (vStatus === 'MISMATCH' ? '#7f1d1d' : 'rgba(255,255,255,0.1)'),
                    color: vStatus === 'MATCHED' ? '#34d399' : (vStatus === 'MISMATCH' ? '#fca5a5' : 'var(--text-dim)')
                  }}>
                    {vStatus === 'MATCHED' ? '✓ MATCHED' : (vStatus === 'MISMATCH' ? '✕ MISMATCH' : 'UNVERIFIED')}
                  </div>

                  {/* Aligned Korean Unit Badge */}
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: assignedUnitText ? (isProposed ? '#c4b5fd' : '#34d399') : 'var(--text-dim)',
                    minHeight: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: 'var(--font-family-korean)'
                  }}>
                    {assignedUnitText || (anchor.isRest ? 'REST' : '-')}
                  </div>

                  {/* Original Chord Display */}
                  <span style={{ fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
                    Orig: <strong style={{ color: '#94a3b8' }}>{originalChordText}</strong>
                  </span>

                  {/* Derived Melody Candidate Pitch Display */}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: anchor.isRest ? '#818cf8' : (melodyExtractionMode === 'HIGHEST_NOTE' ? '#34d399' : (melodyExtractionMode === 'LOWEST_NOTE' ? '#fbbf24' : '#60a5fa')),
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    Melody: {derivedMelodyPitch}
                  </span>

                  {/* Duration & Tie/Slur Indicators */}
                  <div style={{ fontSize: '9px', color: 'var(--text-dim)', display: 'flex', gap: '4px' }}>
                    <span>Dur:{anchor.duration}</span>
                    {anchor.tie !== 'none' && <span style={{ color: '#fbbf24' }}>Tie</span>}
                    {anchor.slur !== 'none' && <span style={{ color: '#a78bfa' }}>Slur</span>}
                  </div>

                  {/* Set as Layer Start Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetLayerStart(anchor.anchorId);
                    }}
                    title="Set as Layer Start Anchor"
                    style={{
                      marginTop: '2px',
                      fontSize: '9px',
                      backgroundColor: isLayerStart ? '#10b981' : 'var(--bg-app)',
                      color: isLayerStart ? '#ffffff' : 'var(--text-dim)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {isLayerStart ? '★ Layer Start' : '📍 Set Start'}
                  </button>

                  {/* Action Disconnect Button */}
                  {aligned && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtendMelisma(anchor.anchorId);
                        }}
                        title="Extend melisma (~)"
                        style={{
                          fontSize: '9px',
                          backgroundColor: 'rgba(245, 158, 11, 0.25)',
                          color: '#fbbf24',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 4px',
                          cursor: 'pointer'
                        }}
                      >
                        ~
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnassign(anchor.anchorId);
                        }}
                        style={{
                          fontSize: '9px',
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          color: '#fca5a5',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 4px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};


