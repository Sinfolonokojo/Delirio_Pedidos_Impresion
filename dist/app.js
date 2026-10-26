import {categories,sizes,items,priceFor,findItems,currency} from './menu.js';
import {mountPizza,updatePizza,ingredientSvg} from './pizza.js';
import {mountPasta,updatePasta,pastaChoiceIcon} from './pasta.js';
const itemById = id => items.find(item => item.id === id);
import {canAnimate} from './performance.js';
const $=selector=>document.querySelector(selector);
const paths={pizza:'<path d="M3 5q9-5 18 0l-9 17zM4 8q8-4 16 0"/><circle cx="10" cy="11" r="1"/><circle cx="13" cy="16" r="1"/><circle cx="16" cy="10" r="1"/>',spark:'<path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',pasta:'<path d="M3 12h18q-1 9-9 9t-9-9zM7 4v5m5-7v7m5-5v5M5 21h14"/>',flame:'<path d="M13 2c2 7-5 7-3 12 2-1 3-3 3-5 5 4 8 7 5 11-3 4-12 3-13-3C4 10 10 8 13 2z"/>',burger:'<path d="M3 9c0-9 18-9 18 0zM3 13h18M4 17h16v3H4zM7 6h0m5-1h0m5 1h0"/>',smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14q4 6 8 0M8 9h0m8 0h0"/>',glass:'<path d="M6 8h12l-2 14H8zM14 8l2-6h5M5 12h14"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/>',bag:'<path d="M5 7h14l1 15H4zM8 8V6a4 4 0 018 0v2"/>',download:'<path d="M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5"/>',phone:'<path d="M5 3l4 4-2 3q2 5 7 7l3-2 4 4-2 3C10 23 1 13 2 5z"/>',reset:'<path d="M3 10a9 9 0 111 8M3 3v7h7"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.spark}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.outerHTML=icon(el.dataset.icon));
let category='pizzas',size=1,query='',currentItem=null,currentSize=1,currentPasta='Spaghetti',selectedExtras=new Set(),toastTimer,searchTimer;
const extras=items.filter(x=>x.category==='adiciones'&&!x.name.includes('papas'));
const scales=[.65,.79,.9,1];
const itemDialog=$('#item-dialog');
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

function sizeButtons(container,selected,onSelect){container.innerHTML=sizes.map((s,i)=>`<button class="size-button" data-size="${i}" aria-pressed="${selected===i}">${s.name}<small>${s.detail}</small></button>`).join('');container.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>onSelect(Number(button.dataset.size))));}
function renderCategories(){
 $('#categories').innerHTML=categories.map(c=>`<button class="category-button" data-category="${c.id}" aria-pressed="${!query&&category===c.id}">${icon(c.icon)}<span>${c.name}</span><span class="count">${String(items.filter(x=>x.category===c.id).length).padStart(2,'0')}</span></button>`).join('');
 $('#categories').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{clearTimeout(searchTimer);category=button.dataset.category;query='';$('#search').value='';renderMenu();const replacement=$(`[data-category="${category}"]`);replacement.focus({preventScroll:true});replacement.scrollIntoView({behavior:canAnimate()?'smooth':'auto',block:'nearest',inline:'nearest'});}));
}
function renderMenu(){
 renderCategories();const cat=categories.find(x=>x.id===category);const filtered=query?findItems(query):items.filter(x=>x.category===category);
 $('#category-eyebrow').textContent=query?'EXPLORA TODA LA CARTA':cat.eyebrow;
 $('#category-title').textContent=query?`Resultados para “${query}”`:cat.title;
 $('#category-description').textContent=query?'Encuentra coincidencias por nombre o ingrediente.':cat.description;
 $('#item-count').textContent=`${filtered.length} ${filtered.length===1?'opción':'opciones'}`;
 $('#pizza-controls').hidden=!filtered.some(x=>x.category==='pizzas');
 sizeButtons($('#menu-sizes'),size,newSize=>{size=newSize;renderMenu();$('#menu-sizes').querySelector(`[data-size="${newSize}"]`).focus({preventScroll:true});});
 const groups=new Map();for(const item of filtered){const group=query?`${categories.find(x=>x.id===item.category).name} · ${item.group}`:item.group;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(item);}
 $('#results').innerHTML=[...groups].map(([name,group])=>`<section class="group"><div class="group-heading"><h4>${name}</h4><span class="group-line"></span><span class="group-count">${String(group.length).padStart(2,'0')}</span></div>${group[0].group==='Pastas'?'<p class="group-note">Escoge spaghetti o fetuccini. Acompañado del pan de la casa.</p>':''}${group[0].category==='bebidas'&&group[0]===filtered[0]?'<p class="group-note">Haz tu bebida michelada por $2.000 adicionales. Confírmalo con nuestro equipo.</p>':''}<div class="card-grid">${group.map((item,i)=>`<article class="menu-card" style="animation-delay:${Math.min(i*35,180)}ms"><div class="card-top"><h5>${item.name}</h5>${item.name==='Delirio'?'<span class="card-tag">DE LA CASA</span>':''}</div>${item.description?`<p>${item.description}</p>`:''}<div class="card-bottom"><span class="card-price">${currency(priceFor(item,size))}${item.category==='pizzas'?`<small>${sizes[size].name}</small>`:''}</span><button class="card-add" data-item="${item.id}" aria-label="${item.category==='pizzas'||item.group==='Pastas'?'Personalizar':'Ver'} ${item.name}"><span>${item.category==='pizzas'||item.group==='Pastas'?'Dale tu toque':'Ver detalle'}</span><span class="plus-circle" aria-hidden="true">+</span></button></div></article>`).join('')}</div></section>`).join('');
 $('#empty-state').hidden=filtered.length>0;
 $('#results').querySelectorAll('[data-item]').forEach(button=>button.addEventListener('click',()=>openItem(button.dataset.item)));
}
$('#search').addEventListener('input',event=>{query=event.target.value.trim();clearTimeout(searchTimer);searchTimer=setTimeout(renderMenu,120);});
$('#clear-search').addEventListener('click',()=>{clearTimeout(searchTimer);query='';$('#search').value='';renderMenu();$('#search').focus();});

function updateDetails(animate=true){
 $('#detail-sizes').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.size)===currentSize));
 $('#detail-size-note').textContent=`${sizes[currentSize].servings}${currentSize>=2?' · Puedes consultar la combinación de dos sabores.':''}`;
 const selected=[...selectedExtras].map(itemById);
 if(currentItem.category==='pizzas')updatePizza($('#pizza-stage'),selected,scales[currentSize],animate);
 if(currentItem.group==='Pastas')updatePasta($('#pasta-stage'),currentItem,currentPasta,selected,animate);
 $('#extras-count').textContent=`${selected.length} ${selected.length===1?'adición':'adiciones'}`;
 $('#extras-grid').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',selectedExtras.has(button.dataset.extra)));
 $('#detail-total').textContent=currency(priceFor(currentItem,currentSize)+selected.reduce((sum,x)=>sum+x.price,0));
}
function flyIngredient(button,item){
 if(!canAnimate()||typeof Element.prototype.animate!=='function')return;
 const from=button.querySelector('.ingredient-icon').getBoundingClientRect();const target=$(currentItem.group==='Pastas'?'#pasta-stage':'#pizza-stage').getBoundingClientRect();
 if(target.bottom<0||target.top>innerHeight)return;
 const flying=document.createElement('div');flying.className='ingredient-flight';flying.setAttribute('aria-hidden','true');flying.innerHTML=ingredientSvg(item.name);Object.assign(flying.style,{position:'fixed',left:`${from.left}px`,top:`${from.top}px`,width:'44px',height:'44px',pointerEvents:'none',zIndex:6,filter:'drop-shadow(0 6px 8px #0004)'});itemDialog.append(flying);
 const dx=target.left+target.width*.5-from.left-22,dy=target.top+target.height*.5-from.top-22;
 const animation=flying.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.6-45}px) scale(1.4) rotate(80deg)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy}px) scale(.6) rotate(160deg)`,opacity:0}],{duration:650,easing:'cubic-bezier(.2,.6,.2,1)'});animation.onfinish=()=>flying.remove();
}
function openItem(id){
 currentItem=itemById(id);currentSize=size;currentPasta='Spaghetti';selectedExtras=new Set();const pizza=currentItem.category==='pizzas',pasta=currentItem.group==='Pastas',customizable=pizza||pasta;
 $('#detail-category').textContent=categories.find(c=>c.id===currentItem.category).name+' / '+currentItem.group;
 $('#detail-title').textContent=currentItem.name;$('#detail-description').textContent=currentItem.description||'Un antojo de nuestra carta, listo para acompañar tu mesa.';
 $('#pizza-stage').hidden=!pizza;$('#pasta-stage').hidden=!pasta;$('#non-pizza-art').hidden=customizable;$('#detail-size-wrap').hidden=!pizza;$('#extras-wrap').hidden=!customizable;$('#reset-extras').hidden=!customizable;
 $('#visual-caption').textContent=pizza?'Toca una adición y mira cómo llega a tu pizza.':pasta?'Toca una adición y mira cómo llega a tu pasta.':'Un antojo. Mil delirios.';
 $('#pasta-choice-wrap').hidden=!pasta;$('#juice-choice-wrap').hidden=currentItem.group!=='Jugos naturales';$('#juice-choice').selectedIndex=0;
 if(pizza){mountPizza($('#pizza-stage'),currentItem,[],scales[currentSize]);sizeButtons($('#detail-sizes'),currentSize,newSize=>{currentSize=newSize;updateDetails(false);});}
 if(!customizable){const img=$('#non-pizza-art img');if(!img.getAttribute('src'))img.src=img.dataset.src;}
 if(pasta){
  mountPasta($('#pasta-stage'),currentItem,currentPasta);
  $('#pasta-choices').innerHTML=['Spaghetti','Fetuccini'].map(shape=>`<button class="pasta-choice" data-pasta="${shape}" aria-pressed="${shape===currentPasta}">${pastaChoiceIcon(shape)}<span>${shape}<small>${shape==='Spaghetti'?'Hebras finas':'Cintas anchas'}</small></span><span class="pasta-check" aria-hidden="true">✓</span></button>`).join('');
  $('#pasta-choices').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{currentPasta=button.dataset.pasta;$('#pasta-choices').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.pasta===currentPasta));updateDetails();}));
 }
 $('#extras-grid').innerHTML=customizable?extras.map(item=>`<button class="extra-button" data-extra="${item.id}" aria-pressed="false" aria-label="Agregar ${item.name}, ${currency(item.price)}"><span class="ingredient-icon">${ingredientSvg(item.name)}</span><span class="ingredient-name">${item.name}</span><small>+${currency(item.price)}</small></button>`).join(''):'';
 $('#extras-grid').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.extra;if(selectedExtras.has(id)){selectedExtras.delete(id)}else{selectedExtras.add(id);flyIngredient(button,itemById(id))}updateDetails();button.setAttribute('aria-label',`${selectedExtras.has(id)?'Quitar':'Agregar'} ${itemById(id).name}, ${currency(itemById(id).price)}`);}));
 updateDetails(false);openDialog(itemDialog);itemDialog.scrollTop=0;$('.detail-content').scrollTop=0;$('#extras-grid').scrollTop=0;
}
$('#reset-extras').addEventListener('click',()=>{selectedExtras.clear();updateDetails();$('#extras-grid').querySelectorAll('button').forEach(button=>button.setAttribute('aria-label',`Agregar ${itemById(button.dataset.extra).name}, ${currency(itemById(button.dataset.extra).price)}`));});
function openDialog(dialog){dialog.showModal();document.body.style.overflow='hidden';}
for(const dialog of [itemDialog]){dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{document.body.style.overflow='';if(dialog===itemDialog){$('#pizza-stage').replaceChildren();$('#pasta-stage').replaceChildren();$('#extras-grid').replaceChildren();dialog.querySelectorAll('.ingredient-flight').forEach(el=>{el.getAnimations?.().forEach(animation=>animation.cancel());el.remove();});currentItem=null;}});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function drawHero(){mountPizza($('#hero-pizza'),{name:'Delirio',description:'Peperoni, tomate, albahaca, champiñones y aceitunas.'},[],1);}
drawHero();
renderMenu();
