// The entrance is a hand-composed field of real bottles in three depth layers
// around the "1612" monument. A camera dollies forward through it as the page
// scrolls. Geometry is plain data so it stays easy to tune and to test.
//
// HERO_IDS keeps its original format: scripts/validate-world-cutouts.mjs parses
// it to make sure every entrance bottle has a transparent world cutout.
export const HERO_IDS=['p0392','p0061','p0182','p0954','p0091','p0114','p0051','p0849','p0035','p0655','p0558','p0588','p0326','p0974','p0228','p0444','p0502','p0306','p1098','p0483','p1511','p0349','p0544','p0608','p0335','p1325','p0144','p1154'];

export const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
export const FOCAL=900;            // perspective focal length (px)
export const MONUMENT_Z=640;       // depth of the "1612" plane

// [x% of width, y% of height, depth, base height px (at depth 0), tilt deg]
// x/y are on-screen positions (from centre) when the camera is at rest.
// Depth < MONUMENT_Z sits in front of the numerals, > MONUMENT_Z behind them.
// The far bottles are written as *arrival* positions: where each sits on screen
// when the camera is ARRIVE px away, so they settle into view rather than
// flying straight past.
const ARRIVE=430;
const arrive=([x,y,z,h,t])=>{const k=(FOCAL+ARRIVE)/(FOCAL+z);return [x*k,y*k,z,h,t];};
const DESKTOP=[
 // foreground — large, cropped by the frame
 [-46,-6,-60,360,-5],[45,-22,20,360,6],
 // midground in front of the numerals
 [-31,-25,300,250,-3],[31,24,280,260,4],[17,-31,520,200,3],[-37,4,560,220,4],[38,2,600,220,-4],
 // behind the numerals
 [-12,-8,820,260,1],[12,-3,900,250,-2],[-26,-14,1000,230,-4],[27,-12,1060,230,4],[1,-25,1140,210,-1],
 // further in, met as the page scrolls
 ...[[-28,10,1500,280,-3],[26,-10,1560,280,3],[-20,-22,1700,250,2],[22,20,1760,250,-2]].map(arrive)
];
const LITE_SLOTS=[0,1,2,3,5,6,7,8,9,10,12,13];
const MOBILE=[
 [-37,-29,-20,210,-5],[40,7,40,200,5],
 [27,-29,300,170,4],[-31,6,340,170,-3],
 [-10,-23,820,180,2],[14,-6,900,170,-3],
 ...[[22,-16,1400,200,4],[-24,-6,1550,200,-4],[20,8,1650,190,3]].map(arrive)
];
export const TRAVEL={desktop:1250,lite:1250,mobile:1150};

export function entranceSlots(profile){
 if(profile==='mobile')return MOBILE;
 if(profile==='lite')return LITE_SLOTS.map(i=>DESKTOP[i]);
 return DESKTOP;
}

// Project a slot for a camera at depth `cam`, nudged by pointer parallax.
export function project(slot,{cam=0,width=1440,height=900,px=0,py=0,compact=false}){
 const [x,y,z,h,tilt]=slot;
 const depth=z-cam;
 const s=FOCAL/(FOCAL+Math.max(depth,-FOCAL*.86));
 // parallax: near objects move more than far ones
 const par=Math.min(1.6,s);
 // slot x/y are the on-screen position at cam=0; keep them on the same ray
 const ray=s/(FOCAL/(FOCAL+z));
 const sx=(x*width/100)*ray+px*par*42;
 const sy=(y*height/100)*ray+py*par*26;
 const sizeScale=(compact?Math.min(1,width/420):Math.min(1.15,Math.max(.72,width/1440)));
 // far objects sink into the dark, objects behind the camera vanish
 const fadeIn=clamp((3600-depth)/900);
 const fadeOut=clamp((depth+260)/240);
 const fog=depth>1200?.38+.62*clamp((2600-depth)/1400):1;
 return {x:sx,y:sy,scale:s*sizeScale,h,tilt,depth,opacity:fadeIn*fadeOut*fog,z:Math.round(10000-depth)};
}
