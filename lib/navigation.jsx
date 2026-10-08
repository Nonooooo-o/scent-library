import React, { createContext, useContext } from 'react';
export const Router = createContext({ navigate: () => {}, focusId: null, draw: () => {} });
export function Arrow({back=false}) {
  return <svg className={back?'icon backwards':'icon'} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.25"/></svg>;
}
export function SearchIcon() {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
export function Link({href,children,onClick,elementRef,...props}) {
  const {navigate}=useContext(Router);
  return <a href={href} ref={elementRef} {...props} onClick={e=>{
    onClick?.(e);
    if (!e.defaultPrevented && e.button===0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && href.startsWith('/')) {
      e.preventDefault();navigate(href,{image:e.currentTarget.querySelector('img')});
    }
  }}>{children}</a>;
}
