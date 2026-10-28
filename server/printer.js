import {Socket,isIP} from 'node:net';

export function printerConfig(input={}){
 if(!input.host)return null;
 const config={host:input.host,port:input.port??9100,columns:input.columns??42,cut:input.cut??true,timeoutMs:input.timeoutMs??5000};
 if(!isIP(config.host))throw new Error('PRINTER_HOST must be the printer IP address.');
 if(!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('Invalid PRINTER_PORT.');
 if(!Number.isInteger(config.columns)||config.columns<24||config.columns>48)throw new Error('PRINTER_COLUMNS must be 24–48.');
 if(!Number.isInteger(config.timeoutMs)||config.timeoutMs<100||config.timeoutMs>30000)throw new Error('PRINTER_TIMEOUT_MS must be 100–30000.');
 if(typeof config.cut!=='boolean')throw new Error('Invalid PRINTER_CUT.');
 return config;
}

// Conservative ASCII profile until this printer's code page is verified on paper.
// Never allow user notes, names or table labels to become ESC/POS commands.
function ascii(value){return String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/[^\x20-\x7e]/g,'?');}
function wrap(value,width){
 const words=ascii(value).trim().split(/\s+/),lines=[];let line='';
 for(let word of words){
  if(line&&line.length+word.length+1>width){lines.push(line);line='';}
  while(word.length>width){lines.push(word.slice(0,width));word=word.slice(width);}
  line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);return lines.join('\n');
}
export function encodeTicket(ticket,job,{columns=42,cut=true}={}){
 const separator='-'.repeat(columns),lines=[];
 const add=value=>lines.push(wrap(value,columns));
 add('DELIRIO - COCINA');add(ticket.kind==='addition'?'ADICION':'COMANDA');
 if(job.copy)add('COPIA - NO DUPLICAR PREPARACION');
 add(`MESA ${ticket.table}`);add(`Pedido #${ticket.number}`);
 add(new Date(ticket.createdAt).toLocaleString('es-CO',{timeZone:'America/Bogota'}));add(`Atendio: ${ticket.staff}`);
 if(ticket.kind==='addition')add('SOLO PLATOS AGREGADOS');lines.push(separator);
 for(const line of ticket.lines){
  add(`${line.quantity} x ${line.name}`);
  for(const detail of [line.sizeName,line.choice,line.extraNames?.length?`+ ${line.extraNames.join(', ')}`:''])if(detail)add(detail);
  if(line.notes)add(`NOTA: ${line.notes}`);lines.push(separator);
 }
 if(ticket.notes){add(`NOTAS: ${ticket.notes}`);lines.push(separator);}
 add(`Comanda ${ticket.id.slice(0,8)}`);add(`Envio ${job.id.slice(0,8)}`);add('Documento de cocina - No es factura');
 return Buffer.concat([Buffer.from([27,64,27,77,0]),Buffer.from(lines.join('\n')+'\n\n\n\n','ascii'),cut?Buffer.from([29,86,1]):Buffer.alloc(0)]);
}

export function sendToPrinter(bytes,config){
 return new Promise(resolve=>{
  const socket=new Socket();let writing=false,settled=false;
  const finish=(status,error)=>{
   if(settled)return;settled=true;clearTimeout(timer);socket.destroy();resolve({status,error});
  };
  const failure=()=>finish(writing?'uncertain':'failed',writing?'Envío interrumpido. Revisa la impresora antes de reenviar.':'No se pudo conectar con la impresora. Revisa cable, encendido e IP.');
  const timer=setTimeout(failure,config.timeoutMs);
  socket.on('error',failure);socket.on('close',()=>{if(!settled)failure();});
  socket.connect(config.port,config.host,()=>{
   writing=true;
   // A completed socket write is not an acknowledgement of paper or kitchen receipt.
   socket.end(bytes,error=>error?failure():finish('sent'));
  });
 });
}

export function createPrintQueue(store,config){
 let stopping=false,running=null;
 async function drain(){
  while(!stopping){
   const job=store.claimPrintJob();if(!job)break;
   let result;
   try{const bytes=encodeTicket(store.getTicket(job.ticketId),job,config);result=await sendToPrinter(bytes,config);}
   catch{result={status:'failed',error:'No se pudo preparar la comanda.'};}
   store.finishPrintJob(job.id,result.status,result.error);
  }
 }
 function kick(){if(!config||stopping||running)return;running=drain().catch(error=>console.error('Print queue stopped:',error)).finally(()=>{running=null;});}
 const timer=config?setInterval(kick,500):null;timer?.unref();
 kick();
 return {kick,close:async()=>{stopping=true;clearInterval(timer);await running;}};
}
