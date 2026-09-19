import React, { useState } from 'react';
import type {
  AmharicLyricLineData,
  LyricLineData
} from '../types/hymn';
import { parseTextToAmharicSingingUnits } from '../utils/amharicSyllable';

interface NativeReviewEditorProps {
  koreanLyrics: LyricLineData[];
  amharicLyrics: AmharicLyricLineData[];
  onSaveAmharicLyrics: (updatedLyrics: AmharicLyricLineData[]) => void;
}

export const NativeReviewEditor: React.FC<NativeReviewEditorProps> = ({
  koreanLyrics,
  amharicLyrics,
  onSaveAmharicLyrics
}) => {
  const [lines, setLines] = useState<AmharicLyricLineData[]>(() => {
    if (amharicLyrics.length > 0) {
      return amharicLyrics;
    }

    return koreanLyrics.map(line => ({
      id: `am_${line.id.replace(/^ko_/, '')}`,
      koreanLineId: line.id,
      lineIndex: line.lineIndex,
      sectionType: line.sectionType,
      sectionNumber: line.sectionNumber,
      displayText: '',
      singingUnits: [],
      approvalStatus: 'DRAFT'
    }));
  });

  const handleAmharicTextChange = (lineId: string, text: string) => {
    setLines(prev =>
      prev.map(line =>
        line.id === lineId
          ? {
              ...line,
              displayText: text,
              singingUnits: parseTextToAmharicSingingUnits(text, line.id),
              approvalStatus: 'DRAFT',
              nativeReview: line.nativeReview
                ? { ...line.nativeReview, reviewedAt: undefined }
                : undefined
            }
          : line
      )
    );
  };

  const handleNativeReviewChange = (
    lineId: string,
    field: 'reviewerName' | 'naturalWordingNotes' | 'theologicalNotes' | 'pronunciationNotes' | 'syllableNotes' | 'singabilityScore',
    value: string | number
  ) => {
    setLines(prev =>
      prev.map(line => {
        if (line.id !== lineId) return line;

        const currentReview = line.nativeReview ?? {
          reviewerName: '',
          naturalWordingNotes: '',
          theologicalNotes: '',
          pronunciationNotes: '',
          syllableNotes: '',
          singabilityScore: 1
        };

        return {
          ...line,
          approvalStatus: 'DRAFT',
          nativeReview: {
            ...currentReview,
            [field]: value,
            reviewedAt: undefined
          }
        };
      })
    );
  };

  const handleMarkReviewed = (lineId: string) => {
    setLines(prev =>
      prev.map(line => {
        if (line.id !== lineId) return line;

        const currentReview = line.nativeReview ?? {
          reviewerName: '',
          naturalWordingNotes: '',
          theologicalNotes: '',
          pronunciationNotes: '',
          syllableNotes: '',
          singabilityScore: 1
        };

        return {
          ...line,
          approvalStatus: 'REVIEWED',
          nativeReview: {
            ...currentReview,
            reviewedAt: new Date().toISOString()
          }
        };
      })
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      <div
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid var(--border-color)'
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: '#60a5fa',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Native Review
        </span>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--text-main)',
            margin: '4px 0 2px 0'
          }}
        >
          Amharic Native Review
        </h2>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Review Amharic hymn lyrics for wording, theology, pronunciation, syllables, and singability.
        </p>

        <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Korean lines: {koreanLyrics.length} / Amharic lines: {lines.length}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginTop: '20px'
          }}
        >
          {lines.map(line => {
            const koreanLine = koreanLyrics.find(
              koLine => koLine.id === line.koreanLineId
            );

            return (
              <div
                key={line.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '16px'
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase'
                  }}
                >
                  {line.sectionType} {line.sectionNumber} | Line {line.lineIndex}
                </div>

                <div
                  style={{
                    fontSize: '15px',
                    color: 'var(--text-main)',
                    marginBottom: '10px'
                  }}
                >
                  {koreanLine?.displayText || 'Korean source line not found'}
                </div>

                <textarea
                  value={line.displayText}
                  onChange={e =>
                    handleAmharicTextChange(line.id, e.target.value)
                  }
                  placeholder="Enter Amharic singable lyric"
                  rows={2}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '16px'
                  }}
                />

                <div style={{ marginTop: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px'
                    }}
                  >
                    Reviewer Name
                  </label>

                  <input
                    type="text"
                    value={line.nativeReview?.reviewerName ?? ''}
                    onChange={e =>
                      handleNativeReviewChange(
                        line.id,
                        'reviewerName',
                        e.target.value
                      )
                    }
                    placeholder="Enter reviewer name"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px'
                    }}
                  >
                    Natural Wording Notes
                  </label>

                  <textarea
                    value={line.nativeReview?.naturalWordingNotes ?? ''}
                    onChange={e =>
                      handleNativeReviewChange(
                        line.id,
                        'naturalWordingNotes',
                        e.target.value
                      )
                    }
                    placeholder="Notes about natural Amharic wording"
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px'
                    }}
                  >
                    Theological Notes
                  </label>

                  <textarea
                    value={line.nativeReview?.theologicalNotes ?? ''}
                    onChange={e =>
                      handleNativeReviewChange(
                        line.id,
                        'theologicalNotes',
                        e.target.value
                      )
                    }
                    placeholder="Notes about theological meaning and accuracy"
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px'
                    }}
                  >
                    Pronunciation Notes
                  </label>

                  <textarea
                    value={line.nativeReview?.pronunciationNotes ?? ''}
                    onChange={e =>
                      handleNativeReviewChange(
                        line.id,
                        'pronunciationNotes',
                        e.target.value
                      )
                    }
                    placeholder="Notes about Amharic pronunciation"
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px'
                    }}
                  >
                    Syllable Notes
                  </label>

                  <textarea
                    value={line.nativeReview?.syllableNotes ?? ''}
                    onChange={e =>
                      handleNativeReviewChange(
                        line.id,
                        'syllableNotes',
                        e.target.value
                      )
                    }
                    placeholder="Notes about syllable division and lyric-to-melody fit"
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '6px'
                    }}
                  >
                    Singability Score (1-5)
                  </label>

                  <select
                    value={line.nativeReview?.singabilityScore ?? 1}
                    onChange={e =>
                      handleNativeReviewChange(
                        line.id,
                        'singabilityScore',
                        Number(e.target.value)
                      )
                    }
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '14px'
                    }}
                  >
                    <option value={1} style={{ backgroundColor: '#ffffff', color: '#111111' }}>1</option>
                    <option value={2} style={{ backgroundColor: '#ffffff', color: '#111111' }}>2</option>
                    <option value={3} style={{ backgroundColor: '#ffffff', color: '#111111' }}>3</option>
                    <option value={4} style={{ backgroundColor: '#ffffff', color: '#111111' }}>4</option>
                    <option value={5} style={{ backgroundColor: '#ffffff', color: '#111111' }}>5</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleMarkReviewed(line.id)}
                  style={{
                    marginTop: '14px',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  {line.approvalStatus === 'REVIEWED'
                    ? 'Reviewed'
                    : 'Mark as Reviewed'}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onSaveAmharicLyrics(lines)}
          style={{ marginTop: '16px' }}
        >
          Save Native Review
        </button>
      </div>
    </div>
  );
};

