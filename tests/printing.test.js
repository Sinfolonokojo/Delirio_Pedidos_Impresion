import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createStore} from '../server/store.js';
import {createApp} from '../server/app.js';
import {sendToPrinter,encodeTicket,printerConfig} from '../server/printer.js';

const line={itemId:'item-48',size:0,extras:[],quantity:1,choice:'',notes:'Sin piña\u001b\u001dp'};
const order=(requestId)=>({requestId,table:'Peña 7',notes:'Primero bebidas',lines:[line]});
async function until(read,accept){for(let n=0;n<200;n++){const value=await read();if(accept(value))return value;await new Promise(r=>setTimeout(r,10));}assert.fail('Timed out waiting for printer state');}

test('configured tickets enqueue atomically, retries do not duplicate, and cancelled queued work never sends',()=>{
 const s=createStore(':memory:',{printingEnabled:true});
 try{
  const first=s.create(order('create-0001'),'Ana');
  assert.equal(first.ticket.delivery,'queued');
  assert.equal(s.create(order('create-0001'),'Ana').ticket.id,first.ticket.id);
  const addition=s.add(first.order.id,{requestId:'addition-0001',version:1,lines:[{...line,quantity:3}]},'Ana');
  const job=s.claimPrintJob();assert.equal(job.ticketId,first.ticket.id);
  assert.equal(s.claimPrintJob(),null,'a second sender must not claim while one is sending');
  s.finishPrintJob(job.id,'sent');
  s.status(first.order.id,{requestId:'cancel-0001',version:2,status:'cancelled'},'Caja');
  assert.equal(s.getTicket(addition.ticket.id).delivery,'cancelled');
  assert.equal(s.claimPrintJob(),null);
  assert.equal(s.getTicket(first.ticket.id).delivery,'sent');
  assert.throws(()=>s.enqueuePrint(first.ticket.id,{requestId:'reprint-001',lastJobId:job.id},'Ana'),{status:409});
 }finally{s.close();}
});

test('startup keeps preview history unqueued, resumes queued jobs and quarantines interrupted sends',()=>{
 const dir=mkdtempSync(join(tmpdir(),'delirio-queue-')),path=join(dir,'db.sqlite');let s;
 try{
  s=createStore(path);const old=s.create(order('old-order-01'),'Ana');s.close();
  s=createStore(path,{printingEnabled:true});
  assert.equal(s.getTicket(old.ticket.id).delivery,'not_configured');assert.equal(s.claimPrintJob(),null);
  const interrupted=s.create(order('new-order-01'),'Ana');const queued=s.create(order('new-order-02'),'Caja');
  const job=s.claimPrintJob();assert.equal(job.ticketId,interrupted.ticket.id);s.close();
  s=createStore(path,{printingEnabled:true});
  assert.equal(s.getTicket(interrupted.ticket.id).delivery,'uncertain');
  assert.equal(s.claimPrintJob().ticketId,queued.ticket.id);
 }finally{s?.close();rmSync(dir,{recursive:true,force:true});}
});

test('manual print is idempotent, rejects stale attempts and marks uncertain resends as copies',()=>{
 const s=createStore(':memory:',{printingEnabled:true});try{
  const {ticket}=s.create(order('order-print1'),'Ana');const job=s.claimPrintJob();
  s.finishPrintJob(job.id,'uncertain','Connection lost');
  const body={requestId:'retry-print1',lastJobId:job.id};
  const next=s.enqueuePrint(ticket.id,body,'Ana');
  assert.equal(next.job.copy,true);assert.equal(next.job.status,'queued');
  assert.equal(s.enqueuePrint(ticket.id,body,'Ana').job.id,next.job.id);
  assert.throws(()=>s.enqueuePrint(ticket.id,{...body,requestId:'retry-print2'},'Caja'),{status:409});
  assert.equal(s.getTicket(ticket.id).jobs.length,2);
 }finally{s.close();}
});

async function simulator(t){
 const received=[];let active=0,maxActive=0;const sockets=new Set();
 const server=createServer(socket=>{sockets.add(socket);active++;maxActive=Math.max(maxActive,active);const chunks=[];socket.on('data',b=>chunks.push(b));socket.on('end',()=>received.push(Buffer.concat(chunks)));socket.on('error',()=>{});socket.on('close',()=>{active--;sockets.delete(socket);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));});
 return {port:server.address().port,received,get maxActive(){return maxActive;}};
}
async function httpApp(t,printer){
 const app=createApp({pin:'246810',printer});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:'246810',name:'Ana'})});const cookie=login.headers.get('set-cookie').split(';')[0];
 return async(path,body,authenticated=true)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:authenticated?cookie:''},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};};
}

test('LAN API sends new orders and additions once, exposes truthful state, and authenticates explicit reprints',async t=>{
 const sim=await simulator(t);const api=await httpApp(t,{host:'127.0.0.1',port:sim.port,columns:42,cut:true,timeoutMs:1000});
 const initial=await api('/api/orders',order('tcp-order-01'));
 assert.equal(initial.ticket.delivery,'queued');
 await api('/api/orders',order('tcp-order-01'));
 const added=await api(`/api/orders/${initial.order.id}/add`,{requestId:'tcp-add-001',version:1,lines:[{...line,quantity:3,notes:'SOLO ADICION'}]});
 const delivered=await until(()=>api(`/api/tickets/${added.ticket.id}`),r=>r.ticket.delivery==='sent');
 assert.equal(delivered.ticket.delivery,'sent');
 await until(()=>sim.received.length,n=>n===2);
 assert.match(sim.received[0].toString('ascii'),/MESA Pena 7/);
 assert.match(sim.received[0].toString('ascii'),/1 x Limonada tradicional/);
 assert.ok(!sim.received[0].includes(Buffer.from([27,29])),'user text cannot inject printer controls');
 assert.ok(sim.received[0].subarray(-3).equals(Buffer.from([29,86,1])));
 assert.match(sim.received[1].toString('ascii'),/SOLO PLATOS AGREGADOS/);
 assert.match(sim.received[1].toString('ascii'),/3 x Limonada tradicional/);
 assert.doesNotMatch(sim.received[1].toString('ascii'),/1 x Limonada tradicional/);
 const body={requestId:'tcp-copy-001',lastJobId:delivered.ticket.jobs.at(-1).id};
 assert.equal((await api(`/api/tickets/${added.ticket.id}/print`,body,false)).status,401);
 const reprinted=await api(`/api/tickets/${added.ticket.id}/print`,body);
 assert.equal(reprinted.status,202);
 assert.equal((await api(`/api/tickets/${added.ticket.id}/print`,body)).job.id,reprinted.job.id);
 await until(()=>sim.received.length,n=>n===3);
 assert.match(sim.received[2].toString('ascii'),/COPIA - NO DUPLICAR PREPARACION/);
 assert.equal(sim.maxActive,1);
 const list=await api('/api/orders');assert.equal(list.orders[0].tickets[1].delivery,'sent');
});

test('refused LAN connection preserves pending order and requires explicit retry',async t=>{
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const api=await httpApp(t,{host:'127.0.0.1',port,timeoutMs:100});
 const result=await api('/api/orders',order('failed-net-1'));
 assert.equal(result.ticket.delivery,'queued');
 const failed=await until(()=>api(`/api/tickets/${result.ticket.id}`),r=>r.ticket.delivery==='failed');
 assert.equal(failed.ticket.jobs.length,1);
 assert.equal((await api(`/api/orders/${result.order.id}`)).order.status,'pending');
 assert.equal((await api(`/api/tickets/${result.ticket.id}`)).ticket.jobs.length,1);
});

test('stalled TCP write times out as uncertain instead of safely retryable',async t=>{
 const sockets=new Set();const server=createServer(socket=>{sockets.add(socket);socket.pause();socket.on('error',()=>{});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));});
 const result=await sendToPrinter(Buffer.alloc(32*1024*1024,65),{host:'127.0.0.1',port:server.address().port,timeoutMs:100});
 assert.equal(result.status,'uncertain');
});

test('reset during socket.end callback is uncertain, never reported as sent',async t=>{
 const server=createServer(socket=>{socket.on('error',()=>{});socket.once('data',()=>socket.resetAndDestroy());});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const result=await sendToPrinter(Buffer.alloc(32*1024*1024,65),{host:'127.0.0.1',port:server.address().port,timeoutMs:1000});
 assert.equal(result.status,'uncertain');
});

test('paper profile wraps long notes, can disable cutter, and refuses malformed network settings',()=>{
 const bytes=encodeTicket({id:'ticket-id',number:1,table:'8',staff:'Ana',createdAt:'2026-10-27T12:00:00Z',kind:'order',notes:'x'.repeat(100),lines:[{quantity:1,name:'Limonada tradicional',notes:'Sin piña',extraNames:[]}]},{id:'job-id',copy:false},{columns:32,cut:false});
 const text=bytes.subarray(5).toString('ascii');
 assert.ok(text.split('\n').every(line=>line.length<=32));assert.match(text,/Sin pina/);
 assert.ok(!bytes.includes(Buffer.from([29,86])));
 for(const input of [{host:'example.com'},{host:'127.0.0.1',port:0},{host:'127.0.0.1',timeoutMs:0},{host:'127.0.0.1',columns:0}])assert.throws(()=>printerConfig(input));
});
