import { useState } from 'react';
import { ArrowRight, Bank, Crown, Flag, Shield, UsersThree } from '@phosphor-icons/react';
import { crewSalary, dailyIncome } from '../game/engine';
import { getStrategy, strategySummary } from '../game/strategy';
import type { Difficulty, OrganizationAgenda } from '../game/strategy-types';
import type { ScreenProps } from './view-types';
import { Button, Modal, money, Tag, Tabs } from './components';

export const challengeOptions: { id: Difficulty; label: string; description: string }[] = [
  { id: 'standard', label: 'Standard', description: 'Steady pressure. Room to learn.' },
  { id: 'hard', label: 'Hard', description: 'Sharper rivals. Tighter margins.' },
  { id: 'ruthless', label: 'Ruthless', description: 'Costly ground. Relentless opposition.' },
];
const agendaOptions: { id: OrganizationAgenda; label: string; description: string; icon: typeof Crown }[] = [
  { id: 'balanced', label: 'Balanced', description: 'Keep the organization steady.', icon: Crown },
  { id: 'profit', label: 'Profit', description: 'Higher zone returns, more attention.', icon: Bank },
  { id: 'silent', label: 'Silent', description: 'Reduce exposure; earn more slowly.', icon: Shield },
  { id: 'war', label: 'War', description: 'Stronger attacks; higher upkeep and Heat.', icon: Flag },
];

export function CommandCentre({ state, act, open, onClose }: ScreenProps & { onClose: () => void }) {
  const [tab, setTab] = useState('agenda');
  const strategy = getStrategy(state), summary = strategySummary(state);
  const net = dailyIncome(state) + summary.zoneIncome - crewSalary(state) - summary.zoneUpkeep;
  return <Modal title="Command centre" onClose={onClose} className="strategy-modal command-modal"><div className="strategy-dialog-heading"><span className="eyebrow">YOUR ORGANIZATION</span><h2>Set the direction.</h2><p>{summary.ownedZones} zones · {summary.battlesWon} battles won · {summary.operationsCompleted} operations closed</p></div><Tabs options={[{ id: 'agenda', label: 'Priorities' }, { id: 'challenge', label: 'Challenge' }, { id: 'accounts', label: 'Accounts' }]} value={tab} onChange={setTab} />
    {tab === 'agenda' && <><div className="command-option-grid">{agendaOptions.map(option => <button key={option.id} className={`command-option ${strategy.agenda === option.id ? 'selected' : ''}`} aria-pressed={strategy.agenda === option.id} aria-label={option.label} disabled={Boolean(state.jail)} onClick={() => act({ type: 'SET_AGENDA', agenda: option.id })}><option.icon size={23} /><strong>{option.label}</strong><p>{option.description}</p><span>{strategy.agenda === option.id ? 'CURRENT PRIORITY' : 'SET PRIORITY'}</span></button>)}</div><p className="dialog-footnote">The previews reflect your priority. You can change it between encounters.</p><Button variant="secondary" className="full-width" onClick={() => open({ kind: 'supplies' })}><UsersThree size={19} />Daily supplies<ArrowRight size={17} /></Button></>}
    {tab === 'challenge' && <><div className="challenge-options">{challengeOptions.map(option => <button key={option.id} className={`challenge-option ${strategy.difficulty === option.id ? 'selected' : ''}`} aria-pressed={strategy.difficulty === option.id} disabled={Boolean(state.jail)} onClick={() => act({ type: 'SET_DIFFICULTY', difficulty: option.id })}><div><strong>{option.label}</strong><p>{option.description}</p></div><Tag tone={strategy.difficulty === option.id ? 'gold' : ''}>{strategy.difficulty === option.id ? 'ACTIVE' : 'CHOOSE'}</Tag></button>)}</div><p className="section-note">Difficulty changes operation odds, upkeep and rival retaliation. Your existing progress stays with you.</p></>}
    {tab === 'accounts' && <><div className="command-accounts"><div><span>Business income</span><strong>{money(dailyIncome(state))}</strong></div><div><span>Zone income</span><strong>{money(summary.zoneIncome)}</strong></div><div><span>Crew salaries</span><strong>−{money(crewSalary(state))}</strong></div><div><span>Zone upkeep</span><strong>−{money(summary.zoneUpkeep)}</strong></div><div className="accounts-total"><span>Projected net / day</span><strong>{money(net)}</strong></div></div>{strategy.lastDaily && <div className="day-report"><strong>Day {strategy.lastDaily.day} report</strong><p>{strategy.lastDaily.notices[0] ?? 'Your crew held the line. No new territorial losses.'}</p>{strategy.lastDaily.businessPressure > 0 && <p>Rival pressure cost {money(strategy.lastDaily.businessPressure)}.</p>}</div>}<Button variant="secondary" className="full-width" onClick={() => open({ kind: 'help' })}>Read the field guide<ArrowRight size={17} /></Button></>}
  </Modal>;
}
