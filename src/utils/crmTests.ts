/**
 * Automated Verification Suite for Prithvi Editify CRM (Supabase Edition)
 * Tests invoice math, INR formatting, WhatsApp click-to-chat generation,
 * seed catalog integrity, and slug generation.
 */

import assert from 'node:assert/strict';
import { calculateInvoiceTotals, formatINR, buildWhatsAppLink, slugify } from './formatters';
import { SEED_SERVICES, SEED_PORTFOLIO } from './seedData';
import {
  detectMediaCategory,
  buildSafeStoragePath,
  validateMediaFile,
} from './mediaValidation';

// 1. Test Invoice Calculation (Subtotal, Discount, Tax, Paid, Balance Due)
const calc1 = calculateInvoiceTotals({
  items: [
    { quantity: 3, unitPrice: 500 }, // 1500
    { quantity: 2, unitPrice: 650 }, // 1300
  ],
  discount: 300, // Taxable = 2500
  taxRate: 18, // Tax = 450, Total = 2950
  amountPaid: 1000, // Balance = 1950
});

assert.equal(calc1.subtotal, 2800, 'Subtotal should be 2800');
assert.equal(calc1.discount, 300, 'Discount should be 300');
assert.equal(calc1.taxableAmount, 2500, 'Taxable amount should be 2500');
assert.equal(calc1.taxAmount, 450, '18% GST tax amount should be 450');
assert.equal(calc1.total, 2950, 'Total should be 2950');
assert.equal(calc1.balanceDue, 1950, 'Balance due should be 1950');

// 2. Test Discount Capping & Non-Negative Balance
const calc2 = calculateInvoiceTotals({
  items: [{ quantity: 1, unitPrice: 400 }],
  discount: 900,
  taxRate: 0,
  amountPaid: 500,
});
assert.equal(calc2.total, 0, 'Discount exceeding subtotal must floor total at 0');
assert.equal(calc2.balanceDue, 0, 'Balance due must never be negative');

// 3. Test INR Currency Formatting
const inr = formatINR(12500);
assert.ok(inr.includes('12,500'), `Formatted INR should include 12,500, got ${inr}`);

// 4. Test WhatsApp Link Builder
const waLink = buildWhatsAppLink('+91 98765-43210', 'Hello Prithvi Editify');
assert.equal(
  waLink,
  'https://wa.me/919876543210?text=Hello%20Prithvi%20Editify',
  'WhatsApp URL must strip non-digits and encode message'
);

// 5. Test Seed Services Count & Starting Prices
assert.equal(SEED_SERVICES.length, 10, 'Must have all 10 required starting-price services');
assert.ok(
  SEED_PORTFOLIO.every((item) => item.isSampleContent === true),
  'All initial sample portfolio items must be flagged as demonstration content'
);

// 6. Test Slug Generation
assert.equal(slugify('Banner / Digital Flyer'), 'banner-digital-flyer');

// 7. Test Media Category Detection & Safe Storage Path Generation
assert.equal(detectMediaCategory('image/png', 'thumbnail.png'), 'image');
assert.equal(detectMediaCategory('video/mp4', 'reel_edit.mp4'), 'video');
assert.equal(detectMediaCategory('application/pdf', 'brand_guide.pdf'), 'pdf');
assert.equal(detectMediaCategory('application/zip', 'source_assets.zip'), 'document');

const safePath = buildSafeStoragePath('../../Unsafe File Name!! (Final).MP4', 'portfolio');
assert.ok(
  safePath.startsWith('portfolio/') && safePath.endsWith('.mp4') && !safePath.includes('..'),
  `Storage path must be sanitized: ${safePath}`
);

const blockedCheck = validateMediaFile(
  { name: 'payload.exe', size: 1024, type: 'application/octet-stream' } as File,
  'portfolio-media'
);
assert.equal(blockedCheck.valid, false, 'Executable extensions must be rejected');

console.log('ALL AUTOMATED SUPABASE CRM & MEDIA SYSTEM TESTS PASSED (7/7 suites)');
