export type MaterialType = "steel" | "stainless" | "aluminum" | "copper";

export interface MaterialInfo {
  name: string;
  thicknesses: number[];
}

export const MATERIALS: Record<MaterialType, MaterialInfo> = {
  steel: {
    name: "Чёрный металл (сталь)",
    thicknesses: [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 20.0, 25.0],
  },
  stainless: {
    name: "Нержавеющая сталь",
    thicknesses: [0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0],
  },
  aluminum: {
    name: "Алюминий",
    thicknesses: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0],
  },
  copper: {
    name: "Медь / Латунь",
    thicknesses: [0.5, 1.0, 1.5, 2.0, 3.0],
  },
};

export const PRICE_PER_METER = 100;

export interface DxfConfig {
  fileName: string;
  fileContent: string;
  material: MaterialType;
  thickness: number;
  vectorLength: number; // in meters
  price: number;
  sheetArea?: number; // площадь листа в м²
  metalCost?: number; // стоимость металла
  efficiency?: number; // эффективность раскроя в %
}

export interface FinishedDxfPart {
  id: string;
  config: DxfConfig;
  createdAt: Date;
}

export function createDefaultDxfConfig(): DxfConfig {
  return {
    fileName: "",
    fileContent: "",
    material: "steel",
    thickness: 1.0,
    vectorLength: 0,
    price: 0,
  };
}

export function calculateDxfPrice(vectorLength: number): number {
  return vectorLength * PRICE_PER_METER;
}
