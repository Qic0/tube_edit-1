import { useEffect, useRef, useState } from "react";
import { NestingResult, getEntityBoundingBox } from "@/lib/dxfNesting";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface NestingViewerProps {
  nestingResults: NestingResult[];
  selectedVariant: number;
}

export const NestingViewer = ({ nestingResults, selectedVariant }: NestingViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Обновляем размеры canvas при изменении размера контейнера
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        setDimensions({ width: Math.max(width, 400), height: Math.max(height, 300) });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nestingResults.length === 0) return;

    const result = nestingResults[selectedVariant] || nestingResults[0];
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 40;
    const baseScale = Math.min(
      (canvas.width - padding * 2) / result.sheetWidth,
      (canvas.height - padding * 2) / result.sheetHeight
    );

    const scale = baseScale * zoom;

    const offsetX = (canvas.width - result.sheetWidth * scale) / 2 + pan.x;
    const offsetY = (canvas.height - result.sheetHeight * scale) / 2 + pan.y;

    // Рисуем границу листа
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      offsetX,
      offsetY,
      result.sheetWidth * scale,
      result.sheetHeight * scale
    );

    // Рисуем размеры листа
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    
    // Ширина сверху
    const widthInMeters = (result.sheetWidth / 1000).toFixed(2);
    ctx.fillText(
      `${widthInMeters} м`,
      offsetX + (result.sheetWidth * scale) / 2,
      offsetY - 10
    );

    // Высота сбоку
    ctx.save();
    ctx.translate(offsetX - 15, offsetY + (result.sheetHeight * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    const heightInMeters = (result.sheetHeight / 1000).toFixed(2);
    ctx.fillText(`${heightInMeters} м`, 0, 0);
    ctx.restore();

    // Рисуем размещенные детали
    ctx.strokeStyle = "#000000";
    const lineWidth = Math.max(1, 2 / zoom);

    for (const placed of result.placedEntities) {
      ctx.save();

      const x = offsetX + placed.x * scale;
      const y = offsetY + placed.y * scale;

      ctx.translate(x, y);
      if (placed.rotation !== 0) {
        ctx.rotate((placed.rotation * Math.PI) / 180);
      }

      // Рисуем родительский контур (синий)
      drawEntity(ctx, placed.entity.entity, scale, "#0066cc", lineWidth * 2);

      // Рисуем дочерние контуры (зеленый)
      for (const child of placed.entity.children) {
        drawEntity(ctx, child.entity, scale, "#00aa00", lineWidth * 1.5);
      }

      ctx.restore();
    }
  }, [nestingResults, selectedVariant, dimensions, zoom, pan]);

  if (nestingResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Загрузите DXF файл для просмотра раскроя
      </div>
    );
  }

  const result = nestingResults[selectedVariant] || nestingResults[0];

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-full gap-3 min-h-0">
      <div className="flex gap-2 flex-shrink-0">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleZoomIn}
          title="Увеличить (или колесо мыши)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleZoomOut}
          title="Уменьшить"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleReset}
          title="Сбросить вид"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <div className="flex items-center text-xs text-muted-foreground ml-2">
          Масштаб: {(zoom * 100).toFixed(0)}%
        </div>
      </div>
      <div 
        ref={containerRef} 
        className="flex-1 flex items-center justify-center min-h-0 overflow-hidden bg-muted/20 rounded-lg cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="max-w-full max-h-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg flex-shrink-0">
        <div>
          <div className="text-xs text-muted-foreground">Площадь листа</div>
          <div className="text-lg font-bold">{result.sheetArea.toFixed(3)} м²</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Эффективность</div>
          <div className="text-lg font-bold text-primary">{result.efficiency.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Стоимость металла</div>
          <div className="text-2xl font-bold text-primary">{result.metalCost.toFixed(2)} ₽</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Использовано</div>
          <div className="text-lg font-bold">{result.usedArea.toFixed(3)} м²</div>
        </div>
      </div>
    </div>
  );
};

function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: any,
  scale: number,
  color: string,
  lineWidth: number
) {
  const bbox = getEntityBoundingBox(entity);
  if (!bbox) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  switch (entity.type) {
    case "LINE":
      ctx.beginPath();
      ctx.moveTo(
        (entity.vertices[0].x - bbox.minX) * scale,
        (entity.vertices[0].y - bbox.minY) * scale
      );
      ctx.lineTo(
        (entity.vertices[1].x - bbox.minX) * scale,
        (entity.vertices[1].y - bbox.minY) * scale
      );
      ctx.stroke();
      break;

    case "LWPOLYLINE":
    case "POLYLINE":
      if (entity.vertices && entity.vertices.length > 0) {
        ctx.beginPath();
        ctx.moveTo(
          (entity.vertices[0].x - bbox.minX) * scale,
          (entity.vertices[0].y - bbox.minY) * scale
        );
        for (let i = 1; i < entity.vertices.length; i++) {
          ctx.lineTo(
            (entity.vertices[i].x - bbox.minX) * scale,
            (entity.vertices[i].y - bbox.minY) * scale
          );
        }
        if (entity.shape || entity.closed) {
          ctx.closePath();
        }
        ctx.stroke();
      }
      break;

    case "CIRCLE":
      ctx.beginPath();
      ctx.arc(
        (entity.center.x - bbox.minX) * scale,
        (entity.center.y - bbox.minY) * scale,
        entity.radius * scale,
        0,
        2 * Math.PI
      );
      ctx.stroke();
      break;

    case "ARC":
      ctx.beginPath();
      ctx.arc(
        (entity.center.x - bbox.minX) * scale,
        (entity.center.y - bbox.minY) * scale,
        entity.radius * scale,
        (entity.startAngle * Math.PI) / 180,
        (entity.endAngle * Math.PI) / 180
      );
      ctx.stroke();
      break;
  }
}
