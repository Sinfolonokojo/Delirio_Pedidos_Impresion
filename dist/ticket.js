import {escapeHTML as e,lineDetails} from './staff-utils.js';
const params=new URLSearchParams(location.search),id=params.get('id'),copy=params.get('copy')==='1';
const ticket=document.querySelector('#ticket');
document.querySelector('#paper').onchange=event=>ticket.classList.toggle('narrow',event.target.value==='58');
document.querySelector('#print').onclick=()=>window.print();
if(id){try{
 const response=await fetch(`/api/tickets/${encodeURIComponent(id)}`,{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);
 const t=result.ticket;document.title=`Comanda ${t.number} · Mesa ${t.table}`;
 ticket.innerHTML=`<h1>DELIRIO</h1><p class="center">COCINA · ${copy?'COPIA / REIMPRESIÓN':t.kind==='addition'?'ADICIÓN':'COMANDA'}</p><h2>MESA ${e(t.table)}</h2><p><b>Pedido #${t.number}</b></p><p>${e(new Date(t.createdAt).toLocaleString('es-CO',{timeZone:'America/Bogota'}))}</p><p>Atendió: ${e(t.staff)}</p>${t.kind==='addition'?'<h3>SOLO PLATOS AGREGADOS</h3>':''}${copy?'<h3>COPIA · NO DUPLICAR PREPARACIÓN</h3>':''}<div class="divider"></div>${t.lines.map(l=>`<div class="dish"><strong>${l.quantity} × ${e(l.name)}</strong><p>${e(lineDetails(l))}</p>${l.notes?`<p class="notes">${e(l.notes)}</p>`:''}</div>`).join('')}${t.notes?`<div class="divider"></div><p class="notes">NOTAS: ${e(t.notes)}</p>`:''}<div class="divider"></div><p class="center small">Comanda ${e(t.id.slice(0,8))}<br>Documento de cocina · No es factura</p>`;
 document.querySelector('#notice').textContent='Pedido guardado. La impresora directa aún no está configurada. Puedes imprimir desde este dispositivo si tiene una impresora disponible; abrir esta comanda no confirma su impresión.';
 document.querySelector('#print').disabled=false;
}catch(error){document.querySelector('#notice').textContent=`No se pudo abrir la comanda: ${error.message}. Vuelve a pedidos para iniciar sesión o intentar de nuevo.`;}}
