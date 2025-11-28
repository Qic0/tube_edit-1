// Базовые типы для работы с DXF и раскроем

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// Геометрическая сущность из DXF
export interface DxfEntity {
  type: string;
  vertices?: Point[];
  center?: Point;
  radius?: number;
  controlPoints?: Point[];
  startAngle?: number;
  endAngle?: number;
  shape?: boolean;
  closed?: boolean;
  majorAxisEndPoint?: Point;
  axisRatio?: number;
  // Храним оригинальный объект для доступа к дополнительным свойствам
  _raw?: any;
}

// Деталь с внешним контуром и внутренними вырезами
export interface Part {
  id: string;
  outerContour: DxfEntity;
  innerContours: DxfEntity[];
  boundingBox: BoundingBox;
  area: number; // площадь внешнего контура в мм²
}

// Размещенная деталь на листе
export interface PlacedPart {
  part: Part;
  x: number; // позиция на листе в мм
  y: number;
  rotation: number; // 0, 90, 180, 270
  boundingBox: BoundingBox; // bbox с учетом поворота
}

// Результат раскроя
export interface NestingResult {
  sheetWidth: number; // мм
  sheetHeight: number; // мм
  placedParts: PlacedPart[];
  efficiency: number; // % использования листа
  sheetArea: number; // м²
  usedArea: number; // м²
  metalCost: number; // ₽
  unplacedParts: Part[]; // детали, которые не поместились
}

// Настройки раскроя
export interface NestingConfig {
  minSpacing: number; // минимальное расстояние между деталями (мм)
  edgeMargin: number; // отступ от края листа (мм)
  maxSheetWidth: number; // максимальная ширина листа (мм)
  maxSheetHeight: number; // максимальная высота листа (мм)
  rotationAngles: number[]; // разрешенные углы поворота
  metalCostPerM2: number; // стоимость металла за м²
}
