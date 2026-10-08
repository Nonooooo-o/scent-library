"use client";
import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PERFUMES, BY_ID, FIVE_STAR, BRANDS, BRAND_BY_SLUG, BRAND_BY_NAME, YEARS, SCENTS, DECADES, selectPerfumes, paginate, archiveUrl, randomBottle } from '../lib/library-model.mjs';
import { Router, Link, Arrow, SearchIcon } from '../lib/navigation';
import { useMotionProfile } from '../lib/motion.mjs';
import { Vitrine, FloatingBottle, Rating, hasCutout, hasPhoto, isTiny, objectNo, toneFor } from './library-primitives';
import { Entrance } from './world-scenes';
export { Vitrine as PerfumeImage } from './library-primitives';

const nf = new Intl.NumberFormat('en-US');
const fmt = n => nf.format(n);
const byId = id => BY_ID.get(id);
const TOTAL = PERFUMES.length;
const INDEX_OF = new Map(PERFUMES.map((p, i) => [p.id, i]));
const decadeOf = y => Math.floor(y / 10) * 10;
function locationValue() { return typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search; }

// ---------------------------------------------------------------- cards ----
export function PerfumeCard({ perfume: p, eager = false }) {
  const { focusId } = useContext(Router);
  return <article className={`card ${p.personalRating === 5 ? 'is-five' : ''}`} data-record={p.id}>
    <Link href={`/perfume/${p.id}`}>
      <span className="card-media"><Vitrine perfume={p} eager={eager} focusId={focusId} shared /><span className="card-no">{objectNo(p)}</span></span>
      <span className="card-caption">
        <span className="card-brand">{p.brand}</span>
        <span className="card-name">{p.nameChinese}</span>
        <span className="card-en" lang="en">{p.nameEnglish}</span>
        <span className="card-meta"><span>{p.releaseYear || '年份待核实'}</span><Rating value={p.personalRating} label={false} /></span>
      </span>
    </Link>
  </article>;
}
function Grid({ items, className = '' }) { return <div className={`grid ${className}`}>{items.map((p, i) => <PerfumeCard key={p.id} perfume={p} eager={i < 4} />)}</div>; }

export function Shelf({ items, label, limit }) {
  const ref = useRef(null), drag = useRef(null);
  const visible = limit ? items.slice(0, limit) : items;
  const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const by = d => ref.current?.scrollBy({ left: d * Math.max(280, ref.current.clientWidth * .8), behavior: smooth() });
  return <div className="shelf-wrap">
    <div className="shelf" ref={ref} tabIndex={0} aria-label={label || '横向浏览，使用左右方向键'}
      onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); by(e.key === 'ArrowRight' ? 1 : -1); } }}
      onPointerDown={e => { if (e.pointerType === 'mouse') drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }; }}
      onPointerMove={e => { const d = drag.current; if (!d) return; if (Math.abs(e.clientX - d.x) > 5) d.moved = true; if (d.moved) { ref.current.scrollLeft = d.left - (e.clientX - d.x); ref.current.classList.add('dragging'); } }}
      onPointerUp={() => { ref.current?.classList.remove('dragging'); setTimeout(() => { drag.current = null; }, 0); }}
      onPointerLeave={() => { ref.current?.classList.remove('dragging'); drag.current = null; }}
      onClickCapture={e => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}>
      {visible.map((p, i) => <div className="shelf-item" key={p.id}><PerfumeCard perfume={p} eager={i < 3} /></div>)}
    </div>
    {visible.length > 2 && <div className="shelf-controls"><span>拖动或滑动</span><div><button aria-label="向左" onClick={() => by(-1)}><Arrow back /></button><button aria-label="向右" onClick={() => by(1)}><Arrow /></button></div></div>}
  </div>;
}

// --------------------------------------------------------------- chrome ----
const NAV = [['/', '漫游'], ['/archive', '全部馆藏'], ['/brands', '品牌'], ['/timeline', '年代'], ['/scents', '香调'], ['/five-star', '五星']];
function Header({ route }) {
  const [open, setOpen] = useState(false), [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => { const on = () => setScrolled(window.scrollY > 24); on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('menu-open', open);
    if (!open) return;
    const key = e => { if (e.key === 'Escape') { setOpen(false); menuRef.current?.focus(); } };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [open]);
  const active = href => href === '/' ? route === '/' || route === '/explore' : href === '/archive' ? route === '/archive' || route === '/all' : href === '/brands' ? route === '/brands' || route.startsWith('/brand/') : route === href;
  return <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
    <Link className="wordmark" href="/" aria-label="私藏香水世界 首页"><span className="wordmark-zh">私藏香水世界</span><span className="wordmark-en">Private Scent Library</span></Link>
    <nav className="nav" aria-label="主导航">{NAV.slice(1).map(([href, zh]) => <Link key={href} href={href} className={active(href) ? 'is-active' : ''} aria-current={active(href) ? 'page' : undefined}>{zh}</Link>)}</nav>
    <div className="header-actions">
      <Link href="/search" className="search-link" aria-label="检索馆藏"><SearchIcon /><span>检索</span></Link>
      <button ref={menuRef} className="menu-button" aria-label={open ? '关闭导航' : '打开导航'} aria-expanded={open} aria-controls="menu-panel" onClick={() => setOpen(!open)}><span /><span /></button>
    </div>
    <nav className="menu-panel" id="menu-panel" aria-label="手机导航" hidden={!open}>
      {NAV.map(([href, zh], i) => <Link key={href} href={href} className={active(href) ? 'is-active' : ''} style={{ '--d': i }}><span className="menu-no">0{i + 1}</span><span className="menu-zh">{zh}</span></Link>)}
      <Link href="/search" style={{ '--d': NAV.length }}><span className="menu-no">0{NAV.length + 1}</span><span className="menu-zh">检索</span></Link>
    </nav>
  </header>;
}
function Footer() {
  return <footer className="site-footer">
    <div className="footer-mark"><span className="footer-zh">私藏香水世界</span><span className="footer-en">Private Scent Library</span></div>
    <nav className="footer-links" aria-label="页脚导航">{NAV.map(([href, zh]) => <Link key={href} href={href}>{zh}</Link>)}<Link href="/about">关于</Link></nav>
    <p className="footer-note">{fmt(TOTAL)} 件馆藏 · {BRANDS.length} 个品牌 · 评分皆为个人判断</p>
    <a className="footer-top" href="#main">回到顶部 <span aria-hidden="true">↑</span></a>
  </footer>;
}
function PageHero({ eyebrow, title, ghost, children, className = '' }) {
  return <header className={`page-hero ${className}`}>
    {ghost && <span className="page-ghost" aria-hidden="true">{ghost}</span>}
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    {children && <div className="page-hero-aside">{children}</div>}
  </header>;
}
function Pagination({ page, pages, total, onPage }) {
  if (total === 0 || pages < 2) return null;
  const nums = [1, ...Array.from({ length: 5 }, (_, i) => page - 2 + i).filter(n => n > 1 && n < pages), pages].filter((n, i, a) => a.indexOf(n) === i);
  return <nav className="pagination" aria-label="分页">
    <span className="pagination-info">第 {page} / {pages} 页 <span className="muted">· {fmt(total)} 件</span></span>
    <div>
      <button aria-label="上一页" disabled={page === 1} onClick={() => onPage(page - 1)}><Arrow back /></button>
      {nums.map((n, i) => <React.Fragment key={n}>{i > 0 && n > nums[i - 1] + 1 && <span className="page-gap">…</span>}<button className={n === page ? 'is-current' : ''} aria-label={`第 ${n} 页`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button></React.Fragment>)}
      <button aria-label="下一页" disabled={page === pages} onClick={() => onPage(page + 1)}><Arrow /></button>
    </div>
  </nav>;
}
function Empty({ reset }) { return <div className="empty"><p className="empty-mark" aria-hidden="true">∅</p><h2>还没有找到这瓶香水</h2><p>试试另一个名称，或减少筛选条件。</p><button className="button-ghost" onClick={reset}>清除筛选</button></div>; }
function ViewToggle({ value, onChange }) { return <div className="view-toggle" role="group" aria-label="浏览方式"><button aria-pressed={value === 'grid'} onClick={() => onChange('grid')}>网格</button><button aria-pressed={value === 'shelf'} onClick={() => onChange('shelf')}>陈列架</button></div>; }

// -------------------------------------------------------------- archive ----
function BrandHero({ brand }) {
  const years = brand.items.map(p => p.releaseYear).filter(Boolean);
  const five = brand.items.filter(p => p.personalRating === 5).length;
  const ranked = [...brand.items].sort((a, b) => b.personalRating - a.personalRating);
  const lead = ranked.find(p => hasCutout(p) && hasPhoto(p)) || ranked.find(hasPhoto) || ranked.find(isTiny);
  const display = brand.english || brand.name;
  return <header className="page-hero brand-hero" style={{ '--tone': toneFor(lead || brand.items[0]) }}>
    <span className={`brand-ghost ${display.length > 14 ? 'is-long' : ''}`} aria-hidden="true">{display}</span>
    <p className="eyebrow">品牌书架 · 第 {brand.index + 1} / {BRANDS.length} 座</p>
    <h1>{brand.name}</h1>
    {brand.english && brand.english !== brand.name && <p className="brand-en" lang="en">{brand.english}</p>}
    <dl className="brand-facts">
      <div><dt>馆藏</dt><dd>{brand.items.length}<small>件</small></dd></div>
      {years.length > 0 && <div><dt>年份</dt><dd>{Math.min(...years) === Math.max(...years) ? Math.min(...years) : `${Math.min(...years)}—${Math.max(...years)}`}</dd></div>}
      <div><dt>五星</dt><dd>{five}<small>瓶</small></dd></div>
    </dl>
    {lead && <div className="brand-hero-bottle" aria-hidden="true"><i className="bottle-light" /><i className="bottle-shadow" /><FloatingBottle perfume={lead} eager /></div>}
  </header>;
}
export function Archive({ params, path = '/archive', search = false, baseItems = PERFUMES, title = '全部馆藏', en = '完整索引', brand = null }) {
  const { navigate } = useContext(Router);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const items = useMemo(() => selectPerfumes(params, baseItems), [params.toString(), baseItems]);
  const pagination = paginate(items, params.get('page'));
  const view = params.get('view') === 'shelf' ? 'shelf' : 'grid';
  const update = (values, { replace = true } = {}) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values)) { if (v === null || v === '' || v === 'grid') next.delete(k); else next.set(k, String(v)); }
    if (!('page' in values)) next.delete('page');
    navigate(path + (next.size ? '?' + next : ''), { replace, keepScroll: replace, transition: false });
  };
  const turnPage = p => { update({ page: p }, { replace: false }); };
  const filters = ['brand', 'rating', 'year', 'scent', 'decade'].filter(k => params.has(k));
  const label = k => k === 'rating' ? `${params.get(k)} / 5` : k === 'decade' ? `${params.get(k)} 年代` : params.get(k) === 'unknown' ? '年份待核实' : params.get(k);
  const next = brand && BRANDS[(brand.index + 1) % BRANDS.length];
  return <div className={`page archive-page ${brand ? 'is-brand' : ''}`}>
    {brand ? <BrandHero brand={brand} /> : <PageHero eyebrow={en} title={title} ghost={search ? '?' : fmt(baseItems.length)}><p>{search ? '名称、品牌、气味，输入即检索。' : `${fmt(baseItems.length)} 件馆藏，按原始顺序排列，也可以任意筛选。`}</p></PageHero>}
    <div className="toolbar">
      <label className="search-field"><SearchIcon /><input autoFocus={search} type="search" value={params.get('query') || ''} onChange={e => update({ query: e.target.value })} placeholder={brand ? `在 ${brand.name} 中搜索` : '搜索名称、品牌或气味'} aria-label="搜索名称、品牌或气味" />{params.get('query') && <button onClick={() => update({ query: '' })} aria-label="清除搜索">×</button>}</label>
      <div className="toolbar-actions">
        <button className="filter-toggle" aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen(!filtersOpen)}>筛选{filters.length > 0 && <span className="count-badge">{filters.length}</span>}<span aria-hidden="true">{filtersOpen ? '−' : '+'}</span></button>
        <ViewToggle value={view} onChange={v => update({ view: v })} />
      </div>
    </div>
    <div className={`filters ${filtersOpen ? 'is-open' : ''}`} id="filters">
      {!brand && <label>品牌<select value={params.get('brand') || ''} onChange={e => update({ brand: e.target.value })}><option value="">所有品牌</option>{[...BRANDS].sort((a, b) => a.sortName.localeCompare(b.sortName)).map(b => <option key={b.name} value={b.name}>{b.name}（{b.items.length}）</option>)}</select></label>}
      <label>发行年份<select value={params.get('year') || ''} onChange={e => update({ year: e.target.value, decade: '' })}><option value="">所有年份</option>{YEARS.map(y => <option key={y}>{y}</option>)}<option value="unknown">待核实</option></select></label>
      <label>个人评分<select value={params.get('rating') || ''} onChange={e => update({ rating: e.target.value })}><option value="">所有评分</option>{[5, 4, 3, 2, 1].map(n => <option value={n} key={n}>{n} / 5</option>)}</select></label>
      <label>香调<select value={params.get('scent') || ''} onChange={e => update({ scent: e.target.value })}><option value="">所有香调</option>{SCENTS.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>排序<select value={params.get('sort') || ''} onChange={e => update({ sort: e.target.value })}><option value="">原始顺序</option><option value="name">名称 A–Z</option><option value="year-desc">年份 · 从近到远</option><option value="year-asc">年份 · 从远到近</option><option value="rating-desc">评分 · 从高到低</option><option value="rating-asc">评分 · 从低到高</option></select></label>
    </div>
    <div className="results-bar">
      <p aria-live="polite"><strong>{fmt(items.length)}</strong> 件馆藏{(filters.length > 0 || params.get('query')) && <button className="reset-link" onClick={() => navigate(path, { replace: true, keepScroll: true, transition: false })}>清除筛选 ×</button>}</p>
      {filters.length > 0 && <div className="chips">{filters.map(k => <button key={k} onClick={() => update({ [k]: '' })}>{label(k)} <span aria-hidden="true">×</span></button>)}</div>}
    </div>
    {items.length === 0 ? <Empty reset={() => navigate(path, { replace: true, transition: false })} /> : view === 'grid' ? <Grid items={pagination.items} /> : <Shelf items={pagination.items} label="本页陈列架" />}
    <Pagination page={pagination.page} pages={pagination.pages} total={items.length} onPage={turnPage} />
    {next && <Link className="next-room" href={`/brand/${next.slug}`}><span className="eyebrow">下一座书架</span><span className="next-room-name">{next.english || next.name}</span><span className="next-room-meta">{next.name} · {next.items.length} 件<Arrow /></span></Link>}
  </div>;
}

// --------------------------------------------------------------- brands ----
export function Brands({ params }) {
  const { navigate } = useContext(Router);
  const query = params.get('query') || '', sort = params.get('sort') || 'az';
  const peek = useRef(null);
  const [hover, setHover] = useState(null);
  const update = (key, value) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); navigate('/brands' + (next.size ? '?' + next : ''), { replace: true, keepScroll: true, transition: false }); };
  const brands = BRANDS.filter(b => `${b.name} ${b.english} ${b.sortName}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'count' ? b.items.length - a.items.length : sort === 'original' ? a.index - b.index : a.sortName.localeCompare(b.sortName));
  const groups = sort === 'az' ? [...new Set(brands.map(b => b.letter))].sort().map(letter => ({ letter, items: brands.filter(b => b.letter === letter) })) : [{ letter: sort === 'count' ? '按数量' : '原始顺序', items: brands }];
  const move = e => { if (peek.current) peek.current.style.transform = `translate3d(${e.clientX + 28}px,${e.clientY - 120}px,0)`; };
  const peekItems = hover ? [...hover.items].filter(hasPhoto).sort((a, b) => b.personalRating - a.personalRating).slice(0, 3) : [];
  return <div className="page brands-page" onPointerMove={move}>
    <PageHero eyebrow="品牌索引" title="品牌书架" ghost={String(BRANDS.length)}><p>{BRANDS.length} 个品牌，{fmt(TOTAL)} 件馆藏。每一个名字，都是一座书架。</p></PageHero>
    <div className="toolbar">
      <label className="search-field"><SearchIcon /><input type="search" aria-label="搜索品牌" placeholder="寻找一个品牌" value={query} onChange={e => update('query', e.target.value)} /></label>
      <label className="inline-select">排列<select value={sort} onChange={e => update('sort', e.target.value)}><option value="az">A–Z</option><option value="count">馆藏数量</option><option value="original">原始顺序</option></select></label>
    </div>
    {sort === 'az' && <nav className="alphabet" aria-label="品牌首字母">{groups.map(g => <a key={g.letter} href={`#letter-${g.letter}`} onClick={e => { e.preventDefault(); document.getElementById(`letter-${g.letter}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>{g.letter}</a>)}</nav>}
    {groups.map(g => <section className="brand-group" key={g.letter} id={`letter-${g.letter}`}>
      <h2 className="brand-letter" data-reveal="">{g.letter}</h2>
      <ul className="brand-list">{g.items.map(b => <li key={b.slug}><Link className="brand-row" href={`/brand/${b.slug}`} onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)}>
        <span className="brand-row-name"><strong lang={b.english ? 'en' : undefined}>{b.english || b.name}</strong>{b.english && b.english !== b.name && <small>{b.name}</small>}</span>
        <span className="brand-row-count">{b.items.length}</span>
      </Link></li>)}</ul>
    </section>)}
    {brands.length === 0 && <Empty reset={() => navigate('/brands', { replace: true, transition: false })} />}
    <div className={`brand-peek ${hover && peekItems.length ? 'is-on' : ''}`} ref={peek} aria-hidden="true">
      {peekItems.map(p => <Vitrine key={p.id} perfume={p} size="thumb" sizes="120px" />)}
      {hover && <span className="brand-peek-label">{hover.name} · {hover.items.length} 件</span>}
    </div>
  </div>;
}

// ------------------------------------------------------------- timeline ----
const ERAS = DECADES.map(decade => ({ decade, items: PERFUMES.filter(p => p.releaseYear && decadeOf(p.releaseYear) === decade).sort((a, b) => a.releaseYear - b.releaseYear || a.sourceOrder - b.sourceOrder) }));
export function Timeline({ params }) {
  const requested = Number(params.get('decade'));
  const [active, setActive] = useState(DECADES.includes(requested) ? requested : DECADES[0]);
  const roots = useRef(new Map());
  useEffect(() => {
    const io = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) setActive(Number(entry.target.dataset.decade)); }, { rootMargin: '-35% 0px -55% 0px' });
    roots.current.forEach(el => el && io.observe(el)); return () => io.disconnect();
  }, []);
  useEffect(() => { if (DECADES.includes(requested)) { const t = setTimeout(() => roots.current.get(requested)?.scrollIntoView({ block: 'start' }), 120); return () => clearTimeout(t); } }, [requested]);
  const dated = PERFUMES.filter(p => p.releaseYear).length;
  const go = d => roots.current.get(d)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  return <div className="page timeline-page">
    <PageHero eyebrow="按发行年份" title="时间长廊" ghost={`${DECADES[0]}`}><p>{fmt(dated)} 件有确切年份的馆藏，从 {Math.min(...YEARS)} 到 {Math.max(...YEARS)}。另有 {TOTAL - dated} 件，年份待核实。</p></PageHero>
    <div className="timeline">
      <aside className="timeline-axis" aria-label="年代">
        <p className="axis-label">正在经过</p>
        <p className="axis-now" key={active}>{active}<span>年代</span></p>
        <nav>{DECADES.map(d => <button key={d} className={d === active ? 'is-active' : ''} onClick={() => go(d)}>{d}<span>{ERAS.find(e => e.decade === d).items.length}</span></button>)}</nav>
      </aside>
      <div className="eras">
        {ERAS.map(({ decade, items }) => {
          const first = items[0].releaseYear, last = items[items.length - 1].releaseYear;
          return <section id={`decade-${decade}`} data-decade={decade} className="era" key={decade} ref={el => roots.current.set(decade, el)}>
            <div className="era-head" data-reveal="">
              <h2>{decade}<span>年代</span></h2>
              <p>{first === last ? first : `${first} — ${last}`} · {items.length} 件</p>
              <Link className="text-link" href={archiveUrl({ decade, sort: 'year-asc' })}>这一年代的全部<Arrow /></Link>
            </div>
            <Shelf items={items} limit={12} label={`${decade} 年代馆藏`} />
          </section>;
        })}
        <div className="era-unknown"><p>另有 {TOTAL - dated} 件，年份待核实。</p><Link className="text-link" href={archiveUrl({ year: 'unknown' })}>查看这些馆藏<Arrow /></Link></div>
      </div>
    </div>
  </div>;
}

// ------------------------------------------------------------ five star ----
export function FiveStar({ params }) {
  const { navigate } = useContext(Router);
  const page = paginate(FIVE_STAR, params.get('page'));
  return <div className="page five-page">
    <header className="page-hero five-hero">
      <span className="five-mark" aria-hidden="true">5<small>/5</small></span>
      <p className="eyebrow">最里面的房间</p>
      <h1>五星馆藏室</h1>
      <div className="page-hero-aside"><p>{FIVE_STAR.length} 瓶，我给出满分的那些。<br /><span className="muted">留在心里的气味，留在最里面的房间。</span></p></div>
    </header>
    <Grid items={page.items} className="grid-five" />
    <Pagination page={page.page} pages={page.pages} total={FIVE_STAR.length} onPage={p => navigate('/five-star?page=' + p)} />
  </div>;
}

// --------------------------------------------------------------- scents ----
const SCENT_COUNT = new Map(SCENTS.map(s => [s, PERFUMES.filter(p => p.scents.includes(s)).length]));
const MAX_SCENT = Math.max(...SCENT_COUNT.values());
export function Scents({ params }) {
  const { navigate } = useContext(Router);
  const selected = SCENTS.includes(params.get('scent')) ? params.get('scent') : SCENTS[0];
  const matching = PERFUMES.filter(p => p.scents.includes(selected));
  const related = SCENTS.filter(s => s !== selected).map(s => ({ name: s, count: matching.filter(p => p.scents.includes(s)).length })).filter(s => s.count).sort((a, b) => b.count - a.count).slice(0, 8);
  const pick = s => navigate('/scents?scent=' + encodeURIComponent(s), { replace: true, keepScroll: true, transition: false });
  const shelf = [...matching].sort((a, b) => b.personalRating - a.personalRating || a.sourceOrder - b.sourceOrder);
  return <div className="page scents-page">
    <PageHero eyebrow="香调索引" title="香调世界" ghost={String(SCENTS.length)}><p>{SCENTS.length} 种香调词，全部取自馆藏原有介绍。字号越大，出现得越多。</p></PageHero>
    <div className="scent-cloud" role="group" aria-label="选择一种香调">
      {SCENTS.map(s => { const c = SCENT_COUNT.get(s); return <button key={s} aria-pressed={s === selected} onClick={() => pick(s)} style={{ '--w': (0.25 + 0.75 * Math.sqrt(c / MAX_SCENT)).toFixed(3) }}>{s}<sup>{c}</sup></button>; })}
    </div>
    <section className="scent-focus" key={selected}>
      <div className="scent-word" data-reveal=""><p className="eyebrow">循香而行</p><h2>{selected}</h2><p>{matching.length} 件馆藏含有这一香调</p><Link className="text-link" href={archiveUrl({ scent: selected })}>在全部馆藏中查看<Arrow /></Link></div>
      <div className="scent-relations" data-reveal="">
        <p className="relations-head">常与它同行</p>
        {related.map(r => <button className="relation" key={r.name} onClick={() => pick(r.name)} style={{ '--r': (r.count / related[0].count).toFixed(3) }}><span className="relation-name">{r.name}</span><span className="relation-bar" aria-hidden="true"><i /></span><span className="relation-count">{r.count}</span></button>)}
      </div>
    </section>
    <Shelf items={shelf} limit={14} label={`${selected} 馆藏`} />
  </div>;
}

// --------------------------------------------------------------- detail ----
function parseNotes(text = '') {
  const out = { accord: null, rows: [], rest: [] };
  for (const raw of text.split(/[；;。]/)) {
    const s = raw.trim(); if (!s) continue; let m;
    if ((m = s.match(/^香调轮廓以(.+)为主$/))) out.accord = m[1];
    else if ((m = s.match(/^(前调|中调|后调|基调)\s*(.+)$/))) out.rows.push([m[1], m[2]]);
    else if ((m = s.match(/^主要气味线索包括(.+)$/))) out.rows.push(['气味线索', m[1]]);
    else out.rest.push(s);
  }
  return out;
}
export function DetailContent({ perfume: p }) {
  const { focusId } = useContext(Router);
  const brand = BRAND_BY_NAME.get(p.brand);
  const notes = parseNotes(p.description);
  const stage = useRef(null);
  useEffect(() => {
    const el = stage.current; if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(hover: none)').matches) return;
    let frame = 0, x = 0, y = 0;
    const move = e => { x = e.clientX / innerWidth - .5; y = e.clientY / innerHeight - .5; if (!frame) frame = requestAnimationFrame(() => { frame = 0; el.style.setProperty('--mx', x.toFixed(3)); el.style.setProperty('--my', y.toFixed(3)); }); };
    window.addEventListener('pointermove', move, { passive: true }); return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, []);
  return <section className="chamber" style={{ '--tone': toneFor(p) }} aria-label={`${p.brand} ${p.nameChinese}`}>
    <div className="chamber-stage" ref={stage}>
      <span className="chamber-cone" aria-hidden="true" />
      <span className="chamber-no" aria-hidden="true">{objectNo(p)}</span>
      <div className="chamber-object">
        <i className="bottle-shadow" aria-hidden="true" /><Vitrine perfume={p} size="stage" eager focusId={focusId} shared />
      </div>
    </div>
    <div className="chamber-copy">
      <p className="chamber-index">馆藏编号 {objectNo(p)} <span>/ {fmt(TOTAL)}</span></p>
      <Link className="chamber-brand" href={`/brand/${brand.slug}`}>{p.brand}{brand.english && brand.english !== p.brand && <span lang="en"> · {brand.english}</span>}</Link>
      <h1>{p.nameChinese}</h1>
      <p className="chamber-en" lang="en">{p.nameEnglish}</p>
      <dl className="chamber-facts">
        <div><dt>发行</dt><dd>{p.releaseYear ? <Link href={archiveUrl({ year: p.releaseYear })}>{p.releaseYear}</Link> : <span className="muted">待核实</span>}</dd></div>
        <div><dt>我的评分</dt><dd><Rating value={p.personalRating} /></dd></div>
      </dl>
      {(notes.accord || p.scents.length > 0) && <div className="chamber-accord">
        <p className="label">香调轮廓</p>
        <p className="accord-line">{p.scents.length ? p.scents.map((s, i) => <React.Fragment key={s}>{i > 0 && <span className="sep" aria-hidden="true"> · </span>}<Link href={`/scents?scent=${encodeURIComponent(s)}`}>{s}</Link></React.Fragment>) : notes.accord}</p>
      </div>}
      {notes.rows.length > 0 && <dl className="notes">{notes.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {notes.rest.length > 0 && <p className="chamber-text">{notes.rest.join('；')}。</p>}
      {!notes.accord && notes.rows.length === 0 && notes.rest.length === 0 && p.description && <p className="chamber-text">{p.description}</p>}
    </div>
  </section>;
}
function Detail({ id }) {
  const p = byId(id);
  const { back, navigate } = useContext(Router);
  const idx = p ? INDEX_OF.get(p.id) : -1;
  const prev = p && PERFUMES[(idx - 1 + TOTAL) % TOTAL], next = p && PERFUMES[(idx + 1) % TOTAL];
  useEffect(() => {
    if (!p) return;
    const key = e => { if (e.target.closest('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === 'ArrowLeft') navigate(`/perfume/${prev.id}`, { replace: true }); if (e.key === 'ArrowRight') navigate(`/perfume/${next.id}`, { replace: true }); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [id]);
  if (!p) return <NotFound />;
  const brand = BRAND_BY_NAME.get(p.brand);
  const sameBrand = brand.items.filter(x => x.id !== id);
  const sameYear = p.releaseYear ? PERFUMES.filter(x => x.id !== id && x.releaseYear === p.releaseYear) : [];
  const sameRating = PERFUMES.filter(x => x.id !== id && x.personalRating === p.personalRating);
  const topScent = p.scents[0];
  const sameScent = topScent ? PERFUMES.filter(x => x.id !== id && x.scents.includes(topScent)) : [];
  const hintFor = list => [...list].filter(hasPhoto).sort((a, b) => b.personalRating - a.personalRating).find(x => x.brand !== p.brand) || list.find(hasPhoto) || list[0] || null;
  const exits = [
    { label: '同一品牌', name: p.brand, href: `/brand/${brand.slug}`, list: sameBrand },
    ...(p.releaseYear ? [{ label: '同一年', name: String(p.releaseYear), href: archiveUrl({ year: p.releaseYear }), list: sameYear }] : []),
    { label: '同样的评分', name: `${p.personalRating} / 5`, href: archiveUrl({ rating: p.personalRating }), list: sameRating },
    ...(topScent ? [{ label: '同一香调', name: topScent, href: `/scents?scent=${encodeURIComponent(topScent)}`, list: sameScent }] : []),
  ].filter(e => e.list.length > 0);
  return <div className="page detail-page">
    <div className="detail-nav">
      <button className="text-link" onClick={back}><Arrow back />返回</button>
      <div className="detail-step">
        <Link href={`/perfume/${prev.id}`} aria-label={`上一瓶：${prev.nameChinese}`}><Arrow back /></Link>
        <span>{objectNo(p)}</span>
        <Link href={`/perfume/${next.id}`} aria-label={`下一瓶：${next.nameChinese}`}><Arrow /></Link>
      </div>
    </div>
    <DetailContent perfume={p} />
    <nav className="exits" aria-labelledby="exits-title">
      <div className="section-head" data-reveal=""><p className="eyebrow">下一站</p><h2 id="exits-title">继续下潜</h2><p className="section-lede">每一瓶的来路，都是另一瓶的去向。</p></div>
      <ul className="exit-list">
        {exits.map((e, i) => { const hint = hintFor(e.list); return <li key={e.label} data-reveal="" style={{ '--d': i }}>
          <Link className="exit" href={e.href}>
            <span className="exit-label">{e.label}</span>
            <span className="exit-name">{e.name}</span>
            <span className="exit-count">{fmt(e.list.length)} 件</span>
            {hint && <span className="exit-thumb" aria-hidden="true"><Vitrine perfume={hint} size="thumb" sizes="96px" /></span>}
            <Arrow />
          </Link>
        </li>; })}
        <li data-reveal="" style={{ '--d': exits.length }}><button className="exit" onClick={() => navigate(`/perfume/${randomBottle(id).id}`)}>
          <span className="exit-label">随机</span><span className="exit-name">再抽一瓶</span><span className="exit-count">{fmt(TOTAL)} 件之中</span><Arrow />
        </button></li>
      </ul>
    </nav>
  </div>;
}
function About() {
  return <div className="page about-page">
    <PageHero eyebrow="关于" title="关于这份馆藏" ghost="i" />
    <div className="prose" data-reveal="">
      <p>这里保存了 {fmt(TOTAL)} 款香水，来自 {BRANDS.length} 个品牌。</p>
      <p>每一项评分都是我的个人判断。馆藏按品牌、发行年份、香调与评分相互连接，可以精确检索，也可以随意漫游。</p>
      <p>尚未确认的发行年份保留为“待核实”。香调与介绍沿用收藏资料中的文字。原始图片很小的馆藏，以原尺寸陈列，不做放大。</p>
      <Link className="text-link" href="/archive">打开全部馆藏<Arrow /></Link>
    </div>
  </div>;
}
function NotFound() { return <div className="page notfound"><PageHero eyebrow="未收录" title="这一处馆藏尚未收录" ghost="404"><Link className="text-link" href="/archive">返回全部馆藏<Arrow /></Link></PageHero></div>; }

// ------------------------------------------------------------------ app ----
function useReveal(route, motion) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('can-reveal', !motion.reduced);
    if (motion.reduced) return;
    const io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px' });
    const scan = () => document.querySelectorAll('[data-reveal]:not(.is-in)').forEach(el => io.observe(el));
    scan();
    const mo = new MutationObserver(scan); mo.observe(document.getElementById('main'), { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [route, motion.reduced]);
}
const LEGACY_SPACE = { brands: '/brands', time: '/timeline', five: '/five-star' };
export default function ArchiveApp() {
  const [location, setLocation] = useState(locationValue);
  const [focusId, setFocusId] = useState(null);
  const pendingScroll = useRef(null), transitionRef = useRef(null);
  const motion = useMotionProfile();
  const route = location.split('?')[0];
  const params = new URLSearchParams(location.split('?')[1] || '');
  useEffect(() => {
    history.scrollRestoration = 'manual';
    if (!history.state?.library) history.replaceState({ library: true, scroll: window.scrollY, depth: 0 }, '');
    const legacy = window.location.hash;
    if (legacy.startsWith('#/')) { history.replaceState({ ...history.state }, '', legacy.slice(1)); setLocation(locationValue()); }
    const pop = () => { pendingScroll.current = history.state?.scroll ?? 0; setFocusId(null); setLocation(locationValue()); };
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, []);
  useLayoutEffect(() => { if (pendingScroll.current !== null) { const y = pendingScroll.current; pendingScroll.current = null; window.scrollTo({ top: y, behavior: 'instant' }); } }, [location]);
  useEffect(() => {
    const title = route === '/archive' ? '全部馆藏' : route === '/brands' ? '品牌书架' : route === '/timeline' ? '时间长廊' : route === '/five-star' ? '五星馆藏室' : route === '/scents' ? '香调世界' : route === '/search' ? '馆藏检索' : route === '/about' ? '关于' : route.startsWith('/perfume/') ? byId(route.split('/')[2])?.nameChinese : route.startsWith('/brand/') ? BRAND_BY_SLUG.get(decodeURIComponent(route.split('/')[2]))?.name : null;
    document.title = (title ? title + ' · ' : '') + '私藏香水世界 | Private Scent Library';
  }, [route]);
  const navigate = (href, options = {}) => {
    if (href === locationValue()) return;
    transitionRef.current?.skipTransition?.();
    document.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.removeProperty('view-transition-name'));
    const id = href.match(/^\/perfume\/(p\d+)/)?.[1] || null;
    if (id && options.image) options.image.style.viewTransitionName = 'selected-bottle';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const commit = () => {
      history.replaceState({ ...history.state, library: true, scroll: window.scrollY }, '');
      const state = { library: true, scroll: options.keepScroll ? window.scrollY : 0, depth: (history.state?.depth || 0) + (options.replace ? 0 : 1) };
      history[options.replace ? 'replaceState' : 'pushState'](state, '', href);
      pendingScroll.current = state.scroll;
      flushSync(() => { setFocusId(id); setLocation(locationValue()); });
    };
    if (document.startViewTransition && !reduced && options.transition !== false) {
      transitionRef.current = document.startViewTransition(commit);
      transitionRef.current.finished.catch(() => {}).finally(() => document.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.removeProperty('view-transition-name')));
    } else commit();
  };
  const back = () => { if (history.state?.depth > 0) history.back(); else navigate('/archive'); };
  // Old shareable entrance links (/?space=brands&brand=…) now open the real rooms.
  const space = (route === '/' || route === '/explore') && params.get('space');
  useEffect(() => {
    if (!space) return;
    const brand = space === 'brands' && BRAND_BY_SLUG.get(params.get('brand'));
    const bottle = space === 'five' && byId(params.get('bottle'));
    navigate(brand ? `/brand/${brand.slug}` : bottle ? `/perfume/${bottle.id}` : LEGACY_SPACE[space] || '/', { replace: true, transition: false });
  }, [space]);
  useReveal(location, motion);
  let page;
  if (space) page = null;
  else if (route === '/' || route === '/explore') page = <Entrance />;
  else if (['/archive', '/all', '/search'].includes(route)) page = <Archive params={params} path={route} search={route === '/search'} title={route === '/search' ? '馆藏检索' : '全部馆藏'} en={route === '/search' ? '馆藏检索' : '完整索引'} />;
  else if (route === '/brands') page = <Brands params={params} />;
  else if (route.startsWith('/brand/')) { const b = BRAND_BY_SLUG.get(decodeURIComponent(route.split('/')[2])); page = b ? <Archive params={params} path={route} baseItems={b.items} title={b.english || b.name} en="品牌书架" brand={b} /> : <NotFound />; }
  else if (route === '/timeline') page = <Timeline params={params} />;
  else if (route === '/five-star') page = <FiveStar params={params} />;
  else if (route === '/scents') page = <Scents params={params} />;
  else if (route.startsWith('/perfume/')) page = <Detail id={route.split('/')[2]} />;
  else if (route === '/rating' || route.startsWith('/rating/')) { const p = new URLSearchParams(params); const rating = route.split('/')[2]; if (rating) p.set('rating', rating); page = <Archive params={p} />; }
  else if (route === '/about') page = <About />;
  else page = <NotFound />;
  const home = route === '/' || route === '/explore';
  return <Router.Provider value={{ navigate, back, focusId, motion }}>
    <div className={`app ${home ? 'is-home' : 'is-inner'}`}>
      <a className="skip-link" href="#main">跳转到正文</a>
      <Header route={route} />
      <main id="main" key={route} className="main">{page}</main>
      <Footer />
      <div className="grain" aria-hidden="true" />
    </div>
  </Router.Provider>;
}
