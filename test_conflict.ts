interface AnalyzedItem {
  modified: Set<string>;
  referenced: Set<string>;
}

function analyzeItem(item: any): AnalyzedItem {
  const modified = new Set<string>();
  const referenced = new Set<string>();

  try {
    const payload = JSON.parse(item.payload);

    if (item.entityType === 'Customer') {
      if (payload.id) modified.add(payload.id);
    } else if (item.entityType === 'Product') {
      if (payload.id) modified.add(payload.id);
      if (payload.productId) modified.add(payload.productId); // for stock update
    } else if (item.entityType === 'Sale') {
      if (payload.id) modified.add(payload.id); // Sale ID
      if (payload.customerId) referenced.add(payload.customerId);
      if (Array.isArray(payload.items)) {
        payload.items.forEach((i: any) => {
          if (i.productId) referenced.add(i.productId);
        });
      }
    }
  } catch (e) {
    // ignore
  }

  return { modified, referenced };
}

function hasConflict(a: AnalyzedItem, b: AnalyzedItem) {
  for (const id of a.modified) if (b.modified.has(id)) return true;
  for (const id of a.modified) if (b.referenced.has(id)) return true;
  for (const id of a.referenced) if (b.modified.has(id)) return true;
  return false;
}

const sale1 = { entityType: 'Sale', payload: JSON.stringify({ id: 's1', customerId: 'c1', items: [{productId: 'p1'}] }) };
const sale2 = { entityType: 'Sale', payload: JSON.stringify({ id: 's2', customerId: 'c1', items: [{productId: 'p1'}] }) };
const customer1 = { entityType: 'Customer', payload: JSON.stringify({ id: 'c1' }) };

console.log("sale1 vs sale2:", hasConflict(analyzeItem(sale1), analyzeItem(sale2))); // expect false
console.log("customer1 vs sale1:", hasConflict(analyzeItem(customer1), analyzeItem(sale1))); // expect true
