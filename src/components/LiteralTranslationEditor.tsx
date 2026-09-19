import React, { useEffect, useState } from 'react';
import type {
  LyricLineData,
  LiteralTranslationLineData
} from '../types/hymn';

interface LiteralTranslationEditorProps {
  koreanLyrics: LyricLineData[];
  literalTranslations: LiteralTranslationLineData[];
  onSaveLiteralTranslations: (
    updatedTranslations: LiteralTranslationLineData[]
  ) => void;
}

export const LiteralTranslationEditor: React.FC<LiteralTranslationEditorProps> = ({
  koreanLyrics,
  literalTranslations,
  onSaveLiteralTranslations
}) => {
  const [translations, setTranslations] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    literalTranslations.forEach(item => {
      initial[item.koreanLineId] = item.literalAmharicText;
    });

    return initial;
  });

  const buildTranslationData = (): LiteralTranslationLineData[] => {
    return koreanLyrics.map(line => ({
      id: `literal_${line.id.replace(/^ko_/, '')}`,
      koreanLineId: line.id,
      lineIndex: line.lineIndex,
      sectionType: line.sectionType,
      sectionNumber: line.sectionNumber,
      koreanText: line.displayText,
      literalAmharicText: translations[line.id] ?? '',
      approvalStatus: translations[line.id]?.trim()
        ? 'TRANSLATED'
        : 'DRAFT'
    }));
  };
  const handleChange = (lineId: string, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [lineId]: value
    }));
  };

  const handleSave = () => {
    onSaveLiteralTranslations(buildTranslationData());
  };

  useEffect(() => {
    const nextTranslations: Record<string, string> = {};

    literalTranslations.forEach(item => {
      nextTranslations[item.koreanLineId] = item.literalAmharicText;
    });

    setTranslations(nextTranslations);
  }, [literalTranslations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>
          Literal Translation
        </h2>
        <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
          Translate each authoritative Korean lyric line into literal Amharic.
          Keep the meaning close to the Korean source before singable adaptation.
        </p>
      </div>

      <div
        style={{
          padding: '14px 16px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}
      >
        Korean lines: {koreanLyrics.length} · Literal translations entered:{' '}
        {Object.values(translations).filter(value => value.trim().length > 0).length}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Save Literal Translations
        </button>
      </div>
      {koreanLyrics.map((line, index) => (
        <div
          key={line.id}
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-panel)'
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              marginBottom: '8px'
            }}
          >
            Line {index + 1} · {line.sectionType} {line.sectionNumber}
          </div>

          <div
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--text-main)',
              marginBottom: '14px'
            }}
          >
            {line.displayText}
          </div>

          <textarea
            value={translations[line.id] ?? ''}
            onChange={event => handleChange(line.id, event.target.value)}
            placeholder="Enter literal Amharic translation"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '16px',
              lineHeight: 1.6,
              fontFamily: 'inherit'
            }}
          />
        </div>
      ))}
    </div>
  );
};


