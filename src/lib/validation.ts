const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export const normalizePhone = (value: string) =>
  value
    .replace(/[\s\-+()]/g, '')
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/^0020/, '0')
    .replace(/^20(?=1)/, '0')

export type SignupFields = {
  name: string
  phone: string
  email: string
  password: string
  confirm: string
}

export function validateSignup(f: SignupFields) {
  const errors: Partial<Record<keyof SignupFields, string>> = {}

  if (f.name.trim().split(/\s+/).length < 2 || f.name.trim().length < 5)
    errors.name = 'اكتبي الاسم الأول والأخير على الأقل.'
  else if (/[0-9@#$%^&*()_+=<>?/\\|{}[\]~`]/.test(f.name))
    errors.name = 'الاسم يجب أن يحتوي على حروف فقط.'

  const phone = normalizePhone(f.phone)
  if (!/^01[0125]\d{8}$/.test(phone))
    errors.phone = 'أدخلي رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()))
    errors.email = 'البريد الإلكتروني غير صحيح.'

  if (f.password.length < 8) errors.password = 'كلمة المرور 8 أحرف على الأقل.'
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))
    errors.password = 'يجب أن تحتوي كلمة المرور على حروف وأرقام.'

  if (f.confirm !== f.password) errors.confirm = 'كلمتا المرور غير متطابقتين.'

  return { errors, phone }
}