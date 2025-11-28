// Парсинг DXF и группировка контуров в детали

import DxfParser from "dxf-parser";
import { DxfEntity, Part } from "./types";
import {
  isContourClosed,
  getEntityBoundingBox,
  getContourCenter,
  isPointInsideContour,
  calculateContourArea,
} from "./geometry";

// Конвертировать raw DXF entity в типизированный DxfEntity
function convertRawEntity(raw: any): DxfEntity {
  const entity: DxfEntity = {
    type: raw.type,
    _raw: raw,
  };

  if (raw.vertices) {
    entity.vertices = raw.vertices.map((v: any) => ({ x: v.x, y: v.y }));
  }

  if (raw.center) {
    entity.center = { x: raw.center.x, y: raw.center.y };
  }

  if (raw.radius !== undefined) {
    entity.radius = raw.radius;
  }

  if (raw.controlPoints) {
    entity.controlPoints = raw.controlPoints.map((p: any) => ({ x: p.x, y: p.y }));
  }

  if (raw.startAngle !== undefined) {
    entity.startAngle = raw.startAngle;
  }

  if (raw.endAngle !== undefined) {
    entity.endAngle = raw.endAngle;
  }

  if (raw.shape !== undefined) {
    entity.shape = raw.shape;
  }

  if (raw.closed !== undefined) {
    entity.closed = raw.closed;
  }

  if (raw.majorAxisEndPoint) {
    entity.majorAxisEndPoint = {
      x: raw.majorAxisEndPoint.x,
      y: raw.majorAxisEndPoint.y,
    };
  }

  if (raw.axisRatio !== undefined) {
    entity.axisRatio = raw.axisRatio;
  }

  return entity;
}

// Парсинг DXF и извлечение замкнутых контуров
export function parseDxfFile(dxfContent: string): DxfEntity[] {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfContent);

  if (!dxf || !dxf.entities) {
    console.warn("DXF parsing failed or no entities found");
    return [];
  }

  const closedContours: DxfEntity[] = [];

  for (const rawEntity of dxf.entities) {
    const entity = convertRawEntity(rawEntity);

    // Фильтруем только замкнутые контуры
    if (!isContourClosed(entity)) {
      console.log(`Skipping unclosed entity: ${entity.type}`);
      continue;
    }

    const bbox = getEntityBoundingBox(entity);
    if (!bbox) {
      console.log(`Skipping entity without bounding box: ${entity.type}`);
      continue;
    }

    closedContours.push(entity);
  }

  console.log(`Total closed contours found: ${closedContours.length}`);
  return closedContours;
}

// Группировка контуров в детали (внешний + внутренние)
export function groupContoursIntoParts(contours: DxfEntity[]): Part[] {
  if (contours.length === 0) return [];

  // Сортируем контуры по площади (большие сначала)
  const sortedContours = contours
    .map((entity, index) => {
      const bbox = getEntityBoundingBox(entity);
      const area = calculateContourArea(entity);
      return { entity, bbox, area, index };
    })
    .filter((item) => item.bbox !== null)
    .sort((a, b) => b.area - a.area);

  const parts: Part[] = [];
  const usedIndices = new Set<number>();

  for (const currentItem of sortedContours) {
    // Пропускаем, если уже использован как внутренний контур
    if (usedIndices.has(currentItem.index)) continue;

    const outerContour = currentItem.entity;
    const innerContours: DxfEntity[] = [];
    const outerCenter = getContourCenter(outerContour);

    if (!outerCenter || !currentItem.bbox) continue;

    // Ищем внутренние контуры
    for (const otherItem of sortedContours) {
      if (
        currentItem.index === otherItem.index ||
        usedIndices.has(otherItem.index)
      ) {
        continue;
      }

      const otherCenter = getContourCenter(otherItem.entity);
      if (!otherCenter) continue;

      // Проверяем, находится ли центр другого контура внутри текущего
      if (isPointInsideContour(otherCenter, outerContour)) {
        innerContours.push(otherItem.entity);
        usedIndices.add(otherItem.index);
      }
    }

    // Создаем деталь
    const part: Part = {
      id: `part-${parts.length}`,
      outerContour,
      innerContours,
      boundingBox: currentItem.bbox,
      area: currentItem.area,
    };

    parts.push(part);
    usedIndices.add(currentItem.index);
  }

  console.log(`Grouped into ${parts.length} parts`);
  parts.forEach((part, i) => {
    console.log(
      `Part ${i}: outer=${part.outerContour.type}, inner=${part.innerContours.length}`
    );
  });

  return parts;
}

// Основная функция для загрузки и парсинга DXF
export function loadDxfParts(dxfContent: string): Part[] {
  const contours = parseDxfFile(dxfContent);
  return groupContoursIntoParts(contours);
}
