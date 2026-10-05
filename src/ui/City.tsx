import { useState } from 'react';
import { ArrowRight, Buildings, LockKey, MapPin, ShieldWarning } from '@phosphor-icons/react';
import { districts } from '../data';
import type { ScreenProps } from './view-types';
import { Bar, Button, Pagination, Tag, Tabs, usePagination } from './components';
import { RivalCouncil, StrategyHeading, TerritoryMap } from './StrategyMap';

function DistrictCards({ state, act, nav, open }: ScreenProps) {
  const pagination = usePagination(districts,6,2);
  return <><div className="page-heading"><div><span className="eyebrow">FIVE DISTRICTS. ONE CITY.</span><h1>Blackwater.</h1><p>Find your corner. Make it yours.</p></div><Buildings size={30} className="heading-icon" /></div><div className="city-strip"><MapPin size={16} /><span>Current district</span><strong>{districts.find(d=>d.id===state.districtId)?.name}</strong><Tag>{districts.filter(d=>state.stats.reputation>=d.requiredRep).length}/5 unlocked</Tag></div><div className="district-grid">{pagination.visible.map((d,i) => { const unlocked=state.stats.reputation>=d.requiredRep; const current=state.districtId===d.id; return <article className={`district-card ${!unlocked?'locked':''}`} key={d.id}><button className="district-image" style={{backgroundImage:`url(${d.image})`}} onClick={()=>open({kind:'district',id:d.id})}><span className="district-index">0{districts.indexOf(d)+1}</span>{current?<Tag tone="gold">YOU ARE HERE</Tag>:!unlocked?<Tag tone="glass"><LockKey size={12}/>{d.requiredRep} REP</Tag>:<Tag tone="glass">OPEN DISTRICT</Tag>}<div><span className="eyebrow">{d.subtitle}</span><h2>{d.name}</h2></div></button><div className="district-body"><div className="district-info"><span><ShieldWarning size={14}/>{d.risk<=2?'Low':d.risk<=4?'Medium':'High'} risk</span><span>{d.gang}</span></div><div className="influence-line"><span>District influence</span><strong>{state.territories[d.id]??0}%</strong></div><Bar value={state.territories[d.id]??0} label={`${d.name} influence`}/><Button variant="secondary" disabled={!unlocked || Boolean(state.jail)} onClick={()=>{if(!current)act({type:'TRAVEL',id:d.id});nav('operations');}}>{current?'View operations':unlocked?'Travel to district':'Reputation required'}{unlocked?<ArrowRight size={15}/>:<LockKey size={15}/>}</Button></div>{i===0&&<span className="sr-only">District selection</span>}</article>;})}</div><Pagination {...pagination}/></>;
}

export function City(props: ScreenProps) {
  const [tab, setTab] = useState('map');
  return <><StrategyHeading open={props.open} /><Tabs options={[{id:'map',label:'Map'},{id:'districts',label:'Districts'},{id:'rivals',label:'Rivals'}]} value={tab} onChange={setTab} />{tab === 'map' ? <TerritoryMap {...props} /> : tab === 'rivals' ? <RivalCouncil {...props} /> : <div className="district-catalogue"><DistrictCards {...props} /></div>}</>;
}
