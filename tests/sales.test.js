const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSaleTotals, calculateChange } = require('../utils/sales.js');

test('calculates VAT-inclusive order totals in cent-safe amounts', () => {
  assert.deepEqual(calculateSaleTotals([
    { price: 120, quantity: 2 },
    { price: 85.5, quantity: 1 },
  ]), { subtotal: 325.5, vat: 39.06, total: 364.56 });
});

test('calculates cash change and rejects insufficient tender', () => {
  assert.equal(calculateChange(500, 364.56), 135.44);
  assert.throws(() => calculateChange(300, 364.56), /Insufficient cash/);
});

test('rejects empty or invalid sale lines', () => {
  assert.throws(() => calculateSaleTotals([]), /at least one item/);
  assert.throws(() => calculateSaleTotals([{ price: 100, quantity: 0 }]), /Invalid sale item/);
});
