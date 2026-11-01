export const ABAYA_SIZE_OPTIONS = [
  { value: '58, 60 / L', label: 'L', lengths: [58, 60],  },
  { value: '60, 62 / XL', label: 'XL', lengths: [60, 62]},
  { value: '62, 64 / XXL', label: 'XXL', lengths: [62, 64],  },
  { value: '64, 66 / XXXL', label: 'XXXL', lengths: [64, 66],  },
  { value: '66, 69 / XXXXL', label: 'XXXXL', lengths: [66, 69], },
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
