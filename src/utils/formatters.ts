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
  items: { quantity: number; unitPrice: number }[];
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
}

export function calculateInvoiceTotals(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const subtotal = input.items.reduce((sum, item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return sum + Math.round(qty * price);
  }, 0);

  const discount = Math.min(subtotal, Math.max(0, Math.round(Number(input.discount) || 0)));
  const taxableAmount = Math.max(0, subtotal - discount);
  const safeTaxRate = Math.min(100, Math.max(0, Number(input.taxRate) || 0));
  const taxAmount = Math.round((taxableAmount * safeTaxRate) / 100);
  const total = taxableAmount + taxAmount;
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
  };
}

export function buildWhatsAppLink(phone: string, message?: string): string {
  const digitsOnly = (phone || '').replace(/[^0-9]/g, '');
  const defaultMsg =
    message ||
    'Hello Prithvi Editify, I would like to discuss a design or video editing project.';
  const encoded = encodeURIComponent(defaultMsg);
  if (!digitsOnly) {
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${digitsOnly}?text=${encoded}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
