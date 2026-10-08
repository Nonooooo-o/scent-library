import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import { Router, Link, Arrow } from '../lib/navigation';
import { Bottle, Rating, hasCutout, hasPhoto } from './library-primitives';
import { PERFUMES, BY_ID, BRANDS, FIVE_STAR, SCENTS, YEARS } from '../lib/library-model.mjs';
import { HERO_IDS, MONUMENT_Z, FOCAL, TRAVEL, clamp, entranceSlots, project } from '../lib/world-model.mjs';

const nf = new Intl.NumberFormat('en-US');
const TOTAL = PERFUMES.length;
const FIRST_YEAR = Math.min(...YEARS), LAST_YEAR = Math.max(...YEARS);
const floats = p => hasCutout(p) && hasPhoto(p);
// The entrance cast: the curated hero list first, then the best-rated bottles with cutouts.
const CAST = (() => {
  const hero = HERO_IDS.map(id => BY_ID.get(id)).filter(p => p && floats(p));
  const seen = new Set(hero.map(p => p.id));
  return [...hero, ...PERFUMES.filter(p => !seen.has(p.id) && floats(p)).sort((a, b) => b.personalRating - a.personalRating || a.sourceOrder - b.sourceOrder)];
})();
const INDEX = [
  { href: '/archive', label: '全部馆藏', value: `${nf.format(TOTAL)} 款` },
  { href: '/brands', label: '品牌', value: `${BRANDS.length} 个` },
  { href: '/timeline', label: '年代', value: `${FIRST_YEAR}–${LAST_YEAR}` },
  { href: '/scents', label: '香调', value: `${SCENTS.length} 种` },
  { href: '/five-star', label: '五星', value: `${FIVE_STAR.length} 款` },
];
const FIVE_PICK = FIVE_STAR.filter(hasPhoto).slice(0, 8);

// Native scroll drives a camera through the bottles; rAF only while it moves.
function useScrollCamera({ root, stage, nodes, monument, profile, motion, count }) {
  useLayoutEffect(() => {
    const host = root.current, el = stage.current; if (!host || !el) return;
    const slots = entranceSlots(profile), travel = TRAVEL[profile], compact = profile === 'mobile';
    let width = el.clientWidth, height = el.clientHeight, top = 0, distance = 1, frame = 0, live = true;
    const s = { p: 0, target: 0, px: 0, py: 0, tx: 0, ty: 0 };
    const m0 = FOCAL / (FOCAL + MONUMENT_Z);
    const render = () => {
      const cam = s.p * travel;
      for (let i = 0; i < count; i++) {
        const node = nodes.current[i]; if (!node) continue;
        const v = project(slots[i], { cam, width, height, px: s.px, py: s.py, compact });
        node.style.transform = `translate3d(${v.x.toFixed(1)}px,${v.y.toFixed(1)}px,0) translate(-50%,-50%) scale(${v.scale.toFixed(4)}) rotate(${v.tilt}deg)`;
        node.style.opacity = v.opacity.toFixed(3);
        node.style.zIndex = String(v.z);
        const hidden = v.opacity < .04;
        if (node._hidden !== hidden) { node.classList.toggle('is-gone', hidden); node._hidden = hidden; }
      }
      if (monument.current) {
        const md = MONUMENT_Z - cam, ms = FOCAL / (FOCAL + Math.max(md, -FOCAL * .8)) / m0;
        monument.current.style.transform = `translate3d(${(s.px * 10).toFixed(1)}px,${(s.py * 6).toFixed(1)}px,0) translate(-50%,-50%) scale(${ms.toFixed(4)})`;
        monument.current.style.opacity = clamp((md + 40) / 420).toFixed(3);
        monument.current.style.zIndex = String(Math.round(10000 - md));
      }
    };
    const tick = () => {
      frame = 0; if (!live) return;
      const k = motion.reduced ? 1 : .1;
      s.p += (s.target - s.p) * k; s.px += (s.tx - s.px) * .06; s.py += (s.ty - s.py) * .06;
      const moving = Math.abs(s.target - s.p) > .0002 || Math.abs(s.tx - s.px) > .001 || Math.abs(s.ty - s.py) > .001;
      if (!moving) { s.p = s.target; s.px = s.tx; s.py = s.ty; }
      render();
      if (moving && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const kick = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const onScroll = () => { s.target = motion.reduced ? 0 : clamp((window.scrollY - top) / distance); kick(); };
    const measure = () => {
      width = el.clientWidth; height = el.clientHeight;
      top = window.scrollY + host.getBoundingClientRect().top; distance = Math.max(1, host.offsetHeight - height);
      onScroll();
    };
    const onPointer = e => {
      if (e.pointerType !== 'mouse' || motion.lite) return;
      s.tx = e.clientX / window.innerWidth - .5; s.ty = e.clientY / window.innerHeight - .5; kick();
    };
    measure(); s.p = s.target; render();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', kick);
    return () => {
      live = false; cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onPointer); document.removeEventListener('visibilitychange', kick);
    };
  }, [profile, motion.reduced, motion.lite, count]);
}

export function Entrance() {
  const { navigate, motion } = useContext(Router);
  const profile = motion.compact ? 'mobile' : motion.lite ? 'lite' : 'desktop';
  const slots = entranceSlots(profile);
  const cast = CAST.slice(0, slots.length);
  const root = useRef(null), stage = useRef(null), nodes = useRef([]), monument = useRef(null);
  const [focus, setFocus] = useState(null);
  useScrollCamera({ root, stage, nodes, monument, profile, motion, count: cast.length });
  const open = (p, el) => navigate('/perfume/' + p.id, { image: el.querySelector('img') });
  return <div className={`home profile-${profile} ${motion.reduced ? 'is-still' : ''}`}>
    <div className="journey" ref={root}>
      <section className={`stage ${focus ? 'has-focus' : ''}`} ref={stage} aria-label="馆藏入口">
        <div className="monument" ref={monument} aria-hidden="true">{TOTAL}</div>
        <div className="field">
          {cast.map((p, i) => <Link key={p.id} href={`/perfume/${p.id}`} elementRef={n => { nodes.current[i] = n; }}
            className={`float ${focus?.id === p.id ? 'is-focus' : ''}`} style={{ '--h': slots[i][3] + 'px' }}
            aria-label={`${p.brand} ${p.nameChinese}`}
            onMouseEnter={() => setFocus(p)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(p)} onBlur={() => setFocus(null)}
            onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); open(p, e.currentTarget); } }}>
            <Bottle perfume={p} size="float" eager={i < 10} />
          </Link>)}
        </div>
        <div className="stage-copy">
          <h1>私藏香水世界</h1>
          <p>{nf.format(TOTAL)} 款香水，{BRANDS.length} 个品牌，个人收藏与评分。</p>
        </div>
        <p className={`stage-caption ${focus ? 'is-on' : ''}`} aria-hidden="true">
          {focus && <><span>{focus.brand}</span>{focus.nameChinese}<span className="muted">{focus.releaseYear || ''}</span></>}
        </p>
      </section>
    </div>

    <section className="home-section">
      <h2 className="section-title">馆藏索引</h2>
      <ul className="index-list">
        {INDEX.map(x => <li key={x.href}><Link href={x.href}><span>{x.label}</span><span className="index-value">{x.value}</span><Arrow /></Link></li>)}
      </ul>
    </section>

    <section className="home-section">
      <div className="section-row"><h2 className="section-title">五星</h2><Link className="text-link" href="/five-star">全部 {FIVE_STAR.length} 款<Arrow /></Link></div>
      <div className="grid">{FIVE_PICK.map(p => <MiniCard key={p.id} perfume={p} />)}</div>
    </section>

    <RandomPick />
  </div>;
}

function MiniCard({ perfume: p }) {
  return <article className="card"><Link href={`/perfume/${p.id}`}>
    <span className="card-media"><Bottle perfume={p} /></span>
    <span className="card-caption"><span className="card-brand">{p.brand}</span><span className="card-name">{p.nameChinese}</span><span className="card-meta"><span>{p.releaseYear || '年份待核实'}</span><Rating value={p.personalRating} /></span></span>
  </Link></article>;
}

const DRAW_POOL = PERFUMES.filter(hasPhoto);
function RandomPick() {
  const [p, setP] = useState(() => DRAW_POOL[Math.floor(Math.random() * DRAW_POOL.length)]);
  const draw = () => { let next = p; while (next.id === p.id && DRAW_POOL.length > 1) next = DRAW_POOL[Math.floor(Math.random() * DRAW_POOL.length)]; setP(next); };
  return <section className="home-section random">
    <div className="section-row"><h2 className="section-title">随机一款</h2><button className="text-link" onClick={draw}>换一款<Arrow /></button></div>
    <Link className="random-item" href={`/perfume/${p.id}`} key={p.id}>
      <span className="random-media"><Bottle perfume={p} size="stage" eager /></span>
      <span className="random-copy">
        <span className="card-brand">{p.brand}</span>
        <span className="random-name">{p.nameChinese}</span>
        <span className="random-en" lang="en">{p.nameEnglish}</span>
        <span className="random-meta">{p.releaseYear || '年份待核实'} · 我的评分 <Rating value={p.personalRating} /></span>
        {p.scents.length > 0 && <span className="random-meta">{p.scents.join('、')}</span>}
      </span>
    </Link>
  </section>;
}
