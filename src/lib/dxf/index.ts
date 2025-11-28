// Главный экспорт всех функций для работы с DXF и раскроем

export * from "./types";
export * from "./geometry";
export * from "./parser";
export * from "./nesting";

// Удобная функция для полного процесса: от DXF файла до результатов раскроя
import { loadDxfParts } from "./parser";
import { calculateNesting, getDefaultNestingConfig } from "./nesting";
import { NestingResult } from "./types";

export function processNesting(
  dxfContent: string,
  thickness: number
): NestingResult[] {
  const parts = loadDxfParts(dxfContent);
  const config = getDefaultNestingConfig(thickness);
  return calculateNesting(parts, config);
}
