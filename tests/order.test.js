import {test} from 'node:test';
import assert from 'node:assert/strict';
import {items} from '../dist/menu.js';
import {lineTotal,orderTotal,validCart} from '../dist/order.js';
const id=name=>items.find(x=>x.name===name).id;
test('order totals include selected pizza size, additions, and quantities',()=>{
 const pizza={itemId:id('Delirio'),size:3,extras:[id('Tocineta'),id('Champiñones')],quantity:2,choice:''};
 const drink={itemId:id('Limonada tradicional'),size:0,extras:[],quantity:1,choice:''};
 assert.equal(lineTotal(pizza),178000);
 assert.equal(orderTotal([pizza,drink]),186000);
 assert.equal(orderTotal([]),0);
});
test('saved orders reject invalid products, negative quantities, and unknown variants',()=>{
 const valid={itemId:id('Margarita'),size:1,extras:[],quantity:1,choice:''};
 assert.deepEqual(validCart([valid,{...valid,itemId:'missing'},{...valid,quantity:-2},{...valid,size:9},{...valid,extras:['bad']},{...valid,choice:'<script>'}]),[valid]);
 assert.deepEqual(validCart(null),[]);
});
