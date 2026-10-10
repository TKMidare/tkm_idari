import type { PostgrestError } from '@supabase/supabase-js'
import type { Entity, Row, Values } from './fields'
import { supabase } from './supabase'

export const PAGE_SIZE = 25
const BATCH_SIZE = 500

export interface Filters {
  term: string
  status: string
}

export interface Sort {
  key: string
  ascending: boolean
}

/** Veritabanı hatasını, iç ayrıntıları sızdırmadan kullanıcıya gösterilecek metne çevirir. */
export function describeError(error: PostgrestError): string {
  switch (error.code) {
    case '23505':
      return 'Bu bilgilerle kayıtlı başka bir kayıt var (plaka, şasi no ve telefon numarası benzersiz olmalıdır).'
    case '23514':
    case '22001':
      return 'Girilen değerlerden biri geçersiz. Lütfen alanları kontrol edin.'
    case '42501':
    case 'PGRST301':
      return 'Bu işlem için yetkiniz yok. Lütfen yeniden giriş yapın.'
    default:
      return 'İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.'
  }
}

function filtered(entity: Entity, { term, status }: Filters, count?: 'exact') {
  let query = supabase.from(entity.table).select('*', { count })
  if (status) query = query.eq('status', status)

  // Yalnızca harf, rakam ve zararsız noktalama kalır; filtre sözdizimine müdahale edilemez.
  const clean = term.replace(/[^\p{L}\p{N} .@+/-]/gu, ' ').trim()
  if (clean) {
    const compact = clean.replace(/\s/g, '')
    query = query.or(
      [
        ...entity.searchColumns.map((column) => `${column}.ilike.%${clean}%`),
        ...entity.compactSearchColumns.map((column) => `${column}.ilike.%${compact}%`),
      ].join(','),
    )
  }
  return query
}

export async function fetchPage(entity: Entity, filters: Filters, sort: Sort, page: number) {
  const from = page * PAGE_SIZE
  const { data, count, error } = await filtered(entity, filters, 'exact')
    .order(sort.key, { ascending: sort.ascending, nullsFirst: false })
    .order('id')
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw new Error(describeError(error))
  return { rows: data as Row[], total: count ?? 0 }
}

export async function fetchAll(entity: Entity, filters: Filters): Promise<Row[]> {
  const rows: Row[] = []
  for (;;) {
    const { data, error } = await filtered(entity, filters)
      .order(entity.keyField)
      .range(rows.length, rows.length + BATCH_SIZE - 1)
    if (error) throw new Error(describeError(error))
    rows.push(...(data as Row[]))
    if (data.length < BATCH_SIZE) return rows
  }
}

export async function saveRecord(entity: Entity, id: string | null, values: Values) {
  const table = supabase.from(entity.table)
  const { error } = id ? await table.update(values).eq('id', id) : await table.insert([values])
  if (error) throw new Error(describeError(error))
}

export async function deleteRecord(entity: Entity, id: string) {
  const { error } = await supabase.from(entity.table).delete().eq('id', id)
  if (error) throw new Error(describeError(error))
}

/** Anahtar alanı (plaka / telefon no) eşleşen kayıtları günceller, diğerlerini ekler. */
export async function upsertRecords(entity: Entity, records: Values[]) {
  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const { error } = await supabase
      .from(entity.table)
      .upsert(records.slice(start, start + BATCH_SIZE), { onConflict: entity.keyField })
    if (error) throw new Error(describeError(error))
  }
}
