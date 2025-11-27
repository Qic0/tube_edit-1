import { useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import DxfParser from "dxf-parser";

interface DxfUploaderProps {
  onFileLoaded: (fileName: string, content: string, vectorLength: number) => void;
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
};

export const DxfUploader = ({ onFileLoaded }: DxfUploaderProps) => {
  const validateAndParseDxf = useCallback(
    (content: string, fileName: string) => {
      try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(content);

        if (!dxf) {
          throw new Error("Не удалось распарсить DXF файл");
        }

        // Check for 3D entities
        const has3DEntities = dxf.entities.some((entity: any) => {
          if (entity.type === "3DFACE" || entity.type === "SOLID") {
            return true;
          }
          if (entity.type === "POLYLINE" && entity.shape) {
            return true;
          }
          if (entity.type === "LINE" && entity.vertices) {
            return entity.vertices.some((v: any) => Math.abs(v.z || 0) > 0.001);
          }
          return false;
        });

        if (has3DEntities) {
          toast({
            title: "Ошибка загрузки",
            description: "3D файлы не поддерживаются. Загрузите векторный 2D DXF файл.",
            variant: "destructive",
          });
          return;
        }

        // Calculate total vector length (only closed contours)
        let totalLength = 0;

        dxf.entities.forEach((entity: any) => {
          try {
            // Skip unclosed contours
            if (!isContourClosed(entity)) {
              return;
            }
            if (entity.type === "LINE") {
              const start = entity.vertices[0];
              const end = entity.vertices[1];
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              totalLength += Math.sqrt(dx * dx + dy * dy);
            } 
            else if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
              const vertices = entity.vertices;
              for (let i = 0; i < vertices.length - 1; i++) {
                const dx = vertices[i + 1].x - vertices[i].x;
                const dy = vertices[i + 1].y - vertices[i].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
              }
              // If closed, add last segment
              if (entity.shape && vertices.length > 0) {
                const dx = vertices[0].x - vertices[vertices.length - 1].x;
                const dy = vertices[0].y - vertices[vertices.length - 1].y;
                totalLength += Math.sqrt(dx * dx + dy * dy);
              }
            } 
            else if (entity.type === "CIRCLE") {
              totalLength += 2 * Math.PI * entity.radius;
            } 
            else if (entity.type === "ARC") {
              let angleRange = entity.angleLength || (entity.endAngle - entity.startAngle);
              // Normalize angle range
              if (angleRange < 0) angleRange += 2 * Math.PI;
              totalLength += Math.abs(angleRange * entity.radius);
            }
            else if (entity.type === "ELLIPSE") {
              // Approximate ellipse perimeter using Ramanujan's formula
              const a = entity.majorAxisEndPoint ? 
                Math.sqrt(entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2) : 
                entity.radius || 0;
              const b = a * (entity.axisRatio || 1);
              const h = ((a - b) ** 2) / ((a + b) ** 2);
              const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
              
              // If it's a partial ellipse
              if (entity.startAngle !== undefined && entity.endAngle !== undefined) {
                let angleRange = entity.endAngle - entity.startAngle;
                if (angleRange < 0) angleRange += 2 * Math.PI;
                totalLength += perimeter * (angleRange / (2 * Math.PI));
              } else {
                totalLength += perimeter;
              }
            }
            else if (entity.type === "SPLINE") {
              // Approximate spline length by control points
              if (entity.controlPoints && entity.controlPoints.length > 1) {
                for (let i = 0; i < entity.controlPoints.length - 1; i++) {
                  const p1 = entity.controlPoints[i];
                  const p2 = entity.controlPoints[i + 1];
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  totalLength += Math.sqrt(dx * dx + dy * dy);
                }
              }
            }
          } catch (error) {
            console.warn(`Error processing entity type ${entity.type}:`, error);
          }
        });

        // Convert to meters
        const lengthInMeters = totalLength / 1000;

        onFileLoaded(fileName, content, lengthInMeters);
        toast({
          title: "Файл загружен",
          description: `Длина реза: ${lengthInMeters.toFixed(2)} м`,
        });
      } catch (error) {
        console.error("DXF parsing error:", error);
        toast({
          title: "Ошибка загрузки",
          description: "Не удалось прочитать DXF файл. Проверьте формат файла.",
          variant: "destructive",
        });
      }
    },
    [onFileLoaded]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".dxf")) {
        toast({
          title: "Неверный формат",
          description: "Можно загружать только DXF файлы",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        validateAndParseDxf(content, file.name);
      };
      reader.readAsText(file);
    },
    [validateAndParseDxf]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".dxf")) {
        toast({
          title: "Неверный формат",
          description: "Можно загружать только DXF файлы",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        validateAndParseDxf(content, file.name);
      };
      reader.readAsText(file);
    },
    [validateAndParseDxf]
  );

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors"
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-4">
          Перетащите DXF файл сюда или нажмите кнопку ниже
        </p>
        <input
          type="file"
          accept=".dxf"
          onChange={handleFileSelect}
          className="hidden"
          id="dxf-upload"
        />
        <label htmlFor="dxf-upload">
          <Button asChild variant="outline">
            <span>Выбрать файл</span>
          </Button>
        </label>
      </div>
    </div>
  );
};
