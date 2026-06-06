export interface MedicineCatalogEntry {
  medicineId: string;
  displayName: string;
  discountPercent: number;
  gstRate: number;
  hsnCode: string;
  mrpMultiplier: number;
}

export const MEDICINE_CATALOG: MedicineCatalogEntry[] = [
  {
    medicineId: 'MED001',
    displayName: 'Crocin 650',
    discountPercent: 4,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.18,
  },
  {
    medicineId: 'MED002',
    displayName: 'Brufen 400 Tablet',
    discountPercent: 5,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.16,
  },
  {
    medicineId: 'MED003',
    displayName: 'Almox 500 Capsule',
    discountPercent: 6,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.14,
  },
  {
    medicineId: 'MED005',
    displayName: 'Azithral 500 Tablet',
    discountPercent: 6,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.18,
  },
  {
    medicineId: 'MED025',
    displayName: 'Telma 40 Tablet',
    discountPercent: 5,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.17,
  },
  {
    medicineId: 'MED010',
    displayName: 'Losar 50 Tablet',
    discountPercent: 5,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.15,
  },
  {
    medicineId: 'MED006',
    displayName: 'Okamet 500 Tablet',
    discountPercent: 4,
    gstRate: 5,
    hsnCode: '30049099',
    mrpMultiplier: 1.12,
  },
  {
    medicineId: 'MED004',
    displayName: 'Cetirizine 10 mg',
    discountPercent: 4,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.12,
  },
  {
    medicineId: 'MED007',
    displayName: 'Omepraz 20 mg',
    discountPercent: 4,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.12,
  },
  {
    medicineId: 'MED008',
    displayName: 'LipVAS 20 Tablet',
    discountPercent: 4,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.12,
  },
  {
    medicineId: 'MED011',
    displayName: 'Lethyrox 50mcg',
    discountPercent: 3,
    gstRate: 5,
    hsnCode: '30049099',
    mrpMultiplier: 1.1,
  },
  {
    medicineId: 'MED012',
    displayName: 'Pantop-D Capsule',
    discountPercent: 5,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.16,
  },
  {
    medicineId: 'MED014',
    displayName: 'Montek-10',
    discountPercent: 4,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.15,
  },
  {
    medicineId: 'MED050',
    displayName: 'Levoquin 500mg Tablet',
    discountPercent: 6,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.18,
  },
  {
    medicineId: 'MED016',
    displayName: 'Taxim-O 200 Tablet',
    discountPercent: 5,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.14,
  },
  {
    medicineId: 'MED043',
    displayName: 'ORS Sachets',
    discountPercent: 3,
    gstRate: 5,
    hsnCode: '30049099',
    mrpMultiplier: 1.08,
  },
  {
    medicineId: 'MED009',
    displayName: 'Amloheal 5mg Tablet',
    discountPercent: 4,
    gstRate: 12,
    hsnCode: '30049099',
    mrpMultiplier: 1.13,
  },
  {
    medicineId: 'MED022',
    displayName: 'Ecosprin 75 Tablet',
    discountPercent: 3,
    gstRate: 5,
    hsnCode: '30049099',
    mrpMultiplier: 1.1,
  },
];

export const MEDICINE_CATALOG_BY_ID = new Map(
  MEDICINE_CATALOG.map((entry) => [entry.medicineId, entry]),
);

export const WHITELISTED_MEDICINE_IDS = new Set(
  MEDICINE_CATALOG.map((entry) => entry.medicineId),
);

export function getMedicineCatalogEntry(
  medicineId: string,
): MedicineCatalogEntry | undefined {
  return MEDICINE_CATALOG_BY_ID.get(medicineId);
}

export function isWhitelistedMedicine(medicineId: string): boolean {
  return WHITELISTED_MEDICINE_IDS.has(medicineId);
}

export function getMedicineDisplayName(
  medicineId: string,
  fallbackName: string,
): string {
  return getMedicineCatalogEntry(medicineId)?.displayName ?? fallbackName;
}
