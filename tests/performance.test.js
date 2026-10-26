import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldUseLite,renderBudget} from '../dist/performance.js';

test('budget hardware, data saving, slow connections and reduced motion choose lite mode',()=>{
  for(const signals of [{memory:2},{memory:4},{cores:4},{saveData:true},{connection:'2g'},{connection:'slow-2g'},{connection:'3g'},{reducedMotion:true}]) {
    assert.equal(shouldUseLite(signals),true,JSON.stringify(signals));
  }
});
test('missing optional browser signals do not break the default experience',()=>{
  assert.equal(shouldUseLite({}),false);
  assert.equal(shouldUseLite({memory:8,cores:8,connection:'4g'}),false);
  assert.equal(shouldUseLite({memory:0,cores:0}),false);
});
test('lite mode reduces rendering work without removing either pasta shape or toppings',()=>{
  const lite=renderBudget(true),full=renderBudget(false);
  for(const key of ['speckles','cheeseSpots','toppings','cheeseToppings','spaghetti','fettuccine']) {
    assert.ok(lite[key]>0&&lite[key]<full[key],key);
  }
});
