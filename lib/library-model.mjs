import source from '../data/collection.json';
export const PERFUMES = source;
export const PAGE_SIZE = 24;
export const BY_ID = new Map(source.map(p=>[p.id,p]));
export const FIVE_STAR = source.filter(p=>p.personalRating===5);
const grouped = new Map();
for(const p of source){if(!grouped.has(p.brand))grouped.set(p.brand,[]);grouped.get(p.brand).push(p);}
function commonBrand(items){
 if(items.length<2)return '';
 let words=items[0].nameEnglish.split(' ');
 for(const p of items.slice(1)){let next=p.nameEnglish.split(' '),i=0;while(i<words.length&&words[i]===next[i])i++;words=words.slice(0,i);}
 return words.join(' ').replace(/[\s-]+$/,'');
}
export const BRANDS=[...grouped].map(([name,items],index)=>{
 const english=commonBrand(items);
 const readable=english&&english.length<40?english.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):null;
 return {name,english:english.length<45?english:'',slug:readable||items[0].brandSlug,originalSlug:items[0].brandSlug,items,index,letter:items[0].nameEnglish.charAt(0).toUpperCase().match(/[A-Z]/)?.[0]||'#',sortName:items[0].nameEnglish};
});
export const BRAND_BY_SLUG=new Map(BRANDS.flatMap(b=>[[b.slug,b],[b.originalSlug,b]]));
export const BRAND_BY_NAME=new Map(BRANDS.map(b=>[b.name,b]));
export const YEARS=[...new Set(source.map(p=>p.releaseYear).filter(Boolean))].sort((a,b)=>b-a);
export const SCENTS=[...new Set(source.flatMap(p=>p.scents))].sort((a,b)=>source.filter(p=>p.scents.includes(b)).length-source.filter(p=>p.scents.includes(a)).length);
export const DECADES=[...new Set(YEARS.map(y=>Math.floor(y/10)*10))].sort((a,b)=>a-b);
export function selectPerfumes(params,items=source){
 const get=k=>params.get(k)||'';const query=get('query').normalize('NFKC').toLowerCase().trim();
 let result=items.filter(p=>(!query||`${p.brand} ${p.nameChinese} ${p.nameEnglish} ${p.description}`.normalize('NFKC').toLowerCase().includes(query))&&(!get('brand')||p.brand===get('brand'))&&(!get('rating')||p.personalRating===Number(get('rating')))&&(!get('year')||(get('year')==='unknown'?p.releaseYear===null:p.releaseYear===Number(get('year'))))&&(!get('scent')||p.scents.includes(get('scent')))&&(!get('decade')||(p.releaseYear!==null&&Math.floor(p.releaseYear/10)*10===Number(get('decade')))));
 const sort=get('sort');
 return result.sort((a,b)=>{
 if(sort==='year-desc')return (b.releaseYear??-Infinity)-(a.releaseYear??-Infinity)||a.sourceOrder-b.sourceOrder;
 if(sort==='year-asc')return (a.releaseYear??Infinity)-(b.releaseYear??Infinity)||a.sourceOrder-b.sourceOrder;
 if(sort==='rating-desc')return b.personalRating-a.personalRating||a.sourceOrder-b.sourceOrder;
 if(sort==='rating-asc')return a.personalRating-b.personalRating||a.sourceOrder-b.sourceOrder;
 if(sort==='name')return a.nameEnglish.localeCompare(b.nameEnglish)||a.sourceOrder-b.sourceOrder;
 return a.sourceOrder-b.sourceOrder;
 });
}
export function paginate(items,page=1){const count=Math.max(1,Math.ceil(items.length/PAGE_SIZE));let current=Math.min(count,Math.max(1,parseInt(page)||1));return {items:items.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE),page:current,pages:count};}
export function archiveUrl(values){return '/archive?'+new URLSearchParams(Object.entries(values).filter(([,v])=>v!==null&&v!==undefined&&v!=='')).toString();}
export function randomBottle(except){const pool=except?source.filter(p=>p.id!==except):source;return pool[Math.floor(Math.random()*pool.length)];}
