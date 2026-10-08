import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const records=JSON.parse(fs.readFileSync('data/collection.json','utf8'));
const source=JSON.parse(fs.readFileSync('data/perfumes.json','utf8'));
const audit=JSON.parse(fs.readFileSync('data/source-audit.json','utf8'));
assert.equal(records.length,1612);assert.equal(new Set(records.map(p=>p.id)).size,1612);
assert.equal(audit.imagesMatchedToWordAndExcel,1612);assert.equal(audit.personalRatingsMatchedToWord,1612);
for(let i=0;i<records.length;i++){
 const p=records[i],s=source[i];assert.equal(p.id,s.id);assert.equal(p.personalRating,s.personalRating);assert.equal(p.releaseYear,s.releaseYear);assert.equal(p.description,s.description);assert.equal(p.image,s.image);assert.equal(p.imageHero||null,s.imageHero||null);
 assert(fs.statSync(path.join('public',p.image)).size>0);assert(!p.image.includes('pending'));
 assert.deepEqual(p.scents,(p.description.match(/^香调轮廓以(.+?)为主/)?.[1]||'').split('、').filter(Boolean));
}
await build({configFile:false,plugins:[react()],publicDir:false,logLevel:'error',build:{ssr:'components/ArchiveApp.jsx',outDir:'.qa',emptyOutDir:true,rollupOptions:{external:['react','react-dom','react-dom/server']}}});
const {PerfumeCard,DetailContent,Archive,Shelf,Brands,Timeline,FiveStar,Scents}=await import('../.qa/ArchiveApp.js');
const {PERFUMES,BRANDS,BY_ID,BRAND_BY_NAME,YEARS,DECADES,SCENTS,selectPerfumes,paginate}=await import('../.qa/library-model.js').catch(async()=>{
 // Bundle the actual model too so JSON loading is identical to the browser build.
 await build({configFile:false,publicDir:false,logLevel:'error',build:{ssr:'lib/library-model.mjs',outDir:'.qa/model',emptyOutDir:true}});
 return import('../.qa/model/library-model.js');
});
const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
const sources=html=>[...html.matchAll(/<img\b[^>]*data-perfume-id="([^"]+)"[^>]*src="([^"]+)"/g)].map(m=>({id:m[1],src:m[2]}));
assert.equal(new Set(BRANDS.map(b=>b.slug)).size,219,'brand slugs must be unique');
let seed=9182026;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const sample=[...records].sort(()=>0);for(let i=sample.length-1;i>0;i--){let j=Math.floor(random()*(i+1));[sample[i],sample[j]]=[sample[j],sample[i]];}
const worldCutouts=JSON.parse(fs.readFileSync('data/world-cutouts.json','utf8'));
const worldSrcFor=id=>worldCutouts[id]?`/thumbnails/${id}_world.webp`:null;
let imageChecks=[];
for(const p of sample.slice(0,100)){
 const b=BRAND_BY_NAME.get(p.brand);
 const archive=sources(render(Archive,{params:new URLSearchParams({query:p.nameEnglish}),path:'/archive'})).find(i=>i.id===p.id);
 // Exact record filter keeps the brand page test bounded, while using its real rendering.
 const brand=sources(render(Archive,{params:new URLSearchParams({query:p.nameEnglish}),path:'/brand/'+b.slug,baseItems:b.items,brand:b})).find(i=>i.id===p.id);
 const detail=sources(render(DetailContent,{perfume:p})).find(i=>i.id===p.id);
 const shelf=sources(render(Shelf,{items:[p]})).find(i=>i.id===p.id);
 for(const [name,value,expected] of [['archive',archive,p.image],['brand',brand,p.image],['shelf',shelf,p.image],['detail',detail,worldSrcFor(p.id)||p.imageHero||p.image]]){assert(value,`${p.id} missing rendered image in ${name}`);assert.equal(value.src,expected)}
 imageChecks.push({id:p.id,image:p.image,archive:true,brand:true,detail:true,shelf:true});
}
const all=selectPerfumes(new URLSearchParams());assert.equal(all.length,1612);assert.equal(paginate(all).pages,68);assert.equal(paginate(all,68).items.length,4);
const renderedAll=render(Archive,{params:new URLSearchParams()});assert.equal(sources(renderedAll).length,24);assert(renderedAll.includes('第 1 / 68 页'));
let count=0;for(let n=1;n<=68;n++)count+=paginate(all,n).items.length;assert.equal(count,1612);
for(const b of BRANDS){assert.equal(selectPerfumes(new URLSearchParams({brand:b.name})).length,b.items.length)}
assert.equal(selectPerfumes(new URLSearchParams({rating:'5'})).length,127);assert.equal(selectPerfumes(new URLSearchParams({year:'unknown'})).length,40);
assert.equal(selectPerfumes(new URLSearchParams({query:'Amouage'})).length,BRAND_BY_NAME.get('Amouage').items.length);
assert(selectPerfumes(new URLSearchParams({query:'檀香'})).every(p=>(p.nameChinese+p.description).includes('檀香')));
assert.equal(selectPerfumes(new URLSearchParams({query:'this-record-does-not-exist-918'})).length,0);
const yc=DECADES.reduce((n,d)=>n+selectPerfumes(new URLSearchParams({decade:d})).length,0);assert.equal(yc,1572);
for(const s of SCENTS)assert(selectPerfumes(new URLSearchParams({scent:s})).every(p=>p.scents.includes(s)));
for(const direction of ['asc','desc']){const list=selectPerfumes(new URLSearchParams({sort:'year-'+direction})).filter(p=>p.releaseYear);for(let i=1;i<list.length;i++)assert(direction==='asc'?list[i-1].releaseYear<=list[i].releaseYear:list[i-1].releaseYear>=list[i].releaseYear)}
for(const [C,props]of [[Brands,{params:new URLSearchParams()}],[Timeline,{params:new URLSearchParams()}],[FiveStar,{params:new URLSearchParams()}],[Scents,{params:new URLSearchParams()}]])assert(render(C,props).length>1000);
const reduced=fs.readFileSync('app/globals.css','utf8');assert(reduced.includes('@media(prefers-reduced-motion:reduce)'));assert(reduced.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
const report={records:1612,brands:219,ratingsPreserved:1612,imageSourceMatches:1612,randomCrossPageImageChecks:imageChecks,archive:{pageSize:24,pages:68,lastPage:4},fiveStar:127,timeline:1572,unknownYear:40,filtersAndSorting:'PASS',serverRenderedRoutes:'PASS',browserQA:'BLOCKED: cloud browser URL security policy',viewportQA:'Not visually tested; responsive CSS reviewed',safariQA:'Not available'};
fs.writeFileSync('data/validation-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,randomCrossPageImageChecks:imageChecks.length},null,2));
