
export type AppView = 'form' | 'map' | 'dashboard';

export enum TreeCondition {
  HEALTHY = 'Sehat',
  DAMAGED = 'Rusak',
  DEAD = 'Mati',
}

export type ProximityToBuilding = 'None' | 'Near' | 'Far';

export interface CarbonMetrics {
  biomass: number; // in kg
  carbonStored: number; // in kg
  co2Sequestrated: number; // in kg
}

export interface EcosystemServices {
  stormwaterInterceptedLiters: number;
  airPollutionRemovedGrams: number;
  energySavingsIDR: number;
  annualMonetaryValue: {
    total: number;
    carbon: number;
    stormwater: number;
    airQuality: number;
    energy: number;
  };
}


export interface TreeData {
  id: number;
  species: string;
  dbh: number; // Diameter at Breast Height in cm
  height: number; // in meters
  condition: TreeCondition;
  proximityToBuilding: ProximityToBuilding;
  notes: string;
  photo: string; // base64 string of compressed image
  latitude: number;
  longitude: number;
  inventoryDate: string; // ISO 8601 format
  carbon: CarbonMetrics;
  ecosystemServices: EcosystemServices;
}

export interface TreeAnalysisResult {
  species: string;
  latitude: number;
  longitude: number;
  condition: TreeCondition;
  estimatedDbh: number;
  estimatedHeight: number;
}