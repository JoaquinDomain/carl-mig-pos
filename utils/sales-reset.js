const SALES_TABLES = ['order_items', 'orders', 'products'];
const PRESERVE_ON_RESET = ['products'];
const EXPECTED_PHRASE = 'DELETE ALL SALES';

function createDeletePlan({ countByTable = {} } = {}) {
  return {
    tables: SALES_TABLES.map(name => ({ name, rows: countByTable[name] || 0 })),
    preserve: PRESERVE_ON_RESET,
    requiresTypedPhrase: true,
    expectedPhrase: EXPECTED_PHRASE
  };
}

function formatResetConfirmation(plan, phrase) {
  if (phrase !== plan.expectedPhrase) {
    throw new Error(`You must type ${plan.expectedPhrase} to confirm.`);
  }
  return `Reset confirmed: ${plan.tables.map(t => `${t.name} (${t.rows})`).join(', ')}.`;
}

async function executeDeletePlan(plan, supabase) {
  const result = {};
  for (const { name } of plan.tables) {
    const query = supabase.from(name).delete();
    if (typeof query.neq === 'function') {
      const { error } = await query.neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } else {
      const { error } = await query;
      if (error) throw error;
    }
    result[name] = plan.tables.find(t => t.name === name).rows;
  }
  return result;
}

module.exports = { createDeletePlan, executeDeletePlan, formatResetConfirmation };
