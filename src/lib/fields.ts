import { formatDate, toIsoDate } from './format'

export type Value = string | number | null
export type Values = Record<string, Value>
export type Row = Values & { id: string }

export interface Field {
  key: string
  label: string
  type: 'text' | 'textarea' | 'int' | 'decimal' | 'date' | 'select'
  required?: boolean
  maxLength?: number
  min?: number
  max?: number
  options?: readonly string[]
  defaultValue?: string
  /** Doğrulamadan önce metne uygulanır (büyük harf, boşluk temizleme vb.). */
  normalize?: (text: string) => string
  pattern?: RegExp
  /** `pattern` tutmadığında gösterilen açıklama. */
  hint?: string
  format?: 'grouped' | 'money' | 'phone'
  /** Bitiş tarihi: yaklaştığında veya geçtiğinde uyarı verilir. */
  expiry?: boolean
  /** Bu tarih, adı verilen diğer tarih alanından önce olamaz. */
  notBefore?: string
  /** Listede gösterilmez, yalnızca formda ve Excel'de yer alır. */
  hidden?: boolean
  /** Telefon görünümündeki özet kartta gösterilir; diğer alanlar kayıt açılınca görünür. */
  summary?: boolean
}

export interface Entity {
  table: 'vehicles' | 'phone_lines' | 'generators'
  path: string
  title: string
  singular: string
  /** Kaydı tanımlayan benzersiz alan (plaka, telefon numarası). */
  keyField: string
  fields: Field[]
  searchColumns: string[]
  /** Boşlukları atılmış arama metniyle eşleştirilen sütunlar. */
  compactSearchColumns: string[]
}

/** Bu durumdaki kayıtlar kullanım dışıdır; bitiş tarihi uyarısı verilmez. */
export const PASSIVE = 'Pasif'

const compactUpper = (text: string) => text.replace(/\s+/g, '').toUpperCase()
const digitsOnly = (text: string) => text.replace(/\D/g, '')

function normalizePlate(text: string): string {
  const standard = /^(\d{2})([A-Z]{1,3})(\d{2,4})$/.exec(compactUpper(text))
  return standard ? `${standard[1]} ${standard[2]} ${standard[3]}` : text.replace(/\s+/g, ' ').toUpperCase()
}

function normalizePhone(text: string): string {
  let digits = digitsOnly(text)
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2)
  return digits.length === 10 ? `0${digits}` : digits
}

const status: Field = { key: 'status', label: 'Durum', type: 'select', options: ['Aktif', PASSIVE], required: true, defaultValue: 'Aktif' }
const notes: Field = { key: 'notes', label: 'Not', type: 'textarea', maxLength: 1000 }
const assignment: Field[] = [
  { key: 'assigned_to', label: 'Kullanan Personel', type: 'text', maxLength: 80, summary: true },
  { key: 'department', label: 'Birim', type: 'text', maxLength: 80, summary: true },
  { key: 'job_title', label: 'Görev', type: 'text', maxLength: 80 },
]
const imeiRule = { normalize: digitsOnly, pattern: /^\d{15}$/, hint: 'IMEI 15 haneli olmalıdır.' }

export const vehicles: Entity = {
  table: 'vehicles',
  path: '/araclar',
  title: 'Araçlar',
  singular: 'Araç',
  keyField: 'plate',
  searchColumns: ['brand', 'model', 'chassis_no', 'assigned_to', 'department', 'job_title'],
  compactSearchColumns: ['plate_compact'],
  fields: [
    {
      key: 'plate', label: 'Plaka', type: 'text', required: true,
      normalize: normalizePlate, pattern: /^[0-9A-Z ]{4,12}$/,
      hint: 'Plaka 4–12 karakter olmalı; yalnızca İngilizce harf ve rakam içerebilir.',
    },
    { key: 'brand', label: 'Marka', type: 'text', maxLength: 50, summary: true },
    { key: 'model', label: 'Model', type: 'text', maxLength: 50, summary: true },
    { key: 'year', label: 'Yıl', type: 'int', min: 1950, max: 2100 },
    { key: 'color', label: 'Renk', type: 'text', maxLength: 30 },
    { key: 'mileage', label: 'Kilometre', type: 'int', min: 0, max: 9_999_999, format: 'grouped' },
    { key: 'fuel_type', label: 'Yakıt Türü', type: 'select', options: ['Benzin', 'Dizel', 'LPG', 'Benzin + LPG', 'Hibrit', 'Elektrik'] },
    // Havuz: belirli bir kişiye veya göreve bağlı olmayan, ortak kullanılan araç.
    { ...status, options: ['Aktif', PASSIVE, 'Havuz'] },
    {
      key: 'chassis_no', label: 'Şasi No', type: 'text',
      normalize: compactUpper, pattern: /^[A-Z0-9]{6,17}$/,
      hint: 'Şasi numarası 6–17 karakter olmalı; yalnızca İngilizce harf ve rakam içerebilir.',
    },
    { key: 'inspection_expiry', label: 'Muayene Bitiş', type: 'date', expiry: true },
    { key: 'traffic_insurance_expiry', label: 'Trafik Sigortası Bitiş', type: 'date', expiry: true },
    { key: 'casco_expiry', label: 'Kasko Bitiş', type: 'date', expiry: true },
    { key: 'rental_start', label: 'Kiralama Başlangıç', type: 'date' },
    { key: 'rental_end', label: 'Kiralama Bitiş', type: 'date', expiry: true, notBefore: 'rental_start' },
    { key: 'assignment_type', label: 'Tahsis Türü', type: 'select', options: ['Göreve', 'Şahsa'] },
    ...assignment,
    notes,
  ],
}

export const phoneLines: Entity = {
  table: 'phone_lines',
  path: '/hatlar',
  title: 'Telefon Hatları',
  singular: 'Hat',
  keyField: 'phone_number',
  searchColumns: ['plan', 'assigned_to', 'department', 'job_title', 'device_brand', 'device_model'],
  compactSearchColumns: ['phone_number', 'imei1', 'imei2', 'sim_serial'],
  fields: [
    {
      key: 'phone_number', label: 'Telefon No', type: 'text', required: true, format: 'phone',
      normalize: normalizePhone, pattern: /^0\d{10}$/,
      hint: 'Telefon numarası alan koduyla birlikte 10 haneli olmalıdır (örn. 0532 123 45 67).',
    },
    { key: 'number_type', label: 'Numara Türü', type: 'select', options: ['Şirket', 'Şahsi'], summary: true },
    { key: 'operator', label: 'Operatör', type: 'select', options: ['Turkcell', 'Vodafone', 'Türk Telekom', 'Diğer'], summary: true },
    { key: 'plan', label: 'Tarife / Paket', type: 'text', maxLength: 80 },
    { key: 'quota', label: 'Kota', type: 'text', maxLength: 60, hidden: true },
    { key: 'monthly_fee', label: 'Aylık Ücret', type: 'decimal', min: 0, max: 999_999, format: 'money' },
    status,
    ...assignment,
    { key: 'device_type', label: 'Cihaz Türü', type: 'select', options: ['Telefon', 'Tablet'], summary: true },
    { key: 'imei1', label: 'IMEI 1', type: 'text', ...imeiRule },
    { key: 'imei2', label: 'IMEI 2', type: 'text', hidden: true, ...imeiRule },
    { key: 'device_brand', label: 'Cihaz Marka', type: 'text', maxLength: 50 },
    { key: 'device_model', label: 'Cihaz Model', type: 'text', maxLength: 50 },
    { key: 'device_serial', label: 'Cihaz Seri No', type: 'text', maxLength: 40, hidden: true },
    {
      key: 'sim_serial', label: 'SIM Seri No (ICCID)', type: 'text', hidden: true,
      normalize: digitsOnly, pattern: /^\d{18,22}$/, hint: 'SIM seri numarası 18–22 haneli olmalıdır.',
    },
    { key: 'account_holder', label: 'Hat Sahibi / Fatura Hesabı', type: 'text', maxLength: 80, hidden: true },
    { key: 'activation_date', label: 'Hat Açılış Tarihi', type: 'date', hidden: true },
    { key: 'contract_end', label: 'Taahhüt Bitiş', type: 'date', expiry: true },
    { key: 'device_handover_date', label: 'Cihaz Teslim Tarihi', type: 'date', hidden: true },
    { ...notes, hidden: true },
  ],
}

export const generators: Entity = {
  table: 'generators',
  path: '/jeneratorler',
  title: 'Jeneratörler',
  singular: 'Jeneratör',
  keyField: 'serial_no',
  searchColumns: ['brand', 'fuel_kind', 'store_code', 'store', 'province', 'district'],
  compactSearchColumns: ['serial_no'],
  fields: [
    {
      key: 'serial_no', label: 'Seri No', type: 'text', required: true,
      normalize: compactUpper, pattern: /^[A-Z0-9./-]{2,40}$/,
      hint: 'Seri numarası 2–40 karakter olmalı; yalnızca İngilizce harf, rakam ve . / - içerebilir.',
    },
    { key: 'brand', label: 'Marka', type: 'text', maxLength: 50, summary: true },
    { key: 'fuel_kind', label: 'Mazot Cinsi', type: 'text', maxLength: 50 },
    { key: 'fuel_limit', label: 'Limit', type: 'decimal', min: 0, max: 9_999_999, format: 'grouped' },
    { key: 'store_code', label: 'Mağaza Kodu', type: 'text', maxLength: 20, summary: true },
    { key: 'store', label: 'Mağaza', type: 'text', maxLength: 80, summary: true },
    { key: 'province', label: 'İl', type: 'text', maxLength: 40, summary: true },
    { key: 'district', label: 'İlçe', type: 'text', maxLength: 40, summary: true },
    status,
    notes,
  ],
}

export const entities = [vehicles, phoneLines, generators]

function parseValue(field: Field, raw: unknown): { value: Value; error?: string } {
  const fail = (error: string) => ({ value: null, error })

  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    if (field.defaultValue !== undefined) return { value: field.defaultValue }
    return field.required ? fail(`${field.label} zorunludur.`) : { value: null }
  }

  switch (field.type) {
    case 'date': {
      const value = toIsoDate(raw)
      return value ? { value } : fail(`${field.label} geçerli bir tarih değil (GG.AA.YYYY).`)
    }
    case 'int':
    case 'decimal': {
      const number = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'))
      if (!Number.isFinite(number) || (field.type === 'int' && !Number.isInteger(number))) {
        return fail(`${field.label} geçerli bir sayı değil.`)
      }
      if (number < field.min! || number > field.max!) {
        return fail(`${field.label} ${field.min}–${field.max} aralığında olmalıdır.`)
      }
      return { value: field.type === 'decimal' ? Math.round(number * 100) / 100 : number }
    }
    case 'select': {
      const wanted = String(raw).trim().toLocaleLowerCase('tr')
      const value = field.options!.find((option) => option.toLocaleLowerCase('tr') === wanted)
      return value ? { value } : fail(`${field.label} şunlardan biri olmalıdır: ${field.options!.join(', ')}.`)
    }
    default: {
      const trimmed = String(raw).trim()
      const value = field.normalize ? field.normalize(trimmed) : trimmed
      if (field.maxLength && value.length > field.maxLength) {
        return fail(`${field.label} en fazla ${field.maxLength} karakter olabilir.`)
      }
      if (field.pattern && !field.pattern.test(value)) return fail(field.hint!)
      return { value }
    }
  }
}

/** Form veya Excel'den gelen ham değerleri veritabanına yazılacak hale getirir. */
export function validateRecord(fields: Field[], source: Record<string, unknown>) {
  const values: Values = {}
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const { value, error } = parseValue(field, source[field.key])
    values[field.key] = value
    if (error) errors[field.key] = error
  }
  for (const field of fields) {
    const earliest = fields.find((other) => other.key === field.notBefore)
    const [value, limit] = [values[field.key], earliest && values[earliest.key]]
    if (earliest && value && limit && value < limit) {
      errors[field.key] = `${field.label}, ${earliest.label} tarihinden önce olamaz.`
    }
  }
  return { values, errors }
}

export function formatValue(field: Field, value: Value): string {
  if (value === null || value === '') return ''
  if (field.type === 'date') return formatDate(String(value))
  switch (field.format) {
    case 'grouped':
      return Number(value).toLocaleString('tr-TR')
    case 'money':
      return Number(value).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
    case 'phone':
      return String(value).replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4')
    default:
      return String(value)
  }
}
