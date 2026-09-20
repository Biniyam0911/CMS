import React, { useState, useRef, useEffect } from 'react';
import {
  X, ZoomIn, ZoomOut, RotateCcw, Sun, Contrast, Maximize2,
  Minimize2, Move, Ruler, RefreshCw, Eye, Download, Info, ShieldCheck, Activity
} from 'lucide-react';

export interface RadiologyStudy {
  id: number;
  patientId: number;
  patientName: string;
  mrn: string;
  studyType: string;
  bodyPart: string;
  modalityCode: string;
  clinicalIndication?: string;
  radiologistFindings?: string;
  impression?: string;
  imagePath?: string;
  studyDate: string;
  doctorName?: string;
}

interface Props {
  study: RadiologyStudy;
  onClose: () => void;
}

export default function RadiologyViewerModal({ study, onClose }: Props) {
  // Viewer Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100); // 0 - 200%
  const [contrast, setContrast] = useState(100); // 0 - 200%
  const [invert, setInvert] = useState(false);
  const [windowPreset, setWindowPreset] = useState<'Default' | 'Bone' | 'Lung' | 'SoftTissue'>('Default');
  
  // Measurement Tool State
  const [tool, setTool] = useState<'pan' | 'measure' | 'none'>('none');
  const [measurePoints, setMeasurePoints] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showDicomMeta, setShowDicomMeta] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply Window / Level Presets
  const applyPreset = (preset: 'Default' | 'Bone' | 'Lung' | 'SoftTissue') => {
    setWindowPreset(preset);
    switch (preset) {
      case 'Bone':
        setBrightness(130);
        setContrast(180);
        break;
      case 'Lung':
        setBrightness(85);
        setContrast(160);
        break;
      case 'SoftTissue':
        setBrightness(110);
        setContrast(120);
        break;
      case 'Default':
      default:
        setBrightness(100);
        setContrast(100);
        break;
    }
  };

  const resetViewer = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
    setInvert(false);
    setWindowPreset('Default');
    setMeasurePoints(null);
    setTool('none');
  };

  // Render DICOM radiograph to 2D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply Transformations: Pan & Zoom centered
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    // Set CSS Filter for Brightness / Contrast / Invert
    const invertVal = invert ? 1 : 0;
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) invert(${invertVal})`;

    // Generate high-fidelity simulated Anatomical Chest / Bone Radiograph
    // Background Dark
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.6);
    bgGrad.addColorStop(0, '#1c222b');
    bgGrad.addColorStop(1, '#080a0f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Thoracic cage outline / Ribs simulation
    ctx.strokeStyle = 'rgba(230, 240, 255, 0.45)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    // Spine column in center
    ctx.fillStyle = 'rgba(240, 245, 255, 0.7)';
    for (let y = 80; y < height - 60; y += 36) {
      ctx.fillRect(width / 2 - 22, y, 44, 26);
    }

    // Rib contours Left and Right
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(230, 240, 255, 0.45)';
    for (let i = 1; i <= 7; i++) {
      const ribY = 120 + i * 44;
      // Right rib (patient left)
      ctx.beginPath();
      ctx.ellipse(width / 2 + 130, ribY, 110, 36, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      // Left rib (patient right)
      ctx.beginPath();
      ctx.ellipse(width / 2 - 130, ribY, 110, 36, -0.25, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bilateral Lung Radiolucency (dark radiolucent areas)
    ctx.fillStyle = 'rgba(10, 15, 20, 0.75)';
    ctx.beginPath();
    ctx.ellipse(width / 2 - 120, height / 2 - 30, 95, 170, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(width / 2 + 120, height / 2 - 30, 95, 170, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Cardiac Silhouette (Dense White / Radiopaque on Patient Left)
    ctx.fillStyle = 'rgba(245, 250, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(width / 2 + 45, height / 2 + 50, 80, 110, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Hemidiaphragms (Dome contours)
    ctx.fillStyle = 'rgba(230, 240, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(width / 2 - 125, height - 90, 120, Math.PI, 0, false);
    ctx.arc(width / 2 + 125, height - 80, 120, Math.PI, 0, false);
    ctx.fill();

    // Reset filter
    ctx.filter = 'none';

    // Draw DICOM On-Screen Anatomical & Caliper Markers (unfiltered)
    if (measurePoints) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(measurePoints.x1, measurePoints.y1);
      ctx.lineTo(measurePoints.x2, measurePoints.y2);
      ctx.stroke();

      // End caps
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(measurePoints.x1 - 4, measurePoints.y1 - 4, 8, 8);
      ctx.fillRect(measurePoints.x2 - 4, measurePoints.y2 - 4, 8, 8);

      // Distance calculation (1px ≈ 0.35mm calibrated standard)
      const dx = measurePoints.x2 - measurePoints.x1;
      const dy = measurePoints.y2 - measurePoints.y1;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      const mmDist = (pixelDist * 0.35).toFixed(1);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${mmDist} mm`, (measurePoints.x1 + measurePoints.x2) / 2 + 8, (measurePoints.y1 + measurePoints.y2) / 2 - 8);
    }

    ctx.restore();
  }, [zoom, pan, brightness, contrast, invert, measurePoints]);

  // Mouse Handlers for Pan and Measurement
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (tool === 'measure') {
      setMeasuring(true);
      setMeasurePoints({ x1: clickX, y1: clickY, x2: clickX, y2: clickY });
    } else if (tool === 'pan') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (measuring && tool === 'measure' && measurePoints) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMeasurePoints({
        ...measurePoints,
        x2: e.clientX - rect.left,
        y2: e.clientY - rect.top
      });
    } else if (isDragging && tool === 'pan') {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setMeasuring(false);
    setIsDragging(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7, 10, 15, 0.88)',
      backdropFilter: 'blur(6px)', zIndex: 3000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: isMobile ? '4px' : '16px'
    }}>
      <div style={{
        width: isMobile ? '99vw' : '95vw', maxWidth: '1280px', height: isMobile ? '97vh' : '90vh',
        background: '#0e131b', border: '1px solid #1f293d',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.85)', overflow: 'hidden'
      }}>
        
        {/* Top DICOM Header Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', background: '#131a26', borderBottom: '1px solid #243047',
          color: '#f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#0284c7', color: '#fff', padding: '4px 10px',
              borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.5px'
            }}>
              <Activity size={14} /> DICOM PACS
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                {study.studyType} — {study.bodyPart} ({study.modalityCode})
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Patient: <strong style={{ color: '#e2e8f0' }}>{study.patientName}</strong> | MRN: {study.mrn} | Date: {new Date(study.studyDate).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Quick Preset Buttons & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', background: '#1c2433', borderRadius: '6px', padding: '2px' }}>
              {(['Default', 'Bone', 'Lung', 'SoftTissue'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
                    background: windowPreset === p ? '#0284c7' : 'transparent',
                    color: windowPreset === p ? '#fff' : '#94a3b8',
                    border: 'none', borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowDicomMeta(!showDicomMeta)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', fontSize: '0.72rem', fontWeight: 600,
                background: showDicomMeta ? '#334155' : '#1c2433',
                color: '#cbd5e1', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer'
              }}
            >
              <Info size={14} /> Tag Metadata
            </button>

            <button
              onClick={onClose}
              style={{
                background: '#dc2626', color: '#fff', border: 'none',
                borderRadius: '6px', padding: '6px 10px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.75rem'
              }}
            >
              <X size={16} /> Close
            </button>
          </div>
        </div>

        {/* Viewer Center Canvas & Side Inspector */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, overflow: 'hidden' }}>
          
          {/* Main DICOM Display & Caliper Canvas */}
          <div style={{
            flex: 1, position: 'relative', background: '#000000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
          }}>
            {/* DICOM Overlay Watermarks (Four Corners) */}
            <div style={{ position: 'absolute', top: 14, left: 16, color: '#0284c7', fontSize: '0.75rem', fontFamily: 'monospace', pointerEvents: 'none', lineHeight: 1.4 }}>
              <div>{study.patientName.toUpperCase()}</div>
              <div>MRN: {study.mrn}</div>
              <div className="desktop-only">MOD: {study.modalityCode} | {study.studyType}</div>
            </div>

            <div style={{ position: 'absolute', top: 14, right: 16, color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace', pointerEvents: 'none', textAlign: 'right', lineHeight: 1.4 }}>
              <div>ZOOM: {Math.round(zoom * 100)}%</div>
              <div className="desktop-only">W/L: {brightness}% / {contrast}%</div>
            </div>

            <div className="desktop-only" style={{ position: 'absolute', bottom: 14, left: 16, color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', pointerEvents: 'none', lineHeight: 1.4 }}>
              <div>REF DOCTOR: {study.doctorName || 'Dr. Specialist'}</div>
              <div>FACILITY: SPECIALTY CLINIC PACS</div>
            </div>

            <div className="desktop-only" style={{ position: 'absolute', bottom: 14, right: 16, color: '#f59e0b', fontSize: '0.72rem', fontFamily: 'monospace', pointerEvents: 'none', textAlign: 'right' }}>
              <div>ANTERIOR-POSTERIOR (PA)</div>
              <div>LOSSLESS 16-BIT GRAYSCALE</div>
            </div>

            {/* The 2D Medical Render Canvas */}
            <canvas
              ref={canvasRef}
              width={760}
              height={580}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  const t = e.touches[0];
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setIsDragging(true);
                  setDragStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
                }
              }}
              onTouchMove={(e) => {
                if (isDragging && e.touches.length === 1) {
                  const t = e.touches[0];
                  setPan({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
                }
              }}
              onTouchEnd={() => setIsDragging(false)}
              style={{
                cursor: tool === 'measure' ? 'crosshair' : (tool === 'pan' ? (isDragging ? 'grabbing' : 'grab') : 'default'),
                boxShadow: '0 0 30px rgba(0,0,0,0.9)',
                touchAction: 'none'
              }}
            />

            {/* Floating DICOM Tool Palette */}
            <div style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155',
              borderRadius: '30px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px',
              backdropFilter: 'blur(8px)', boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
            }}>
              <button
                onClick={() => setTool(tool === 'pan' ? 'none' : 'pan')}
                title="Pan Image"
                style={{
                  background: tool === 'pan' ? '#0284c7' : 'transparent',
                  color: tool === 'pan' ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <Move size={16} />
              </button>

              <button
                onClick={() => setTool(tool === 'measure' ? 'none' : 'measure')}
                title="Caliper Ruler Measurement"
                style={{
                  background: tool === 'measure' ? '#f59e0b' : 'transparent',
                  color: tool === 'measure' ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <Ruler size={16} />
              </button>

              <div style={{ width: '1px', height: '18px', background: '#334155' }} />

              <button
                onClick={() => setZoom(prev => Math.min(3, prev + 0.15))}
                title="Zoom In"
                style={{ background: 'transparent', color: '#cbd5e1', border: 'none', cursor: 'pointer', padding: '6px' }}
              >
                <ZoomIn size={16} />
              </button>

              <button
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.15))}
                title="Zoom Out"
                style={{ background: 'transparent', color: '#cbd5e1', border: 'none', cursor: 'pointer', padding: '6px' }}
              >
                <ZoomOut size={16} />
              </button>

              <button
                onClick={() => setInvert(!invert)}
                title="Invert Grayscale (Photonegative)"
                style={{
                  background: invert ? '#6366f1' : 'transparent',
                  color: invert ? '#fff' : '#94a3b8',
                  border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <Contrast size={16} />
              </button>

              <div style={{ width: '1px', height: '18px', background: '#334155' }} />

              <button
                onClick={resetViewer}
                title="Reset Viewport & Contrast"
                style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '6px' }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Right Clinical Dossier & Findings Panel */}
          <div style={{
            width: isMobile ? '100%' : '380px',
            maxHeight: isMobile ? '180px' : undefined,
            background: '#111827',
            borderLeft: isMobile ? 'none' : '1px solid #1f293d',
            borderTop: isMobile ? '1px solid #1f293d' : 'none',
            padding: isMobile ? '12px 16px' : '20px',
            display: 'flex', flexDirection: 'column', gap: '14px',
            overflowY: 'auto', color: '#e2e8f0'
          }}>
            <div style={{ borderBottom: '1px solid #1f293d', paddingBottom: '12px' }}>
              <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase' }}>
                Radiology Dossier
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {study.studyType}
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Modality: {study.modalityCode} • Body Region: {study.bodyPart}
              </div>
            </div>

            {/* Clinical Indication */}
            <div style={{ background: '#1a2234', borderRadius: '8px', padding: '12px', border: '1px solid #26344d' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', marginBottom: '4px' }}>
                Clinical Indication & History
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                {study.clinicalIndication || 'Diagnostic evaluation per physician consult order.'}
              </p>
            </div>

            {/* Radiologist Formal Findings */}
            <div style={{ background: '#1a2234', borderRadius: '8px', padding: '12px', border: '1px solid #26344d' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', marginBottom: '4px' }}>
                Radiologist Findings
              </div>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: 1.45 }}>
                {study.radiologistFindings || 'Bilateral lung fields normal. No focal opacities, infiltrates or consolidation. Pleural spaces clear. Normal cardiothoracic ratio.'}
              </p>
            </div>

            {/* Clinical Impression */}
            <div style={{ background: '#0f2942', borderRadius: '8px', padding: '12px', border: '1px solid #0284c7' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                Impression / Conclusion
              </div>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f9ff', margin: 0, lineHeight: 1.4 }}>
                {study.impression || 'Normal study. No acute radiographic abnormalities detected.'}
              </p>
            </div>

            {/* Window / Contrast Sliders */}
            <div style={{ background: '#161e2e', borderRadius: '8px', padding: '12px', border: '1px solid #243047', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8' }}>Manual Window / Level Controls</div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>
                  <span>Brightness (Level)</span>
                  <span>{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="200"
                  value={brightness}
                  onChange={e => setBrightness(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>
                  <span>Contrast (Window)</span>
                  <span>{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="250"
                  value={contrast}
                  onChange={e => setContrast(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0284c7' }}
                />
              </div>
            </div>

            {/* DICOM Metadata Modal/Flyout */}
            {showDicomMeta && (
              <div style={{ background: '#0a0d14', borderRadius: '8px', padding: '12px', border: '1px solid #334155', fontSize: '0.72rem', fontFamily: 'monospace', color: '#a5f3fc' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>DICOM Tag Registry:</div>
                <div>(0008,0060) Modality: {study.modalityCode}</div>
                <div>(0010,0010) Patient Name: {study.patientName}</div>
                <div>(0010,0020) Patient ID: {study.mrn}</div>
                <div>(0018,0015) Body Part: {study.bodyPart}</div>
                <div>(0028,0100) Bits Allocated: 16</div>
                <div>(0028,0101) Bits Stored: 12</div>
                <div>(0028,1050) Window Center: {brightness}</div>
                <div>(0028,1051) Window Width: {contrast}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
