export function formatINR(amount: number | undefined | null): string {
  const safeAmount = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function formatDate(
  value: string | Date | { toDate?: () => Date } | undefined | null
): string {
  if (!value) return '—';
  try {
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else if (typeof value === 'object' && typeof value.toDate === 'function') {
      date = value.toDate();
    } else {
      return String(value);
    }
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export interface InvoiceCalculationInput {
  items: { description?: string; quantity: number; unitPrice: number }[];
  discount: number;
  taxRate: number;
  amountPaid: number;
}

export interface InvoiceCalculationResult {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  normalizedItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
  validationErrors: string[];
}

export function calculateInvoiceTotals(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const validationErrors: string[] = [];

  if (!Array.isArray(input.items) || input.items.length === 0) {
    validationErrors.push('At least one line item is required.');
  }

  const normalizedItems = (input.items || []).map((item, idx) => {
    const rawQty = Number(item.quantity);
    const rawPrice = Number(item.unitPrice);
    if (Number.isNaN(rawQty) || rawQty <= 0) {
      validationErrors.push(`Line item #${idx + 1} quantity must be greater than zero.`);
    }
    if (Number.isNaN(rawPrice) || rawPrice < 0) {
      validationErrors.push(`Line item #${idx + 1} unit price cannot be negative.`);
    }
    if (item.description !== undefined && !String(item.description).trim()) {
      validationErrors.push(`Line item #${idx + 1} requires a description.`);
    }
    const qty = Math.max(0.01, Number.isNaN(rawQty) ? 1 : rawQty);
    const price = Math.max(0, Number.isNaN(rawPrice) ? 0 : rawPrice);
    const amount = Math.round(qty * price);
    return {
      description: String(item.description || '').trim(),
      quantity: qty,
      unitPrice: price,
      amount,
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);

  const rawDiscount = Number(input.discount) || 0;
  if (rawDiscount < 0) {
    validationErrors.push('Discount cannot be negative.');
  }
  if (rawDiscount > subtotal && subtotal > 0) {
    validationErrors.push('Discount cannot exceed the subtotal.');
  }

  const discount = Math.min(subtotal, Math.max(0, Math.round(rawDiscount)));
  const taxableAmount = Math.max(0, subtotal - discount);
  const rawTaxRate = Number(input.taxRate) || 0;
  if (rawTaxRate < 0 || rawTaxRate > 100) {
    validationErrors.push('Tax rate must be between 0% and 100%.');
  }
  const safeTaxRate = Math.min(100, Math.max(0, rawTaxRate));
  const taxAmount = Math.round((taxableAmount * safeTaxRate) / 100);
  const total = Math.max(0, taxableAmount + taxAmount);
  const amountPaid = Math.max(0, Math.round(Number(input.amountPaid) || 0));
  const balanceDue = Math.max(0, total - amountPaid);

  return {
    subtotal,
    discount,
    taxableAmount,
    taxAmount,
    total,
    amountPaid,
    balanceDue,
    normalizedItems,
    validationErrors,
  };
}

export const DEFAULT_STUDIO_WHATSAPP = '+916361902619';

export function buildWhatsAppLink(phone?: string, message?: string): string {
  const rawPhone = (phone || '').trim() || DEFAULT_STUDIO_WHATSAPP;
  const digitsOnly = rawPhone.replace(/[^0-9]/g, '') || '916361902619';
  const defaultMsg =
    message ||
    'Hello Prithvi Editify, I would like to discuss a design or video editing project.';
  const encoded = encodeURIComponent(defaultMsg);
  return `https://wa.me/${digitsOnly}?text=${encoded}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
