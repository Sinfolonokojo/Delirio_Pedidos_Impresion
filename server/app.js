import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createStore,fail} from './store.js';
import {printerConfig,createPrintQueue} from './printer.js';
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.pdf':'application/pdf'};
const digest=value=>Buffer.from(String(value));
export function createApp({dbPath,pin,secureCookies=false,publicOrigin,printer}={}){
 if(typeof pin!=='string'||pin.length<6)throw new Error('Set STAFF_PIN to an access code of at least 6 characters.');
 const config=printerConfig(printer),printerState=config?'configured':'not_configured';
 const store=createStore(dbPath||':memory:',{printingEnabled:!!config});const queue=createPrintQueue(store,config);
 const sessions=new Map(),attempts=new Map();
 const cookie=(token,age)=>`delirio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookies?'; Secure':''}`;
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 async function body(req){
  if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Usa JSON para enviar el pedido.');
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)fail(413,'Pedido demasiado grande.');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'Datos inválidos.');}
 }
 function session(req){
  const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('delirio_session='))?.slice(16);
  const value=sessions.get(token);if(!value||value.expires<Date.now()){sessions.delete(token);fail(401,'Ingresa con el código del equipo.');}return {...value,token};
 }
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  try{
   const url=new URL(req.url,'http://localhost');const path=url.pathname;
   if(path.startsWith('/api/')){
    if(!['GET','POST'].includes(req.method))fail(405,'Método no permitido.');
    if(req.method==='POST'){
     const origin=publicOrigin||`${secureCookies?'https':'http'}://${req.headers.host}`;
     if((req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site')fail(403,'Abre el sistema desde su dirección habitual.');
    }
    if(path==='/api/login'&&req.method==='POST'){
     const key=req.socket.remoteAddress;const now=Date.now();let attempt=attempts.get(key);
     if(!attempt||attempt.until<now){attempt={count:0,until:now+60000};attempts.set(key,attempt);}
     if(attempt.count>=10)fail(429,'Espera un minuto antes de intentar de nuevo.');attempt.count++;
     const input=await body(req);const expected=digest(pin),actual=digest(input?.pin??'');
     if(actual.length!==expected.length||!timingSafeEqual(actual,expected))fail(401,'Código incorrecto.');
     if(typeof input.name!=='string'||!input.name.trim()||input.name.length>60)fail(400,'Escribe tu nombre (máximo 60 caracteres).');
     const token=randomBytes(32).toString('hex');sessions.set(token,{name:input.name.trim(),expires:now+12*60*60*1000});attempts.delete(key);
     res.setHeader('Set-Cookie',cookie(token,43200));return send(res,200,{name:input.name.trim()});
    }
    const user=session(req);
    if(path==='/api/session'&&req.method==='GET')return send(res,200,{name:user.name,printer:printerState});
    if(path==='/api/logout'&&req.method==='POST'){sessions.delete(user.token);res.setHeader('Set-Cookie',cookie('',0));return send(res,200,{ok:true});}
    if(path==='/api/orders'){
     if(req.method==='GET')return send(res,200,{orders:store.list(),printer:printerState});
     const result=store.create(await body(req),user.name);send(res,201,result);queue.kick();return;
    }
    let match=path.match(/^\/api\/orders\/([\w-]+)(?:\/(add|status))?$/);
    if(match){if(!match[2]&&req.method==='GET')return send(res,200,{order:store.get(match[1])});if(match[2]&&req.method==='POST'){const result=store[match[2]](match[1],await body(req),user.name);send(res,200,result);queue.kick();return;}}
    match=path.match(/^\/api\/tickets\/([\w-]+)(?:\/(print))?$/);
    if(match){
     if(!match[2]&&req.method==='GET'){const ticket=store.getTicket(match[1]);return send(res,200,{ticket,printer:printerState,orderStatus:store.get(ticket.orderId).status});}
     if(match[2]&&req.method==='POST'){const result=store.enqueuePrint(match[1],await body(req),user.name);send(res,202,result);queue.kick();return;}
    }
    fail(404,'Ruta no encontrada.');
   }
   if(!['GET','HEAD'].includes(req.method))fail(405,'Método no permitido.');
   const target=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path==='/staff'?'/staff.html':path));
   if(!target.startsWith(root+sep)||!mime[extname(target)])fail(404,'Archivo no encontrado.');
   let content;try{content=await readFile(target);}catch{fail(404,'Archivo no encontrado.');}
   res.writeHead(200,{'Content-Type':mime[extname(target)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){if(!error.status)console.error(error);if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'No se pudo guardar. Conserva el pedido e intenta de nuevo.'});else res.end();}
 });
 const cleanup=setInterval(()=>{const now=Date.now();for(const [key,s] of sessions)if(s.expires<now)sessions.delete(key);for(const [key,a] of attempts)if(a.until<now)attempts.delete(key);},60000);cleanup.unref();
 return {server,close:async()=>{clearInterval(cleanup);await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await queue.close();store.close();}};
}
