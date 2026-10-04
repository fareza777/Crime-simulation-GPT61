import { useState } from 'react';
import { ArrowLeft, ArrowRight, Briefcase, Crown, Detective, Diamond, GearSix, Handshake, Info, ShareNetwork, ShieldCheck, Star, Truck, UserCircle } from '@phosphor-icons/react';
import type { CareerPath, GameState } from '../game/types';
import { rankFor } from '../game/engine';
import { Button, Tag } from './components';

export function MainMenu({save,onContinue,onNew,onSettings,onAbout,onShare,onRate}:{save:GameState|null;onContinue:()=>void;onNew:()=>void;onSettings:()=>void;onAbout:()=>void;onShare:()=>void;onRate:()=>void}){
  return <div className="main-menu" style={{backgroundImage:'url(/assets/city.webp)'}}><div className="menu-top"><div className="small-brand"><img src="/assets/icon-192.png" alt="BLACKLINE monogram"/><span>BLACKLINE</span></div><span className="offline-label"><ShieldCheck size={14}/>OFFLINE & ON YOUR TERMS</span></div><div className="menu-content"><span className="menu-overline">A CRIME LIFE SIMULATOR</span><h1>BLACK<span>LINE</span><i>.</i></h1><p className="menu-tagline">Rise from the shadows.</p><div className="menu-rule"/><p className="menu-description">One city. A thousand choices.<br />The empire you build is yours.</p><div className="menu-buttons">{save&&<><span className="resume-info">{save.player.name} · Day {save.day} · {rankFor(save.stats.reputation)}</span><Button onClick={onContinue}>Continue story<ArrowRight size={19}/></Button></>}<Button variant={save?'secondary':'primary'} onClick={onNew}>New game<ArrowRight size={19}/></Button></div><div className="menu-utility"><button onClick={onSettings}><GearSix size={19}/><span>Settings</span></button><button onClick={onAbout}><Info size={19}/><span>About</span></button><button onClick={onShare}><ShareNetwork size={19}/><span>Share</span></button><button onClick={onRate}><Star size={19}/><span>Rate</span></button></div></div><div className="menu-footer"><span>EVERY CHOICE LEAVES A MARK.</span><span>BLACKWATER CITY · 1.0</span></div></div>;
}

const slides=[
 {image:'/assets/district-old-quarter.webp',tag:'YOUR FIRST MOVE',title:'Start on the street.',text:'Choose an operation. Weigh the odds. Every decision changes your cash, reputation and Heat.',icon:Diamond},
 {image:'/assets/warehouse.webp',tag:'YOUR INNER CIRCLE',title:'Trust is a currency.',text:'Recruit specialists, keep them paid, and turn small opportunities into bigger scores.',icon:Handshake},
 {image:'/assets/district-crown-heights.webp',tag:'YOUR CITY. YOUR RULES.',title:'Build your legacy.',text:'Own businesses, shape districts, and plan the operation that changes everything.',icon:Crown}
];
export function Onboarding({onFinish,onBack}:{onFinish:()=>void;onBack:()=>void}){
  const [step,setStep]=useState(0);const slide=slides[step];
  return <div className="intro-shell"><div className="intro-panel"><div className="intro-art" style={{backgroundImage:`url(${slide.image})`}}><button className="icon-button" aria-label="Back to menu" onClick={onBack}><ArrowLeft size={21}/></button><button className="intro-skip" onClick={onFinish}>Skip introduction<ArrowRight size={14}/></button></div><div className="intro-copy"><div className="intro-symbol"><slide.icon size={29}/></div><span className="eyebrow">{slide.tag}</span><h1>{slide.title}</h1><p>{slide.text}</p><div className="intro-dots">{slides.map((s,i)=><button key={s.title} className={i===step?'active':''} aria-label={`Introduction ${i+1}`} onClick={()=>setStep(i)}/>)}</div><Button className="full-width" onClick={()=>step<slides.length-1?setStep(step+1):onFinish()}>{step===slides.length-1?'Create your character':'Next'}<ArrowRight size={18}/></Button></div></div></div>;
}

export const paths:{id:CareerPath;title:string;benefit:string;icon:typeof Crown}[]=[
 {id:'thief',title:'The thief',benefit:'Stealth 5 · Street smarts 3',icon:Diamond},
 {id:'smuggler',title:'The smuggler',benefit:'Driving 5 · +$400',icon:Truck},
 {id:'leader',title:'The gang leader',benefit:'Charisma 5 · Combat 3',icon:ShieldCheck},
 {id:'fixer',title:'The fixer',benefit:'Street smarts 5 · +$200',icon:Detective},
 {id:'businessman',title:'The businessman',benefit:'Business 5 · +$1,700',icon:Briefcase},
 {id:'boss',title:'The future boss',benefit:'Charisma & business 4 · +$700',icon:Crown}
];
export function CharacterCreation({onCreate,onBack}:{onCreate:(name:string,path:CareerPath,portrait:string)=>void;onBack:()=>void}){
  const [name,setName]=useState('Alex Vale');const [path,setPath]=useState<CareerPath>('thief');const [portrait,setPortrait]=useState('/assets/player.webp');
  return <div className="intro-shell creation-shell"><div className="creation-panel"><div className="creation-heading"><button className="icon-button" aria-label="Back to menu" onClick={onBack}><ArrowLeft size={21}/></button><div><span className="eyebrow">A NEW NAME IN BLACKWATER</span><h1>Who will you become?</h1></div><UserCircle size={30}/></div><div className="creation-identity"><div className="creation-portrait"><img src={portrait} alt="Your completely masked character"/></div><div><label htmlFor="player-name">Your name</label><input id="player-name" value={name} onChange={e=>setName(e.target.value)} maxLength={24} autoComplete="off"/><div className="portrait-choices">{['/assets/player.webp','/assets/crew-2.webp','/assets/crew-8.webp','/assets/crew-10.webp'].map((p,i)=><button key={p} className={portrait===p?'selected':''} aria-label={`Masked identity ${i+1}`} onClick={()=>setPortrait(p)}><img src={p} alt="Fully covered identity"/></button>)}</div></div></div><div className="creation-path-title"><h2>Choose your starting path</h2><Tag>You can build every skill</Tag></div><div className="path-grid">{paths.map(p=><button key={p.id} className={`path-card ${path===p.id?'selected':''}`} onClick={()=>setPath(p.id)} aria-pressed={path===p.id}><p.icon size={22}/><div><strong>{p.title}</strong><span>{p.benefit}</span></div><span className="path-check"/ ></button>)}</div><Button className="full-width" disabled={name.trim().length<2} onClick={()=>onCreate(name.trim(),path,portrait)}>Enter Blackwater<ArrowRight size={18}/></Button><p className="dialog-footnote">Your story saves automatically on this device.</p></div></div>;
}
