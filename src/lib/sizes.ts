export const ABAYA_SIZE_OPTIONS = [
  { value: '55, 57 / L', label: 'L', lengths: [55, 57] },
  { value: '58, 60 / XL', label: 'XL', lengths: [58, 60] },
  { value: '60, 62 / 2XL', label: '2XL', lengths: [60, 62] },
  { value: '63, 65 / 3XL', label: '3XL', lengths: [63, 65] },
  { value: '66, 69 / 4XL', label: '4XL', lengths: [66, 69] },
] as const

export function hasFractionalSize(size: string): boolean {
  return /\d+[.,]\d+/.test(size)
}

export function getAbayaSizeByBmi(bmi: number) {
  if (bmi >= 40) return ABAYA_SIZE_OPTIONS[4]
  if (bmi >= 35) return ABAYA_SIZE_OPTIONS[3]
  if (bmi >= 30) return ABAYA_SIZE_OPTIONS[2]
  if (bmi >= 25) return ABAYA_SIZE_OPTIONS[1]
  return ABAYA_SIZE_OPTIONS[0]
}
