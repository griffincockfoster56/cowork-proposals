import { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export function RectangleDrawer({
  pdfBlobUrl,
  pageIndex,
  pageDimensions,
  rects,
  onAddRect,
  onDeleteRect,
  rectColor = 'rgba(0, 100, 255, 0.3)',
  rectBorder = 'rgba(0, 100, 255, 0.8)',
}) {
  const [pageImage, setPageImage] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const svgRef = useRef(null);

  const { width: pageWidth, height: pageHeight } = pageDimensions;

  // Render the PDF page to an image
  useEffect(() => {
    if (!pdfBlobUrl) return;
    let cancelled = false;

    async function renderPage() {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfBlobUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageIndex + 1);
        const scale = 2; // high-res for sharp display
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          setPageImage(canvas.toDataURL());
        }
      } catch (err) {
        console.error('Failed to render page for drawer:', err);
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdfBlobUrl, pageIndex]);

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = pageWidth / rect.width;
    const scaleY = pageHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [pageWidth, pageHeight]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    setDrawing(true);
    setStartPoint(pt);
    setCurrentRect(null);
  };

  const handleMouseMove = (e) => {
    if (!drawing || !startPoint) return;
    const pt = getSvgPoint(e);
    if (!pt) return;

    const x = Math.min(startPoint.x, pt.x);
    const y = Math.min(startPoint.y, pt.y);
    const width = Math.abs(pt.x - startPoint.x);
    const height = Math.abs(pt.y - startPoint.y);
    setCurrentRect({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (drawing && currentRect && currentRect.width > 3 && currentRect.height > 3) {
      // Convert from SVG coords (top-left origin) to PDF coords (bottom-left origin)
      const pdfRect = {
        x: Math.round(currentRect.x),
        y: Math.round(pageHeight - currentRect.y - currentRect.height),
        width: Math.round(currentRect.width),
        height: Math.round(currentRect.height),
      };
      onAddRect(pdfRect);
    }
    setDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);
  };

  // Convert PDF rect (bottom-left origin) to SVG rect (top-left origin) for display
  const pdfToSvg = (rect) => ({
    x: rect.x,
    y: pageHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  });

  if (!pageImage) {
    return <div className="rectangle-drawer loading">Rendering page...</div>;
  }

  return (
    <div className="rectangle-drawer">
      <div className="drawer-canvas" style={{ position: 'relative' }}>
        <img
          src={pageImage}
          alt={`Page ${pageIndex + 1}`}
          style={{ width: '100%', display: 'block' }}
          draggable={false}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${pageWidth} ${pageHeight}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Existing rects */}
          {rects.map((rect, i) => {
            const svgR = pdfToSvg(rect);
            return (
              <g key={i}>
                <rect
                  x={svgR.x}
                  y={svgR.y}
                  width={svgR.width}
                  height={svgR.height}
                  fill={rectColor}
                  stroke={rectBorder}
                  strokeWidth={2}
                />
                {/* Delete button */}
                <circle
                  cx={svgR.x + svgR.width}
                  cy={svgR.y}
                  r={8}
                  fill="red"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRect(i);
                  }}
                />
                <text
                  x={svgR.x + svgR.width}
                  y={svgR.y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontWeight="bold"
                  style={{ cursor: 'pointer', pointerEvents: 'none' }}
                >
                  x
                </text>
              </g>
            );
          })}

          {/* Current drawing rect */}
          {currentRect && (
            <rect
              x={currentRect.x}
              y={currentRect.y}
              width={currentRect.width}
              height={currentRect.height}
              fill="rgba(0, 100, 255, 0.15)"
              stroke="rgba(0, 100, 255, 0.6)"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
