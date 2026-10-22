import { boards } from './board-data.js';

export function createGame(boardId, count=2) {
  if (!boards[boardId] || !Number.isInteger(count) || count<1 || count>4) throw new Error('请选择1至4位玩家');
  return {version:1, boardId, count, positions:Array(count).fill(0), turn:0, winner:null, lastRoll:null, rounds:0};
}

export function playTurn(state, roll) {
  if (!Number.isInteger(roll) || roll<1 || roll>6 || state.winner!==null) throw new Error('当前不能掷骰子');
  const board = boards[state.boardId];
  const end = board.cells.length-1;
  const player = state.turn;
  const from = state.positions[player];
  let target = Math.min(from+roll, end);
  const path = Array.from({length:target-from}, (_,i)=>from+i+1);
  const cell = board.cells[target];
  let effect=null;
  if (cell.jump !== undefined) {
    effect={kind:'ladder',from:target,to:cell.jump};
    target=cell.jump;
    path.push(target);
  } else if (cell.advance) {
    const next = Math.min(target+cell.advance,end);
    effect={kind:'advance',from:target,to:next};
    for (let i=target+1;i<=next;i++) path.push(i);
    target=next;
  }
  const positions=[...state.positions];
  positions[player]=target;
  const winner=target===end ? player : null;
  return {
    state:{...state,positions,turn:winner===null?(player+1)%state.count:player,winner,lastRoll:roll,rounds:state.rounds+1},
    player,from,path,effect,landed:board.cells[target],
  };
}

export function restoreGame(raw,boardId) {
  try {
    const state=JSON.parse(raw);
    if (!state || state.version!==1 || state.boardId!==boardId || !boards[boardId]) return null;
    const {count,positions,turn,winner,lastRoll,rounds}=state;
    const end=boards[boardId].cells.length-1;
    if (!Number.isInteger(count) || count<1 || count>4 || !Array.isArray(positions) || positions.length!==count) return null;
    if (!positions.every(p=>Number.isInteger(p)&&p>=0&&p<=end)) return null;
    if (!Number.isInteger(turn) || turn<0 || turn>=count || !Number.isInteger(rounds) || rounds<0) return null;
    if (lastRoll!==null && (!Number.isInteger(lastRoll)||lastRoll<1||lastRoll>6)) return null;
    if (winner!==null && (!Number.isInteger(winner)||winner<0||winner>=count||positions[winner]!==end||turn!==winner)) return null;
    if (winner===null && positions.some(p=>p===end)) return null;
    return {version:1,boardId,count,positions:[...positions],turn,winner,lastRoll,rounds};
  } catch { return null; }
}
