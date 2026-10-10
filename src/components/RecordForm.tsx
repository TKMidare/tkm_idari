import { useState, type FormEvent } from 'react'
import { validateRecord, type Entity, type Field, type Row } from '../lib/fields'
import { saveRecord } from '../lib/records'
import { Modal } from './Modal'

interface Props {
  entity: Entity
  /** Düzenlenen kayıt; yeni kayıt için null. */
  row: Row | null
  onSaved: () => void
  onClose: () => void
}

export function RecordForm({ entity, row, onSaved, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      entity.fields.map((field) => [field.key, String(row?.[field.key] ?? field.defaultValue ?? '')]),
    ),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = validateRecord(entity.fields, values)
    setErrors(result.errors)
    if (Object.keys(result.errors).length > 0) return

    setSaving(true)
    setFailure('')
    try {
      await saveRecord(entity, row?.id ?? null, result.values)
      onSaved()
    } catch (error) {
      setFailure((error as Error).message)
      setSaving(false)
    }
  }

  function control(field: Field) {
    const shared = {
      id: field.key,
      value: values[field.key],
      'aria-invalid': field.key in errors,
      onChange: (event: { target: { value: string } }) =>
        setValues((current) => ({ ...current, [field.key]: event.target.value })),
    }
    switch (field.type) {
      case 'select':
        return (
          <select {...shared}>
            {!field.required && <option value="">Seçiniz</option>}
            {field.options!.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        )
      case 'textarea':
        return <textarea {...shared} rows={3} maxLength={field.maxLength} />
      case 'date':
        return <input {...shared} type="date" />
      case 'int':
      case 'decimal':
        return <input {...shared} type="number" min={field.min} max={field.max} step={field.type === 'int' ? 1 : 0.01} />
      default:
        return <input {...shared} type="text" maxLength={field.maxLength} autoComplete="off" />
    }
  }

  return (
    <Modal title={row ? `${entity.singular} Düzenle` : `Yeni ${entity.singular}`} size="large" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          {entity.fields.map((field) => (
            <div key={field.key} className={field.type === 'textarea' ? 'form-field form-field-wide' : 'form-field'}>
              <label htmlFor={field.key}>
                {field.label}
                {field.required && <span className="required"> *</span>}
              </label>
              {control(field)}
              {errors[field.key] && <p className="field-error">{errors[field.key]}</p>}
            </div>
          ))}
        </div>
        {failure && <p className="alert alert-error">{failure}</p>}
        <footer className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Vazgeç
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
