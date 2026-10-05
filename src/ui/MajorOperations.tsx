import { ArrowRight, Diamond, Lightning, LockKey, UsersThree } from '@phosphor-icons/react';
import { districts, operations } from '../data';
import { getStrategy, operationEntryInfo } from '../game/strategy';
import type { ScreenProps } from './view-types';
import { Button, money, Pagination, Tag, usePagination } from './components';

export function MajorOperations({ state, open }: ScreenProps) {
  const pages = usePagination(operations, 3, 1), strategy = getStrategy(state);
  return <><div className="section-note">Plan the crew. Adapt through each stage. Get out before suspicion peaks.</div><div className="major-operation-grid">{pages.visible.map(operation => {
    const unlocked = state.stats.reputation >= operation.requiredRep;
    const cooldown = Math.max(0, (strategy.operationCooldowns[operation.id] ?? 0) - state.day);
    const entry = operationEntryInfo(state, operation);
    return <article className="major-operation-card" key={operation.id}><div className="major-operation-art" style={{ backgroundImage: `url(${operation.image})` }}><Tag tone="glass">{districts.find(d => d.id === operation.districtId)?.name}</Tag><div><span className="eyebrow">{operation.stages.length} STAGES · REPEATABLE</span><h2>{operation.name}</h2></div><Diamond className="major-operation-mark" size={32} /></div><div className="major-operation-body"><p>{operation.description}</p><div className="major-operation-steps">{operation.stages.map((stage, index) => <div key={stage.id}><span>{index + 1}</span><strong>{stage.name}</strong></div>)}</div><div className="strategy-preview"><div><span>Potential take</span><strong>{money(operation.reward[0], true)}–{money(operation.reward[1], true)}</strong></div><div><span>Buy-in</span><strong>{money(entry.cost, true)}</strong></div><div><span>Crew</span><strong><UsersThree size={15} />{operation.requiredCrew}</strong></div></div><div className="major-operation-meta"><span><Lightning size={15} />{entry.energy} energy to begin</span><span>{operation.requiredItems.length} required tools</span></div><Button className="full-width" variant="secondary" onClick={() => open({ kind: 'operation-plan', id: operation.id })}>{!unlocked ? <><LockKey size={17} />{operation.requiredRep} REP · View plan</> : cooldown > 0 ? `${cooldown} days to reopen · View plan` : 'Plan major operation'}<ArrowRight size={17} /></Button></div></article>;
  })}</div><Pagination {...pages} /></>;
}
