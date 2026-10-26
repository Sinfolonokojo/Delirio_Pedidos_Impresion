import {ingredientLayer, updatePizza} from './pizza.js';
import {drawingBudget,canAnimate,performanceProfile} from './performance.js';

let serial = 0;
const recipes = {
  Carbonara: {sauce:'#e9d5a1', noodle:'#efcc7d', ingredients:['bacon','cheese']},
  Boloñesa: {sauce:'#a94529', noodle:'#e6aa55', ingredients:['beef','cheese']},
  Primavera: {sauce:'#e6d4ab', noodle:'#efd18e', ingredients:['chicken','mushroom','cheese']},
  'Frutos del mar': {sauce:'#e5c69a', noodle:'#edc47b', ingredients:['shrimp','cheese']}
};

function random(seed) {
  let value = seed;
  return () => { value = value * 16807 % 2147483647; return (value - 1) / 2147483646; };
}

// The two shapes have different geometry as well as different strand widths.
function noodles(shape, recipe, animate) {
  const ribbon = shape === 'Fetuccini';
  const rand = random(ribbon ? 108 : 73);
  const budget = drawingBudget();
  const count = ribbon ? budget.fettuccine : budget.spaghetti;
  animate = animate && canAnimate();
  let markup = '';
  for (let i=0; i<count; i++) {
    const angle = rand()*360;
    const cx = 250+(rand()-.5)*75, cy = 250+(rand()-.5)*75;
    const rx = 55+rand()*85, ry = 22+rand()*52;
    const x = cx-rx, y = cy-ry*.25;
    const path = ribbon
      ? `M ${x} ${y} C ${cx-rx*.8} ${cy-ry*1.7}, ${cx+rx*.8} ${cy-ry*1.5}, ${cx+rx} ${cy} S ${cx+rx*.3} ${cy+ry*1.3}, ${cx-rx*.45} ${cy+ry} S ${cx-rx*.5} ${cy-ry*.4}, ${cx+rx*.35} ${cy+ry*.2}`
      : `M ${x} ${y} C ${cx-rx*.9} ${cy-ry*1.9}, ${cx+rx*.9} ${cy-ry*1.6}, ${cx+rx} ${cy} C ${cx+rx*1.05} ${cy+ry*1.7}, ${cx-rx*.9} ${cy+ry*1.5}, ${cx-rx*.8} ${cy+ry*.25} S ${cx+rx*.45} ${cy-ry*.5}, ${cx+rx*.7} ${cy+ry*.3}`;
    const width = ribbon ? 10+rand()*4 : 3.5+rand()*1.3;
    const shadow = `<path d="${path}" fill="none" stroke="#88551f" stroke-opacity=".3" stroke-width="${width+2.6}" transform="translate(0 2)"/>`;
    const main = `<path class="pasta-strand" d="${path}" pathLength="1" fill="none" stroke="${i%3===0?'#f5dfa0':recipe.noodle}" stroke-width="${width}"/>`;
    const highlight = `<path d="${path}" fill="none" stroke="#fff0c6" stroke-opacity="${ribbon?.43:.38}" stroke-width="${ribbon?2.5:1.1}" transform="translate(0 -${ribbon?2:1})"/>`;
    markup += `<g class="${animate?'pasta-strand-enter':''}" style="--strand-delay:${i*6}ms" transform="rotate(${angle} ${cx} ${cy})" stroke-linecap="round" stroke-linejoin="round">${performanceProfile.lite?'':shadow}${main}${highlight}</g>`;
  }
  return markup;
}

function plate(id, recipe) {
  return `<defs><radialGradient id="ceramic-${id}" cx="45%" cy="37%"><stop stop-color="#fffef4"/><stop offset=".75" stop-color="#f4f0df"/><stop offset=".9" stop-color="#d6d2c0"/><stop offset=".95" stop-color="#f9f7ed"/><stop offset="1" stop-color="#b8b8a8"/></radialGradient><radialGradient id="well-${id}"><stop stop-color="#f6f0d9"/><stop offset=".82" stop-color="#e8e1ca"/><stop offset="1" stop-color="#c9c4b4"/></radialGradient><radialGradient id="sauce-${id}"><stop stop-color="${recipe.sauce}"/><stop offset=".8" stop-color="${recipe.sauce}"/><stop offset="1" stop-color="${recipe.sauce}" stop-opacity=".3"/></radialGradient></defs><circle cx="250" cy="254" r="224" fill="#0c100b" opacity=".3"/><circle cx="250" cy="250" r="220" fill="url(#ceramic-${id})"/><circle cx="250" cy="250" r="207" fill="none" stroke="#fffdf3" stroke-width="2" opacity=".6"/><circle cx="250" cy="250" r="178" fill="url(#well-${id})"/><circle cx="250" cy="250" r="172" fill="none" stroke="#a5a48e" stroke-opacity=".3"/><ellipse cx="250" cy="258" rx="155" ry="149" fill="url(#sauce-${id})"/>`;
}

export function pastaChoiceIcon(shape) {
  return `<svg viewBox="0 0 50 50" aria-hidden="true" class="pasta-choice-icon"><path d="M7 17C9 3 43 5 43 20S8 41 9 27S35 10 36 28S18 45 15 35" fill="none" stroke="currentColor" stroke-width="${shape==='Fetuccini'?5.5:2.4}" stroke-linecap="round"/>${shape==='Spaghetti'?'<path d="M6 25C1 6 31 1 40 13S40 45 18 43" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>':''}</svg>`;
}

export function mountPasta(container, item, shape='Spaghetti', extras=[]) {
  const recipe = recipes[item.name];
  const id = `pasta-${++serial}`;
  container.innerHTML = `<div class="pizza-scale pasta-plate" style="--pizza-scale:.96"><svg class="pizza-svg pasta-svg" viewBox="0 0 500 500" role="img" aria-label="${shape} ${item.name}, vista ilustrativa">${plate(id,recipe)}<g class="noodle-bed" data-shape="${shape}">${noodles(shape,recipe,true)}</g><g class="base-toppings">${recipe.ingredients.map((type,i)=>ingredientLayer(type,i+2,false)).join('')}</g><g class="extra-toppings"></g></svg></div>`;
  updatePizza(container,extras,.96,false);
}

export function updatePasta(container, item, shape, extras, animate=true) {
  const bed = container.querySelector('.noodle-bed');
  if (bed.dataset.shape !== shape) {
    bed.dataset.shape = shape;
    bed.innerHTML = noodles(shape,recipes[item.name],animate);
    container.querySelector('svg').setAttribute('aria-label',`${shape} ${item.name}, vista ilustrativa`);
  }
  updatePizza(container,extras,.96,animate);
}
