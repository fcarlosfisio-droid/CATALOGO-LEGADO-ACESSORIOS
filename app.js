import { mountCatalog } from './navigation.mjs';
import { STORE_CONTACTS, WHATSAPP_NUMBER, APP_BASE_PATH, configurePublicBaseUrl } from './site-config.mjs';
document.querySelector('#footer-whatsapp').href = `https://wa.me/${WHATSAPP_NUMBER}`;
for (const key of ['instagram', 'email', 'address', 'hours']) {
  const value = STORE_CONTACTS[key].trim();
  if (!value) continue;
  const target = document.querySelector(`#footer-${key}`);
  if (key === 'instagram' || key === 'email') {
    const link = document.createElement('a');
    link.id = target.id;
    link.textContent = key === 'instagram' ? '@' + value.replace(/^@/, '') : value;
    link.href = key === 'instagram' ? `https://www.instagram.com/${encodeURIComponent(value.replace(/^@/, ''))}/` : `mailto:${value}`;
    target.replaceWith(link);
  } else target.textContent = value;
}
const icons={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',diamond:'<path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18"/>',watch:'<rect x="5" y="6" width="14" height="12" rx="4"/><path d="m8 6 1-4h6l1 4m-8 12 1 4h6l1-4M12 9v3l2 1"/>',layers:'<path d="m12 3 10 6-10 6L2 9l10-6Zm-10 11 10 6 10-6M2 19l10 6 10-6"/>'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.arrow}</svg>`;
function paintIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon));el.removeAttribute('data-icon');});}paintIcons();
let artId=0;
function art(type,variant='silver'){
 const id=`art${artId++}`,dark=variant==='dark',metal=dark?'#606d7b':'#c8d0d7';
 const defs=`<defs><linearGradient id="${id}m"><stop stop-color="#697583"/><stop offset=".24" stop-color="${metal}"/><stop offset=".48" stop-color="#f0f3f6"/><stop offset=".7" stop-color="#8f9ba8"/><stop offset="1" stop-color="#d4dce4"/></linearGradient><radialGradient id="${id}d"><stop stop-color="${dark?'#242c34':'#294d6c'}"/><stop offset="1" stop-color="#0d1d2f"/></radialGradient><filter id="${id}s"><feDropShadow dx="6" dy="12" stdDeviation="8" flood-color="#0f233b" flood-opacity=".2"/></filter></defs>`;
 let shape='';
 if(type==='Relógios'){
  let links='';for(let y=8;y<470;y+=25){if(y>133&&y<332)continue;links+=`<rect x="103" y="${y}" width="94" height="23" rx="5" fill="url(#${id}m)" stroke="#7b8794" stroke-width=".7"/><path d="M125 ${y+2}v19m50-19v19" stroke="#8493a1" stroke-width="1"/>`;}
  let ticks='';for(let n=0;n<12;n++){ticks+=`<rect x="148" y="159" width="4" height="${n%3===0?13:8}" rx="1" fill="#c9d5df" transform="rotate(${n*30} 150 235)"/>`;}
  shape=`<g filter="url(#${id}s)">${links}<rect x="239" y="224" width="14" height="23" rx="4" fill="url(#${id}m)"/><circle cx="150" cy="235" r="99" fill="url(#${id}m)" stroke="#93a2b0" stroke-width="2"/><circle cx="150" cy="235" r="87" fill="#677988"/><circle cx="150" cy="235" r="82" fill="url(#${id}d)" stroke="#e0e6ed" stroke-width="1"/>${ticks}<text x="150" y="200" text-anchor="middle" fill="#dce3ea" font-size="10" letter-spacing="2" font-family="Arial">LEGADO</text><text x="150" y="213" text-anchor="middle" fill="#889eaf" font-size="5" letter-spacing="2" font-family="Arial">ESSENCIAL</text><circle cx="115" cy="247" r="17" stroke="#658199" fill="none"/><circle cx="185" cy="247" r="17" stroke="#658199" fill="none"/><circle cx="150" cy="278" r="14" stroke="#658199" fill="none"/><path d="M115 236v11l7 4m63-15v11l-8 3m-27 17v11l6 3" fill="none" stroke="#b6c6d4" stroke-width="1"/><path d="m150 235-36-29m36 29 38-58" stroke="#e6edf3" stroke-width="4" stroke-linecap="round"/><path d="m150 235-6 51" stroke="#8ba9c3" stroke-width="1"/><circle cx="150" cy="235" r="5" fill="#e3eaf1"/><text x="150" y="298" text-anchor="middle" fill="#7a98b0" font-size="5" font-family="Arial" letter-spacing="1">COLEÇÃO MASCULINA</text></g>`;
 }else if(type==='Pulseiras'){
  shape=`<g transform="translate(0 30)" filter="url(#${id}s)"><ellipse cx="150" cy="210" rx="100" ry="73" fill="none" stroke="#5c6875" stroke-width="27"/><ellipse cx="150" cy="210" rx="100" ry="73" fill="none" stroke="url(#${id}m)" stroke-width="23"/>`;for(let i=0;i<22;i++){let a=i*Math.PI*2/22,x=150+100*Math.cos(a),y=210+73*Math.sin(a);shape+=`<rect x="${x-10}" y="${y-15}" width="20" height="30" rx="5" fill="url(#${id}m)" stroke="#74818f" stroke-width="1.5" transform="rotate(${i*360/22} ${x} ${y})"/>`;}shape+=`<rect x="131" y="270" width="40" height="30" rx="5" fill="url(#${id}m)"/><path d="M140 285h20" stroke="#8293a4"/></g>`;
 }else if(type==='Correntes'){
  shape=`<g filter="url(#${id}s)">`;for(let i=0;i<42;i++){let a=i*Math.PI*2/42,x=150+88*Math.sin(a),y=218+137*Math.cos(a);shape+=`<ellipse cx="${x}" cy="${y}" rx="9" ry="14" fill="none" stroke="#637383" stroke-width="5" transform="rotate(${-i*360/42} ${x} ${y})"/><ellipse cx="${x}" cy="${y}" rx="9" ry="14" fill="none" stroke="url(#${id}m)" stroke-width="3" transform="rotate(${-i*360/42} ${x} ${y})"/>`;}shape+='</g>';
 }else{
  shape=`<g transform="rotate(-24 150 230)" filter="url(#${id}s)"><ellipse cx="150" cy="242" rx="77" ry="94" fill="url(#${id}m)" stroke="#788898"/><ellipse cx="150" cy="242" rx="47" ry="67" fill="#dfe5eb" stroke="#768596" stroke-width="5"/><path d="M89 175Q150 128 212 175L211 219Q150 194 89 219Z" fill="url(#${id}m)" stroke="#8a99a7"/><path d="M100 174Q150 148 201 174L198 200Q150 182 102 200Z" fill="${dark?'#182b40':'#9aaab9'}"/><path d="m147 164-12 19h27Z" fill="none" stroke="#d7e0e8" stroke-width="2"/></g>`;
 }
 return `<svg viewBox="0 0 300 470" aria-hidden="true">${defs}${shape}</svg>`;
}
document.querySelector('#hero-art').innerHTML=art('Relógios');
import { products as demonstrationProducts } from './products.mjs';
let products = demonstrationProducts;
let catalogUnavailable = false;
if (APP_BASE_PATH === '/') {
  try {
    const response = await fetch('/api/products', { cache: 'no-store' });
    if (!response.ok) throw new Error('Catálogo indisponível.');
    {
      const catalog = await response.json();
      products = catalog.products;
      configurePublicBaseUrl(catalog.publicBaseUrl);
    }
  } catch { products = []; catalogUnavailable = true; }
}
let favorites;try{favorites=new Set(JSON.parse(localStorage.getItem('legado-favorites')||'[]'));}catch{favorites=new Set();}
mountCatalog({ products, favorites, art, icon, catalogUnavailable });
