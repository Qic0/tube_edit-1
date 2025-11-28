// DEPRECATED: Этот файл оставлен для обратной совместимости
// Используйте новые модули из src/lib/dxf/

export type { 
  BoundingBox, 
  DxfEntity, 
  NestingResult, 
  Part, 
  PlacedPart,
  Point,
  NestingConfig
} from "./dxf/types";

export { getEntityBoundingBox } from "./dxf/geometry";
export { loadDxfParts as groupDxfEntities } from "./dxf/parser";
export { processNesting as calculateNesting } from "./dxf";
