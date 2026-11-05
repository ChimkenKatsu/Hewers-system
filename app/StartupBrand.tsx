'use client';
import {useEffect,useRef,useState} from 'react';

/** Once per tab/WebView session; content loads underneath without a network dependency. */
export default function StartupBrand(){
 const [visible,setVisible]=useState(true);
 const alreadyPlayed=useRef<boolean|null>(null);
 useEffect(()=>{
  if(alreadyPlayed.current===null){
   try{alreadyPlayed.current=Boolean(sessionStorage.getItem('hewers-brand-intro'));sessionStorage.setItem('hewers-brand-intro','seen');}catch{alreadyPlayed.current=false;}
  }
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timer=setTimeout(()=>setVisible(false),alreadyPlayed.current?0:reduced?200:1650);
  return()=>clearTimeout(timer);
 },[]);
 if(!visible)return null;
 return <div className="brand-intro" aria-hidden="true">
  <div className="brand-intro-art">
   <svg className="brand-intro-symbol" viewBox="0 0 180 210" fill="none">
    <g className="brand-piece brand-piece-left" fill="#002448"><path d="M14 60l32 15 38 35v40l-38-33v78l-32-21z"/></g>
    <g className="brand-piece brand-piece-right" fill="#e9a500"><path d="M154 60l-32 15-38 35v40l38-31v76l32-21z"/></g>
    <g className="brand-heads" fill="#002448"><circle cx="35" cy="35" r="22"/><circle cx="133" cy="35" r="22"/></g>
   </svg>
   <svg className="brand-intro-name" viewBox="0 0 450 190" fontFamily="Arial,Helvetica,sans-serif" fill="#002448">
    <text x="0" y="83" fontSize="90" fontWeight="800" textLength="440" lengthAdjust="spacingAndGlyphs">HEWERS</text>
    <text x="0" y="138" fontSize="48" fontWeight="700" fill="#e9a500" textLength="440" lengthAdjust="spacingAndGlyphs">MANPOWER</text>
    <text x="70" y="182" fontSize="30" textLength="300" lengthAdjust="spacingAndGlyphs" letterSpacing="8">SERVICES</text>
    <path stroke="#e9a500" strokeWidth="4" d="M0 171h53m334 0h53"/>
   </svg>
  </div>
  <div className="brand-intro-rule"/>
  <p className="brand-intro-caption">PEOPLE. PROGRESS. CONNECTED.</p>
 </div>;
}
