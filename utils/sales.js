function toMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateSaleTotals(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('A sale must contain at least one item.');
  }

  const subtotal = items.reduce((sum, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Invalid sale item.');
    }
    return sum + price * quantity;
  }, 0);

  const roundedSubtotal = toMoney(subtotal);
  const vat = toMoney(roundedSubtotal * 0.12);
  return { subtotal: roundedSubtotal, vat, total: toMoney(roundedSubtotal + vat) };
}

function calculateChange(amountTendered, total) {
  const tendered = toMoney(amountTendered);
  const amountDue = toMoney(total);
  if (!Number.isFinite(tendered) || tendered < amountDue) {
    throw new Error('Insufficient cash tendered.');
  }
  return toMoney(tendered - amountDue);
}

module.exports = { calculateSaleTotals, calculateChange, toMoney };
