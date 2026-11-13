export const COUNTRIES = [
  { code: 'LT', name: 'Lithuania' },
  { code: 'LV', name: 'Latvia' },
  { code: 'EE', name: 'Estonia' },
  { code: 'HU', name: 'Hungary' },
  { code: 'ES', name: 'Spain' },
  { code: 'DE', name: 'Germany' },
  { code: 'PL', name: 'Poland' },
] as const

export function findCountry(code: string) {
  return COUNTRIES.find((country) => country.code === code)
}
