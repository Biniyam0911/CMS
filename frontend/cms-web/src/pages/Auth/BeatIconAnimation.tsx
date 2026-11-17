import React, { useRef, useEffect } from 'react';

interface BeatIconAnimationProps {
  compact?: boolean;
}

interface MeshPoint {
  x: number;
  y: number;
  z: number;
  seed: number;
  bucket: number;
}

export default function BeatIconAnimation({ compact = false }: BeatIconAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Offscreen canvas for pre-rendering masked base hologram
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 1024;
    offscreenCanvas.height = 1024;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    let isDisposed = false;
    let animId = 0;
    let lastTime = 0;
    let time = 0;
    let width = 0;
    let height = 0;
    let isIntersecting = true;
    let needsRender = true;
    const points: MeshPoint[] = [];

    const img = new Image();
    img.src = '/female-hologram.webp';

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsRender = true;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting;
      needsRender = true;
    });
    intersectionObserver.observe(container);

    img.onload = () => {
      if (isDisposed) return;

      // 1. Create radial-vignetted base in offscreen canvas
      if (offscreenCtx) {
        offscreenCtx.drawImage(img, 0, 0, 1024, 1024);
        offscreenCtx.globalCompositeOperation = 'destination-in';
        const grad = offscreenCtx.createRadialGradient(512, 480, 230, 512, 480, 530);
        grad.addColorStop(0, '#000');
        grad.addColorStop(0.6, '#000c');
        grad.addColorStop(1, '#0000');
        offscreenCtx.fillStyle = grad;
        offscreenCtx.fillRect(0, 0, 1024, 1024);
      }

      // 2. Sample pixel luminance and color into 3D mesh points (384x384 grid)
      const samplingCanvas = document.createElement('canvas');
      samplingCanvas.width = 384;
      samplingCanvas.height = 384;
      const samplingCtx = samplingCanvas.getContext('2d');
      if (!samplingCtx) return;

      samplingCtx.drawImage(img, 0, 0, 384, 384);
      const imgData = samplingCtx.getImageData(0, 0, 384, 384).data;

      for (let y = 4; y < 380; y += 3) {
        for (let x = 4; x < 380; x += 3) {
          const idx = (y * 384 + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];

          // Filter out dark background pixels
          if (g < 64 || Math.max(r, g, b) < 86) continue;

          const lum = (r + g + b) / 765;
          points.push({
            x: x / 384 - 0.5,
            y: y / 384 - 0.5,
            z: lum * 0.08,
            seed: x * 0.013 + y * 0.021,
            // Bucket 3: Golden neural fibers, Bucket 2: Brightest cyan, Bucket 1: Mid cyan, Bucket 0: Darker cyan
            bucket: r > b * 0.85 ? 3 : lum > 0.68 ? 2 : +(lum > 0.43)
          });
        }
      }

      container.dataset.ready = 'true';
      needsRender = true;
    };

    // Main animation loop replicating Dr. Mehmet Ünal's holographic mesh engine
    const render = (now: number) => {
      animId = requestAnimationFrame(render);

      if (now - lastTime < 32) return;
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      if (!isIntersecting || document.hidden || !img.complete || !img.naturalWidth || !width || !height) {
        return;
      }

      time += dt;
      needsRender = true;

      const n = Math.min(width * 1.15, height * 1.15);
      const cx = width * 0.5;
      const cy = height * 0.51;

      // 5.4-second cycle with dynamic pulse burst
      const cycleProgress = (time % 5.4) / 5.4;
      const pulse = Math.max(0, Math.sin((cycleProgress - 0.2) * Math.PI * 2)) ** 3;
      const sway = Math.sin(time * 0.86) * 0.045;
      const scale = 1.02 + Math.sin(time * 1.16) * 0.025;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(cx + Math.sin(time * 0.8) * n * 0.008, cy);
      ctx.scale(scale * (1 - Math.abs(sway) * 0.5), scale);
      ctx.rotate(Math.sin(time * 0.6) * 0.012);

      // Base face hologram (fades slightly during pulse burst)
      ctx.globalAlpha = 1 - pulse * 0.78;
      ctx.drawImage(offscreenCtx ? offscreenCanvas : img, -n / 2, -n / 2, n, n);
      ctx.globalAlpha = 1;

      // Real-time sweeping laser slice
      const scanY = (cycleProgress * 1.6 - 0.3) * n - n * 0.5;
      ctx.globalCompositeOperation = 'screen';
      ctx.save();
      ctx.beginPath();
      ctx.rect(-n * 0.5, scanY - n * 0.045, n, n * 0.09);
      ctx.clip();
      ctx.globalAlpha = 0.25 * (1 - pulse * 0.5);
      ctx.filter = 'sepia(0.6) brightness(1.5)';
      ctx.drawImage(offscreenCtx ? offscreenCanvas : img, -n / 2, -n / 2, n, n);
      ctx.filter = 'none';
      ctx.restore();

      // Render animated 3D mesh points with kinetic wave displacement
      const colors = ['#397e94', '#69c7d7', '#c5f4f5', '#e8c987'];
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = colors[b];
        ctx.globalAlpha = 0.15 + pulse * 0.8;
        ctx.beginPath();
        for (const pt of points) {
          if (pt.bucket !== b) continue;
          const wave = time * 2.2 + pt.seed;
          const displ = pulse * (0.011 + pt.z * 0.6);
          const depthScale = 1 + pt.z * sway * 4;
          const px = (pt.x * depthScale + Math.sin(wave + pt.y * 9) * displ + sway * pt.z) * n;
          const py = (pt.y + Math.cos(wave * 0.8 + pt.x * 11) * displ * 0.64) * n;
          const sz = (n / 640) * (b === 3 ? 1.25 : 0.95) * (1 + pulse * 0.22);
          ctx.rect(px, py, sz, sz);
        }
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    };

    animId = requestAnimationFrame(render);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      img.onload = null;
    };
  }, []);

  if (compact) {
    return (
      <div 
        ref={containerRef}
        className="female-hologram mini-hologram"
        aria-hidden="true"
        title="Dermatology 3D Hologram Mesh"
      >
        <img src="/female-hologram.webp" alt="3D Hologram" fetchPriority="high" />
        <canvas ref={canvasRef} />
      </div>
    );
  }

  return (
    <div className="derma-hologram-arena">
      <div 
        ref={containerRef}
        className="female-hologram"
        aria-hidden="true"
      >
        <img src="/female-hologram.webp" alt="3D Female Facial Hologram Mesh" fetchPriority="high" />
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
