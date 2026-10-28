import {escapeHTML as e,lineDetails,requestId,deliveryLabel} from './staff-utils.js';
const params=new URLSearchParams(location.search),id=params.get('id'),previewCopy=params.get('copy')==='1';
const ticket=document.querySelector('#ticket'),notice=document.querySelector('#notice'),sendButton=document.querySelector('#send-printer');
let current=null,polling=false,busy=false,pending=null,deviceCopy=false;
const storageKey=`delirio-print-${id}`;
try{const stored=JSON.parse(sessionStorage.getItem(storageKey));if(stored&&typeof stored.requestId==='string')pending=stored;}catch{}
function persist(){try{if(pending)sessionStorage.setItem(storageKey,JSON.stringify(pending));else sessionStorage.removeItem(storageKey);}catch{}}
document.querySelector('#paper').onchange=event=>ticket.classList.toggle('narrow',event.target.value==='58');
document.querySelector('#print').onclick=()=>{
 if(current?.printer==='configured'&&!confirm('Esto abre la impresión del dispositivo y podría duplicar la comanda de cocina. ¿Continuar?'))return;
 if(current?.ticket.jobs?.some(job=>['queued','sending','sent','uncertain'].includes(job.status))){deviceCopy=true;render();}
 window.print();
};
function render(){
 const {ticket:t,printer,orderStatus}=current,last=t.jobs?.at(-1),copy=previewCopy||last?.copy||deviceCopy;
 document.title=`Comanda ${t.number} · Mesa ${t.table}`;
 ticket.innerHTML=`<h1>DELIRIO</h1><p class="center">COCINA · ${copy?'COPIA / REIMPRESIÓN':t.kind==='addition'?'ADICIÓN':'COMANDA'}</p><h2>MESA ${e(t.table)}</h2><p><b>Pedido #${t.number}</b></p><p>${e(new Date(t.createdAt).toLocaleString('es-CO',{timeZone:'America/Bogota'}))}</p><p>Atendió: ${e(t.staff)}</p>${t.kind==='addition'?'<h3>SOLO PLATOS AGREGADOS</h3>':''}${copy?'<h3>COPIA · NO DUPLICAR PREPARACIÓN</h3>':''}<div class="divider"></div>${t.lines.map(l=>`<div class="dish"><strong>${l.quantity} × ${e(l.name)}</strong><p>${e(lineDetails(l))}</p>${l.notes?`<p class="notes">${e(l.notes)}</p>`:''}</div>`).join('')}${t.notes?`<div class="divider"></div><p class="notes">NOTAS: ${e(t.notes)}</p>`:''}<div class="divider"></div><p class="center small">Comanda ${e(t.id.slice(0,8))}<br>Documento de cocina · No es factura</p>`;
 const descriptions={not_configured:'Esta comanda no se ha enviado por LAN.',queued:'Esperando turno para enviar a cocina.',sending:'Enviando a la impresora…',sent:'Enviada por LAN. Confirma que salió el papel.',failed:'Sin enviar. Revisa el cable, el encendido y la IP.',uncertain:'Envío sin confirmar. Revisa el papel antes de reenviar.',cancelled:'Envío cancelado.'};
 notice.textContent=orderStatus==='cancelled'?'Pedido cancelado. Avisa a cocina si ya recibió la comanda.':pending?'Solicitud sin confirmar. Reintenta el mismo envío para consultar su resultado.':printer!=='configured'?'Impresora LAN pendiente de configurar. Puedes usar la impresión de este dispositivo.':descriptions[t.delivery]||deliveryLabel(t.delivery);
 sendButton.hidden=printer!=='configured'||orderStatus==='cancelled';
 sendButton.disabled=busy||(!pending&&['queued','sending'].includes(t.delivery));
 sendButton.textContent=busy?'Enviando solicitud…':pending?'Reintentar solicitud':['queued','sending'].includes(t.delivery)?deliveryLabel(t.delivery):t.delivery==='failed'?'Reintentar envío':['sent','uncertain'].includes(t.delivery)?'Reenviar copia':'Enviar a cocina';
 document.querySelector('#print').disabled=false;
}
async function refresh(){
 if(!id||polling||busy)return;polling=true;
 try{
  const response=await fetch(`/api/tickets/${encodeURIComponent(id)}`,{cache:'no-store'}),result=await response.json();
  if(!response.ok)throw new Error(result.error);current=result;render();
 }catch(error){notice.textContent=`No se pudo actualizar: ${error.message}. Vuelve a pedidos para iniciar sesión o intenta de nuevo.`;sendButton.disabled=true;}
 finally{polling=false;}
}
sendButton.onclick=async()=>{
 if(busy||!current)return;
 if(!pending){
  const t=current.ticket;
  if(['sent','uncertain'].includes(t.delivery)&&!confirm('Revisa si ya salió el papel. Se enviará una COPIA para evitar duplicar la preparación. ¿Reenviar?'))return;
  pending={requestId:requestId(),lastJobId:t.jobs?.at(-1)?.id??null};persist();
 }
 busy=true;render();let errorMessage='';
 try{
  const response=await fetch(`/api/tickets/${encodeURIComponent(id)}/print`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});
  const result=await response.json();
  if(!response.ok){if([400,403,409,413,415].includes(response.status)){pending=null;persist();}throw new Error(result.error);}
  pending=null;persist();
 }catch(error){errorMessage=error.message;}
 finally{busy=false;await refresh();if(errorMessage)notice.textContent=`${errorMessage}${pending?' Usa «Reintentar solicitud»; no crees otro envío.':''}`;}
};
if(id){await refresh();setInterval(()=>{if(!document.hidden)refresh();},2000);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});}
else notice.textContent='Guarda un pedido para abrir su comanda.';
