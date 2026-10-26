export function shouldUseLite({memory,cores,saveData,connection,reducedMotion}={}) {
  return Boolean(reducedMotion || saveData || (memory>0 && memory<=4) ||
    (cores>0 && cores<=4) || ['slow-2g','2g','3g'].includes(connection));
}

export function renderBudget(lite) {
  return lite
    ? {speckles:28,cheeseSpots:24,toppings:4,cheeseToppings:7,spaghetti:28,fettuccine:16}
    : {speckles:105,cheeseSpots:90,toppings:9,cheeseToppings:18,spaghetti:66,fettuccine:30};
}

const browser=typeof window!=='undefined';
const motion=browser?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const nav=browser?window.navigator:{};
// Performance is automatic. Old manual preferences must not override detection.
export const performanceProfile={
  lite: shouldUseLite({
    memory:nav.deviceMemory,cores:nav.hardwareConcurrency,saveData:nav.connection?.saveData,
    connection:nav.connection?.effectiveType,reducedMotion:motion?.matches
  })
};
export const drawingBudget=()=>renderBudget(performanceProfile.lite);
export const canAnimate=()=>!performanceProfile.lite&&!motion?.matches;
function applyMode() {
  if(!browser)return;
  document.documentElement.classList.toggle('lite-mode',performanceProfile.lite);
  // System fonts render immediately; optional local fonts load only in full mode.
  if(!performanceProfile.lite&&!document.getElementById('local-fonts')){
    const link=document.createElement('link');link.id='local-fonts';link.rel='stylesheet';link.href='fonts.css';document.head.append(link);
  }
}
applyMode();
