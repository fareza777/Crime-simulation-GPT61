import { useMemo, useState } from 'react';
import { ArrowRight, Crown, Crosshair, Flag, LinkBreak, LinkSimple, MapPin, Shield, ShieldWarning } from '@phosphor-icons/react';
import { districts, rivals, zones } from '../data';
import { getStrategy, rivalTruceInfo, strategySummary, zoneView } from '../game/strategy';
import type { ScreenProps } from './view-types';
import { Bar, Button, money, Pagination, Tag, usePagination } from './components';

type Point = [number, number];
/** Convex cells divide the planning map into tappable, accurate data-driven zones. */
function cellFor(index: number): string {
  const site = zones[index];
  let polygon: Point[] = [[0, 0], [100, 0], [100, 100], [0, 100]];
  for (const other of zones) {
    if (other.id === site.id) continue;
    const a = other.x - site.x, b = other.y - site.y;
    const c = (other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y) / 2;
    const clipped: Point[] = [];
    for (let edge = 0; edge < polygon.length; edge++) {
      const p = polygon[edge], q = polygon[(edge + 1) % polygon.length];
      const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
      if (dp <= .00001) clipped.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const t = dp / (dp - dq);
        clipped.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    polygon = clipped;
  }
  return polygon.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

export function TerritoryMap({ state, act, open }: ScreenProps) {
  const [selectedId, setSelectedId] = useState(zones.find(z => z.districtId === state.districtId)?.id ?? zones[0].id);
  const [focus, setFocus] = useState(state.districtId);
  const strategy = getStrategy(state), summary = strategySummary(state);
  const selected = zoneView(state, selectedId)!;
  const selectedDistrict = districts.find(d => d.id === selected.definition.districtId)!;
  const cells = useMemo(() => zones.map((_, index) => cellFor(index)), []);
  const connections = useMemo(() => zones.flatMap(z => z.neighbors.filter(id => z.id < id).map(id => ({ from: z, to: zones.find(other => other.id === id)! }))), []);
  function choose(id: string) {
    setSelectedId(id);
    setFocus(zones.find(z => z.id === id)!.districtId);
  }
  return <div className="territory-map-screen">
    <div className="zone-summary"><div><span>Held zones</span><strong>{summary.ownedZones}<small> / {zones.length}</small></strong></div><div><span>Connected</span><strong>{summary.connectedZones}<LinkSimple size={16} /></strong></div><div><span>Zone net / day</span><strong>{money(summary.zoneIncome - summary.zoneUpkeep, true)}</strong></div></div>
    <div className="map-focus"><label><MapPin size={17} /><select aria-label="Map district" value={focus} onChange={e => { setFocus(e.target.value); setSelectedId(zones.find(z => z.districtId === e.target.value)!.id); }}>{districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><Tag tone="gold">DAY {state.day}</Tag></div>
    <div className="zone-map-frame" style={{ backgroundImage: 'url(/assets/underworld-map.webp)' }}>
      <div className="map-grid-texture" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" data-testid="zone-map" aria-label={`Blackwater territory map, ${zones.length} zones`} className="zone-map-svg">
        <g className="zone-supply-lines" aria-hidden="true">{connections.map(({ from, to }) => <line key={`${from.id}-${to.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={strategy.zones[from.id].owner === 'player' && strategy.zones[to.id].owner === 'player' ? 'connected' : ''} />)}</g>
        {zones.map((z, index) => {
          const view = zoneView(state, z.id)!;
          return <g key={z.id} data-zone-id={z.id} className={`zone-map-cell ${view.owned ? 'owned' : 'rival'} ${selectedId === z.id ? 'selected' : ''} ${focus !== z.districtId ? 'out-of-focus' : ''} ${!view.unlocked ? 'locked' : ''}`} role="button" aria-label={`${z.name}, ${view.owned ? 'your zone' : 'rival zone'}${!view.unlocked ? `, ${z.requiredRep} reputation required` : ''}`} aria-pressed={selectedId === z.id} tabIndex={0} onClick={() => choose(z.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(z.id); } }}>
            <polygon points={cells[index]} />
            <circle cx={z.x} cy={z.y} r={3.5} />
            <text x={z.x} y={z.y + 1.45} textAnchor="middle">{String(index + 1).padStart(2, '0')}</text>
            {view.owned && <circle className="zone-owned-ring" cx={z.x} cy={z.y} r={5.1} />}
          </g>;
        })}
      </svg>
      <div className="map-compass" aria-hidden="true"><span>N</span><span>↑</span></div>
      <div className="map-caption">BLACKWATER <span>TACTICAL OVERVIEW</span></div>
    </div>
    <div className="map-legend"><span><i className="owned" />Your zone</span><span><i className="rival" />Rival held</span><span><i className="locked" />Locked</span><span><LinkSimple size={14} />Supply route</span></div>
    <article className="selected-zone" aria-live="polite"><div className="selected-zone-heading"><div><span className="eyebrow">{String(zones.findIndex(z => z.id === selectedId) + 1).padStart(2, '0')} / {selectedDistrict.name}</span><h3>{selected.definition.name}</h3></div><Tag tone={selected.owned ? 'gold' : ''}>{selected.owned ? 'YOUR TERRITORY' : selected.rival?.name ?? 'CONTESTED'}</Tag></div><div className="zone-status-row"><span><Flag size={15} />{selected.state.control}% control</span><span><Shield size={15} />{selected.state.fortification}/3 guard</span><span>{selected.connected ? <LinkSimple size={15} /> : <LinkBreak size={15} />}{selected.connected ? 'Supplied' : selected.adjacent ? 'Reachable' : 'Isolated'}</span></div><Bar value={selected.state.control} label={`${selected.definition.name} control`} /><div className="zone-primary-actions">{selected.definition.districtId !== state.districtId ? <Button disabled={!selected.unlocked || Boolean(state.jail)} onClick={() => act({ type: 'TRAVEL', id: selected.definition.districtId })}>{selected.unlocked ? 'Visit district · 5 energy' : `${selected.definition.requiredRep} reputation required`}<ArrowRight size={17} /></Button> : <><Button onClick={() => open({ kind: 'zone', id: selectedId })} disabled={Boolean(state.jail)}>Zone actions<ArrowRight size={17} /></Button>{!selected.owned && <Button variant="secondary" onClick={() => open({ kind: 'battle-plan', id: selectedId })}><Crosshair size={17} />Plan attack</Button>}</>}</div></article>
  </div>;
}

export function RivalCouncil({ state, open }: ScreenProps) {
  const strategy = getStrategy(state);
  const pages = usePagination(rivals, 4, 2);
  return <><div className="section-note">Watch their strength. Win ground, or buy time.</div><div className="rival-grid">{pages.visible.map(rival => {
    const current = strategy.rivals[rival.id];
    const truce = current.truceUntil > state.day;
    const info = rivalTruceInfo(state, rival.id);
    return <article className="rival-card" key={rival.id}><div className="rival-card-top"><img src={rival.image} alt="Covered rival insignia and portrait" /><div><span className="eyebrow">{districts.find(d => d.id === rival.districtId)?.name}</span><h3>{rival.name}</h3><Tag tone={truce ? 'gold' : ''}>{truce ? `${current.truceUntil - state.day} DAYS OF TRUCE` : current.hostility >= 65 ? 'HOSTILE' : 'WATCHING'}</Tag></div></div><div className="rival-meter"><span>Strength <strong>{current.strength}</strong></span><Bar value={current.strength} max={150} label={`${rival.name} strength`} /></div><div className="rival-meter heat"><span>Hostility <strong>{current.hostility}%</strong></span><Bar value={current.hostility} tone="heat" label={`${rival.name} hostility`} /></div><div className="rival-card-footer"><span><ShieldWarning size={15} />{current.alert}% alert</span><Button variant="secondary" onClick={() => open({ kind: 'rival', id: rival.id })}>{truce ? 'View terms' : `Diplomacy · ${money(info.cost, true)}`}<ArrowRight size={16} /></Button></div></article>;
  })}</div><Pagination {...pages} /></>;
}

export function StrategyHeading({ open }: Pick<ScreenProps, 'open'>) {
  return <div className="page-heading"><div><span className="eyebrow">{zones.length} ZONES. {rivals.length} RIVALS.</span><h1>Blackwater.</h1><p>Read the city. Choose your ground.</p></div><button className="icon-button strategy-heading-button" aria-label="Command centre" onClick={() => open({ kind: 'command' })}><Crown size={26} /></button></div>;
}
