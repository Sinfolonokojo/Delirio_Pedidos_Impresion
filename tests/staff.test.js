import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
const pizza={itemId:'item-10',size:3,extras:['item-36','item-44'],quantity:2,choice:'',notes:'Sin cebolla'};
const drink={itemId:'item-48',size:0,extras:[],quantity:1,choice:'',notes:''};
const payload=(key='request-0001')=>({requestId:key,table:'7',notes:'Primero las bebidas',lines:[pizza,drink]});
async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'delirio-test-'));const path=join(dir,'orders.sqlite');
 let app;let base;
 async function start(){app=createApp({dbPath:path,pin:'246810'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
 await start();t.after(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
 async function request(url,body,cookie='',method=body?'POST':'GET',headers={}){const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 async function login(name='Ana'){return (await request('/api/login',{pin:'246810',name})).cookie;}
 return {get base(){return base;},request,login,restart:async()=>{await app.close();await start();}};
}
test('staff authentication protects saved orders and rejects cross-origin mutations',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request('/api/orders')).status,401);
 assert.equal((await f.request('/api/login',{pin:'wrong',name:'Ana'})).status,401);
 const c=await f.login();assert.ok(c);
 assert.equal((await f.request('/api/orders',payload(),c,'POST',{Origin:'https://elsewhere.invalid'})).status,403);
 assert.equal((await f.request('/api/orders',undefined,c)).body.orders.length,0);
 await f.request('/api/logout',{},c);
 assert.equal((await f.request('/api/orders',undefined,c)).status,401);
});
test('phones and caja share authoritative totals and durable pending orders',async t=>{
 const f=await fixture(t);const a=await f.login();const b=await f.login('Caja');
 const created=await f.request('/api/orders',{...payload(),total:1},a);
 assert.equal(created.status,201);const o=created.body.order;
 assert.equal(o.total,186000);assert.equal(o.status,'pending');assert.equal(o.staff,'Ana');assert.equal(o.version,1);
 assert.equal(created.body.ticket.delivery,'not_configured');
 assert.equal((await f.request('/api/orders',undefined,b)).body.orders[0].id,o.id);
 await f.restart();const c=await f.login();assert.equal((await f.request('/api/orders',undefined,c)).body.orders[0].total,186000);
});
test('retrying save does not duplicate orders or tickets and changed retries conflict',async t=>{
 const f=await fixture(t);const c=await f.login();
 const first=await f.request('/api/orders',payload(),c);const retry=await f.request('/api/orders',payload(),c);
 assert.equal(retry.body.order.id,first.body.order.id);assert.equal(retry.body.ticket.id,first.body.ticket.id);
 assert.equal((await f.request('/api/orders',{...payload(),table:'8'},c)).status,409);
 assert.equal((await f.request('/api/orders',undefined,c)).body.orders.length,1);
});
test('invalid dish options and quantities never create partial orders',async t=>{
 const f=await fixture(t);const c=await f.login();
 const invalid=[{...pizza,quantity:0},{...pizza,quantity:1.5},{...pizza,itemId:'missing'},{...pizza,size:7},{...drink,extras:['item-36']},{...drink,choice:'Spaghetti'},{...pizza,extras:['item-36','item-36']},{...pizza,notes:'x'.repeat(301)}];
 for(const line of invalid)assert.equal((await f.request('/api/orders',{...payload(),lines:[line]},c)).status,400);
 assert.equal((await f.request('/api/orders',{...payload(),table:''},c)).status,400);
 assert.equal((await f.request('/api/orders',{...payload(),lines:[]},c)).status,400);
 assert.equal((await f.request('/api/orders',undefined,c)).body.orders.length,0);
});
test('additions print only new dishes and stale payment cannot close a changed order',async t=>{
 const f=await fixture(t);const a=await f.login();const b=await f.login('Caja');
 const {body:{order}}=await f.request('/api/orders',payload(),a);
 const addition={requestId:'addition-001',version:1,lines:[drink]};
 const added=await f.request(`/api/orders/${order.id}/add`,addition,a);
 assert.equal(added.body.order.total,194000);assert.equal(added.body.order.version,2);
 assert.equal(added.body.ticket.kind,'addition');assert.equal(added.body.ticket.lines.length,1);assert.equal(added.body.ticket.lines[0].name,'Limonada tradicional');
 const retry=await f.request(`/api/orders/${order.id}/add`,addition,a);assert.equal(retry.body.ticket.id,added.body.ticket.id);
 assert.equal((await f.request(`/api/orders/${order.id}/status`,{requestId:'payment-001',version:1,status:'paid'},b)).status,409);
 const paid=await f.request(`/api/orders/${order.id}/status`,{requestId:'payment-002',version:2,status:'paid'},b);
 assert.equal(paid.body.order.status,'paid');
 assert.equal((await f.request(`/api/orders/${order.id}/add`,{...addition,requestId:'addition-002',version:3},a)).status,409);
 const original=await f.request(`/api/tickets/${order.ticketIds[0]}`,undefined,a);
 assert.equal(original.body.ticket.lines.length,2);assert.equal(original.body.ticket.delivery,'not_configured');
});
test('simultaneous changes preserve one complete version and return a conflict to the other device',async t=>{
 const f=await fixture(t);const c=await f.login();const {body:{order}}=await f.request('/api/orders',payload(),c);
 const responses=await Promise.all(['a','b'].map(key=>f.request(`/api/orders/${order.id}/add`,{requestId:`concurrent-${key}`,version:1,lines:[drink]},c)));
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const saved=(await f.request(`/api/orders/${order.id}`,undefined,c)).body.order;
 assert.equal(saved.total,194000);assert.equal(saved.lines.length,3);assert.equal(saved.ticketIds.length,2);
});

test('public menu and staff assets are served but private database and source files are not',async t=>{
 const f=await fixture(t);
 for(const url of ['/','/staff.html','/staff.js','/ticket.html'])assert.equal((await fetch(f.base+url)).status,200);
 for(const url of ['/server/store.js','/data/orders.sqlite','/.env','/../package.json'])assert.equal((await fetch(f.base+url)).status,404);
});

test('split UTF-8 request bytes preserve accents and retry without duplicating the order',async t=>{
 const f=await fixture(t);const c=await f.login();const input={...payload('unicode-0001'),table:'Peña',notes:'Sin piña, por favor'};
 const bytes=Buffer.from(JSON.stringify(input));const split=bytes.indexOf(Buffer.from('ñ'))+1;
 const {request}=await import('node:http');
 const response=await new Promise((resolve,reject)=>{
  const req=request(f.base+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json',Cookie:c}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));
  });req.on('error',reject);req.write(bytes.subarray(0,split));setTimeout(()=>req.end(bytes.subarray(split)),10);
 });
 assert.equal(response.status,201);assert.equal(response.body.order.table,'Peña');assert.equal(response.body.order.notes,'Sin piña, por favor');
 const retry=await f.request('/api/orders',input,c);assert.equal(retry.status,201);assert.equal(retry.body.order.id,response.body.order.id);
 assert.equal((await f.request('/api/orders',undefined,c)).body.orders.length,1);
});
