import type { Dict } from '../i18n'
import type { FunctionalNeeds, NeedKey } from '../types'

/** Display order of the five functional needs (REG-2). */
export const needKeys: NeedKey[] = ['noStairsRequired', 'accessibleToiletNeeded', 'caregiverSpaceNeeded', 'medicalPowerRequired', 'wheelchairVehicleNeeded']

export function needSummary(n: FunctionalNeeds, d: Dict): string[] {
  const out = needKeys.filter((k) => n[k]).map((k) => (k === 'medicalPowerRequired' && n.minPowerWattage > 0 ? d.needExtra.power(n.minPowerWattage) : d.need[k].label))
  if (n.infantCount > 0) out.push(d.needExtra.infants(n.infantCount))
  if (n.pregnantCount > 0) out.push(d.needExtra.pregnant(n.pregnantCount))
  if (n.preferredLanguage && n.preferredLanguage !== 'Indonesia') out.push(d.needExtra.language(n.preferredLanguage))
  return out
}
