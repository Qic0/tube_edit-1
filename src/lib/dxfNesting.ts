import DxfParser from "dxf-parser";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface DxfEntity {
  entity: any;
  boundingBox: BoundingBox;
  children: DxfEntity[];
}

export interface PlacedEntity {
  entity: DxfEntity;
  x: number;
  y: number;
  rotation: number; // в градусах: 0, 90, 180, 270
}

export interface NestingResult {
  sheetWidth: number;
  sheetHeight: number;
  placedEntities: PlacedEntity[];
  efficiency: number; // процент использования листа
  sheetArea: number; // площадь листа в м²
  usedArea: number; // использованная площадь в м²
  metalCost: number; // стоимость металла
}

const MIN_SPACING = 10; // мм минимальное расстояние между деталями
const METAL_COST_PER_M2 = 100; // руб за м²

// Проверка замкнутости контура (из DxfViewer)
function isContourClosed(entity: any, tolerance = 1): boolean {
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

// Максимальные размеры листов в мм
function getMaxSheetSize(thickness: number): { width: number; height: number } {
  if (thickness > 3.1) {
    return { width: 1500, height: 3000 };
  }
  return { width: 1250, height: 2500 };
}

// Получить ограничивающий прямоугольник для сущности
export function getEntityBoundingBox(entity: any): BoundingBox | null {
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
      updateBounds(entity.vertices[0].x, entity.vertices[0].y);
      updateBounds(entity.vertices[1].x, entity.vertices[1].y);
      break;

    case "LWPOLYLINE":
    case "POLYLINE":
      entity.vertices?.forEach((v: any) => {
        updateBounds(v.x, v.y);
      });
      break;

    case "CIRCLE":
      updateBounds(entity.center.x - entity.radius, entity.center.y - entity.radius);
      updateBounds(entity.center.x + entity.radius, entity.center.y + entity.radius);
      break;

    case "ARC":
      const arcRadius = entity.radius;
      updateBounds(entity.center.x - arcRadius, entity.center.y - arcRadius);
      updateBounds(entity.center.x + arcRadius, entity.center.y + arcRadius);
      break;

    case "SPLINE":
      entity.controlPoints?.forEach((p: any) => {
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

// Проверить, находится ли точка внутри замкнутого контура
function isPointInside(point: { x: number; y: number }, entity: any): boolean {
  if (entity.type !== "LWPOLYLINE" && entity.type !== "POLYLINE") {
    return false;
  }

  const vertices = entity.vertices || [];
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

// Группировать сущности (родительские и дочерние)
export function groupDxfEntities(dxfContent: string): DxfEntity[] {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfContent);

  if (!dxf || !dxf.entities) return [];

  // Создаем список всех замкнутых сущностей с их bounding box
  const entityList: Array<{ entity: any; boundingBox: BoundingBox }> = [];
  
  for (const entity of dxf.entities) {
    // ВАЖНО: Фильтруем только замкнутые контуры
    if (!isContourClosed(entity)) {
      console.log(`Skipping unclosed entity: ${entity.type}`);
      continue;
    }
    
    const boundingBox = getEntityBoundingBox(entity);
    if (boundingBox) {
      entityList.push({ entity, boundingBox });
    }
  }

  console.log(`Total closed entities: ${entityList.length}`);

  // Определяем родительские контуры и их дочерние элементы
  const parentEntities: DxfEntity[] = [];
  const childEntities = new Set<number>();

  // Сортируем по площади (большие сначала) для правильного определения родителей
  const sortedByArea = entityList
    .map((e, idx) => ({ ...e, originalIndex: idx }))
    .sort((a, b) => {
      const areaA = a.boundingBox.width * a.boundingBox.height;
      const areaB = b.boundingBox.width * b.boundingBox.height;
      return areaB - areaA;
    });

  for (const current of sortedByArea) {
    // Пропускаем, если уже является чьим-то ребенком
    if (childEntities.has(current.originalIndex)) continue;

    // Проверяем, какие другие сущности находятся внутри этого контура
    const children: DxfEntity[] = [];

    for (const other of sortedByArea) {
      if (current.originalIndex === other.originalIndex || 
          childEntities.has(other.originalIndex)) continue;

      const centerPoint = {
        x: (other.boundingBox.minX + other.boundingBox.maxX) / 2,
        y: (other.boundingBox.minY + other.boundingBox.maxY) / 2,
      };

      if (isPointInside(centerPoint, current.entity)) {
        children.push({
          entity: other.entity,
          boundingBox: other.boundingBox,
          children: [],
        });
        childEntities.add(other.originalIndex);
      }
    }

    parentEntities.push({
      entity: current.entity,
      boundingBox: current.boundingBox,
      children,
    });
  }

  console.log(`Parent entities: ${parentEntities.length}, Children: ${childEntities.size}`);
  parentEntities.forEach((p, i) => {
    console.log(`Entity ${i}: type=${p.entity.type}, children=${p.children.length}`);
  });

  return parentEntities;
}

// Получить общий bounding box для группы (родитель + дети)
function getGroupBoundingBox(dxfEntity: DxfEntity): BoundingBox {
  let minX = dxfEntity.boundingBox.minX;
  let minY = dxfEntity.boundingBox.minY;
  let maxX = dxfEntity.boundingBox.maxX;
  let maxY = dxfEntity.boundingBox.maxY;

  for (const child of dxfEntity.children) {
    minX = Math.min(minX, child.boundingBox.minX);
    minY = Math.min(minY, child.boundingBox.minY);
    maxX = Math.max(maxX, child.boundingBox.maxX);
    maxY = Math.max(maxY, child.boundingBox.maxY);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Проверить пересечение двух прямоугольников с учетом отступа
function checkCollision(
  placed: PlacedEntity,
  newEntity: PlacedEntity,
  spacing: number
): boolean {
  const bbox1 = getGroupBoundingBox(placed.entity);
  const bbox2 = getGroupBoundingBox(newEntity.entity);

  // Применяем вращение и позицию
  const rect1 = getRotatedBoundingBox(bbox1, placed.rotation);
  const rect2 = getRotatedBoundingBox(bbox2, newEntity.rotation);

  return !(
    placed.x + rect1.width + spacing < newEntity.x ||
    newEntity.x + rect2.width + spacing < placed.x ||
    placed.y + rect1.height + spacing < newEntity.y ||
    newEntity.y + rect2.height + spacing < placed.y
  );
}

// Получить bounding box с учетом вращения
function getRotatedBoundingBox(bbox: BoundingBox, rotation: number): BoundingBox {
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
  return bbox;
}

// Алгоритм упаковки с несколькими вариантами
export function calculateNesting(
  dxfContent: string,
  thickness: number
): NestingResult[] {
  const entities = groupDxfEntities(dxfContent);
  if (entities.length === 0) {
    return [];
  }

  const maxSheet = getMaxSheetSize(thickness);
  const rotations = [0, 90]; // пробуем 0° и 90°

  const results: NestingResult[] = [];

  // Генерируем несколько вариантов с разными стратегиями
  const strategies = [
    { name: "width-first", sortBy: (a: DxfEntity, b: DxfEntity) => 
      getGroupBoundingBox(b).width - getGroupBoundingBox(a).width },
    { name: "height-first", sortBy: (a: DxfEntity, b: DxfEntity) => 
      getGroupBoundingBox(b).height - getGroupBoundingBox(a).height },
    { name: "area-first", sortBy: (a: DxfEntity, b: DxfEntity) => {
      const aBox = getGroupBoundingBox(a);
      const bBox = getGroupBoundingBox(b);
      return (bBox.width * bBox.height) - (aBox.width * aBox.height);
    }},
  ];

  for (const strategy of strategies) {
    const sortedEntities = [...entities].sort(strategy.sortBy);
    const result = packEntities(sortedEntities, maxSheet, rotations);
    results.push(result);
  }

  // Сортируем результаты по эффективности
  results.sort((a, b) => b.efficiency - a.efficiency);

  return results.slice(0, 3); // Возвращаем топ-3 варианта
}

// Найти лучшую позицию для размещения детали
function findBestPosition(
  entity: DxfEntity,
  placedEntities: PlacedEntity[],
  maxSheet: { width: number; height: number },
  rotations: number[]
): PlacedEntity | null {
  let bestPlacement: PlacedEntity | null = null;
  let bestScore = Infinity;

  for (const rotation of rotations) {
    const bbox = getRotatedBoundingBox(getGroupBoundingBox(entity), rotation);

    // Пробуем разные позиции
    const positions: Array<{ x: number; y: number }> = [
      { x: MIN_SPACING, y: MIN_SPACING }, // Начало листа
    ];

    // Добавляем позиции рядом с уже размещенными деталями
    for (const placed of placedEntities) {
      const placedBbox = getRotatedBoundingBox(
        getGroupBoundingBox(placed.entity),
        placed.rotation
      );

      // Справа от детали
      positions.push({
        x: placed.x + placedBbox.width + MIN_SPACING,
        y: placed.y,
      });

      // Снизу от детали
      positions.push({
        x: placed.x,
        y: placed.y + placedBbox.height + MIN_SPACING,
      });
    }

    for (const pos of positions) {
      // Проверяем, влезает ли в лист
      if (
        pos.x + bbox.width + MIN_SPACING > maxSheet.width ||
        pos.y + bbox.height + MIN_SPACING > maxSheet.height
      ) {
        continue;
      }

      const candidate: PlacedEntity = {
        entity,
        x: pos.x,
        y: pos.y,
        rotation,
      };

      // Проверяем коллизии
      const hasCollision = placedEntities.some((p) =>
        checkCollision(p, candidate, MIN_SPACING)
      );

      if (!hasCollision) {
        // Оценка позиции: предпочитаем позиции ближе к началу и с меньшей высотой
        const score = pos.y * 10 + pos.x;

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = candidate;
        }
      }
    }
  }

  return bestPlacement;
}

// Основной алгоритм упаковки
function packEntities(
  entities: DxfEntity[],
  maxSheet: { width: number; height: number },
  rotations: number[]
): NestingResult {
  const placedEntities: PlacedEntity[] = [];

  for (const entity of entities) {
    const placement = findBestPosition(entity, placedEntities, maxSheet, rotations);
    
    if (placement) {
      placedEntities.push(placement);
    } else {
      console.warn("Could not place entity:", entity.entity.type);
    }
  }

  // Вычисляем фактические размеры листа
  let maxUsedX = 0;
  let maxUsedY = 0;

  for (const placed of placedEntities) {
    const bbox = getRotatedBoundingBox(
      getGroupBoundingBox(placed.entity),
      placed.rotation
    );
    maxUsedX = Math.max(maxUsedX, placed.x + bbox.width);
    maxUsedY = Math.max(maxUsedY, placed.y + bbox.height);
  }

  const sheetWidth = Math.min(maxUsedX + MIN_SPACING, maxSheet.width);
  const sheetHeight = Math.min(maxUsedY + MIN_SPACING, maxSheet.height);

  // Площадь в м²
  const sheetArea = (sheetWidth * sheetHeight) / 1000000;
  
  // Используемая площадь (площадь всех деталей)
  let usedArea = 0;
  for (const placed of placedEntities) {
    const bbox = getGroupBoundingBox(placed.entity);
    usedArea += (bbox.width * bbox.height) / 1000000;
  }

  const efficiency = (usedArea / sheetArea) * 100;
  const metalCost = sheetArea * METAL_COST_PER_M2;

  return {
    sheetWidth,
    sheetHeight,
    placedEntities,
    efficiency,
    sheetArea,
    usedArea,
    metalCost,
  };
}
