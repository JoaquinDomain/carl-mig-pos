const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeletePlan, executeDeletePlan, formatResetConfirmation } = require('../utils/sales-reset.js');

test('builds a delete plan that empties sales tables while preserving products', () => {
  const plan = createDeletePlan({ countByTable: { orders: 12, order_items: 30, products: 8 } });
  assert.deepEqual(plan.tables.map(t => t.name), ['order_items', 'orders', 'products']);
  assert.deepEqual(plan.preserve, ['products']);
  assert.ok(plan.requiresTypedPhrase);
  assert.equal(plan.expectedPhrase, 'DELETE ALL SALES');
});

test('executeDeletePlan runs the table deletes in dependency order', async () => {
  const calls = [];
  const supabase = {
    from(name) {
      return {
        delete() {
          return {
            neq(field, value) { calls.push(name + ':neq(' + field + ',' + value + ')'); return Promise.resolve({ error: null }); }
          };
        }
      };
    }
  };
  const plan = createDeletePlan({ countByTable: { orders: 1, order_items: 1, products: 1 } });
  const result = await executeDeletePlan(plan, supabase);
  assert.deepEqual(calls, [
    'order_items:neq(id,00000000-0000-0000-0000-000000000000)',
    'orders:neq(id,00000000-0000-0000-0000-000000000000)',
    'products:neq(id,00000000-0000-0000-0000-000000000000)'
  ]);
  assert.deepEqual(result, { order_items: 1, orders: 1, products: 1 });
});

test('rejects reset when the confirmation phrase is incorrect', () => {
  const plan = createDeletePlan({ countByTable: { orders: 1, order_items: 1, products: 1 } });
  assert.throws(() => formatResetConfirmation(plan, 'delete all sales'), /DELETE ALL SALES/);
  assert.doesNotThrow(() => formatResetConfirmation(plan, 'DELETE ALL SALES'));
});
