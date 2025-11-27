import { useEffect, useRef, useState } from "react";
import DxfParser from "dxf-parser";

interface DxfViewerProps {
  fileContent: string;
  fileName: string;
}

// Check if contour is closed within 1mm tolerance
const isContourClosed = (entity: any, tolerance = 1): boolean => {
  try {
    if (entity.type === "CIRCLE" || entity.type === "ELLIPSE") {
      return true; // Circles and ellipses are always closed
    }
    
    if (entity.type === "ARC") {
      return false; // Arcs are open by nature
    }
    
    if (entity.type === "LINE") {
      return false; // Single lines are open
    }
    
    if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
      if (entity.shape) return true; // Marked as closed in DXF
      
      if (entity.vertices && entity.vertices.length > 2) {
        const first = entity.vertices[0];
        const last = entity.vertices[entity.vertices.length - 1];
        const distance = Math.sqrt(
          Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
        );
        return distance <= tolerance;
      }
    }
    
    if (entity.type === "SPLINE") {
      if (entity.closed) return true;
      
      if (entity.controlPoints && entity.controlPoints.length > 2) {
        const first = entity.controlPoints[0];
        const last = entity.controlPoints[entity.controlPoints.length - 1];
        const distance = Math.sqrt(
          Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
        );
        return distance <= tolerance;
      }
    }
    
    return false;
  } catch (error) {
    console.warn("Error checking contour closure:", error);
    return false;
  }
}

export const DxfViewer = ({ fileContent, fileName }: DxfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasUnclosedContours, setHasUnclosedContours] = useState(false);

  useEffect(() => {
    if (!fileContent || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const parser = new DxfParser();
      const dxf = parser.parseSync(fileContent);

      if (!dxf) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Find bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      const updateBounds = (x: number, y: number) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      };

      dxf.entities.forEach((entity: any) => {
        try {
          if (entity.type === "LINE") {
            entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
          } 
          else if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
            entity.vertices.forEach((v: any) => updateBounds(v.x, v.y));
          } 
          else if (entity.type === "CIRCLE") {
            updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
            updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
          } 
          else if (entity.type === "ARC") {
            updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
            updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
          }
          else if (entity.type === "ELLIPSE") {
            const a = entity.majorAxisEndPoint ? 
              Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2) : 
              entity.radius || 0;
            const b = a * (entity.axisRatio || 1);
            updateBounds(entity.center.x - a, entity.center.y - b);
            updateBounds(entity.center.x + a, entity.center.y + b);
          }
          else if (entity.type === "SPLINE") {
            if (entity.controlPoints) {
              entity.controlPoints.forEach((p: any) => updateBounds(p.x, p.y));
            }
          }
          else if (entity.type === "TEXT" || entity.type === "MTEXT") {
            if (entity.startPoint) {
              updateBounds(entity.startPoint.x, entity.startPoint.y);
            }
          }
        } catch (error) {
          console.warn(`Error processing bounds for entity type ${entity.type}:`, error);
        }
      });

      const width = maxX - minX;
      const height = maxY - minY;
      const scale = Math.min(
        (canvas.width - 40) / width,
        (canvas.height - 40) / height
      );
      const offsetX = (canvas.width - width * scale) / 2 - minX * scale;
      const offsetY = (canvas.height - height * scale) / 2 - minY * scale;

      // Check for unclosed contours
      let hasUnclosed = false;

      // Draw entities
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      dxf.entities.forEach((entity: any) => {
        const isClosed = isContourClosed(entity);
        if (!isClosed) {
          hasUnclosed = true;
        }
        
        // Set color based on closure
        ctx.strokeStyle = isClosed ? "#000000" : "#ff0000";
        try {
          if (entity.type === "LINE") {
            ctx.beginPath();
            ctx.moveTo(
              entity.vertices[0].x * scale + offsetX,
              canvas.height - (entity.vertices[0].y * scale + offsetY)
            );
            ctx.lineTo(
              entity.vertices[1].x * scale + offsetX,
              canvas.height - (entity.vertices[1].y * scale + offsetY)
            );
            ctx.stroke();
          } 
          else if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
            ctx.beginPath();
            entity.vertices.forEach((v: any, i: number) => {
              const x = v.x * scale + offsetX;
              const y = canvas.height - (v.y * scale + offsetY);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            });
            // Close path if needed
            if (entity.shape) {
              ctx.closePath();
            }
            ctx.stroke();
          } 
          else if (entity.type === "CIRCLE") {
            ctx.beginPath();
            ctx.arc(
              entity.center.x * scale + offsetX,
              canvas.height - (entity.center.y * scale + offsetY),
              entity.radius * scale,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          } 
          else if (entity.type === "ARC") {
            ctx.beginPath();
            const startAngle = -entity.endAngle;
            const endAngle = -entity.startAngle;
            ctx.arc(
              entity.center.x * scale + offsetX,
              canvas.height - (entity.center.y * scale + offsetY),
              entity.radius * scale,
              startAngle,
              endAngle,
              true
            );
            ctx.stroke();
          }
          else if (entity.type === "ELLIPSE") {
            ctx.beginPath();
            const cx = entity.center.x * scale + offsetX;
            const cy = canvas.height - (entity.center.y * scale + offsetY);
            
            const a = entity.majorAxisEndPoint ? 
              Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2) * scale : 
              (entity.radius || 0) * scale;
            const b = a * (entity.axisRatio || 1);
            
            const rotation = entity.majorAxisEndPoint ? 
              Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x) : 0;
            
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-rotation);
            ctx.ellipse(0, 0, a, b, 0, 0, 2 * Math.PI);
            ctx.restore();
            ctx.stroke();
          }
          else if (entity.type === "SPLINE") {
            if (entity.controlPoints && entity.controlPoints.length > 1) {
              ctx.beginPath();
              const first = entity.controlPoints[0];
              ctx.moveTo(
                first.x * scale + offsetX,
                canvas.height - (first.y * scale + offsetY)
              );
              
              for (let i = 1; i < entity.controlPoints.length; i++) {
                const p = entity.controlPoints[i];
                ctx.lineTo(
                  p.x * scale + offsetX,
                  canvas.height - (p.y * scale + offsetY)
                );
              }
              ctx.stroke();
            }
          }
        } catch (error) {
          console.warn(`Error drawing entity type ${entity.type}:`, error);
        }
      });

      setHasUnclosedContours(hasUnclosed);
    } catch (error) {
      console.error("Error rendering DXF:", error);
    }
  }, [fileContent]);

  return (
    <div className="w-full max-w-2xl bg-background rounded-lg border border-border p-4">
      <div className="text-sm text-muted-foreground mb-2">{fileName}</div>
      {hasUnclosedContours && (
        <div className="mb-3 p-3 bg-destructive/10 border border-destructive rounded-md">
          <p className="text-sm font-semibold text-destructive">
            ⚠ Вектор не замкнут, вырезан не будет!
          </p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-auto max-h-96 border border-border rounded"
      />
    </div>
  );
};
