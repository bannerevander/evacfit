// Synthetic demo data in nine hazard-prone areas (Medan, Karo, Samosir, Tapanuli Tengah, Cianjur, Lumajang, Palu, Aceh Tamiang, Banda Aceh). Names, phones and shelters are fictional ("Data contoh").
// Same rows as private.seed_demo_v2 + seed_aceh + seed_health (migrations 20261020000026, 20261025000031, 20261025000033); change both together so demo and Supabase mode match.
import type { DisasterEvent, Family, FunctionalNeeds, Shelter, Volunteer } from '../types'

const noNeeds: FunctionalNeeds = {
  noStairsRequired: false,
  accessibleToiletNeeded: false,
  caregiverSpaceNeeded: false,
  medicalPowerRequired: false,
  minPowerWattage: 0,
  chronicCareNeeded: false,
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
  fam('fam-01', 'Keluarga Siregar', 4, 3.5862, 98.6791, 'Rumah cat hijau dekat musala', { noStairsRequired: true, accessibleToiletNeeded: true, medicalPowerRequired: true, minPowerWattage: 600, wheelchairVehicleNeeded: true }),
  fam('fam-02', 'Keluarga Nasution', 3, 3.5741, 98.6833, 'Gang buntu, rumah kedua kiri', { noStairsRequired: true, caregiverSpaceNeeded: true, wheelchairVehicleNeeded: true, preferredLanguage: 'BISINDO' }, 'caregiver'),
  fam('fam-03', 'Keluarga Lubis', 2, 3.579, 98.6712, 'Samping warung kelontong', { chronicCareNeeded: true, noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 300 }, 'caregiver'),
  fam('fam-04', 'Keluarga Harahap', 5, 3.5888, 98.688, 'Rumah panggung tepi sungai', { infantCount: 1, pregnantCount: 1 }),
  fam('fam-05', 'Keluarga Tanjung', 6, 3.5705, 98.676, 'Depan lapangan voli', {}),
  fam('fam-06', 'Keluarga Sembiring', 3, 3.5845, 98.6905, 'Belakang sekolah', { accessibleToiletNeeded: true, preferredLanguage: 'Karo' }),
  fam('fam-07', 'Keluarga Ginting', 4, 3.5768, 98.688, 'Rumah pagar biru', { chronicCareNeeded: true, noStairsRequired: true, caregiverSpaceNeeded: true, medicalPowerRequired: true, minPowerWattage: 1200 }),
  fam('fam-08', 'Keluarga Simanjuntak', 5, 3.5915, 98.6745, 'Lorong samping gereja', { preferredLanguage: 'Batak Toba' }),
  fam('fam-09', 'Keluarga Hasibuan', 7, 3.573, 98.6905, 'Rumah dua lantai, lantai dasar', { noStairsRequired: true, accessibleToiletNeeded: true, caregiverSpaceNeeded: true }),
  fam('fam-10', 'Keluarga Pohan', 2, 3.582, 98.669, 'Kios jahit', { noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 500 }),
  fam('fam-11', 'Keluarga Daulay', 6, 3.5695, 98.6845, 'Ujung gang, dekat jembatan', { noStairsRequired: true, caregiverSpaceNeeded: true, medicalPowerRequired: true, minPowerWattage: 1000 }),
  fam('fam-12', 'Keluarga Sitompul', 4, 3.588, 98.6705, 'Rumah sudut', {}),
  fam('fam-13', 'Keluarga Tarigan', 5, 3.195, 98.405, 'Desa Sukanalu, rumah dekat jambur', { noStairsRequired: true, caregiverSpaceNeeded: true, preferredLanguage: 'Karo' }),
  fam('fam-14', 'Keluarga Sitepu', 4, 3.15, 98.42, 'Desa Gamber, ladang jeruk', { chronicCareNeeded: true, noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 400, wheelchairVehicleNeeded: true, preferredLanguage: 'Karo' }, 'caregiver'),
  fam('fam-15', 'Keluarga Perangin-angin', 6, 3.14, 98.385, 'Desa Kuta Rakyat, ujung jalan desa', { infantCount: 1, pregnantCount: 1, preferredLanguage: 'Karo' }),
  fam('fam-16', 'Keluarga Barus', 3, 3.18, 98.425, 'Desa Kuta Gugung, depan losd', { accessibleToiletNeeded: true, preferredLanguage: 'Karo' }),
  fam('fam-17', 'Keluarga Sinulingga', 4, 3.205, 98.37, 'Desa Mardinding, rumah adat', { preferredLanguage: 'Karo' }),
  fam('fam-18', 'Keluarga Sinaga', 4, 2.545, 98.64, 'Kaki tebing, dekat dermaga kecil', { preferredLanguage: 'Batak Toba' }),
  fam('fam-19', 'Keluarga Simbolon', 3, 2.53, 98.655, 'Tepi sungai, rumah kayu', { noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 300 }, 'caregiver'),
  fam('fam-20', 'Keluarga Naibaho', 5, 2.552, 98.632, 'Jalan desa menanjak, rumah batu', { noStairsRequired: true, caregiverSpaceNeeded: true, wheelchairVehicleNeeded: true }),
  fam('fam-21', 'Keluarga Situmorang', 2, 2.538, 98.63, 'Samping gereja desa', { accessibleToiletNeeded: true, preferredLanguage: 'Batak Toba' }),
  fam('fam-22', 'Keluarga Hutagalung', 5, 1.705, 98.865, 'Bantaran sungai, rumah panggung', {}),
  fam('fam-23', 'Keluarga Pasaribu', 3, 1.695, 98.872, 'Dekat jembatan gantung', { noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 500, wheelchairVehicleNeeded: true }, 'caregiver'),
  fam('fam-24', 'Keluarga Panggabean', 4, 1.712, 98.855, 'Lereng bukit, kebun karet', { infantCount: 1 }),
  fam('fam-25', 'Keluarga Sihombing', 6, 1.69, 98.85, 'Ujung kampung, dekat aliran sungai', { noStairsRequired: true, accessibleToiletNeeded: true, caregiverSpaceNeeded: true }),
  fam('fam-26', 'Keluarga Hidayat', 4, -6.8, 107.08, 'Desa Cijedil, rumah tembok retak', { chronicCareNeeded: true, noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 600, wheelchairVehicleNeeded: true, preferredLanguage: 'Sunda' }),
  fam('fam-27', 'Keluarga Saepudin', 5, -6.83, 107.05, 'Desa Cibereum, dekat masjid', { infantCount: 1, pregnantCount: 1, preferredLanguage: 'Sunda' }),
  fam('fam-28', 'Keluarga Rohman', 3, -6.84, 107.09, 'Kampung Nagrak, gang sempit', { noStairsRequired: true, caregiverSpaceNeeded: true }, 'caregiver'),
  fam('fam-29', 'Keluarga Suryana', 6, -6.81, 107.06, 'Desa Gasol, kebun teh', { preferredLanguage: 'Sunda' }),
  fam('fam-30', 'Keluarga Sutrisno', 4, -8.17, 112.98, 'Desa Sumberwuluh, dekat aliran lahar', { noStairsRequired: true, accessibleToiletNeeded: true, preferredLanguage: 'Jawa' }),
  fam('fam-31', 'Keluarga Fauzi', 5, -8.16, 112.97, 'Dusun Curah Kobokan', { chronicCareNeeded: true, noStairsRequired: true, caregiverSpaceNeeded: true, medicalPowerRequired: true, minPowerWattage: 800 }, 'caregiver'),
  fam('fam-32', 'Keluarga Wahyudi', 3, -8.15, 112.95, 'Tepi tambang pasir', { preferredLanguage: 'Madura' }),
  fam('fam-33', 'Keluarga Susanto', 6, -8.19, 112.97, 'Dusun Kamar Kajang', { infantCount: 2, preferredLanguage: 'Jawa' }),
  fam('fam-34', 'Keluarga Lasaeba', 4, -0.875, 119.875, 'Dekat Pantai Talise', { noStairsRequired: true, wheelchairVehicleNeeded: true }),
  fam('fam-35', 'Keluarga Tombolotutu', 5, -0.89, 119.866, 'Kompleks rumah nelayan', { chronicCareNeeded: true, noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 400 }, 'caregiver'),
  fam('fam-36', 'Keluarga Lamarauna', 3, -0.882, 119.878, 'Belakang pasar ikan', { pregnantCount: 1, preferredLanguage: 'Kaili' }),
  fam('fam-37', 'Keluarga Pettalolo', 6, -0.892, 119.872, 'Jalan lorong, rumah dua lantai', { noStairsRequired: true, accessibleToiletNeeded: true, caregiverSpaceNeeded: true }),
  fam('fam-38', 'Keluarga Muhammad Yusuf', 5, 4.279, 98.062, 'Kuala Simpang, rumah tepi Sungai Tamiang', { chronicCareNeeded: true, noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 500, wheelchairVehicleNeeded: true, preferredLanguage: 'Aceh' }),
  fam('fam-39', 'Keluarga Ibrahim', 3, 4.274, 98.066, 'Gang dekat pasar Kuala Simpang', { noStairsRequired: true, accessibleToiletNeeded: true, caregiverSpaceNeeded: true }, 'caregiver'),
  fam('fam-40', 'Keluarga Abdullah', 6, 4.283, 98.058, 'Rumah panggung, dekat jembatan', { infantCount: 1, pregnantCount: 1, preferredLanguage: 'Aceh' }),
  fam('fam-41', 'Keluarga Ismail', 4, 4.271, 98.06, 'Kampung Bukit Rata, lantai satu', {}),
  fam('fam-42', 'Keluarga Teuku Hasan', 4, 5.56, 95.298, 'Gampong Ulee Lheue, dekat pantai', { chronicCareNeeded: true, noStairsRequired: true, medicalPowerRequired: true, minPowerWattage: 600, wheelchairVehicleNeeded: true, preferredLanguage: 'Aceh' }),
  fam('fam-43', 'Keluarga Zulkifli', 3, 5.562, 95.296, 'Gampong Punge, rumah satu lantai', { noStairsRequired: true, caregiverSpaceNeeded: true }, 'caregiver'),
  fam('fam-44', 'Keluarga Mahmud', 6, 5.565, 95.302, 'Gampong Lampaseh, dekat tambak', { infantCount: 2, preferredLanguage: 'Aceh' }),
  fam('fam-45', 'Keluarga Nurdin', 2, 5.558, 95.292, 'Belakang meunasah', { accessibleToiletNeeded: true, preferredLanguage: 'Aceh' }),
]

/** Demo citizen account: own family plus two families registered as caregiver proxy (REG-3). */
export const citizenFamilyIds = ['fam-01', 'fam-02', 'fam-03']

const accessible = {
  hasRamp: true, rampSlopeCompliant: true, doorWidthAccessible: true, hasAccessibleToilet: true, hasHealthPost: false,
}
const plain = {
  hasRamp: false, rampSlopeCompliant: false, doorWidthAccessible: false, hasAccessibleToilet: false,
  accessibleToiletCount: 0, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, hasHealthPost: false,
}

export const shelters: Shelter[] = [
  { id: 'sh-01', name: 'Posko Gedung Serbaguna Titi Kuning', address: 'Jl. Serbaguna No. 1, Titi Kuning, Medan Johor', contact: '0812-0000-0201', lat: 3.553, lng: 98.676, totalCapacity: 60, currentOccupancy: 40, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 4, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'BISINDO'] } },
  { id: 'sh-02', name: 'Posko SD Negeri Petisah Tengah', address: 'Jl. Sekolah No. 12, Medan Petisah', contact: '0812-0000-0202', lat: 3.605, lng: 98.672, totalCapacity: 80, currentOccupancy: 35, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, supportedLanguages: ['Indonesia', 'Batak Toba'] } },
  { id: 'sh-03', name: 'Posko GOR Kelurahan Sidorame', address: 'Jl. Olahraga No. 3, Medan Perjuangan', contact: '0812-0000-0203', lat: 3.598, lng: 98.701, totalCapacity: 40, currentOccupancy: 28, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Karo'] } },
  { id: 'sh-04', name: 'Posko Kantor Lurah Pangkalan Masyhur', address: 'Jl. Kelurahan No. 5, Medan Johor', contact: '0812-0000-0204', lat: 3.548, lng: 98.685, totalCapacity: 30, currentOccupancy: 5, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: true, backupGeneratorCapacityWatt: 2000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia'] } },
  { id: 'sh-05', name: 'Posko Aula Puskesmas Darussalam', address: 'Jl. Kesehatan No. 8, Medan Petisah', contact: '0812-0000-0205', lat: 3.604, lng: 98.66, totalCapacity: 14, currentOccupancy: 8, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: false, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Karo'] } },
  { id: 'sh-06', name: 'Posko Balai Warga Kampung Aur', address: 'Jl. Tepi Sungai No. 2, Medan Maimun', contact: '0812-0000-0206', lat: 3.583, lng: 98.682, totalCapacity: 25, currentOccupancy: 0, operationalStatus: 'closed_emergency', verificationStatus: 'verified', features: { ...plain, supportedLanguages: ['Indonesia'] } },
  { id: 'sh-07', name: 'Posko SMP Negeri Medan Area', address: 'Jl. Pendidikan No. 9, Medan Area', contact: '0812-0000-0207', lat: 3.59, lng: 98.705, totalCapacity: 50, currentOccupancy: 50, operationalStatus: 'full', verificationStatus: 'verified', features: { ...plain, hasHealthPost: true, supportedLanguages: ['Indonesia'] } },
  { id: 'sh-08', name: 'Posko Jambur Desa Simpang Empat', address: 'Desa Simpang Empat, Kec. Simpang Empat, Karo', contact: '0812-0000-0208', lat: 3.13, lng: 98.445, totalCapacity: 120, currentOccupancy: 30, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: true, backupGeneratorCapacityWatt: 2000, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Karo'] } },
  { id: 'sh-09', name: 'Posko GOR Kabanjahe', address: 'Jl. Veteran, Kec. Kabanjahe, Karo', contact: '0812-0000-0209', lat: 3.103, lng: 98.492, totalCapacity: 200, currentOccupancy: 60, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 3, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, supportedLanguages: ['Indonesia', 'Karo'] } },
  { id: 'sh-10', name: 'Posko Jambur Desa Tiganderket', address: 'Desa Tiganderket, Kec. Tiganderket, Karo', contact: '0812-0000-0210', lat: 3.232, lng: 98.385, totalCapacity: 80, currentOccupancy: 10, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Karo'] } },
  { id: 'sh-11', name: 'Posko Puskesmas Naman Teran', address: 'Kec. Naman Teran, Karo', contact: '0812-0000-0211', lat: 3.215, lng: 98.455, totalCapacity: 30, currentOccupancy: 0, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Karo'] } },
  { id: 'sh-12', name: 'Posko Aula Gereja Desa Hariara Pohan', address: 'Desa Hariara Pohan, Kec. Harian, Samosir', contact: '0812-0000-0212', lat: 2.585, lng: 98.68, totalCapacity: 100, currentOccupancy: 20, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: true, supportedLanguages: ['Indonesia', 'Batak Toba'] } },
  { id: 'sh-13', name: 'Posko Kantor Camat Harian', address: 'Kec. Harian, Samosir', contact: '0812-0000-0213', lat: 2.565, lng: 98.665, totalCapacity: 60, currentOccupancy: 10, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Batak Toba'] } },
  { id: 'sh-14', name: 'Posko SMA Negeri 1 Pangururan', address: 'Kec. Pangururan, Samosir', contact: '0812-0000-0214', lat: 2.61, lng: 98.7, totalCapacity: 150, currentOccupancy: 40, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Batak Toba'] } },
  { id: 'sh-15', name: 'Posko Aula Kantor Camat Tukka', address: 'Kec. Tukka, Tapanuli Tengah', contact: '0812-0000-0215', lat: 1.735, lng: 98.88, totalCapacity: 80, currentOccupancy: 15, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: true, backupGeneratorCapacityWatt: 2000, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Batak Toba'] } },
  { id: 'sh-16', name: 'Posko SMP Negeri Pandan', address: 'Kec. Pandan, Tapanuli Tengah', contact: '0812-0000-0216', lat: 1.665, lng: 98.875, totalCapacity: 120, currentOccupancy: 30, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, supportedLanguages: ['Indonesia', 'Batak Toba'] } },
  { id: 'sh-17', name: 'Posko Gedung Serbaguna Hutanabolon', address: 'Kec. Tukka, Tapanuli Tengah', contact: '0812-0000-0217', lat: 1.7, lng: 98.905, totalCapacity: 60, currentOccupancy: 10, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, hasHealthPost: true, supportedLanguages: ['Indonesia'] } },
  { id: 'sh-18', name: 'Posko Lapangan Prawatasari', address: 'Kec. Cianjur, Cianjur', contact: '0812-0000-0218', lat: -6.81, lng: 107.14, totalCapacity: 300, currentOccupancy: 50, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Sunda'] } },
  { id: 'sh-19', name: 'Posko GOR Desa Sukaresmi', address: 'Kec. Sukaresmi, Cianjur', contact: '0812-0000-0219', lat: -6.76, lng: 107.03, totalCapacity: 100, currentOccupancy: 20, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia', 'Sunda'] } },
  { id: 'sh-20', name: 'Posko SD Negeri Warungkondang', address: 'Kec. Warungkondang, Cianjur', contact: '0812-0000-0220', lat: -6.89, lng: 107.06, totalCapacity: 80, currentOccupancy: 10, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, supportedLanguages: ['Indonesia', 'Sunda'] } },
  { id: 'sh-21', name: 'Posko Puskesmas Karangtengah', address: 'Kec. Karangtengah, Cianjur', contact: '0812-0000-0221', lat: -6.86, lng: 107.13, totalCapacity: 30, currentOccupancy: 5, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 2000, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Sunda'] } },
  { id: 'sh-22', name: 'Posko Balai Desa Penanggal', address: 'Desa Penanggal, Kec. Candipuro, Lumajang', contact: '0812-0000-0222', lat: -8.2, lng: 113.05, totalCapacity: 200, currentOccupancy: 60, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Jawa', 'Madura'] } },
  { id: 'sh-23', name: 'Posko SD Negeri Pronojiwo', address: 'Kec. Pronojiwo, Lumajang', contact: '0812-0000-0223', lat: -8.22, lng: 112.93, totalCapacity: 120, currentOccupancy: 30, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, supportedLanguages: ['Indonesia', 'Jawa'] } },
  { id: 'sh-24', name: 'Posko Gedung Serbaguna Candipuro', address: 'Kec. Candipuro, Lumajang', contact: '0812-0000-0224', lat: -8.15, lng: 113.02, totalCapacity: 150, currentOccupancy: 40, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 3, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia', 'Jawa'] } },
  { id: 'sh-25', name: 'Posko Puskesmas Candipuro', address: 'Kec. Candipuro, Lumajang', contact: '0812-0000-0225', lat: -8.21, lng: 113.01, totalCapacity: 25, currentOccupancy: 0, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Jawa'] } },
  { id: 'sh-26', name: 'Posko Kampus Bukit Tondo', address: 'Kel. Tondo, Kec. Mantikulore, Palu', contact: '0812-0000-0226', lat: -0.835, lng: 119.895, totalCapacity: 300, currentOccupancy: 50, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 4, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Kaili'] } },
  { id: 'sh-27', name: 'Posko Kelurahan Layana Indah', address: 'Kel. Layana Indah, Kec. Mantikulore, Palu', contact: '0812-0000-0227', lat: -0.862, lng: 119.89, totalCapacity: 100, currentOccupancy: 20, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Kaili'] } },
  { id: 'sh-28', name: 'Posko Lapangan Vatulemo', address: 'Kec. Palu Timur, Palu', contact: '0812-0000-0228', lat: -0.905, lng: 119.875, totalCapacity: 200, currentOccupancy: 30, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, supportedLanguages: ['Indonesia', 'Kaili'] } },
  { id: 'sh-29', name: 'Posko SD Negeri Talise Atas', address: 'Kel. Talise, Kec. Mantikulore, Palu', contact: '0812-0000-0229', lat: -0.866, lng: 119.892, totalCapacity: 40, currentOccupancy: 0, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Kaili'] } },
  { id: 'sh-30', name: 'Posko Aula Kantor Bupati Aceh Tamiang', address: 'Kec. Karang Baru, Aceh Tamiang', contact: '0812-0000-0230', lat: 4.312, lng: 98.035, totalCapacity: 150, currentOccupancy: 30, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 3, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia', 'Aceh'] } },
  { id: 'sh-31', name: 'Posko SMA Negeri 1 Karang Baru', address: 'Kec. Karang Baru, Aceh Tamiang', contact: '0812-0000-0231', lat: 4.305, lng: 98.025, totalCapacity: 100, currentOccupancy: 20, operationalStatus: 'open', verificationStatus: 'verified', features: { ...plain, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Aceh'] } },
  { id: 'sh-32', name: 'Posko Puskesmas Rantau', address: 'Kec. Rantau, Aceh Tamiang', contact: '0812-0000-0232', lat: 4.315, lng: 98.09, totalCapacity: 30, currentOccupancy: 0, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia'] } },
  { id: 'sh-33', name: 'Posko Lapangan Blang Padang', address: 'Kec. Baiturrahman, Banda Aceh', contact: '0812-0000-0233', lat: 5.552, lng: 95.32, totalCapacity: 300, currentOccupancy: 50, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 2, hasMedicalPower: false, backupGeneratorCapacityWatt: 0, hasCaregiverRooms: false, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Aceh'] } },
  { id: 'sh-34', name: 'Posko Gedung Serbaguna Darussalam', address: 'Kec. Syiah Kuala, Banda Aceh', contact: '0812-0000-0234', lat: 5.57, lng: 95.37, totalCapacity: 200, currentOccupancy: 30, operationalStatus: 'open', verificationStatus: 'verified', features: { ...accessible, accessibleToiletCount: 3, hasMedicalPower: true, backupGeneratorCapacityWatt: 3000, hasCaregiverRooms: true, supportedLanguages: ['Indonesia', 'Aceh'] } },
  { id: 'sh-35', name: 'Posko Puskesmas Lueng Bata', address: 'Kec. Lueng Bata, Banda Aceh', contact: '0812-0000-0235', lat: 5.53, lng: 95.34, totalCapacity: 30, currentOccupancy: 0, operationalStatus: 'open', verificationStatus: 'unverified', features: { ...accessible, accessibleToiletCount: 1, hasMedicalPower: true, backupGeneratorCapacityWatt: 1500, hasCaregiverRooms: true, hasHealthPost: true, supportedLanguages: ['Indonesia', 'Aceh'] } },
]

export const volunteers: Volunteer[] = [
  { id: 'vol-01', name: 'Andi Pratama', vehicleType: 'wheelchair_accessible_van', plate: 'BK 1402 AV' },
  { id: 'vol-02', name: 'Budi Santoso', vehicleType: 'standard_car', plate: 'BK 1877 RT' },
  { id: 'vol-03', name: 'Tim Ambulans Kecamatan', vehicleType: 'ambulance', plate: 'BK 9001 AM' },
  { id: 'vol-04', name: 'Tim SAR Perahu Karet', vehicleType: 'boat', plate: 'Perahu 02' },
  { id: 'vol-05', name: 'Tim SAR Kabupaten Karo', vehicleType: 'wheelchair_accessible_van', plate: 'BK 1288 KR' },
  { id: 'vol-06', name: 'Relawan PMI Kabanjahe', vehicleType: 'bus', plate: 'BK 7710 KR' },
  { id: 'vol-07', name: 'Tim SAR Samosir', vehicleType: 'boat', plate: 'KM Samosir 07' },
  { id: 'vol-08', name: 'Ambulans Puskesmas Pangururan', vehicleType: 'ambulance', plate: 'BB 1102 SA' },
  { id: 'vol-09', name: 'Tim BPBD Tapanuli Tengah', vehicleType: 'wheelchair_accessible_van', plate: 'BB 1450 TT' },
  { id: 'vol-10', name: 'Relawan Desa Tukka', vehicleType: 'standard_car', plate: 'BB 1820 TT' },
  { id: 'vol-11', name: 'Tim Tagana Cianjur', vehicleType: 'wheelchair_accessible_van', plate: 'F 1307 CJ' },
  { id: 'vol-12', name: 'Ambulans Desa Cugenang', vehicleType: 'ambulance', plate: 'F 9011 CJ' },
  { id: 'vol-13', name: 'Tim SAR Lumajang', vehicleType: 'wheelchair_accessible_van', plate: 'N 1188 LM' },
  { id: 'vol-14', name: 'Truk Evakuasi Candipuro', vehicleType: 'bus', plate: 'N 8076 LM' },
  { id: 'vol-15', name: 'Tim BPBD Kota Palu', vehicleType: 'wheelchair_accessible_van', plate: 'DN 1209 PL' },
  { id: 'vol-16', name: 'Relawan Kelurahan Talise', vehicleType: 'standard_car', plate: 'DN 1755 PL' },
  { id: 'vol-17', name: 'Tim BPBD Aceh Tamiang', vehicleType: 'boat', plate: 'Perahu AT 01' },
  { id: 'vol-18', name: 'Ambulans RSUD Aceh Tamiang', vehicleType: 'wheelchair_accessible_van', plate: 'BL 1317 AT' },
  { id: 'vol-19', name: 'Tim SAR Banda Aceh', vehicleType: 'wheelchair_accessible_van', plate: 'BL 1204 BA' },
  { id: 'vol-20', name: 'Relawan Gampong Meuraxa', vehicleType: 'standard_car', plate: 'BL 1630 BA' },
]

export const disasterEvents: DisasterEvent[] = [
  {
    id: 'evt-bmkg-01', source: 'bmkg', type: 'earthquake', title: 'Gempa M5,3 — 32 km BaratDaya Kabanjahe',
    magnitude: 5.3, depthKm: 10, lat: 2.92, lng: 98.3, radiusKm: 15, status: 'draft', time: '2026-10-17T08:41:00+07:00',
  },
]

type Scenario = Pick<DisasterEvent, 'type' | 'title' | 'lat' | 'lng' | 'radiusKm'>

/** Prefill for the manual activation form (EMER-1), one rehearsed scenario per seeded operation area. */
export const scenarios: Record<string, Scenario> = {
  'ID-SU-kota-medan': { type: 'flood', title: 'Banjir luapan Sungai Deli — Medan Maimun', lat: 3.58, lng: 98.68, radiusKm: 2.5 },
  'ID-SU-kab-karo': { type: 'volcanic_eruption', title: 'Erupsi Gunung Sinabung — zona merah 5 km', lat: 3.17, lng: 98.392, radiusKm: 5 },
  'ID-SU-kab-samosir': { type: 'flood', title: 'Banjir bandang & longsor — Kec. Harian, Samosir', lat: 2.54, lng: 98.645, radiusKm: 3 },
  'ID-SU-kab-tapanuli-tengah': { type: 'flood', title: 'Banjir bandang & longsor — Kec. Tukka, Tapanuli Tengah', lat: 1.7, lng: 98.86, radiusKm: 3 },
  'ID-JB-kab-cianjur': { type: 'earthquake', title: 'Gempa M5,6 — Cugenang, Cianjur', lat: -6.82, lng: 107.07, radiusKm: 6 },
  'ID-JI-kab-lumajang': { type: 'volcanic_eruption', title: 'Awan panas guguran Semeru — Besuk Kobokan', lat: -8.17, lng: 112.96, radiusKm: 5 },
  'ID-ST-kota-palu': { type: 'earthquake', title: 'Gempa & peringatan tsunami — Pantai Talise, Palu', lat: -0.885, lng: 119.87, radiusKm: 2 },
  'ID-AC-kab-aceh-tamiang': { type: 'flood', title: 'Banjir luapan Sungai Tamiang — Kuala Simpang', lat: 4.278, lng: 98.062, radiusKm: 2.5 },
  'ID-AC-kota-banda-aceh': { type: 'earthquake', title: 'Gempa & peringatan tsunami — pesisir Meuraxa, Banda Aceh', lat: 5.565, lng: 95.293, radiusKm: 2.5 },
}

/** Demo mode (no accounts, no areas) rehearses the Medan flood. */
export const floodScenario = scenarios['ID-SU-kota-medan']
