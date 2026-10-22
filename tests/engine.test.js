import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, playTurn, restoreGame } from '../engine.js';
import { boards } from '../board-data.js';

// These tests catch missed turn changes, wrong route traversal, chained effects,
// out-of-range finishing moves, and accepting corrupt persisted games.
test('two players begin at start; a roll advances only the current player and changes turns', () => {
  const state = createGame('counting', 2);
  const result = playTurn(state, 4);
  assert.deepEqual(state.positions, [0, 0]);
  assert.deepEqual(result.state.positions, [4, 0]);
  assert.equal(result.state.turn, 1);
  assert.deepEqual(result.path, [1, 2, 3, 4]);
});
test('literacy blank after 海 uses ladder to 江', () => {
  const result = playTurn(createGame('literacy', 2), 3);
  assert.equal(result.state.positions[0], 8);
  assert.equal(result.landed.label, '江');
  assert.equal(result.effect.kind, 'ladder');
  assert.deepEqual(result.path, [1, 2, 3, 8]);
});
test('前进两格 moves from the upper connector to 江', () => {
  const result = playTurn(createGame('literacy', 2), 6);
  assert.equal(result.state.positions[0], 8);
  assert.equal(result.effect.kind, 'advance');
});
test('all forward instruction cells and the second ladder move to the correct destination', () => {
  for (const [from, end] of [[12, 14], [14, 16], [20, 22], [26, 29], [27, 33]]) {
    const state = createGame('literacy', 2);
    state.positions[0] = from;
    assert.equal(playTurn(state, 1).state.positions[0], end);
  }
});
test('arrival beyond the final cell stops at finish and wins without changing the winner turn', () => {
  const state = createGame('literacy', 2);
  state.positions[0] = 36;
  const result = playTurn(state, 6);
  assert.equal(result.state.positions[0], 38);
  assert.equal(result.state.winner, 0);
  assert.equal(result.state.turn, 0);
  assert.deepEqual(result.path, [37, 38]);
  assert.throws(() => playTurn(result.state, 1));
});
test('single player stays active; four players rotate', () => {
  assert.equal(playTurn(createGame('counting', 1), 1).state.turn, 0);
  let state = createGame('counting', 4);
  for (let i = 0; i < 4; i++) state = playTurn(state, 1).state;
  assert.deepEqual(state.positions, [1, 1, 1, 1]);
  assert.equal(state.turn, 0);
});
test('reading route respects the corrected 白, blank and 月 positions', () => {
  assert.deepEqual(boards.literacy.cells.slice(0, 6).map(c => c.label), ['起点', '白', '海', '空格', '万', '千']);
  assert.equal(boards.literacy.cells[36].label, '月');
  assert.equal(boards.counting.cells.length, 47);
});
test('restore rejects malformed state rather than breaking the next turn', () => {
  const good = createGame('counting', 2);
  assert.deepEqual(restoreGame(JSON.stringify(good), 'counting'), good);
  for (const bad of [null, {}, {...good, positions:[-1,0]}, {...good, turn:5}, {...good, positions:[0.5,0]}, {...good, winner:0}, {...good, lastRoll:99}, {...good, positions:[0]}, {...good, rounds:-1}]) {
    assert.equal(restoreGame(JSON.stringify(bad), 'counting'), null);
  }
  assert.equal(restoreGame('{bad json', 'counting'), null);
  assert.equal(restoreGame(JSON.stringify(good), 'literacy'), null);
});
test('invalid dice values and player counts cannot mutate the game', () => {
  for (const roll of [0, 7, -1, NaN, 1.5, '3']) assert.throws(() => playTurn(createGame('counting', 2), roll));
  for (const n of [0, 5, '2', 1.5]) assert.throws(() => createGame('counting', n));
});
