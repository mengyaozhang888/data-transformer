export interface MaterialProperties {
  yieldStr: number;
  tensileStr: number;
  elongation: number;
  elasticMod: number;
}

export interface Row {
  hardness: number | null;
  yieldStr: number;
  tensileStr: number;
  elongation: number;
  elasticMod: number;
  thickness: number | null;
  height: number | null;
  size: number;
  temperature: number;
  testType: number;
  plasticineHeight: number | null;
}