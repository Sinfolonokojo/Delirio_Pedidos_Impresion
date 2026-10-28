export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const lineDetails=line=>[line.sizeName,line.choice,line.extraNames?.length?`+ ${line.extraNames.join(', ')}`:''].filter(Boolean).join(' · ');
export const requestId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
export const deliveryLabel=status=>({not_configured:'Sin configurar',queued:'En cola',sending:'Enviando',sent:'Enviada',failed:'Sin enviar',uncertain:'Revisar impresora',cancelled:'Envío cancelado'}[status]||'Sin configurar');
export function orderDelivery(tickets=[]){
 for(const status of ['uncertain','failed','sending','queued','not_configured','sent','cancelled'])if(tickets.some(t=>t.delivery===status))return status;
 return 'not_configured';
}
