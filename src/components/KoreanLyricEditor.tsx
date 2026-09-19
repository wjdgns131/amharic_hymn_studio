import React, { useState } from 'react';
import type { LyricLineData, SectionType, ReadOnlyNoteEvent } from '../types/hymn';
import { parseTextToSingingUnits, singingUnitsToDisplayText } from '../utils/koreanSyllable';

interface KoreanLyricEditorProps {
  lyrics: LyricLineData[];
  noteSequence: ReadOnlyNoteEvent[];
  onSaveLyrics: (updatedLyrics: LyricLineData[]) => void;
}

export const KoreanLyricEditor: React.FC<KoreanLyricEditorProps> = ({
  lyrics,
  noteSequence,
  onSaveLyrics
}) => {
  const [lines, setLines] = useState<LyricLineData[]>(lyrics);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Group lines by section
  const sectionTypes: SectionType[] = ['VERSE', 'CHORUS', 'REFRAIN', 'BRIDGE', 'OTHER'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handle sentence display text change
  const handleLineTextChange = (lineId: string, newText: string) => {
    const updated = lines.map(line => {
      if (line.id === lineId) {
        const newUnits = parseTextToSingingUnits(newText, line.id);
        return {
          ...line,
          displayText: newText,
          singingUnits: newUnits
        };
      }
      return line;
    });
    setLines(updated);
  };

  // Handle individual unit text change
  const handleUnitTextChange = (lineId: string, unitId: string, newChar: string) => {
    const updated = lines.map(line => {
      if (line.id === lineId) {
        const newUnits = line.singingUnits.map(u => {
          if (u.id === unitId) {
            return { ...u, unitText: newChar };
          }
          return u;
        });
        return {
          ...line,
          displayText: singingUnitsToDisplayText(newUnits),
          singingUnits: newUnits
        };
      }
      return line;
    });
    setLines(updated);
  };

  // Toggle Word Boundary
  const handleToggleWordBoundary = (lineId: string, unitId: string) => {
    const updated = lines.map(line => {
      if (line.id === lineId) {
        const newUnits = line.singingUnits.map(u => {
          if (u.id === unitId) {
            return { ...u, isWordBoundary: !u.isWordBoundary };
          }
          return u;
        });
        return {
          ...line,
          displayText: singingUnitsToDisplayText(newUnits),
          singingUnits: newUnits
        };
      }
      return line;
    });
    setLines(updated);
  };

  // Toggle Melismatic Extension (-)
  const handleToggleExtension = (lineId: string, unitId: string) => {
    const updated = lines.map(line => {
      if (line.id === lineId) {
        const newUnits = line.singingUnits.map(u => {
          if (u.id === unitId) {
            return { ...u, isExtended: !u.isExtended };
          }
          return u;
        });
        return {
          ...line,
          singingUnits: newUnits
        };
      }
      return line;
    });
    setLines(updated);
  };

  // Add new section line
  const handleAddLine = (sectionType: SectionType, sectionNum: number) => {
    const newLineId = `line_${Date.now()}`;
    const newLine: LyricLineData = {
      id: newLineId,
      lineIndex: lines.length + 1,
      sectionType,
      sectionNumber: sectionNum,
      displayText: 'Enter new lyric line',
      singingUnits: parseTextToSingingUnits('Enter new lyric line', newLineId),
      approvalStatus: 'DRAFT'
    };
    const updated = [...lines, newLine];
    setLines(updated);
    onSaveLyrics(updated);
    showToast('✓ New lyric line added');
  };

  // Save changes
  const handleSaveAll = () => {
    onSaveLyrics(lines);
    showToast('✓ Authoritative Korean lyrics saved');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      {/* HEADER BAR & SAVE ACTION */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Authoritative Text Layer
          </span>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', margin: '4px 0 2px 0' }}>
            Korean Hymn Lyric Editor & Syllable Preparation
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            User-provided authoritative Korean text taking priority over OMR/OCR detected lyrics for translation & alignment.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {toastMessage && (
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#34d399',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              {toastMessage}
            </div>
          )}

          <button onClick={handleSaveAll} style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💾 Save Authoritative Lyrics
          </button>
        </div>
      </div>

      {/* READ-ONLY NOTE SEQUENCE INFORMATION CARD */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '16px 20px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🎼</span>
          <div>
            <strong style={{ color: 'var(--text-main)' }}>MusicXML Note Sequence (Read-Only Inspection):</strong>
            <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
              {noteSequence.length > 0
                ? `${noteSequence.length} note/event(s) extracted across ${Math.max(...noteSequence.map(n => n.measureNumber), 0)} measure(s). Notes are NOT automatically modified.`
                : 'No MusicXML loaded yet. Import a MusicXML/MXL score to inspect note counts.'}
            </span>
          </div>
        </div>

        {noteSequence.length > 0 && (
          <span style={{ color: '#34d399', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            ✓ Notes Sequence Ready
          </span>
        )}
      </div>

      {/* LYRIC LINES & SYLLABLE TILES LISTING */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {lines.map((line) => (
          <div key={line.id} style={{
            backgroundColor: 'var(--bg-panel)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* Line Header & Section Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: line.sectionType === 'CHORUS' ? '#a78bfa' : '#60a5fa',
                  backgroundColor: line.sectionType === 'CHORUS' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${line.sectionType === 'CHORUS' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`
                }}>
                  {line.sectionType} {line.sectionNumber} - Line {line.lineIndex}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Total Units: {line.singingUnits.length}
                </span>
              </div>
            </div>

            {/* Authoritative Display Sentence Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Authoritative Korean Sentence Text:
              </label>
              <input
                type="text"
                value={line.displayText}
                onChange={(e) => handleLineTextChange(line.id, e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: 'var(--text-main)',
                  fontSize: '15px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family-korean)'
                }}
              />
            </div>

            {/* Interactive Singing Units Tile Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Singing Units (Interactive Syllable & Melisma Segmentation):
              </label>
              
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                {line.singingUnits.map((unit) => (
                  <div key={unit.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    backgroundColor: unit.isExtended ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                    border: `1px solid ${unit.isExtended ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)'}`,
                    borderRadius: '6px',
                    padding: '6px 8px',
                    gap: '4px',
                    minWidth: '42px'
                  }}>
                    {/* Character Edit */}
                    <input
                      type="text"
                      value={unit.unitText}
                      onChange={(e) => handleUnitTextChange(line.id, unit.id, e.target.value)}
                      style={{
                        width: '28px',
                        textAlign: 'center',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-light)',
                        color: 'var(--text-main)',
                        fontSize: '16px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-family-korean)'
                      }}
                    />

                    {/* Unit Controls (Space Boundary & Melisma) */}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      <button
                        onClick={() => handleToggleWordBoundary(line.id, unit.id)}
                        title={unit.isWordBoundary ? "Word boundary space ON" : "Turn word boundary space ON"}
                        style={{
                          fontSize: '9px',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: unit.isWordBoundary ? 'var(--accent-primary)' : 'var(--bg-app)',
                          color: unit.isWordBoundary ? '#fff' : 'var(--text-dim)'
                        }}
                      >
                        ␣
                  </button>

                      <button
                        onClick={() => handleToggleExtension(line.id, unit.id)}
                        title={unit.isExtended ? "Melisma extended ON" : "Mark as melisma extension (-)"}
                        style={{
                          fontSize: '9px',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: unit.isExtended ? 'var(--accent-warning)' : 'var(--bg-app)',
                          color: unit.isExtended ? '#000' : 'var(--text-dim)'
                        }}
                      >
                        ~
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* ADD NEW SECTION BUTTONS */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px dashed var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add Section Line:</span>
        {sectionTypes.map(st => (
          <button
            key={st}
            onClick={() => handleAddLine(st, 1)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            + Add {st}
          </button>
        ))}
      </div>

    </div>
  );
};


