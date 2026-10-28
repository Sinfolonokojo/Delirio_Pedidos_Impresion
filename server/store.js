import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {items,priceFor,sizes} from '../dist/menu.js';

export function fail(status,message){throw Object.assign(new Error(message),{status});}
function text(value,max,label,required=false){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,`Revisa ${label}.`);
 return value.trim();
}
function linesFrom(value){
 if(!Array.isArray(value)||!value.length||value.length>100)fail(400,'Agrega entre 1 y 100 platos.');
 return value.map(line=>{
  if(!line||typeof line!=='object')fail(400,'Plato inválido.');
  const item=items.find(x=>x.id===line.itemId);
  if(!item||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)fail(400,'Revisa el plato y la cantidad (1–99).');
  const pizza=item.category==='pizzas',pasta=item.group==='Pastas',juice=item.group==='Jugos naturales';
  if(!Number.isInteger(line.size)||line.size<0||line.size>(pizza?3:0))fail(400,'Tamaño inválido.');
  const choices=pasta?['Spaghetti','Fetuccini']:juice?['Mango','Fresa','Mora','Maracumango']:[''];
  if(!choices.includes(line.choice))fail(400,'Selecciona una opción válida para el plato.');
  if(!Array.isArray(line.extras)||new Set(line.extras).size!==line.extras.length||line.extras.length>20)fail(400,'Adiciones inválidas.');
  const extras=line.extras.map(id=>items.find(x=>x.id===id));
  if(extras.some(x=>!x||x.category!=='adiciones'||x.name.includes('papas'))||(!(pizza||pasta)&&extras.length))fail(400,'Estas adiciones no corresponden al plato.');
  const unitPrice=priceFor(item,line.size)+extras.reduce((sum,x)=>sum+x.price,0);
  return {itemId:item.id,name:item.name,size:line.size,sizeName:pizza?sizes[line.size].name:'',choice:line.choice,extras:line.extras,extraNames:extras.map(x=>x.name),quantity:line.quantity,notes:text(line.notes??'',300,'las notas del plato'),unitPrice,total:unitPrice*line.quantity};
 });
}
export function createStore(path,{printingEnabled=false}={}){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number INTEGER UNIQUE NOT NULL, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, hash TEXT NOT NULL, response TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS print_jobs (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS print_jobs_ticket ON print_jobs(ticket_id);
 CREATE INDEX IF NOT EXISTS print_jobs_status ON print_jobs(status);`);
 // One application instance owns this queue. An interrupted write must never replay automatically.
 for(const row of db.prepare("SELECT data FROM print_jobs WHERE status='sending'").all()){
  const job=JSON.parse(row.data);job.status='uncertain';job.error='El servidor se reinició durante el envío. Revisa la impresora antes de reenviar.';job.finishedAt=new Date().toISOString();writeJob(job);
 }
 const read=(table,id)=>{const row=db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);if(!row)fail(404,'No encontramos este pedido o comanda.');return JSON.parse(row.data);};
 function mutate(action,body,staff,operation){
  if(!body||typeof body!=='object')fail(400,'Solicitud inválida.');
  if(typeof body.requestId!=='string'||!/^[\w-]{8,100}$/.test(body.requestId))fail(400,'Identificador de envío inválido.');
  const hash=createHash('sha256').update(JSON.stringify({action,body,staff})).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try{
   const prior=db.prepare('SELECT hash,response FROM requests WHERE id=?').get(body.requestId);
   if(prior){if(prior.hash!==hash)fail(409,'Este envío ya existe con otros datos. Abre el pedido guardado.');db.exec('COMMIT');return JSON.parse(prior.response);}
   const result=operation();
   db.prepare('INSERT INTO requests VALUES (?,?,?)').run(body.requestId,hash,JSON.stringify(result));
   db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function ticket(order,lines,kind,staff){
  const record={id:randomUUID(),orderId:order.id,number:order.number,table:order.table,staff,createdAt:new Date().toISOString(),notes:order.notes,kind,lines,delivery:'not_configured'};
  db.prepare('INSERT INTO tickets VALUES (?,?)').run(record.id,JSON.stringify(record));order.ticketIds.push(record.id);
  if(printingEnabled)newJob(record.id,false,staff);
  return getTicket(record.id);
 }
 function jobsFor(id){return db.prepare('SELECT data FROM print_jobs WHERE ticket_id=? ORDER BY rowid').all(id).map(row=>JSON.parse(row.data));}
 function getTicket(id){const record=read('tickets',id),jobs=jobsFor(id);return {...record,jobs,delivery:jobs.at(-1)?.status||record.delivery};}
 function withTickets(order){return {...order,tickets:order.ticketIds.map(id=>{const t=getTicket(id);return {id,delivery:t.delivery};})};}
 function writeJob(job){db.prepare('UPDATE print_jobs SET status=?,data=? WHERE id=?').run(job.status,JSON.stringify(job),job.id);}
 function newJob(ticketId,copy,staff){
  const job={id:randomUUID(),ticketId,copy,staff,status:'queued',createdAt:new Date().toISOString()};
  db.prepare('INSERT INTO print_jobs VALUES (?,?,?,?)').run(job.id,ticketId,job.status,JSON.stringify(job));return job;
 }
 function write(order){db.prepare('UPDATE orders SET data=? WHERE id=?').run(JSON.stringify(order),order.id);}
 function current(id,body){const order=read('orders',id);if(order.status!=='pending')fail(409,'El pedido ya está cerrado.');if(body.version!==order.version)fail(409,'El pedido cambió en otro dispositivo. Actualiza y revisa el total antes de continuar.');return order;}
 return {
  close:()=>db.close(),
  list:()=>db.prepare('SELECT data FROM orders ORDER BY number DESC').all().map(row=>JSON.parse(row.data)).filter((o,i)=>o.status==='pending'||i<100).map(withTickets),
  get:id=>withTickets(read('orders',id)),getTicket,
  enqueuePrint:(id,body,staff)=>mutate(`print:${id}`,body,staff,()=>{
   if(!printingEnabled)fail(409,'La impresora LAN aún no está configurada.');
   const record=getTicket(id),order=read('orders',record.orderId),last=record.jobs.at(-1);
   if(order.status==='cancelled')fail(409,'El pedido está cancelado.');
   if(body.lastJobId!==(last?.id??null)||['queued','sending'].includes(last?.status))fail(409,'El envío cambió. Actualiza la comanda antes de reenviar.');
   const job=newJob(id,record.jobs.some(j=>j.copy||['sent','uncertain'].includes(j.status)),staff);return {job};
  }),
  claimPrintJob:()=>{
   if(!printingEnabled)return null;
   db.exec('BEGIN IMMEDIATE');
   try{
    const sending=db.prepare("SELECT id FROM print_jobs WHERE status='sending' LIMIT 1").get();
    const row=sending?null:db.prepare("SELECT data FROM print_jobs WHERE status='queued' ORDER BY rowid LIMIT 1").get();
    const job=row?JSON.parse(row.data):null;
    if(job){job.status='sending';job.startedAt=new Date().toISOString();writeJob(job);}
    db.exec('COMMIT');return job;
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  finishPrintJob:(id,status,error)=>{
   if(!['sent','failed','uncertain'].includes(status))throw new Error('Invalid delivery result');
   const job=read('print_jobs',id);if(job.status!=='sending')throw new Error('Job is not sending');
   job.status=status;job.finishedAt=new Date().toISOString();if(error)job.error=error;writeJob(job);
  },
  create:(body,staff)=>mutate('create',body,staff,()=>{
   const lines=linesFrom(body.lines);const order={id:randomUUID(),number:Number(db.prepare('SELECT COALESCE(MAX(number),0)+1 AS n FROM orders').get().n),table:text(body.table,30,'la mesa',true),staff,notes:text(body.notes??'',500,'las notas'),lines,total:lines.reduce((s,l)=>s+l.total,0),status:'pending',version:1,createdAt:new Date().toISOString(),ticketIds:[]};
   const printed=ticket(order,lines,'order',staff);
   db.prepare('INSERT INTO orders VALUES (?,?,?)').run(order.id,order.number,JSON.stringify(order));return {order,ticket:printed};
  }),
  add:(id,body,staff)=>mutate(`add:${id}`,body,staff,()=>{
   const order=current(id,body);const lines=linesFrom(body.lines);if(order.lines.length+lines.length>200)fail(400,'Este pedido ya tiene demasiados platos.');
   order.lines.push(...lines);order.total+=lines.reduce((s,l)=>s+l.total,0);order.version++;
   const printed=ticket(order,lines,'addition',staff);write(order);return {order,ticket:printed};
  }),
  status:(id,body,staff)=>mutate(`status:${id}`,body,staff,()=>{
   const order=current(id,body);if(!['paid','cancelled'].includes(body.status))fail(400,'Estado inválido.');
   order.status=body.status;order.version++;order.closedAt=new Date().toISOString();order.closedBy=staff;
   if(order.status==='cancelled')for(const ticketId of order.ticketIds)for(const job of jobsFor(ticketId))if(job.status==='queued'){
    job.status='cancelled';job.finishedAt=order.closedAt;writeJob(job);
   }
   write(order);return {order};
  })
 };
}
