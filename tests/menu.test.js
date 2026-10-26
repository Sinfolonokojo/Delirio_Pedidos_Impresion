import { test } from 'node:test';
import assert from 'node:assert/strict';
import { items, priceFor, findItems } from '../dist/menu.js';

test('pizza sizes match the source PDF pricing', () => {
  const classic = items.find(x => x.name === 'Margarita');
  const signature = items.find(x => x.name === 'Delirio');
  assert.deepEqual([0,1,2,3].map(size => priceFor(classic, size)), [11000,23000,50000,65000]);
  assert.deepEqual([0,1,2,3].map(size => priceFor(signature, size)), [16000,30000,57000,75000]);
  assert.equal(priceFor(items.find(x=>x.name==='Punta de anca'), 3),40000);
});

test('search matches names and ingredients without accents and handles empty results', () => {
  assert.ok(findItems('  jamon  ').some(x => x.name === 'Montadito jamón'));
  assert.ok(findItems('CAMARONES').some(x=>x.name==='Frutos del mar'));
  assert.equal(findItems('zzzzzz').length,0);
  assert.equal(findItems('').length,items.length);
});

test('all 13 pizza flavors and every source section are represented', () => {
  assert.equal(items.filter(x=>x.category==='pizzas').length,13);
  for (const category of ['entradas','pastas','asados','hamburguesas','infantil','bebidas','adiciones']) {
    assert.ok(items.some(x=>x.category===category), category);
  }
  assert.equal(new Set(items.map(x=>x.id)).size,items.length);
  for (const item of items) assert.ok(priceFor(item,0)>0,item.name);
});
