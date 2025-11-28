// Алгоритм раскроя деталей на листе

import { Part, PlacedPart, NestingResult, NestingConfig } from "./types";
import { rotateBoundingBox, checkBoundingBoxCollision } from "./geometry";

// Конфигурация по умолчанию
export function getDefaultNestingConfig(thickness: number): NestingConfig {
  // Максимальные размеры листов в зависимости от толщины
  const maxSheet =
    thickness > 3.1
      ? { width: 1500, height: 3000 }
      : { width: 1250, height: 2500 };

  return {
    minSpacing: 10, // 10 мм между деталями
    edgeMargin: 10, // 10 мм от края листа
    maxSheetWidth: maxSheet.width,
    maxSheetHeight: maxSheet.height,
    rotationAngles: [0, 45, 90, 135, 180, 225, 270, 315], // пробуем все углы с шагом 45°
    metalCostPerM2: 100, // руб за м²
  };
}

// Стратегии сортировки деталей
type SortStrategy = (a: Part, b: Part) => number;

const strategies: { name: string; sort: SortStrategy }[] = [
  {
    name: "area-desc",
    sort: (a, b) => b.area - a.area,
  },
  {
    name: "width-desc",
    sort: (a, b) => b.boundingBox.width - a.boundingBox.width,
  },
  {
    name: "height-desc",
    sort: (a, b) => b.boundingBox.height - a.boundingBox.height,
  },
  {
    name: "perimeter-desc",
    sort: (a, b) => {
      const perimA = 2 * (a.boundingBox.width + a.boundingBox.height);
      const perimB = 2 * (b.boundingBox.width + b.boundingBox.height);
      return perimB - perimA;
    },
  },
];

// Найти лучшую позицию для размещения детали
function findBestPosition(
  part: Part,
  placedParts: PlacedPart[],
  config: NestingConfig
): PlacedPart | null {
  let bestPlacement: PlacedPart | null = null;
  let bestScore = Infinity;

  for (const rotation of config.rotationAngles) {
    const rotatedBbox = rotateBoundingBox(part.boundingBox, rotation);

    // Проверяем, влезает ли деталь в лист вообще
    if (
      rotatedBbox.width + 2 * config.edgeMargin > config.maxSheetWidth ||
      rotatedBbox.height + 2 * config.edgeMargin > config.maxSheetHeight
    ) {
      continue;
    }

    // Кандидаты позиций для размещения
    const candidatePositions: Array<{ x: number; y: number }> = [
      // Начало листа (с отступом от края)
      { x: config.edgeMargin, y: config.edgeMargin },
    ];

    // Позиции рядом с уже размещенными деталями
    for (const placed of placedParts) {
      // Справа от детали
      candidatePositions.push({
        x: placed.x + placed.boundingBox.width + config.minSpacing,
        y: placed.y,
      });

      // Снизу от детали
      candidatePositions.push({
        x: placed.x,
        y: placed.y + placed.boundingBox.height + config.minSpacing,
      });

      // Справа-снизу (диагональ)
      candidatePositions.push({
        x: placed.x + placed.boundingBox.width + config.minSpacing,
        y: placed.y + placed.boundingBox.height + config.minSpacing,
      });

      // Слева-сверху от детали (для заполнения пробелов)
      candidatePositions.push({
        x: Math.max(config.edgeMargin, placed.x - rotatedBbox.width - config.minSpacing),
        y: placed.y,
      });

      candidatePositions.push({
        x: placed.x,
        y: Math.max(config.edgeMargin, placed.y - rotatedBbox.height - config.minSpacing),
      });
    }

    // Проверяем все кандидаты
    for (const pos of candidatePositions) {
      // Проверка выхода за границы листа
      if (
        pos.x + rotatedBbox.width + config.edgeMargin > config.maxSheetWidth ||
        pos.y + rotatedBbox.height + config.edgeMargin > config.maxSheetHeight ||
        pos.x < config.edgeMargin ||
        pos.y < config.edgeMargin
      ) {
        continue;
      }

      const candidate: PlacedPart = {
        part,
        x: pos.x,
        y: pos.y,
        rotation,
        boundingBox: rotatedBbox,
      };

      // Проверка коллизий с уже размещенными деталями
      const hasCollision = placedParts.some((placed) =>
        checkBoundingBoxCollision(
          placed.boundingBox,
          { x: placed.x, y: placed.y },
          rotatedBbox,
          pos,
          config.minSpacing
        )
      );

      if (!hasCollision) {
        // Оценка позиции: предпочитаем компактное размещение
        // Комбинация: минимальная высота + минимальное расстояние от начала
        const score = pos.y * 2 + pos.x;

        if (score < bestScore) {
          bestScore = score;
          bestPlacement = candidate;
        }
      }
    }
  }

  return bestPlacement;
}

// Упаковка деталей по заданной стратегии
function packParts(
  parts: Part[],
  config: NestingConfig,
  strategy: SortStrategy
): NestingResult {
  const sortedParts = [...parts].sort(strategy);
  const placedParts: PlacedPart[] = [];
  const unplacedParts: Part[] = [];

  for (const part of sortedParts) {
    const placement = findBestPosition(part, placedParts, config);

    if (placement) {
      placedParts.push(placement);
    } else {
      unplacedParts.push(part);
      console.warn(`Could not place part: ${part.id}`);
    }
  }

  // Вычисляем фактические размеры использованного листа
  let maxX = config.edgeMargin;
  let maxY = config.edgeMargin;

  for (const placed of placedParts) {
    maxX = Math.max(maxX, placed.x + placed.boundingBox.width);
    maxY = Math.max(maxY, placed.y + placed.boundingBox.height);
  }

  const sheetWidth = maxX + config.edgeMargin;
  const sheetHeight = maxY + config.edgeMargin;

  // Ограничиваем размерами листа
  const finalSheetWidth = Math.min(sheetWidth, config.maxSheetWidth);
  const finalSheetHeight = Math.min(sheetHeight, config.maxSheetHeight);

  const sheetArea = (finalSheetWidth * finalSheetHeight) / 1_000_000; // в м²

  // Используемая площадь (сумма площадей деталей)
  const usedArea =
    placedParts.reduce((sum, placed) => sum + placed.part.area, 0) / 1_000_000; // в м²

  const efficiency = (usedArea / sheetArea) * 100;
  const metalCost = sheetArea * config.metalCostPerM2;

  return {
    sheetWidth: finalSheetWidth,
    sheetHeight: finalSheetHeight,
    placedParts,
    efficiency,
    sheetArea,
    usedArea,
    metalCost,
    unplacedParts,
  };
}

// Главная функция раскроя: пробует несколько стратегий и возвращает лучшие варианты
export function calculateNesting(
  parts: Part[],
  config: NestingConfig
): NestingResult[] {
  if (parts.length === 0) {
    console.warn("No parts to nest");
    return [];
  }

  console.log(`Starting nesting with ${parts.length} parts`);

  const results: NestingResult[] = [];

  for (const strategy of strategies) {
    console.log(`Trying strategy: ${strategy.name}`);
    const result = packParts(parts, config, strategy.sort);
    results.push(result);
  }

  // Сортируем по эффективности (лучшие первые)
  results.sort((a, b) => {
    // Приоритет: больше размещенных деталей, потом выше эффективность
    if (a.placedParts.length !== b.placedParts.length) {
      return b.placedParts.length - a.placedParts.length;
    }
    return b.efficiency - a.efficiency;
  });

  console.log(`Generated ${results.length} nesting variants`);
  results.forEach((res, i) => {
    console.log(
      `Variant ${i}: ${res.placedParts.length} parts, efficiency: ${res.efficiency.toFixed(1)}%`
    );
  });

  // Возвращаем топ-3 варианта
  return results.slice(0, 3);
}
