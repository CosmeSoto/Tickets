import { z } from 'zod'
import { PAYMENT_METHOD_TYPE_VALUES } from '@/lib/validations/contracts'

export const SUPPLIER_PAYMENT_TERMS_OPTIONS = [
  { value: 0, label: 'Contado / inmediato' },
  { value: 15, label: '15 días' },
  { value: 30, label: '30 días' },
  { value: 45, label: '45 días' },
  { value: 60, label: '60 días' },
  { value: 90, label: '90 días' },
] as const

export const SUPPLIER_BANK_ACCOUNT_TYPES = ['CHECKING', 'SAVINGS', 'OTHER'] as const

export const SUPPLIER_BANK_ACCOUNT_TYPE_LABELS: Record<
  (typeof SUPPLIER_BANK_ACCOUNT_TYPES)[number],
  string
> = {
  CHECKING: 'Cuenta corriente',
  SAVINGS: 'Cuenta de ahorros',
  OTHER: 'Otra',
}

const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v)

const optionalString = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().optional())

export const supplierFormSchema = z.object({
  name: z.string().min(1, 'El nombre del proveedor es obligatorio').max(200),
  legalName: optionalString(200),
  typeId: optionalString(50),
  familyId: optionalString(50),
  taxId: optionalString(20),
  email: z.preprocess(
    emptyToNull,
    z.string().email('Email inválido').max(200).nullable().optional()
  ),
  phone: optionalString(50),
  contactName: optionalString(200),
  website: optionalString(500),
  address: optionalString(500),
  city: optionalString(100),
  country: optionalString(100),
  paymentTermsDays: z.preprocess(
    v => (v === '' || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(0).max(365).nullable().optional()
  ),
  creditLimit: z.preprocess(
    v => (v === '' || v === undefined || v === null ? null : Number(String(v).replace(',', '.'))),
    z.number().min(0).nullable().optional()
  ),
  creditCurrency: z.preprocess(emptyToNull, z.string().length(3).nullable().optional()),
  preferredPaymentMethod: z.preprocess(
    emptyToNull,
    z.enum(PAYMENT_METHOD_TYPE_VALUES).nullable().optional()
  ),
  bankName: optionalString(100),
  bankAccountNumber: optionalString(80),
  bankAccountType: z.preprocess(
    emptyToNull,
    z.enum(SUPPLIER_BANK_ACCOUNT_TYPES).nullable().optional()
  ),
  bankSwift: optionalString(30),
  notes: optionalString(5000),
})

export type SupplierFormInput = z.infer<typeof supplierFormSchema>

/** Campos comerciales/contacto para create/update (sin id). */
export function sanitizeSupplierPayload(raw: Record<string, unknown>) {
  const parsed = supplierFormSchema.parse(raw)
  return {
    name: parsed.name.trim(),
    legalName: parsed.legalName || null,
    typeId: parsed.typeId || null,
    familyId: parsed.familyId || null,
    taxId: parsed.taxId || null,
    email: parsed.email || null,
    phone: parsed.phone || null,
    contactName: parsed.contactName || null,
    website: parsed.website || null,
    address: parsed.address || null,
    city: parsed.city || null,
    country: parsed.country || null,
    paymentTermsDays: parsed.paymentTermsDays ?? null,
    creditLimit: parsed.creditLimit ?? null,
    creditCurrency: parsed.creditCurrency || 'USD',
    preferredPaymentMethod: parsed.preferredPaymentMethod || null,
    bankName: parsed.bankName || null,
    bankAccountNumber: parsed.bankAccountNumber || null,
    bankAccountType: parsed.bankAccountType || null,
    bankSwift: parsed.bankSwift || null,
    notes: parsed.notes || null,
  }
}
