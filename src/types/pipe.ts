export type PipeShape = "Круглая" | "Квадратная" | "Прямоугольная";

// Типы срезов краёв - только 2 варианта для начала
export type EdgeCutType = "Прямой срез" | "Угловой срез 45°";

export interface PipeDimensions {
  width?: number;
  height?: number;
  diameter?: number;
  length: number;
}

// Срезы краёв трубы
export interface EdgeCuts {
  left: EdgeCutType;
  right: EdgeCutType;
}

export interface PipeConfig {
  shape: PipeShape;
  size: string;
  dimensions: PipeDimensions;
  edgeCuts: EdgeCuts;
  confirmed: boolean;
}

export interface FinishedPart {
  id: string;
  config: PipeConfig;
  createdAt: Date;
}

export const PIPE_SIZES: Record<PipeShape, string[]> = {
  "Круглая": ["20 мм", "25 мм", "32 мм", "40 мм", "50 мм", "57 мм", "76 мм"],
  "Квадратная": ["20x20", "25x25", "30x30", "40x40", "50x50", "60x60"],
  "Прямоугольная": ["20x30", "20x40", "30x40", "40x60", "50x100", "60x120"],
};

export const EDGE_CUT_OPTIONS: EdgeCutType[] = ["Прямой срез", "Угловой срез 45°"];

export function parsePipeSize(size: string, shape: PipeShape): PipeDimensions {
  const length = 6000;
  
  if (shape === "Круглая") {
    const diameter = parseInt(size.replace(" мм", ""));
    return { diameter, length };
  }
  
  const parts = size.split("x").map(p => parseInt(p));
  if (parts.length === 2) {
    return {
      width: parts[0],
      height: parts[1],
      length,
    };
  }
  
  return {
    width: parts[0],
    height: parts[0],
    length,
  };
}

export function createDefaultConfig(): PipeConfig {
  return {
    shape: "Круглая",
    size: "",
    dimensions: { length: 6000 },
    edgeCuts: {
      left: "Прямой срез",
      right: "Прямой срез",
    },
    confirmed: false,
  };
}

// Цена за 1 метр реза в рублях
export const PRICE_PER_METER = 100;

// Расчёт длины одного реза в мм
export function calculateSingleCutLength(
  shape: PipeShape,
  dimensions: PipeDimensions,
  cutType: EdgeCutType
): number {
  if (shape === "Круглая") {
    const d = dimensions.diameter || 0;
    const r = d / 2;
    
    if (cutType === "Прямой срез") {
      // Периметр круга
      return Math.PI * d;
    } else {
      // 45° срез создаёт эллипс с полуосями r и r*√2
      // Используем приближение Рамануджана для периметра эллипса
      const a = r;
      const b = r * Math.SQRT2;
      const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
      return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    }
  }
  
  // Квадратная или прямоугольная труба
  const w = dimensions.width || 0;
  const h = dimensions.height || w;
  
  if (cutType === "Прямой срез") {
    // Периметр прямоугольника
    return 2 * (w + h);
  } else {
    // 45° срез - диагональный рез через профиль
    // Длина реза увеличивается из-за угла
    // Для каждой стороны длина реза = сторона / cos(45°) = сторона * √2
    return 2 * (w + h) * Math.SQRT2;
  }
}

// Расчёт общей длины резов для детали в мм
export function calculateTotalCutLength(config: PipeConfig): number {
  const leftCutLength = calculateSingleCutLength(
    config.shape,
    config.dimensions,
    config.edgeCuts.left
  );
  
  const rightCutLength = calculateSingleCutLength(
    config.shape,
    config.dimensions,
    config.edgeCuts.right
  );
  
  return leftCutLength + rightCutLength;
}

// Расчёт стоимости резки в рублях
export function calculateCutPrice(config: PipeConfig): number {
  const totalLengthMm = calculateTotalCutLength(config);
  const totalLengthM = totalLengthMm / 1000;
  return Math.round(totalLengthM * PRICE_PER_METER * 100) / 100;
}
