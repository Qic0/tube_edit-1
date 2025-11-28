// Геометрические операции и нормализация

import { Point, BoundingBox, DxfEntity } from "./types";

// Проверка замкнутости контура
export function isContourClosed(entity: DxfEntity, tolerance = 1): boolean {
  try {
    if (entity.type === "CIRCLE" || entity.type === "ELLIPSE") {
      return true;
    }
    
    if (entity.type === "ARC" || entity.type === "LINE") {
      return false;
    }
    
    if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
      if (entity.shape || entity.closed) return true;
      
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
    return false;
  }
}

// Получить ограничивающий прямоугольник для сущности
export function getEntityBoundingBox(entity: DxfEntity): BoundingBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  switch (entity.type) {
    case "LINE":
      if (entity.vertices && entity.vertices.length >= 2) {
        updateBounds(entity.vertices[0].x, entity.vertices[0].y);
        updateBounds(entity.vertices[1].x, entity.vertices[1].y);
      }
      break;

    case "LWPOLYLINE":
    case "POLYLINE":
      entity.vertices?.forEach((v) => {
        updateBounds(v.x, v.y);
      });
      break;

    case "CIRCLE":
      if (entity.center && entity.radius !== undefined) {
        updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
        updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
      }
      break;

    case "ARC":
      if (entity.center && entity.radius !== undefined) {
        updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
        updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
      }
      break;

    case "ELLIPSE":
      if (entity.center && entity.majorAxisEndPoint) {
        const a = Math.sqrt(
          entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
        );
        const b = a * (entity.axisRatio || 1);
        updateBounds(entity.center.x - a, entity.center.y - b);
        updateBounds(entity.center.x + a, entity.center.y + b);
      }
      break;

    case "SPLINE":
      entity.controlPoints?.forEach((p) => {
        updateBounds(p.x, p.y);
      });
      break;

    default:
      return null;
  }

  if (!isFinite(minX)) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Получить центр контура
export function getContourCenter(entity: DxfEntity): Point | null {
  const bbox = getEntityBoundingBox(entity);
  if (!bbox) return null;

  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
}

// Проверка, находится ли точка внутри замкнутого полигона (ray casting)
export function isPointInsidePolygon(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) return false;

  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// Проверка, находится ли точка внутри контура (с поддержкой разных типов)
export function isPointInsideContour(point: Point, entity: DxfEntity): boolean {
  if (entity.type === "CIRCLE") {
    if (!entity.center || entity.radius === undefined) return false;
    const dx = point.x - entity.center.x;
    const dy = point.y - entity.center.y;
    return Math.sqrt(dx * dx + dy * dy) <= entity.radius;
  }

  if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
    if (!entity.vertices) return false;
    return isPointInsidePolygon(point, entity.vertices);
  }

  if (entity.type === "ELLIPSE") {
    if (!entity.center || !entity.majorAxisEndPoint) return false;
    const a = Math.sqrt(
      entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
    );
    const b = a * (entity.axisRatio || 1);
    const dx = point.x - entity.center.x;
    const dy = point.y - entity.center.y;
    return (dx * dx) / (a * a) + (dy * dy) / (b * b) <= 1;
  }

  // Для SPLINE используем bbox как приближение
  const bbox = getEntityBoundingBox(entity);
  if (!bbox) return false;

  return (
    point.x >= bbox.minX &&
    point.x <= bbox.maxX &&
    point.y >= bbox.minY &&
    point.y <= bbox.maxY
  );
}

// Вычислить площадь контура (приближенно через bbox)
export function calculateContourArea(entity: DxfEntity): number {
  if (entity.type === "CIRCLE" && entity.radius !== undefined) {
    return Math.PI * entity.radius * entity.radius;
  }

  if (entity.type === "ELLIPSE" && entity.majorAxisEndPoint) {
    const a = Math.sqrt(
      entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
    );
    const b = a * (entity.axisRatio || 1);
    return Math.PI * a * b;
  }

  // Для полигонов используем формулу площади
  if (
    (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") &&
    entity.vertices &&
    entity.vertices.length >= 3
  ) {
    let area = 0;
    const vertices = entity.vertices;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area / 2);
  }

  // Для остальных используем bbox
  const bbox = getEntityBoundingBox(entity);
  return bbox ? bbox.width * bbox.height : 0;
}

// Повернуть bounding box на заданный угол
export function rotateBoundingBox(bbox: BoundingBox, rotation: number): BoundingBox {
  if (rotation === 0) return bbox;

  if (rotation === 90 || rotation === 270) {
    return {
      minX: 0,
      minY: 0,
      maxX: bbox.height,
      maxY: bbox.width,
      width: bbox.height,
      height: bbox.width,
    };
  }

  if (rotation === 180) {
    return bbox;
  }

  // Для других углов возвращаем исходный (можно расширить)
  return bbox;
}

// Проверить пересечение двух прямоугольников с учетом spacing
export function checkBoundingBoxCollision(
  bbox1: BoundingBox,
  pos1: Point,
  bbox2: BoundingBox,
  pos2: Point,
  spacing: number
): boolean {
  return !(
    pos1.x + bbox1.width + spacing <= pos2.x ||
    pos2.x + bbox2.width + spacing <= pos1.x ||
    pos1.y + bbox1.height + spacing <= pos2.y ||
    pos2.y + bbox2.height + spacing <= pos1.y
  );
}
