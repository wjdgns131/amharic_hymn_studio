import React, { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { LyricNoteAnchor, VisualTargetConfidence, AnchorDiagnosticInfo } from '../types/hymn';
import { findOsmdGraphicalNoteTarget } from '../utils/osmdNoteMapper';
import { getDerivedMelodyPitch } from '../utils/lyricAnchorExtractor';

interface ScoreViewerProps {
  xmlContent: string | null;
  selectedMeasureNumber?: number;
  selectedAnchor?: LyricNoteAnchor;
  selectedMelodyPitch?: string;
  anchorsToBatchInspect?: LyricNoteAnchor[];
  batchInspectionTrigger?: number;
  onVisualConfidenceEvaluated?: (anchorId: string, confidence: VisualTargetConfidence) => void;
  onDiagnosticInfoEvaluated?: (diag: AnchorDiagnosticInfo) => void;
  onBatchInspectionEvaluated?: (results: Record<string, AnchorDiagnosticInfo>) => void;
  onError: (errMsg: string) => void;
}

export const ScoreViewer: React.FC<ScoreViewerProps> = ({ 
  xmlContent, 
  selectedMeasureNumber, 
  selectedAnchor,
  selectedMelodyPitch,
  anchorsToBatchInspect,
  batchInspectionTrigger,
  onVisualConfidenceEvaluated,
  onDiagnosticInfoEvaluated,
  onBatchInspectionEvaluated,
  onError 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const activeHighlightedSvgRef = useRef<SVGElement | null>(null);
  const highlightedShapesRef = useRef<Array<{
    element: SVGElement;
    originalStyle: string | null;
  }>>([]);
  
  const [zoom, setZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activeConfidence, setActiveConfidence] = useState<VisualTargetConfidence>('NOT_INSPECTED');

  // Clear all existing SVG highlights from container
  const clearPreviousHighlights = () => {
    // Restore the original inline styles of previously highlighted shapes.
    highlightedShapesRef.current.forEach(({ element, originalStyle }) => {
      if (originalStyle === null) {
        element.removeAttribute('style');
      } else {
        element.setAttribute('style', originalStyle);
      }
    });
    highlightedShapesRef.current = [];
    if (activeHighlightedSvgRef.current) {
      try {
        activeHighlightedSvgRef.current.style.stroke = '';
        activeHighlightedSvgRef.current.style.strokeWidth = '';
        activeHighlightedSvgRef.current.style.fill = '';
      } catch (e) {}
      activeHighlightedSvgRef.current = null;
    }
    if (containerRef.current) {
      const highlightedNodes = containerRef.current.querySelectorAll('[data-osmd-highlight="true"]');
      highlightedNodes.forEach((node: any) => {
        try {
          node.style.stroke = '';
          node.style.strokeWidth = '';
          node.style.fill = '';
          node.removeAttribute('data-osmd-highlight');
        } catch (e) {}
      });
    }
  };

  // Initialize and Render OSMD when xmlContent changes
  useEffect(() => {
    if (!xmlContent || !containerRef.current) return;

    let isMounted = true;
    setLoading(true);
    setRenderError(null);

    const renderScore = async () => {
      try {
        // Clear previous container DOM elements
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Create new OSMD instance
        const osmd = new OpenSheetMusicDisplay(containerRef.current!, {
          autoResize: true,
          backend: 'svg',
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          drawLyricist: true,
          drawMetronomeMarks: true,
          drawPartNames: true,
          drawFingerings: true,
          renderSingleHorizontalStaffline: false
        });

        osmdRef.current = osmd;

        // Load MusicXML raw string
        await osmd.load(xmlContent);

        if (isMounted) {
          osmd.Zoom = zoom;
          osmd.render();
          setLoading(false);
        }
      } catch (err: any) {
        console.error('OSMD Render Error:', err);
        const msg = err?.message || 'Failed to render the MusicXML score.';
        if (isMounted) {
          setRenderError(msg);
          setLoading(false);
          onError(msg);
        }
      }
    };

    renderScore();

    return () => {
      isMounted = false;
    };
  }, [xmlContent]);

  // OSMD internal Graphical Sheet Notehead Mapping & Auto-Scroll
  useEffect(() => {
    if (!containerRef.current || !osmdRef.current) return;
    const targetMeasureNum = selectedAnchor?.measureNumber ?? selectedMeasureNumber;
    if (targetMeasureNum === undefined || !selectedAnchor) return;

    try {
      // 1. Clear previous highlights
      clearPreviousHighlights();

      // 2. Run GraphicSheet note target mapping via modular utility
      const result = findOsmdGraphicalNoteTarget(osmdRef.current, selectedAnchor, selectedMelodyPitch);
      if (selectedAnchor.anchorIndex === 17) {
        console.log('[FOCUS #17]', {
          finalConfidence: result.finalConfidence,
          svgElementFound: result.runtimeInspector?.svgElementFound,
          positionAndShapeFound: result.runtimeInspector?.positionAndShapeFound,
          highlightTarget: result.highlightTarget,
          svgTag: result.svgElementObj?.tagName,
          svgConnected: result.svgElementObj?.isConnected
        });
      }

      // 3. Highlight the actual SVG shapes inside the note group.
      if (result.svgElementObj) {
        const shapes = result.svgElementObj.querySelectorAll<SVGElement>('path, ellipse');

        shapes.forEach((shape) => {
          highlightedShapesRef.current.push({
            element: shape,
            originalStyle: shape.getAttribute('style')
          });

          shape.style.setProperty('fill', '#3b82f6', 'important');
          shape.style.setProperty('stroke', '#3b82f6', 'important');
        });

        result.svgElementObj.setAttribute('data-osmd-highlight', 'true');
        activeHighlightedSvgRef.current = result.svgElementObj;
      }

      // 4. Auto-scroll canvas container to measure text / note position
      if (canvasWrapperRef.current && result.osmdSourceMeasureNumber !== undefined) {
        const textElements = containerRef.current.querySelectorAll('text');
        let measureDomEl: Element | null = null;
        textElements.forEach((el) => {
          if (el.textContent?.trim() === targetMeasureNum.toString()) {
            measureDomEl = el;
          }
        });

        if (measureDomEl) {
          const wrapperRect = canvasWrapperRef.current.getBoundingClientRect();
          const elRect = (measureDomEl as Element).getBoundingClientRect();
          const scrollTopOffset = elRect.top - wrapperRect.top + canvasWrapperRef.current.scrollTop - 80;
          canvasWrapperRef.current.scrollTo({ top: Math.max(0, scrollTopOffset), behavior: 'smooth' });
        }
      }

      setActiveConfidence(result.finalConfidence);

      if (onVisualConfidenceEvaluated) {
        onVisualConfidenceEvaluated(selectedAnchor.anchorId, result.finalConfidence);
      }
      if (onDiagnosticInfoEvaluated) {
        onDiagnosticInfoEvaluated(result);
      }
    } catch (err) {
      console.warn('OSMD internal mapping pipeline evaluation error:', err);
      setActiveConfidence('UNAVAILABLE');
    }
  }, [selectedAnchor, selectedMeasureNumber, selectedMelodyPitch]);

  // Batch Inspection Trigger Effect (#1~#64)
  useEffect(() => {
    if (!batchInspectionTrigger || !anchorsToBatchInspect || anchorsToBatchInspect.length === 0 || !osmdRef.current) return;

    try {
      const results: Record<string, AnchorDiagnosticInfo> = {};
      anchorsToBatchInspect.forEach(anchor => {
        try {
          const derivedPitch = getDerivedMelodyPitch(anchor.chordPitches, anchor.mainPitch, 'HIGHEST_NOTE');
          const res = findOsmdGraphicalNoteTarget(osmdRef.current, anchor, derivedPitch);
          results[anchor.anchorId] = res;
        } catch (anchorErr: any) {
          console.error(`Error inspecting anchor #${anchor.anchorIndex}:`, anchorErr);
          results[anchor.anchorId] = {
            anchorId: anchor.anchorId,
            xmlPartId: anchor.partId,
            xmlStaffNumber: anchor.staffNumber,
            xmlVoiceNumber: anchor.voiceNumber,
            xmlMeasureNumber: anchor.measureNumber,
            xmlBeat: anchor.beat,
            targetPitch: anchor.mainPitch,
            finalConfidence: 'UNAVAILABLE',
            failureReason: `Batch inspection exception: ${anchorErr?.message || anchorErr}`
          };
        }
      });

      if (onBatchInspectionEvaluated) {
        onBatchInspectionEvaluated(results);
      }
    } catch (e) {
      console.error('Batch inspection outer error:', e);
    }
  }, [batchInspectionTrigger]);

  // Handle Zoom change
  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.5, Math.min(3.0, newZoom));
    setZoom(clamped);
    if (osmdRef.current) {
      try {
        osmdRef.current.Zoom = clamped;
        osmdRef.current.render();
      } catch (err) {
        console.error('Zoom render error:', err);
      }
    }
  };

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
          No Score Loaded
        </h3>
        <p style={{ fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
          Please click <strong>"Import MusicXML"</strong> in the left sidebar to load a MusicXML file from your computer.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      
      {/* SCORE TOOLBAR / CONTROLS */}
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '8px',
        padding: '12px 16px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            🎼 Original Score Preview (Read-Only)
          </span>
          {(selectedAnchor || selectedMeasureNumber !== undefined) && (
            <span style={{
              fontSize: '12px',
              backgroundColor: activeConfidence === 'EXACT' ? 'rgba(16, 185, 129, 0.2)' : (activeConfidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
              color: activeConfidence === 'EXACT' ? '#34d399' : (activeConfidence === 'APPROXIMATE' ? '#fbbf24' : '#fca5a5'),
              border: `1px solid ${activeConfidence === 'EXACT' ? 'rgba(16, 185, 129, 0.4)' : (activeConfidence === 'APPROXIMATE' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)')}`,
              borderRadius: '4px',
              padding: '2px 8px',
              fontWeight: 600
            }}>
              {activeConfidence === 'EXACT' && `✓ Visual Target: EXACT (M.${selectedAnchor?.measureNumber ?? selectedMeasureNumber}, Notehead Isolated)`}
              {activeConfidence === 'APPROXIMATE' && `⚠ Visual Target: APPROXIMATE (M.${selectedAnchor?.measureNumber ?? selectedMeasureNumber}, Chord Group)`}
              {activeConfidence === 'UNAVAILABLE' && `✕ Visual Target: UNAVAILABLE`}
            </span>
          )}
          {loading && <span style={{ fontSize: '12px', color: 'var(--accent-primary)' }}>Loading score...</span>}
        </div>

        {/* ZOOM CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>
            Zoom: {Math.round(zoom * 100)}%
          </span>
          <button className="control-btn" onClick={() => handleZoomChange(zoom - 0.2)}>
            🔍 - Zoom Out
          </button>
          <button className="control-btn" onClick={() => handleZoomChange(zoom + 0.2)}>
            🔍 + Zoom In
          </button>
          <button className="control-btn" onClick={() => handleZoomChange(1.0)}>
            ↺ Reset (100%)
          </button>
        </div>
      </div>

      {/* RENDER ERROR BANNER */}
      {renderError && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '8px',
          padding: '14px 18px',
          color: '#fca5a5',
          fontSize: '14px'
        }}>
          <strong>⚠ Score Rendering Error:</strong> {renderError}
        </div>
      )}

      {/* PRINTED SHEET MUSIC CANVAS CONTAINER (WHITE BACKGROUND) */}
      <div ref={canvasWrapperRef} style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        minHeight: '400px',
        maxHeight: '650px',
        overflow: 'auto',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div ref={containerRef} style={{ width: '100%', backgroundColor: '#ffffff' }} />
      </div>

      {/* CSS for Control Buttons */}
      <style>{`
        .control-btn {
          background-color: var(--bg-card);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .control-btn:hover {
          background-color: var(--bg-hover);
        }
      `}</style>
    </div>
  );
};

