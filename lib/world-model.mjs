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
// The deep field is written as *arrival* positions instead: where the bottle
// sits on screen when the camera is ARRIVE px away, so each chapter of the
// journey is framed by bottles rather than crossed by them.
const ARRIVE=430;
const arrive=([x,y,z,h,t])=>{const k=(FOCAL+ARRIVE)/(FOCAL+z);return [x*k,y*k,z,h,t];};
const DESKTOP=[
 // foreground — large, cropped by the frame, softened by depth of field
 [-45,27,-60,400,-7],[46,-21,20,380,8],
 // midground in front of the numerals — the readable ring
 [-31,-24,300,260,-4],[31,23,280,270,5],[17,-31,520,210,4],[-37,3,560,230,6],[38,1,600,230,-5],
 // behind the numerals
 [-12,-7,820,280,1],[12,-3,900,270,-3],[-27,-13,1000,240,-5],[27,-12,1060,240,5],[1,-25,1140,220,-2],
 // deep field, framing each chapter as the camera arrives
 ...[[28,-12,1380,300,5],[18,22,1560,280,-4],[38,14,1700,240,6],
     [-30,10,1960,300,-5],[-19,-22,2120,280,4],[-40,-8,2260,240,-6],
     [-33,2,2520,300,4],[34,8,2600,300,-5],[0,-30,2700,240,2],
     [-24,-15,3120,290,-3],[25,16,3180,290,4],[-30,22,3300,240,5],[31,-20,3360,240,-4]].map(arrive)
];
const LITE_SLOTS=[0,1,2,3,5,6,7,8,10,12,13,15,16,18,19,21,22,23,24];
const MOBILE=[
 [-37,-29,-20,230,-6],[40,7,40,220,7],
 [27,-29,300,180,5],[-31,6,340,180,-4],
 [-10,-23,820,190,2],[14,-6,900,180,-4],
 ...[[22,-16,1400,210,5],[-24,-6,1950,210,-5],[24,-4,2380,210,4],[-22,-20,2500,200,-3],
     [-22,-14,2950,200,-3],[24,-6,3050,200,4]].map(arrive)
];
export const TRAVEL={desktop:2760,lite:2760,mobile:2600};

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
