import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Router, Link, Arrow } from '../lib/navigation';
import { FloatingBottle, Rating, hasCutout, hasPhoto, objectNo, toneFor } from './library-primitives';
import { PERFUMES, BY_ID, BRANDS, FIVE_STAR, SCENTS, YEARS } from '../lib/library-model.mjs';
import { HERO_IDS, MONUMENT_Z, FOCAL, TRAVEL, clamp, entranceSlots, project } from '../lib/world-model.mjs';

const nf = new Intl.NumberFormat('en-US');
const TOTAL = PERFUMES.length;
const FIRST_YEAR = Math.min(...YEARS), LAST_YEAR = Math.max(...YEARS);
const floats = p => hasCutout(p) && hasPhoto(p);
// Entrance cast: the curated hero list first, then the best-rated floating bottles.
const CAST = (() => {
  const hero = HERO_IDS.map(id => BY_ID.get(id)).filter(p => p && floats(p));
  const seen = new Set(hero.map(p => p.id));
  const extra = [...PERFUMES].filter(p => !seen.has(p.id) && floats(p)).sort((a, b) => b.personalRating - a.personalRating || a.sourceOrder - b.sourceOrder);
  return [...hero, ...extra];
})();
const pickFloating = (list, fallback) => list.find(floats) || fallback;
const PASSAGES = [
  { href: '/brands', no: '01', title: '品牌', figure: nf.format(BRANDS.length), unit: '个品牌', line: '按品牌排列的书架，从一个名字走进它的全部馆藏。', bottle: BY_ID.get('p0182') },
  { href: '/timeline', no: '02', title: '年代', figure: `${FIRST_YEAR}—${LAST_YEAR}`, unit: '', line: `沿着发行年份穿过 ${LAST_YEAR - FIRST_YEAR} 年，一个年代一个年代地走。`, bottle: pickFloating([...PERFUMES].filter(p => p.releaseYear).sort((a, b) => a.releaseYear - b.releaseYear), BY_ID.get('p0035')) },
  { href: '/scents', no: '03', title: '香调', figure: String(SCENTS.length), unit: '种香调', line: '从一种气味出发，找到与它同行的另一种。', bottle: BY_ID.get('p0954') },
  { href: '/five-star', no: '04', title: '五星', figure: String(FIVE_STAR.length), unit: '瓶', line: '我给出满分的那些，留在最里面的房间。', bottle: pickFloating(FIVE_STAR, BY_ID.get('p0849')) },
];
// Chapter captions that appear while the camera travels: [start, end] in scroll progress.
const CHAPTERS = [
  { range: [.25, .43], align: 'left', figure: String(BRANDS.length), title: '个品牌，同一间屋子', href: '/brands', link: '品牌书架' },
  { range: [.46, .64], align: 'right', figure: `${FIRST_YEAR}—${LAST_YEAR}`, title: `跨越 ${LAST_YEAR - FIRST_YEAR} 年的气味`, href: '/timeline', link: '时间长廊' },
  { range: [.67, .84], align: 'center', figure: String(FIVE_STAR.length), title: '瓶五星，留在最里面', href: '/five-star', link: '五星馆藏室' },
  { range: [.88, 1.3], align: 'center', figure: '', title: '再往里，是全部的馆藏', href: '#passages', link: '继续往里走', final: true },
];

function useScrollCamera({ root, stage, nodes, monument, title, chapters, profile, motion, count }) {
  useLayoutEffect(() => {
    const host = root.current, el = stage.current; if (!host || !el) return;
    const slots = entranceSlots(profile), travel = TRAVEL[profile], compact = profile === 'mobile';
    const soften = profile === 'desktop';
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
        const near = soften && v.depth < 90 && v.depth > -400;
        if (node._near !== near) { node.classList.toggle('is-near', near); node._near = near; }
        const hidden = v.opacity < .04;
        if (node._hidden !== hidden) { node.classList.toggle('is-gone', hidden); node._hidden = hidden; }
      }
      const md = MONUMENT_Z - cam, ms = FOCAL / (FOCAL + Math.max(md, -FOCAL * .8)) / m0;
      if (monument.current) {
        monument.current.style.transform = `translate3d(${(s.px * 14).toFixed(1)}px,${(s.py * 10).toFixed(1)}px,0) translate(-50%,-50%) scale(${ms.toFixed(4)})`;
        monument.current.style.opacity = clamp((md + 40) / 380).toFixed(3);
        monument.current.style.zIndex = String(Math.round(10000 - md));
      }
      if (title.current) {
        const t = clamp(s.p / .12);
        title.current.style.opacity = (1 - t).toFixed(3);
        title.current.style.transform = `translate3d(0,${(-t * 60).toFixed(1)}px,0)`;
        title.current.classList.toggle('is-gone', t > .98);
      }
      chapters.current.forEach((node, i) => {
        if (!node) return;
        const [a, b] = CHAPTERS[i].range, span = b - a;
        const t = clamp((s.p - a) / span);
        const o = clamp(t / .22) * clamp((1 - t) / .22);
        node.style.opacity = o.toFixed(3);
        node.style.transform = `translate3d(0,${((.5 - t) * 70).toFixed(1)}px,0)`;
        node.classList.toggle('is-live', o > .6);
      });
      el.style.setProperty('--p', s.p.toFixed(4));
    };
    const tick = () => {
      frame = 0; if (!live) return;
      const k = motion.reduced ? 1 : .085;
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

function Bottle({ perfume: p, slot, index, focused, onFocus, onOpen, register, eager }) {
  return <Link href={`/perfume/${p.id}`} elementRef={register}
    className={`bottle ${slot[2] < MONUMENT_Z ? 'in-front' : 'behind'} ${focused ? 'is-focus' : ''}`}
    style={{ '--h': slot[3] + 'px', '--i': index, '--tone': toneFor(p) }}
    aria-label={`${p.brand} ${p.nameChinese}，我的评分 ${p.personalRating}/5`}
    onMouseEnter={() => onFocus(p)} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(p)} onBlur={() => onFocus(null)}
    onClick={e => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onOpen(p, e.currentTarget); } }}>
    <span className="bottle-light" aria-hidden="true" />
    <span className="bottle-shadow" aria-hidden="true" />
    <span className="bottle-float"><FloatingBottle perfume={p} eager={eager} /></span>
  </Link>;
}

export function Entrance() {
  const { navigate, motion } = useContext(Router);
  const profile = motion.compact ? 'mobile' : motion.lite ? 'lite' : 'desktop';
  const slots = entranceSlots(profile);
  const cast = CAST.slice(0, slots.length);
  const root = useRef(null), stage = useRef(null), nodes = useRef([]), monument = useRef(null), title = useRef(null), chapters = useRef([]);
  const [focus, setFocus] = useState(null);
  useScrollCamera({ root, stage, nodes, monument, title, chapters, profile, motion, count: cast.length });
  const open = (p, el) => navigate('/perfume/' + p.id, { image: el.querySelector('img') });
  const enter = () => {
    const target = document.getElementById('passages');
    if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: motion.reduced ? 'auto' : 'smooth' });
  };
  return <div className={`entrance profile-${profile} ${motion.reduced ? 'is-still' : ''}`}>
    <div className="journey" ref={root}>
      <section className={`stage ${focus ? 'has-focus' : ''}`} ref={stage} aria-label="私藏香水世界入口">
        <div className="stage-air" aria-hidden="true"><i className="beam beam-a" /><i className="beam beam-b" /><i className="haze" /><i className="floor" /></div>
        <div className="monument" ref={monument} aria-hidden="true"><span className="monument-num">{TOTAL}</span></div>
        <div className="field">
          {cast.map((p, i) => <Bottle key={p.id} perfume={p} slot={slots[i]} index={i} eager={i < 10} focused={focus?.id === p.id} onFocus={setFocus} onOpen={open} register={n => { nodes.current[i] = n; }} />)}
        </div>
        <div className="stage-title" ref={title}>
          <p className="eyebrow">私人香水馆藏</p>
          <h1>私藏香水世界</h1>
          <p className="stage-sub">一个人的 {nf.format(TOTAL)} 瓶香水，{BRANDS.length} 个品牌，全部真实收藏。</p>
          <button className="scroll-cue" onClick={enter} data-reveal-skip=""><span>向下，走进去</span><i aria-hidden="true" /></button>
        </div>
        {!motion.reduced && CHAPTERS.map((c, i) => <div key={c.href} className={`chapter chapter-${c.align} ${c.final ? 'chapter-final' : ''}`} ref={n => { chapters.current[i] = n; }}>
          {c.figure && <p className="chapter-figure">{c.figure}</p>}
          <p className="chapter-title">{c.title}</p>
          {c.final ? <button className="scroll-cue" onClick={enter} tabIndex={-1}><span>{c.link}</span><i aria-hidden="true" /></button> : <Link className="text-link" href={c.href} tabIndex={-1}>{c.link}<Arrow /></Link>}
        </div>)}
        <div className={`plaque ${focus ? 'is-on' : ''}`} aria-hidden="true">
          {focus && <>
            <span className="plaque-no">馆藏编号 {objectNo(focus)}</span>
            <span className="plaque-brand">{focus.brand}</span>
            <strong className="plaque-name">{focus.nameChinese}</strong>
            <span className="plaque-en" lang="en">{focus.nameEnglish}</span>
            <Rating value={focus.personalRating} label={false} />
          </>}
        </div>
        <div className="stage-progress" aria-hidden="true"><i /></div>
      </section>
    </div>
    <Passages />
    <Spotlight motion={motion} />
    <section className="closing" data-reveal="">
      <p className="eyebrow">全部馆藏</p>
      <h2><span className="closing-num">{nf.format(TOTAL)}</span> 件馆藏，一件不少。</h2>
      <p>按品牌、年份、评分与香调精确检索，每页 24 件。</p>
      <div className="closing-actions"><Link className="button-gold" href="/archive">打开全部馆藏<Arrow /></Link><Link className="text-link" href="/search">直接检索<Arrow /></Link></div>
    </section>
  </div>;
}

function Passages() {
  const [hover, setHover] = useState(0);
  return <section className="passages" id="passages" aria-labelledby="passages-title">
    <div className="section-head" data-reveal="">
      <p className="eyebrow">从这里出发</p>
      <h2 id="passages-title">四条小径</h2>
      <p className="section-lede">同一间屋子，四种走法。</p>
    </div>
    <div className="passage-layout">
      <ol className="passage-list">
        {PASSAGES.map((x, i) => <li key={x.href} data-reveal="" style={{ '--d': i }}>
          <Link href={x.href} className={`passage ${hover === i ? 'is-on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}>
            <span className="passage-no">{x.no}</span>
            <span className="passage-title"><strong>{x.title}</strong></span>
            <span className="passage-figure">{x.figure}<small>{x.unit}</small></span>
            <span className="passage-line">{x.line}</span>
            <Arrow />
          </Link>
        </li>)}
      </ol>
      <div className="passage-visual" aria-hidden="true">
        {PASSAGES.map((x, i) => x.bottle && <div key={x.href} className={`passage-bottle ${hover === i ? 'is-on' : ''}`} style={{ '--tone': toneFor(x.bottle) }}>
          <i className="bottle-light" /><i className="bottle-shadow" /><FloatingBottle perfume={x.bottle} />
        </div>)}
      </div>
    </div>
  </section>;
}

const DRAW_POOL = PERFUMES.filter(floats);
function Spotlight({ motion }) {
  const { navigate } = useContext(Router);
  const [p, setP] = useState(() => BY_ID.get('p0849') && floats(BY_ID.get('p0849')) ? BY_ID.get('p0849') : DRAW_POOL[0] || PERFUMES[0]);
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const draw = () => { let next = p; while (next.id === p.id && DRAW_POOL.length > 1) next = DRAW_POOL[Math.floor(Math.random() * DRAW_POOL.length)]; setP(next); setN(n + 1); };
  return <section className="spotlight" style={{ '--tone': toneFor(p) }} aria-labelledby="spotlight-title" ref={ref}>
    <div className="spotlight-copy" data-reveal="">
      <p className="eyebrow">随机</p>
      <h2 id="spotlight-title">闭上眼，抽一瓶</h2>
      <div className="spotlight-card" key={n}>
        <p className="spotlight-brand">{p.brand}</p>
        <p className="spotlight-name">{p.nameChinese}</p>
        <p className="spotlight-en" lang="en">{p.nameEnglish}</p>
        <p className="spotlight-meta"><span>{p.releaseYear || '年份待核实'}</span><Rating value={p.personalRating} /></p>
      </div>
      <div className="spotlight-actions">
        <button className="button-gold" onClick={draw}>再抽一瓶 <span aria-hidden="true">↻</span></button>
        <Link className="text-link" href={`/perfume/${p.id}`} onClick={e => { e.preventDefault(); navigate(`/perfume/${p.id}`, { image: ref.current?.querySelector('.spotlight-stage img') }); }}>走近这瓶<Arrow /></Link>
      </div>
    </div>
    <Link className="spotlight-stage" href={`/perfume/${p.id}`} aria-label={`走近 ${p.nameChinese}`}>
      <span className="spot-cone" aria-hidden="true" />
      <span className="spot-object" key={p.id}><i className="bottle-shadow" aria-hidden="true" /><FloatingBottle perfume={p} eager={false} /></span>
    </Link>
  </section>;
}
