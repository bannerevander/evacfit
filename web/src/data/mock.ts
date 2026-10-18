// Synthetic demo data around Medan. Names, phones and shelters are fictional ("Data contoh").
import type { DisasterEvent, Family, FunctionalNeeds, Shelter, Volunteer } from '../types'

const noNeeds: FunctionalNeeds = {
  noStairsRequired: false,
  accessibleToiletNeeded: false,
  caregiverSpaceNeeded: false,
  medicalPowerRequired: false,
  minPowerWattage: 0,
  wheelchairVehicleNeeded: false,
  preferredLanguage: 'Indonesia',
  infantCount: 0,
  pregnantCount: 0,
  notes: '',
}

export const emptyNeeds = noNeeds

function fam(
  id: string,
  familyName: string,
  memberCount: number,
  lat: number,
  lng: number,
  addressNotes: string,
  needs: Partial<FunctionalNeeds>,
  registeredVia: Family['registeredVia'] = 'self',
): Family {
  return {
    id,
    code: `EVF-${id.slice(-2)}${familyName.slice(0, 2).toUpperCase()}`,
    familyName,
    memberCount,
    contactPhone: `0812-0000-01${id.slice(-2)}`,
    lat,
    lng,
    addressNotes,
    status: 'idle',
    needs: { ...noNeeds, ...needs },
    registeredVia,
  }
}

export const families: Family[] = [
  fam('fam-01', 'Keluarga Siregar', 4, 3.5862, 98.6791, 'Rumah cat hijau dekat musala', {
    noStairsRequired: true, accessibleToiletNeeded: true, medicalPowerRequired: true, minPowerWattage: 600, wheelchairVehicleNeeded: true,
  }),
  fam('fam-02', 'Keluarga Nasution', 3, 3.5741, 98.6833, 'Gang buntu, rumah kedua kiri', {
    noStairsRequired: true, caregiverSpaceNeeded: true, wheelchairVehicleNeeded: true, preferredLanguage: 'BISINDO',
  }, 'caregiver'),
  fam('fam-03', 'Keluarga Lubis', 2, 3.579, 98.6712, 'Samping warung kelontong', {
    noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 300,
  }, 'caregiver'),
  fam('fam-04', 'Keluarga Harahap', 5, 3.5888, 98.688, 'Rumah panggung tepi sungai', { infantCount: 1, pregnantCount: 1 }),
  fam('fam-05', 'Keluarga Tanjung', 6, 3.5705, 98.676, 'Depan lapangan voli', {}),
  fam('fam-06', 'Keluarga Sembiring', 3, 3.5845, 98.6905, 'Belakang sekolah', { accessibleToiletNeeded: true, preferredLanguage: 'Karo' }),
  fam('fam-07', 'Keluarga Ginting', 4, 3.5768, 98.688, 'Rumah pagar biru', {
    noStairsRequired: true, caregiverSpaceNeeded: true, medicalPowerRequired: true, minPowerWattage: 1200,
  }),
  fam('fam-08', 'Keluarga Simanjuntak', 5, 3.5915, 98.6745, 'Lorong samping gereja', { preferredLanguage: 'Batak Toba' }),
  fam('fam-09', 'Keluarga Hasibuan', 7, 3.573, 98.6905, 'Rumah dua lantai, lantai dasar', {
    noStairsRequired: true, accessibleToiletNeeded: true, caregiverSpaceNeeded: true,
  }),
  fam('fam-10', 'Keluarga Pohan', 2, 3.582, 98.669, 'Kios jahit', { noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 500 }),
  fam('fam-11', 'Keluarga Daulay', 6, 3.5695, 98.6845, 'Ujung gang, dekat jembatan', {
    noStairsRequired: true, caregiverSpaceNeeded: true, medicalPowerRequired: true, minPowerWattage: 1000,
  }),
  fam('fam-12', 'Keluarga Sitompul', 4, 3.588, 98.6705, 'Rumah sudut', {}),
]

/** Demo citizen account: own family plus two families registered as caregiver proxy (REG-3). */
export const citizenFamilyIds = ['fam-01', 'fam-02', 'fam-03']

const accessible = {
  hasRamp: true, rampSlopeCompliant: true, doorWidthAccessible: true, hasAccessibleToilet: true,
}
const plain = {
  hasRamp: false, rampSlopeCompliant: false, doorWidthAccessible: false, hasAccessibleToilet: false,
  accessibleToiletCount: 0, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false,
}

export const shelters: Shelter[] = [
  {
    id: 'sh-01', name: 'Posko Gedung Serbaguna Padang Bulan', address: 'Jl. Serbaguna No. 1, Medan Baru', contact: '0812-0000-0201',
    lat: 3.5614, lng: 98.6567, totalCapacity: 60, currentOccupancy: 40, operationalStatus: 'open', verificationStatus: 'verified',
    features: { ...accessible, accessibleToiletCount: 4, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia', 'BISINDO'] },
  },
  {
    id: 'sh-02', name: 'Posko SD Negeri Sei Sikambing', address: 'Jl. Sekolah No. 12, Medan Petisah', contact: '0812-0000-0202',
    lat: 3.6004, lng: 98.6656, totalCapacity: 80, currentOccupancy: 35, operationalStatus: 'open', verificationStatus: 'verified',
    features: { ...plain, supportedLanguages: ['Indonesia', 'Batak Toba'] },
  },
  {
    id: 'sh-03', name: 'Posko GOR Kecamatan Medan Timur', address: 'Jl. Olahraga No. 3, Medan Timur', contact: '0812-0000-0203',
    lat: 3.5927, lng: 98.709, totalCapacity: 40, currentOccupancy: 28, operationalStatus: 'open', verificationStatus: 'verified',
    features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, supportedLanguages: ['Indonesia', 'Karo'] },
  },
  {
    id: 'sh-04', name: 'Posko Kantor Camat Medan Johor', address: 'Jl. Kecamatan No. 5, Medan Johor', contact: '0812-0000-0204',
    lat: 3.53, lng: 98.675, totalCapacity: 30, currentOccupancy: 5, operationalStatus: 'open', verificationStatus: 'unverified',
    features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: true, backupGeneratorCapacityWatt: 2000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia'] },
  },
  {
    id: 'sh-05', name: 'Posko Aula Puskesmas Helvetia', address: 'Jl. Kesehatan No. 8, Medan Helvetia', contact: '0812-0000-0205',
    lat: 3.605, lng: 98.635, totalCapacity: 14, currentOccupancy: 8, operationalStatus: 'open', verificationStatus: 'verified',
    features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: false, supportedLanguages: ['Indonesia', 'Karo'] },
  },
  {
    id: 'sh-06', name: 'Posko Balai Warga Kampung Aur', address: 'Jl. Tepi Sungai No. 2, Medan Maimun', contact: '0812-0000-0206',
    lat: 3.583, lng: 98.682, totalCapacity: 25, currentOccupancy: 0, operationalStatus: 'closed_emergency', verificationStatus: 'verified',
    features: { ...plain, supportedLanguages: ['Indonesia'] },
  },
  {
    id: 'sh-07', name: 'Posko SMP Negeri Medan Perjuangan', address: 'Jl. Pendidikan No. 9, Medan Perjuangan', contact: '0812-0000-0207',
    lat: 3.612, lng: 98.695, totalCapacity: 50, currentOccupancy: 50, operationalStatus: 'full', verificationStatus: 'verified',
    features: { ...plain, supportedLanguages: ['Indonesia'] },
  },
]

export const volunteers: Volunteer[] = [
  { id: 'vol-01', name: 'Andi Pratama', vehicleType: 'wheelchair_accessible_van', plate: 'BK 1402 AV' },
  { id: 'vol-02', name: 'Budi Santoso', vehicleType: 'standard_car', plate: 'BK 1877 RT' },
  { id: 'vol-03', name: 'Tim Ambulans Kecamatan', vehicleType: 'ambulance', plate: 'BK 9001 AM' },
  { id: 'vol-04', name: 'Tim SAR Perahu Karet', vehicleType: 'boat', plate: 'Perahu 02' },
]

export const disasterEvents: DisasterEvent[] = [
  {
    id: 'evt-bmkg-01', source: 'bmkg', type: 'earthquake', title: 'Gempa M5,3 — 32 km BaratDaya Kabanjahe',
    magnitude: 5.3, depthKm: 10, lat: 2.92, lng: 98.3, radiusKm: 15, status: 'draft', time: '2026-10-17T08:41:00+07:00',
  },
]

/** Prefill for the manual activation form (EMER-1): Sungai Deli flood scenario. */
export const floodScenario = {
  type: 'flood' as const,
  title: 'Banjir luapan Sungai Deli — Medan Maimun',
  lat: 3.58,
  lng: 98.68,
  radiusKm: 2.5,
}
