import {items,categories,sizes,priceFor,currency,normalize} from './menu.js';
import {escapeHTML as e,lineDetails,requestId,deliveryLabel,orderDelivery} from './staff-utils.js';
const $=s=>document.querySelector(s);
const item=id=>items.find(x=>x.id===id);
const extras=items.filter(x=>x.category==='adiciones'&&!x.name.includes('papas'));
const labels={pending:'Pendiente',paid:'Pagado',cancelled:'Cancelado'};
let user='',orders=[],view='new',category='pizzas',selected=null,activeOrder=null,busy=false,polling=false,saveActionVisible=false,printer='not_configured';
let draft={lines:[],table:'',notes:'',target:null,submission:null};
try{const saved=JSON.parse(sessionStorage.getItem('delirio-staff-draft'));if(saved&&Array.isArray(saved.lines)&&saved.lines.every(l=>item(l.itemId)&&Number.isInteger(l.quantity)&&l.quantity>0&&l.quantity<=99&&Array.isArray(l.extras)&&l.extras.every(id=>extras.some(x=>x.id===id))))draft={...draft,...saved};}catch{}
function persist(){try{sessionStorage.setItem('delirio-staff-draft',JSON.stringify(draft));}catch{}}
function message(text,error=false){$('#message').hidden=!text;$('#message').textContent=text;$('#message').classList.toggle('error',error);}
async function api(path,body){
 let response;try{response=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}catch{throw Object.assign(new Error('Sin conexión. Tu selección sigue aquí. Reintenta cuando vuelva la conexión.'),{status:0});}
 let result;try{result=await response.json();}catch{throw Object.assign(new Error('El servicio de pedidos no está disponible en esta dirección.'),{status:response.status||0});}
 if(!response.ok){if(response.status===401)showLogin();throw Object.assign(new Error(result.error||'No se pudo completar la acción.'),{status:response.status});}return result;
}
function showLogin(){$('#connection').hidden=true;$('#mobile-summary').hidden=true;$('#workspace').hidden=true;$('#login-view').hidden=false;$('#logout').hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function showWorkspace(name){$('#connection').hidden=false;user=name;$('#staff-name').textContent=name;$('#workspace').hidden=false;$('#login-view').hidden=true;$('#logout').hidden=false;$('#login-pin').value='';renderDraft();renderFoods();refresh();}
$('#login-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('#login-error').textContent='';try{const result=await api('/api/login',{name:$('#login-name').value.trim(),pin:$('#login-pin').value});showWorkspace(result.name);}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}};
$('#logout').onclick=async()=>{if(busy)return;if(draft.lines.length&&!confirm('La selección quedará guardada en esta pestaña. ¿Salir?'))return;try{await api('/api/logout',{});showLogin();}catch(error){message(error.message,true);}};
function switchView(next){view=next;$('#new-view').hidden=next!=='new';$('#orders-view').hidden=next==='new';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===next));renderOrders();renderMobileSummary();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
function renderFoods(){
 const search=normalize($('#food-search').value);
 $('#food-categories').innerHTML=categories.map(c=>`<button data-category="${c.id}" aria-pressed="${category===c.id&&!search}">${e(c.name)}</button>`).join('');
 $('#food-categories').querySelectorAll('button').forEach(b=>b.onclick=()=>{category=b.dataset.category;$('#food-search').value='';renderFoods();});
 const list=items.filter(x=>search?normalize(`${x.name} ${x.description} ${x.group}`).includes(search):x.category===category);
 $('#food-list').innerHTML=list.length?list.map(x=>`<button class="food-card" data-food="${x.id}" ${draft.submission?'disabled':''}><strong>${e(x.name)}</strong><div class="food-bottom"><span>${Array.isArray(x.price)?'Desde ':''}${currency(Array.isArray(x.price)?Math.min(...x.price):x.price)}</span><span class="plus" aria-hidden="true">+</span></div></button>`).join(''):'<p class="empty">No encontramos platos con ese nombre.</p>';
 $('#food-list').querySelectorAll('[data-food]').forEach(b=>b.onclick=()=>openFood(b.dataset.food));
}
$('#food-search').oninput=renderFoods;
for(const dialog of document.querySelectorAll('dialog'))dialog.querySelector('[data-close]').onclick=()=>dialog.close();
function openFood(id){
 if(draft.submission)return;selected=item(id);const pizza=selected.category==='pizzas',pasta=selected.group==='Pastas',juice=selected.group==='Jugos naturales';
 $('#food-title').textContent=selected.name;$('#food-description').textContent=selected.description;$('#food-quantity').value=1;$('#food-notes').value='';
 $('#food-options').innerHTML=(pizza?`<label>Tamaño<select id="food-size">${sizes.map((s,i)=>`<option value="${i}" ${i===1?'selected':''}>${s.name} · ${currency(priceFor(selected,i))}</option>`).join('')}</select></label>`:'')+(pasta||juice?`<label>${pasta?'Tipo de pasta':'Sabor'}<select id="food-choice">${(pasta?['Spaghetti','Fetuccini']:['Mango','Fresa','Mora','Maracumango']).map(v=>`<option>${v}</option>`).join('')}</select></label>`:'')+(pizza||pasta?`<label>Adiciones <span class="optional">Opcional</span></label><div class="extras">${extras.map(x=>`<label><input type="checkbox" value="${x.id}"><span>${e(x.name)}<small>+ ${currency(x.price)}</small></span></label>`).join('')}</div>`:'');
 $('#food-dialog').showModal();updateFoodPrice();
}
function selectedLine(){return {itemId:selected.id,size:Number($('#food-size')?.value||0),choice:$('#food-choice')?.value||'',extras:[...$('#food-options').querySelectorAll('input:checked')].map(x=>x.value),quantity:Number($('#food-quantity').value),notes:$('#food-notes').value.trim()};}
function subtotal(line){return(priceFor(item(line.itemId),line.size)+line.extras.reduce((sum,id)=>sum+item(id).price,0))*line.quantity;}
function details(line){return lineDetails({sizeName:item(line.itemId).category==='pizzas'?sizes[line.size]?.name:'',choice:line.choice,extraNames:line.extras.map(id=>item(id).name)});}
function updateFoodPrice(){const line=selectedLine();$('#food-price').textContent=currency(subtotal(line));}
$('#food-form').oninput=updateFoodPrice;
$('#food-form').onsubmit=event=>{event.preventDefault();if(draft.submission)return;const line=selectedLine();if(draft.lines.length>=100){message('Puedes agregar hasta 100 selecciones por envío.',true);return;}draft.lines.push(line);persist();renderDraft();$('#food-dialog').close();};
function renderMobileSummary(){
 $('#mobile-summary').hidden=view!=='new'||!draft.lines.length||$('#workspace').hidden||saveActionVisible;
 $('#mobile-total').textContent=currency(draft.lines.reduce((s,l)=>s+subtotal(l),0));
}
new IntersectionObserver(entries=>{saveActionVisible=entries[0].isIntersecting;renderMobileSummary();},{threshold:0.1}).observe($('#save-order'));
$('#mobile-summary').onclick=()=>$('.draft').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
function renderDraft(){
 renderMobileSummary();const locked=!!draft.submission;$('#table').value=draft.table;$('#order-notes').value=draft.notes;
 $('#table').disabled=locked||!!draft.target;$('#order-notes').disabled=locked;$('#order-notes-label').hidden=!!draft.target;
 $('#draft-title').textContent=draft.target?`Adiciones · #${draft.target.number}`:'Pedido';
 $('#draft-lines').innerHTML=draft.lines.length?draft.lines.map((line,i)=>`<div class="draft-line"><div><strong>${line.quantity} × ${e(item(line.itemId).name)}</strong><p>${e(details(line))}${line.notes?`<br>${e(line.notes)}`:''}</p></div><strong>${currency(subtotal(line))}</strong><div class="line-controls"><button data-quantity="${i}" data-delta="-1" ${locked?'disabled':''} aria-label="Quitar una unidad de ${e(item(line.itemId).name)}">−</button><span>${line.quantity}</span><button data-quantity="${i}" data-delta="1" ${locked||line.quantity>=99?'disabled':''} aria-label="Agregar una unidad de ${e(item(line.itemId).name)}">+</button><button class="remove" data-remove="${i}" ${locked?'disabled':''}>Quitar</button></div></div>`).join(''):'<p class="empty">Selecciona un plato para empezar.</p>';
 const total=draft.lines.reduce((s,l)=>s+subtotal(l),0);$('#draft-total').textContent=currency(total);$('#total-label').textContent=draft.target?'Adiciones (COP)':'Total (COP)';$('#base-total').hidden=!draft.target;$('#base-total').textContent=draft.target?`Total de la mesa con estas adiciones: ${currency(draft.target.total+total)}`:'';
 $('#save-order').disabled=busy||!draft.lines.length||!draft.table.trim();$('#save-order').textContent=busy?'Guardando…':locked?'Reintentar el mismo envío ↻':printer==='configured'?'Guardar y enviar a cocina':'Guardar pedido';$('#clear-draft').disabled=busy||locked;
 $('#printer-hint').textContent=printer==='configured'?'Envío automático por LAN.':'Impresora pendiente de configurar.';
 $('#draft-lines').querySelectorAll('[data-quantity]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.quantity);draft.lines[i].quantity+=Number(b.dataset.delta);if(!draft.lines[i].quantity)draft.lines.splice(i,1);persist();renderDraft();});
 $('#draft-lines').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{draft.lines.splice(Number(b.dataset.remove),1);persist();renderDraft();});
}
$('#table').oninput=event=>{draft.table=event.target.value;persist();$('#save-order').disabled=!draft.lines.length||!draft.table.trim();};
$('#order-notes').oninput=event=>{draft.notes=event.target.value;persist();};
$('#clear-draft').onclick=()=>{if(draft.lines.length&&!confirm('¿Limpiar esta selección sin enviarla?'))return;draft={lines:[],table:'',notes:'',target:null,submission:null};persist();renderDraft();renderFoods();message('');};
$('#save-order').onclick=async()=>{
 if(busy||!draft.lines.length||!draft.table.trim())return;
 if(draft.submission&&draft.submission.staff!==user){message(`Vuelve a ingresar como ${draft.submission.staff} para recuperar este envío.`,true);return;}
 const preview=printer==='configured'?null:window.open('ticket.html','_blank');if(preview)preview.opener=null;
 if(!draft.submission){draft.submission={staff:user,path:draft.target?`/api/orders/${draft.target.id}/add`:'/api/orders',body:{requestId:requestId(),...(draft.target?{version:draft.target.version}:{table:draft.table,notes:draft.notes}),lines:draft.lines.map(l=>({...l}))}};persist();}
 busy=true;renderDraft();renderFoods();message('Guardando el pedido…');
 try{
  const result=await api(draft.submission.path,draft.submission.body);const link=`ticket.html?id=${encodeURIComponent(result.ticket.id)}`;
  $('#last-ticket').href=link;$('#last-ticket').hidden=false;if(preview)preview.location.replace(link);
  draft={lines:[],table:'',notes:'',target:null,submission:null};persist();message(`Pedido #${result.order.number} guardado${printer==='configured'?' · Consulta el envío en Pendientes.':'.'}`);if(printer==='configured')switchView('pending');await refresh();
 }catch(error){
  if(preview)preview.close();
  if([400,403,409,413,415].includes(error.status)){
   draft.submission=null;
   if(error.status===409&&draft.target){try{const result=await api(`/api/orders/${draft.target.id}`);if(result.order.status==='pending'){draft.target=result.order;}else{draft.target=null;message('El pedido fue cerrado. Tu selección se conserva para crear uno nuevo.',true);}}catch{}}
   persist();
  }
  message(error.message+(draft.submission?' No cambies el pedido: usa «Reintentar el mismo envío» para evitar duplicados.':''),true);
 }finally{busy=false;renderDraft();renderFoods();}
};
async function refresh(){
 if(polling||$('#workspace').hidden)return;polling=true;
 try{const result=await api('/api/orders');orders=result.orders;if(printer!==result.printer){printer=result.printer;renderDraft();}$('#pending-count').textContent=orders.filter(o=>o.status==='pending').length;$('#connection').textContent='Conectado';$('#connection').classList.remove('offline');renderOrders();if($('#order-dialog').open&&!busy){const fresh=orders.find(o=>o.id===activeOrder?.id);if(fresh&&JSON.stringify(fresh)!==JSON.stringify(activeOrder)){activeOrder=fresh;renderSaved();}}}
 catch(error){$('#connection').textContent='Sin sincronizar';$('#connection').classList.add('offline');if(view!=='new')message(error.message,true);}
 finally{polling=false;}
}
$('#refresh-orders').onclick=()=>{message('');refresh();};
function renderOrders(){
 if(view==='new')return;
 const emptyMessages={pending:'Sin pedidos pendientes.',paid:'Sin pedidos pagados.',cancelled:'Sin pedidos cancelados.'};
 $('#list-title').textContent=`Pedidos ${labels[view].toLowerCase()}s`;
 const list=orders.filter(o=>o.status===view);
 $('#orders-list').innerHTML=list.length?list.map(o=>`<article class="order-card"><div class="order-head"><span>PEDIDO #${o.number}</span><span class="badge ${o.status}">${labels[o.status]}</span></div><h3>Mesa ${e(o.table)}</h3><p class="order-meta">${e(o.staff)} · ${new Date(o.createdAt).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',timeZone:'America/Bogota'})}<br>${o.lines.reduce((s,l)=>s+l.quantity,0)} ${o.lines.reduce((s,l)=>s+l.quantity,0)===1?'plato':'platos'} · ${o.ticketIds.length} ${o.ticketIds.length===1?'comanda':'comandas'}</p><p class="delivery ${orderDelivery(o.tickets)}">Cocina: ${deliveryLabel(orderDelivery(o.tickets))}</p><div class="order-foot"><strong>${currency(o.total)}</strong><button class="secondary" data-order="${o.id}">Ver pedido →</button></div></article>`).join(''):`<p class="empty">${emptyMessages[view]}</p>`;
 $('#orders-list').querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>openOrder(b.dataset.order));
}
async function openOrder(id){try{const result=await api(`/api/orders/${id}`);activeOrder=result.order;renderSaved();if(!$('#order-dialog').open)$('#order-dialog').showModal();}catch(error){message(error.message,true);}}
function renderSaved(){
 const o=activeOrder;$('#saved-number').textContent=`PEDIDO #${o.number} · ${labels[o.status].toUpperCase()}`;$('#saved-title').textContent=`Mesa ${o.table}`;
 $('#saved-content').innerHTML=`<p class="muted">Atendió: ${e(o.staff)}</p>${o.notes?`<p>${e(o.notes)}</p>`:''}<ul class="saved-lines">${o.lines.map(l=>`<li><strong>${l.quantity} × ${e(l.name)} · ${currency(l.total)}</strong><p>${e(lineDetails(l))}</p>${l.notes?`<p>${e(l.notes)}</p>`:''}</li>`).join('')}</ul><div class="draft-total"><span>Total de la mesa</span><strong>${currency(o.total)}</strong></div><div class="ticket-history">${o.ticketIds.map((id,i)=>`<a href="ticket.html?id=${id}&copy=1" target="_blank" rel="noopener">${i?'Adición '+i:'Comanda inicial'} · ${deliveryLabel(o.tickets?.find(t=>t.id===id)?.delivery)} ↗</a>`).join('')}</div>${o.status==='pending'?'<div class="saved-actions"><button id="append-order" class="secondary">+ Agregar platos</button><button id="pay-order" class="primary">Marcar como pagado ✓</button><button id="cancel-order" class="danger">Cancelar pedido</button></div>':''}`;
 $('#append-order')?.addEventListener('click',()=>{
  if(draft.submission){$('#order-dialog').close();message('Resuelve el envío pendiente antes de empezar otro.',true);switchView('new');return;}
  if(draft.lines.length&&!confirm('¿Reemplazar la selección que aún no has enviado?'))return;
  draft={lines:[],table:o.table,notes:'',target:o,submission:null};persist();renderDraft();renderFoods();$('#order-dialog').close();switchView('new');message(`Agrega platos al pedido #${o.number}. La nueva comanda incluirá solo estos platos.`);
 });
 $('#pay-order')?.addEventListener('click',()=>closeOrder('paid'));
 $('#cancel-order')?.addEventListener('click',()=>closeOrder('cancelled'));
}
async function closeOrder(status){
 if(busy)return;const o=activeOrder;
 if(!confirm(status==='paid'?`¿Confirmas el pago de ${currency(o.total)} para la mesa ${o.table}?`:`¿Cancelar el pedido #${o.number}? Si ya fue enviado, avisa personalmente a cocina.`))return;
 busy=true;$('#saved-content').querySelectorAll('button').forEach(b=>b.disabled=true);
 try{await api(`/api/orders/${o.id}/status`,{status,version:o.version,requestId:requestId()});$('#order-dialog').close();message(status==='paid'?'Pedido marcado como pagado.':'Pedido cancelado. Recuerda avisar a cocina.');await refresh();}
 catch(error){$('#order-dialog').close();message(error.message,true);await refresh();}
 finally{busy=false;}
}
setInterval(refresh,4000);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
try{const result=await api('/api/session');showWorkspace(result.name);}catch(error){showLogin();if(error.status!==401)$('#login-error').textContent=error.message;}
