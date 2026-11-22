import assert from 'node:assert/strict';
import test from 'node:test';
import { activityNoticePriority, appendMatchActivity, matchesActivityFilter, MATCH_ACTIVITY_LIMIT, type MatchActivityEvent } from '../src/game/matchActivity';

const actor = { id: 'victoria', name: 'Victoria', color: '#ec4899' };
const recipient = { id: 'arthur', name: 'Arthur', color: '#3b82f6' };
const event = (sequence: number, extras: Partial<MatchActivityEvent> = {}): MatchActivityEvent => ({
  id: `solo-1:${sequence}`, matchId: 'solo-1', title: 'Victoria rolled a six', sequence, kind: 'roll', actor, turn: 1, ...extras,
});

test('match history orders late arrivals, ignores replay IDs and keeps the most recent 160 records', () => {
  let history = appendMatchActivity([event(9)], [event(1), event(3), event(9, { title: 'Replay' })]);
  assert.deepEqual(history.map(entry => entry.sequence), [1, 3, 9]);
  assert.equal(history.at(-1)?.title, 'Victoria rolled a six');
  history = appendMatchActivity(history, Array.from({ length: 190 }, (_, index) => event(10 + index)));
  assert.equal(history.length, MATCH_ACTIVITY_LIMIT);
  assert.deepEqual(history.map(entry => entry.sequence), Array.from({ length: 160 }, (_, index) => 40 + index));
});

test('filters use event type and every participant, including card recipients', () => {
  const card = event(1, { kind: 'card', transfers: [{ from: actor, to: recipient, amount: 50 }] });
  assert.equal(matchesActivityFilter(card, 'Cards', recipient.id), true);
  assert.equal(matchesActivityFilter(card, 'Money', recipient.id), true);
  assert.equal(matchesActivityFilter(card, 'Properties', recipient.id), false);
  assert.equal(matchesActivityFilter(card, 'All', 'another-player'), false);
  assert.equal(matchesActivityFilter(event(2, { kind: 'upgrade', emphasis: 'milestone' }), 'Important', ''), true);
});

test('quiet mode retains critical notices and restored entries never produce one', () => {
  assert.equal(activityNoticePriority(event(1, { kind: 'purchase' }), 'standard'), 1);
  assert.equal(activityNoticePriority(event(2, { kind: 'purchase' }), 'important'), 0);
  assert.equal(activityNoticePriority(event(3, { kind: 'rent' }), 'important'), 2);
  assert.equal(activityNoticePriority(event(4, { kind: 'card', silent: true }), 'standard'), 0);
  assert.equal(activityNoticePriority(event(5, { kind: 'upgrade', emphasis: 'milestone' }), 'important'), 3);
});
