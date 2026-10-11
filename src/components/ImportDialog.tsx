import { useState, type ChangeEvent } from 'react'
import { downloadTemplate, readExcel, type ImportResult } from '../lib/excel'
import type { Entity } from '../lib/fields'
import { upsertRecords } from '../lib/records'
import { Modal } from './Modal'

const MAX_LISTED_ERRORS = 50

interface Props {
  entity: Entity
  onImported: (count: number) => void
  onClose: () => void
}

export function ImportDialog({ entity, onImported, onClose }: Props) {
  const [parsed, setParsed] = useState<ImportResult | null>(null)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const keyLabel = entity.fields.find((field) => field.key === entity.keyField)!.label

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setParsed(null)
    setFailure('')
    setBusy(true)
    try {
      setParsed(await readExcel(entity, file))
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function importRecords() {
    if (!parsed) return
    setBusy(true)
    setFailure('')
    try {
      await upsertRecords(entity, parsed.records)
      onImported(parsed.records.length)
    } catch (error) {
      setFailure((error as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Excel'den ${entity.singular} Aktar`} onClose={onClose}>
      <div className="modal-body">
        <p>
          İlk satırı sütun başlıkları olan bir <strong>.xlsx</strong> dosyası seçin. {keyLabel} bilgisi sistemde
          zaten bulunan kayıtlar güncellenir, diğerleri yeni kayıt olarak eklenir.
        </p>
        <p>
          <button type="button" className="link-button" onClick={() => void downloadTemplate(entity)}>
            Boş şablonu indir
          </button>
        </p>
        <input type="file" accept=".xlsx" aria-label="Excel dosyası" onChange={chooseFile} disabled={busy} />

        {parsed && (
          <div className="import-summary">
            <p>
              <strong>{parsed.records.length}</strong> satır aktarılmaya hazır
              {parsed.errors.length > 0 && (
                <>
                  , <strong className="text-danger">{parsed.errors.length}</strong> satır hatalı (aktarılmayacak)
                </>
              )}
              .
            </p>
            {parsed.errors.length > 0 && (
              <ul className="import-errors">
                {parsed.errors.slice(0, MAX_LISTED_ERRORS).map((error) => (
                  <li key={error.row}>
                    <strong>Satır {error.row}:</strong> {error.message}
                  </li>
                ))}
                {parsed.errors.length > MAX_LISTED_ERRORS && (
                  <li>… ve {parsed.errors.length - MAX_LISTED_ERRORS} satır daha</li>
                )}
              </ul>
            )}
          </div>
        )}
        {failure && <p className="alert alert-error">{failure}</p>}
      </div>
      <footer className="modal-footer">
        <button type="button" className="button" onClick={onClose}>
          Vazgeç
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={busy || !parsed || parsed.records.length === 0}
          onClick={importRecords}
        >
          {busy ? 'Lütfen bekleyin…' : `${parsed?.records.length ?? 0} Kaydı Aktar`}
        </button>
      </footer>
    </Modal>
  )
}
