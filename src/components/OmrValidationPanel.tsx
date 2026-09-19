import React, { useState, useEffect } from 'react';
import type { OmrMetadata, OmrValidationStatus } from '../types/hymn';

interface OmrValidationPanelProps {
  omrMetadata: OmrMetadata | null;
  onSaveStatusAndNotes: (newStatus: OmrValidationStatus, notes: string) => boolean;
  onImportOmrXml: () => void;
}

export const OmrValidationPanel: React.FC<OmrValidationPanelProps> = ({
  omrMetadata,
  onSaveStatusAndNotes,
  onImportOmrXml
}) => {
  const [notes, setNotes] = useState<string>(omrMetadata?.validationNotes || '');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync internal notes state if omrMetadata prop changes (e.g. after refresh/hydration)
  useEffect(() => {
    if (omrMetadata?.validationNotes !== undefined) {
      setNotes(omrMetadata.validationNotes);
    }
  }, [omrMetadata?.validationNotes]);

  // Handle Save Action with visual feedback toast
  const handleSave = (statusToSave: OmrValidationStatus, notesToSave: string) => {
    setFeedbackMessage(null);
    const success = onSaveStatusAndNotes(statusToSave, notesToSave);

    if (success) {
      setFeedbackMessage({ type: 'success', text: '✓ Validation notes saved' });
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 3000);
    } else {
      setFeedbackMessage({ type: 'error', text: 'Failed to save validation notes.' });
    }
  };

  const statusColors: Record<OmrValidationStatus, { bg: string; color: string; border: string }> = {
    UNVERIFIED: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' },
    REVIEWING: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' },
    VERIFIED: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.4)' },
    NEEDS_CORRECTION: { bg: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.4)' }
  };

  const currentStatus = omrMetadata?.validationStatus || 'UNVERIFIED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* AUDIVERIS OMR CONVERSION GUIDE & IMPORT BAR */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              OMR Engine Adapter (Audiveris)
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: '4px 0 2px 0' }}>
              PDF / Image Hymn Score OMR Workflow
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Convert original PDF score ("495 내 영혼이 은총 입어") into editable MusicXML using Audiveris OMR.
            </p>
          </div>

          <button onClick={onImportOmrXml} style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📥 Import Audiveris MusicXML / MXL
          </button>
        </div>

        {/* STEP-BY-STEP LOCAL AUDIVERIS PROCEDURE */}
        <div style={{
          backgroundColor: 'var(--bg-app)',
          borderRadius: '8px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>
            💡 Audiveris Local OMR Conversion Procedure (Windows):
          </strong>
          <ol style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.6' }}>
            <li>Open <strong>Audiveris OMR Desktop Application</strong> on Windows.</li>
            <li>Load the PDF file: <code>495 내 영혼이 은총 입어.pdf</code>.</li>
            <li>Run Recognition (Transcribe) to generate score layers.</li>
            <li>Export the transcribed score as <code>.mxl</code> or <code>.musicxml</code> to your local directory.</li>
            <li>Click <strong>"Import Audiveris MusicXML"</strong> above to load the converted score into Amharic Hymn Studio.</li>
          </ol>
        </div>
      </div>

      {/* OMR VALIDATION STATUS PANEL */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              OMR Score Validation & Visual Verification
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Compare the rendered MusicXML score against the original PDF score to verify accuracy.
            </p>
          </div>

          {/* Current Status Badge */}
          <div style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: statusColors[currentStatus].bg,
            color: statusColors[currentStatus].color,
            border: `1px solid ${statusColors[currentStatus].border}`
          }}>
            Status: {currentStatus}
          </div>
        </div>

        {/* QUICK STATUS ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => handleSave('VERIFIED', notes)}
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ✓ Verified against original PDF
          </button>

          <button
            onClick={() => handleSave('NEEDS_CORRECTION', notes)}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⚠ Needs Correction
          </button>

          <button
            onClick={() => handleSave('REVIEWING', notes)}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🔍 Mark Under Review
          </button>
        </div>

        {/* VERIFICATION NOTES INPUT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Validation Notes & OMR Accuracy Observation:
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record any missing notes, key signature discrepancies, or Korean lyric alignment fixes needed against the original PDF..."
            rows={3}
            style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '10px 12px',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Visual Feedback Message Toast */}
            {feedbackMessage ? (
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: feedbackMessage.type === 'success' ? '#34d399' : '#fca5a5',
                backgroundColor: feedbackMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                padding: '6px 14px',
                borderRadius: '6px',
                border: `1px solid ${feedbackMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {feedbackMessage.text}
              </div>
            ) : <div />}

            <button
              onClick={() => handleSave(currentStatus, notes)}
              style={{
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                color: '#ffffff',
                padding: '8px 18px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              💾 Save Validation Notes
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

