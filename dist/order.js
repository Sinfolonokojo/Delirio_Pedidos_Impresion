import {items,priceFor} from './menu.js';
export const itemById = id => items.find(item=>item.id===id);
export const lineTotal = line => (priceFor(itemById(line.itemId),line.size)+line.extras.reduce((sum,id)=>sum+priceFor(itemById(id)),0))*line.quantity;
export const orderTotal = cart => cart.reduce((sum,line)=>sum+lineTotal(line),0);
export function validCart(value){if(!Array.isArray(value))return [];return value.filter(line=>line&&itemById(line.itemId)&&Number.isInteger(line.size)&&line.size>=0&&line.size<4&&Number.isInteger(line.quantity)&&line.quantity>0&&line.quantity<=99&&Array.isArray(line.extras)&&line.extras.every(id=>itemById(id)?.category==='adiciones')&&new Set(line.extras).size===line.extras.length&&typeof line.choice==='string'&&['','Spaghetti','Fetuccini','Mango','Fresa','Mora','Maracumango'].includes(line.choice)).slice(0,100);}
