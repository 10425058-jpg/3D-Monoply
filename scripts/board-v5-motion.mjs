import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const rollButton = '[aria-label="Roll dice"]';
const wait = (page, predicate) => page.waitForFunction(predicate, {timeout: 60000});
const expectedDice = [3, 5];

function installMotionObserver(faces) {
  const solo = window.__soloTest;
  const render = window.__graphicsAudit;
  const trace = window.__boardMotion = {
    timeOrigin: performance.timeOrigin, startedAt: performance.now(), fontStatus: document.fonts.status,
    input: [], turns: [], frames: [], longTasks: [], ready: null, rolling: null, settled: null, hop: null, landing: null,
  };
  let turn;
  let started = false;
  const stopTurn = solo.observeTurn(next => {
    turn = next;
    started ||= turn.phase === 'ROLLING';
    if (trace.turns.length < 32) trace.turns.push({...turn, at: performance.now()});
  });
  const gameId = turn.gameId;
  const playerId = turn.playerId;
  const capture = event => {
    if (event.target.closest('.fantasy-roll')) {
      trace.input.push({type: event.type, at: performance.now(), dispatchedAt: event.timeStamp, trusted: event.isTrusted});
    }
  };
  const bubble = event => {
    if (event.target.closest('.fantasy-roll')) trace.input.push({type: 'click-bubble', at: performance.now()});
  };
  document.addEventListener('pointerdown', capture, true);
  document.addEventListener('click', capture, true);
  document.addEventListener('click', bubble);
  const longTasks = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) if (trace.longTasks.length < 40) {
      trace.longTasks.push({at: entry.startTime, durationMs: entry.duration});
    }
  });
  longTasks.observe({type: 'longtask'});
  const stopRender = render.observeRender(timing => {
    if (trace.landing || turn.gameId !== gameId) return;
    const token = render.actors().tokens.find(actor => actor.id === playerId);
    if (!token?.position) return;
    if (!started) {
      if (turn.phase === 'PRE_ROLL') trace.ready = {...timing, ...turn, token: token.position};
      return;
    }
    const frame = {...timing, ...turn, token: token.position, renderedDice: render.dice()};
    if (trace.frames.length < 512) trace.frames.push(frame);
    const diceVisible = frame.renderedDice.every(die => die.visible && die.scale?.every(scale => scale > 0));
    if (turn.phase === 'ROLLING' && diceVisible) trace.rolling ??= frame;
    if (turn.phase !== 'ROLLING' && diceVisible) trace.settled ??= frame;
    if (turn.phase === 'MOVING' && token.position[1] > .38) trace.hop ??= frame;
    if (turn.phase !== 'PRE_ROLL' && !['ROLLING', 'MOVING'].includes(turn.phase)) trace.landing = frame;
  });
  const original = Math.random;
  const next = [...faces];
  window.__armBoardMotion = () => {
    Math.random = () => {
      const value = (next.shift() - .5) / 6;
      if (!next.length) Math.random = original;
      return value;
    };
    trace.armedAt = performance.now();
  };
  window.__stopBoardMotion = () => {
    stopRender();
    stopTurn();
    longTasks.disconnect();
    document.removeEventListener('pointerdown', capture, true);
    document.removeEventListener('click', capture, true);
    document.removeEventListener('click', bubble);
    Math.random = original;
    delete window.__armBoardMotion;
    delete window.__boardMotion;
    delete window.__stopBoardMotion;
  };
}

export async function checkBoardMotion(page, {out, name, speed, motion}) {
  const input = {};
  const errors = [];
  const onPageError = error => errors.push(error.message);
  const onConsole = message => {
    if (message.type() === 'error' && errors.length < 25) errors.push(message.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  const read = () => page.evaluate(() => ({
    trace: window.__boardMotion, readAt: performance.now(),
    final: window.__soloTest.state(), renderedDice: window.__graphicsAudit.dice(),
  }));
  try {
    await page.evaluate(installMotionObserver, expectedDice);
    await wait(page, () => window.__boardMotion?.ready && document.querySelector('[aria-label="Roll dice"]:enabled'));
    const initial = await page.evaluate(() => window.__boardMotion.ready);
    assert.equal(initial.phase, 'PRE_ROLL');
    assert.equal(initial.speed, speed);
    assert.equal(initial.tile, 0);

    await page.evaluate(() => window.__armBoardMotion());
    input.requestedAt = performance.timeOrigin + performance.now();
    await page.click(rollButton);
    input.resolvedAt = performance.timeOrigin + performance.now();
    // Deliberately retrieve the trace only after landing. A point-in-time
    // read here cannot see either transient phase, even on a fast machine.
    await wait(page, () => window.__boardMotion?.landing);
    const {trace, readAt, final} = await read();
    input.firstReadAt = trace.timeOrigin + readAt;
    const click = trace.input.find(event => event.type === 'click');
    const phases = trace.turns.filter((turn, index) => index > 0 && turn.phase !== trace.turns[index - 1].phase);
    assert.ok(click?.trusted, 'the real Roll click was delivered');
    assert.deepEqual(phases.map(turn => turn.phase), ['ROLLING', 'MOVING', 'LANDED_ACTION']);
    assert.ok(click.at <= phases[0].at, 'ROLLING is committed by the Roll input');
    assert.deepEqual(phases[0].dice, expectedDice);
    assert.deepEqual(trace.turns.filter((turn, index) => index > 0 && turn.tile !== trace.turns[index - 1].tile)
      .map(turn => turn.tile), [1, 2, 3, 4, 5, 6, 7, 8]);

    assert.ok(trace.rolling, 'both dice are visible in a rendered rolling frame');
    if (motion === 'no-preference') assert.ok(trace.hop, 'actual rendered token hops above its surface');
    else {
      assert.ok(trace.frames.some(frame => frame.phase === 'MOVING'), 'reduced motion still renders movement');
      assert.equal(trace.hop, null, 'reduced motion keeps the token on its surface');
    }
    assert.ok(trace.settled, 'both dice remain visible in the first rendered result');
    assert.deepEqual(trace.settled.renderedDice.map(die => die.face), expectedDice);
    assert.ok(trace.settled.renderedDice.every(die => die.up > .999), 'settled top faces point up');
    assert.equal(trace.landing.phase, 'LANDED_ACTION');
    assert.equal(trace.landing.tile, 8);
    const player = final.players.find(player => player.id === initial.playerId);
    assert.equal(final.gameId, initial.gameId);
    assert.equal(final.turnPhase, 'LANDED_ACTION');
    assert.equal(player.position, 8);
    assert.equal(player.money, 1500);
    assert.deepEqual(final.dice, expectedDice);
    assert.ok(readAt >= trace.landing.at, 'the first result read happens after the rendered decision');
    return {trace, input, errors};
  } catch (error) {
    const details = await read().catch(() => null);
    await writeFile(`${out}/${name}-failure.json`, JSON.stringify({error: String(error), input, errors, ...details}, null, 2));
    await page.screenshot({path: `${out}/${name}-failure.png`}).catch(() => {});
    throw error;
  } finally {
    await page.evaluate(() => window.__stopBoardMotion?.()).catch(() => {});
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}
