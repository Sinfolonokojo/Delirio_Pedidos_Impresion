export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const lineDetails=line=>[line.sizeName,line.choice,line.extraNames?.length?`+ ${line.extraNames.join(', ')}`:''].filter(Boolean).join(' · ');
export const requestId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
