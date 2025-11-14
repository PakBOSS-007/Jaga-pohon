
import type { TreeData, ProximityToBuilding } from './types';
import { TreeCondition } from './types';
import { calculateCarbonMetrics } from './services/carbonCalculator';
import { calculateEcosystemServices } from './services/ecosystemServiceCalculator';

const createTree = (
  id: number,
  species: string,
  dbh: number,
  height: number,
  condition: TreeCondition,
  proximityToBuilding: ProximityToBuilding,
  notes: string,
  photoSeed: string,
  latitude: number,
  longitude: number,
  date: string
): TreeData => {
  const carbon = calculateCarbonMetrics(dbh, height, condition);
  const ecosystemServices = calculateEcosystemServices(dbh, proximityToBuilding, condition);
  return {
    id,
    species,
    dbh,
    height,
    condition,
    proximityToBuilding,
    notes,
    photo: `https://picsum.photos/seed/${photoSeed}/400/300`,
    latitude,
    longitude,
    inventoryDate: new Date(date).toISOString(),
    carbon,
    ecosystemServices,
  };
};


export const initialTrees: TreeData[] = [
  createTree(
    1,
    'Jati',
    60,
    25,
    TreeCondition.HEALTHY,
    'Near',
    'Pohon jati tua yang megah di taman utama, memberikan keteduhan yang luar biasa.',
    'oak',
    34.0522,
    -118.2437,
    '2023-10-26T10:00:00Z'
  ),
  createTree(
    2,
    'Pinus',
    45,
    30,
    TreeCondition.HEALTHY,
    'Far',
    'Pohon pinus tinggi di dekat sungai.',
    'pine',
    34.055,
    -118.245,
    '2023-10-26T11:30:00Z'
  ),
  createTree(
    3,
    'Mapel',
    50,
    22,
    TreeCondition.DAMAGED,
    'Near',
    'Cabang patah akibat badai baru-baru ini. Memberikan keteduhan pada bangku di dekatnya.',
    'maple',
    34.051,
    -118.24,
    '2023-10-27T09:00:00Z'
  ),
];
