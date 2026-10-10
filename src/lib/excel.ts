import { validateRecord, type Entity, type Field, type Values } from './fields'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 5000

export interface ImportResult {
  records: Values[]
  errors: { row: number; message: string }[]
}

const fold = (text: unknown) => String(text ?? '').trim().toLocaleLowerCase('tr')

/** Kayıtları .xlsx olarak indirir. Boş liste verilirse yalnızca başlıkları içeren şablon oluşur. */
export async function downloadExcel(entity: Entity, rows: Values[], fileName: string) {
  const { default: writeExcelFile } = await import('write-excel-file/universal')

  const header = entity.fields.map((field) => ({ value: field.label, fontWeight: 'bold' as const }))
  const body = rows.map((row) =>
    entity.fields.map((field) => {
      const value = row[field.key]
      return field.type === 'date' && value ? new Date(`${value}T00:00:00Z`) : value
    }),
  )
  const blob = await writeExcelFile([header, ...body], {
    sheet: entity.title,
    columns: entity.fields.map((field) => ({ width: Math.max(14, field.label.length + 4) })),
    dateFormat: 'dd.mm.yyyy',
    stickyRowsCount: 1,
  }).toBlob()

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${fileName}.xlsx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

/**
 * .xlsx dosyasını okuyup satırları doğrular. İlk satır başlık olmalı ve
 * sütun adları formdaki alan adlarıyla aynı olmalıdır; tanınmayan sütunlar yok sayılır.
 */
export async function readExcel(entity: Entity, file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Dosya çok büyük (en fazla 5 MB).')

  let sheet: unknown[][]
  try {
    const { readSheet } = await import('read-excel-file/universal')
    sheet = await readSheet(file)
  } catch {
    throw new Error('Dosya okunamadı. Lütfen .xlsx biçiminde bir Excel dosyası seçin.')
  }

  const [header = [], ...lines] = sheet
  const byLabel = new Map(entity.fields.map((field) => [fold(field.label), field]))
  const columns = header.map((cell) => byLabel.get(fold(cell)))
  const present = columns.filter((field): field is Field => field !== undefined)
  const keyLabel = entity.fields.find((field) => field.key === entity.keyField)!.label

  if (!present.some((field) => field.key === entity.keyField)) {
    throw new Error(`Dosyanın ilk satırında "${keyLabel}" sütunu bulunamadı. Şablonu indirip doldurmayı deneyin.`)
  }
  if (lines.length > MAX_ROWS) throw new Error(`Dosya en fazla ${MAX_ROWS} satır içerebilir.`)

  const result: ImportResult = { records: [], errors: [] }
  const seen = new Set<Values[string]>()

  lines.forEach((line, index) => {
    if (line.every((cell) => cell === null || cell === '')) return

    const source: Record<string, unknown> = {}
    columns.forEach((field, column) => {
      if (field) source[field.key] = line[column]
    })
    const { values, errors } = validateRecord(present, source)
    const problems = Object.values(errors)
    if (problems.length === 0 && seen.has(values[entity.keyField])) {
      problems.push(`${keyLabel} dosyada birden fazla kez geçiyor.`)
    }

    if (problems.length > 0) {
      result.errors.push({ row: index + 2, message: problems.join(' ') })
    } else {
      seen.add(values[entity.keyField])
      result.records.push(values)
    }
  })
  return result
}
