import { boards } from './board-data.js';
import { createGame, playTurn, restoreGame } from './engine.js';

const $ = id => document.getElementById(id);
const players = [
  {name:'小橘',color:'#c66b3d'}, {name:'小绿',color:'#606c38'},
  {name:'小蓝',color:'#527f83'}, {name:'小莓',color:'#a75868'},
];
const pips = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const storageKey = id => `kids-board-v1-${id}`;
const games = {};
let boardId = 'counting';
let busy = false;
let sound = true;
let showRoute = false;
let lastWord = '';
let pendingReset = null;
let lastFocus = null;
let visualPositions = [];
const histories = {counting:[],literacy:[]};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pause = ms => new Promise(resolve=>setTimeout(resolve,reduced.matches?0:ms));

try {
  boardId = boards[localStorage.getItem('kids-board-selected')] ? localStorage.getItem('kids-board-selected') : 'counting';
  sound = localStorage.getItem('kids-board-sound') !== 'off';
} catch { /* Play still works when browser storage is unavailable. */ }
for (const id of Object.keys(boards)) {
  let restored = null;
  try { restored=restoreGame(localStorage.getItem(storageKey(id)),id); } catch {}
  games[id]=restored || createGame(id,2);
}

function persist() {
  try {
    localStorage.setItem(storageKey(boardId),JSON.stringify(games[boardId]));
    localStorage.setItem('kids-board-selected',boardId);
    $('saved-status').textContent='进度已保存在此设备';
  } catch { $('saved-status').textContent='本次进度仅在当前页面保留'; }
}

function say(text) {
  if (!sound || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const speech=new SpeechSynthesisUtterance(text);
  speech.lang='zh-CN';
  speech.rate=.8;
  const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('zh'));
  if (voice) speech.voice=voice;
  speechSynthesis.speak(speech);
}

function drawDie(value) {
  $('die').querySelectorAll('i').forEach((pip,i)=>pip.classList.toggle('on',pips[value].includes(i)));
  $('die').setAttribute('aria-label',`${value} 点`);
}

function pieceSvg(index) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="25" r="21" fill="#353b2c" fill-opacity=".25"/><circle cx="24" cy="23" r="20.5" fill="${players[index].color}" stroke="#fffdf5" stroke-width="4"/><circle cx="24" cy="23" r="15" fill="none" stroke="#fffdf5" stroke-opacity=".35" stroke-width="1.5"/><path d="M12 17a14 14 0 0 1 12-7" fill="none" stroke="#fffdf5" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/><text x="24" y="31" text-anchor="middle" fill="#fffdf5" font-size="24" font-family="Arial,sans-serif" font-weight="800">${index+1}</text></svg>`;
}

function placePiece(index, position) {
  visualPositions[index]=position;
  layoutPieces();
}

function layoutPieces() {
  const state=games[boardId];
  const board=boards[boardId];
  const surface=$('board-surface').getBoundingClientRect();
  if (!surface.width || !surface.height) return;
  visualPositions.forEach((position,index)=>{
    const el=$(`piece-${index}`);
    if (!el) return;
    const cell=board.cells[position];
    const group=visualPositions.flatMap((p,i)=>p===position?[i]:[]);
    const arrangements={1:[[0,0]],2:[[-.48,0],[.48,0]],3:[[-.48,-.4],[.48,-.4],[0,.48]],4:[[-.48,-.48],[.48,-.48],[-.48,.48],[.48,.48]]};
    const arrangement=arrangements[group.length];
    const [dx,dy]=arrangement[group.indexOf(index)];
    const size=el.getBoundingClientRect().width;
    const margin=size*.62;
    // Shift the whole group inward; clamping each token separately would stack
    // tokens together when several players share an edge square.
    const minX=Math.min(...arrangement.map(o=>o[0]))*size;
    const maxX=Math.max(...arrangement.map(o=>o[0]))*size;
    const minY=Math.min(...arrangement.map(o=>o[1]))*size;
    const maxY=Math.max(...arrangement.map(o=>o[1]))*size;
    const cx=Math.max(margin-minX,Math.min(surface.width-margin-maxX,cell.x/board.width*surface.width));
    const cy=Math.max(margin-minY,Math.min(surface.height-margin-maxY,cell.y/board.height*surface.height));
    const x=cx+dx*size, y=cy+dy*size;
    el.style.left=`${x/surface.width*100}%`;
    el.style.top=`${y/surface.height*100}%`;
    el.setAttribute('aria-label',`${players[index].name}，第${position}格，${cell.label}`);
    el.dataset.position=position;
  });
}

function drawPieces() {
  const state=games[boardId];
  visualPositions=[...state.positions];
  $('piece-layer').innerHTML=state.positions.map((_,i)=>`<div class="piece ${state.turn===i?'active':''}" id="piece-${i}" role="img" style="--piece-color:${players[i].color}"><span class="piece-visual">${pieceSvg(i)}</span></div>`).join('');
  layoutPieces();
}

async function hopPiece(index,position,ladder) {
  const piece=$(`piece-${index}`);
  const duration=ladder?620:380;
  piece.style.setProperty('--move-duration',`${duration}ms`);
  placePiece(index,position);
  if (reduced.matches) return;
  const visual=piece.querySelector('.piece-visual');
  if (typeof visual.animate!=='function') { await pause(duration+75); return; }
  const lift=ladder?-26:-16;
  const hop=visual.animate([
    {transform:'translateY(0) scale(1)',offset:0},
    {transform:'translateY(3px) scale(1.08,.9)',offset:.12},
    {transform:`translateY(${lift}px) scale(1.06,1.08)`,offset:.48},
    {transform:'translateY(0) scale(1.12,.86)',offset:.84},
    {transform:'translateY(0) scale(1)',offset:1},
  ],{duration,easing:'cubic-bezier(.25,.1,.25,1)'});
  await hop.finished;
  visual.animate([{filter:'brightness(1.35)'},{filter:'brightness(1)'}],{duration:190});
  await pause(75);
}

function inspectCell(cell, index) {
  if (busy) return;
  lastWord=cell.label;
  $('landed-card').hidden=false;
  $('landed-caption').textContent=index===0?'起点':`第 ${index} 格`;
  $('landed-word').textContent=cell.label;
  const previous=document.querySelector('.cell-hit.inspected');
  const selected=document.querySelector(`.cell-hit[data-index="${index}"]`);
  if (previous) previous.classList.remove('inspected');
  if (selected) selected.classList.add('inspected');
  say(cell.label);
}

function drawBoard() {
  const board=boards[boardId];
  const img=$('board-image');
  img.src=board.image;
  img.alt=boardId==='counting'?'快乐点数棋，沿四排动物格子蛇形行走。':'经典飞行棋第三册，顶排从左到右为千、万、空格、海、白、起点。';
  $('board-title').textContent=board.name;
  $('board-subtitle').textContent=board.subtitle;
  $('route-caption').textContent=boardId==='counting'?'左上出发，沿蛇形路线到左下':'右上出发，沿路线到左下小屋';
  $('landed-card').hidden=true;
  lastWord='';
  const pts=board.cells.map(c=>`${c.x},${Math.min(c.y+36,board.height-15)}`).join(' ');
  $('route-svg').innerHTML=`<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" class="route-arrow"/></marker></defs><polyline points="${pts}" class="route-underlay"/><polyline points="${pts}" class="route-line"/>`;
  // Direction arrows in each horizontal run make the serpentine track unambiguous.
  for (let i=1;i<board.cells.length-1;i++) {
    const a=board.cells[i], b=board.cells[i+1];
    if (Math.abs(a.y-b.y)<5 && i%3===0) {
      const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
      const x=(a.x+b.x)/2, y=a.y+36, dir=b.x>a.x?1:-1;
      arrow.setAttribute('d',`M${x-10*dir} ${y-8} L${x+2*dir} ${y} L${x-10*dir} ${y+8}`);
      arrow.setAttribute('fill','none');arrow.setAttribute('stroke','#606c38');arrow.setAttribute('stroke-width','5');arrow.setAttribute('stroke-linecap','round');
      $('route-svg').append(arrow);
    }
  }
  $('route-svg').toggleAttribute('hidden',!showRoute);
  $('cell-layer').replaceChildren();
  board.cells.forEach((cell,index)=>{
    const button=document.createElement('button');
    button.className='cell-hit';button.type='button';button.dataset.index=index;
    button.style.left=`${cell.x/board.width*100}%`;button.style.top=`${cell.y/board.height*100}%`;
    button.setAttribute('aria-label',`${index===0?'起点':`第${index}格`}：${cell.label}${cell.jump!==undefined?'，梯子捷径':''}`);
    button.title=`${index===0?'起点':`第${index}格`} · ${cell.label}`;
    button.addEventListener('click',()=>inspectCell(cell,index));
    $('cell-layer').append(button);
  });
  for (const [id,index] of [['start-badge',0],['finish-badge',board.cells.length-1]]) {
    const c=board.cells[index];
    $(id).style.left=`${c.x/board.width*100}%`;
    $(id).style.top=`${(c.y-45)/board.height*100}%`;
  }
  $('rules-content').innerHTML=boardId==='counting'
    ? '<p><strong>轮流掷骰子，数着格子走。</strong>从左上“起点”出发，按箭头走完整条蛇形路线，到左下“终点”获胜。掷出的点数超过剩余格数，也可以直接到终点。</p><p>可以先让孩子数骰子上的圆点，再一起看棋子一步一步走。点击动物格子可以听名字。</p><p class="rule-note">网页版以绿色“起点”和橙色“终点”标识为准；原画中的其他旗帜和奖杯保留为图案。1 人时可独自练习，2–4 人时同屏轮流。</p>'
    : '<p><strong>走到汉字格，大声读一读。</strong>从右上“起点”出发，沿蛇形路线到左下小屋。到达或超过终点获胜。</p><p>落到“前进一格 / 两格 / 二格”会自动前进；上方空格的梯子通向“江”，下方空格的梯子通向“秋”。每回合落格只触发一次特殊移动。花朵、火把和其余空格作普通格。</p><p class="rule-note">点击格子可以朗读。朗读使用浏览器语音，是否可用取决于设备的中文语音支持。当前玩法根据图片制作，适合家长和孩子同屏轮流玩。</p>';
  drawPieces();
}

function drawStatus() {
  const state=games[boardId];
  const end=boards[boardId].cells.length-1;
  const who=players[state.turn];
  $('turn-title').textContent=state.winner===null?`轮到${who.name}`:`${who.name}获胜！`;
  $('turn-color').style.background=who.color;
  $('turn-number').textContent=`${state.turn+1} 号`;
  $('roll').disabled=busy||state.winner!==null;
  $('roll-label').textContent=state.winner!==null?'已到达终点':busy?'数一数，向前走':'掷骰子';
  $('player-count').value=state.count;
  $('player-count').disabled=busy;
  $('restart').disabled=busy;
  document.querySelectorAll('.board-tab').forEach(b=>{
    const selected=b.dataset.board===boardId;
    b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=busy;
  });
  $('round-count').textContent=`第 ${Math.floor(state.rounds/state.count)+1} 回合`;
  $('players').innerHTML=state.positions.map((position,i)=>`<div class="player-row ${i===state.turn?'current':''}" style="--progress-color:${players[i].color}"><span class="player-color" style="background:${players[i].color}"></span><span>${players[i].name}${i===state.winner?' · 获胜':''}</span><small>${position===end?'终点':`已走 ${position} / ${end}`}</small><span class="player-progress" style="width:${position/end*100}%"></span></div>`).join('');
  state.positions.forEach((position,i)=>{
    const piece=$(`piece-${i}`);
    if (piece) piece.classList.toggle('active',i===state.turn);
  });
}

function drawHistory() {
  $('history').replaceChildren();
  if (!histories[boardId].length) {
    const li=document.createElement('li');li.className='empty-history';li.textContent=games[boardId].rounds?'已恢复棋子位置，继续上一局吧。':'掷出第一颗骰子，留下足迹。';$('history').append(li);
  } else histories[boardId].forEach(text=>{const li=document.createElement('li');li.textContent=text;$('history').append(li);});
}

function switchBoard(id) {
  if (busy) return;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  boardId=id;
  drawBoard();drawStatus();drawDie(games[id].lastRoll||1);drawHistory();
  $('status').textContent=games[id].winner!==null?`${players[games[id].winner].name}已到终点，重新开始再玩一局吧。`:`${players[games[id].turn].name}，准备好就掷骰子吧。`;
  persist();
}

function randomRoll() {
  const data=new Uint32Array(1);
  if (!window.crypto || typeof window.crypto.getRandomValues!=='function') return Math.floor(Math.random()*6)+1;
  do { window.crypto.getRandomValues(data); } while (data[0]>=4294967292);
  return data[0]%6+1;
}

async function roll() {
  if (busy || games[boardId].winner!==null) return;
  busy=true;
  drawStatus();
  $('roll').classList.add('rolling');
  $('status').textContent='骰子转起来了……';
  const result=playTurn(games[boardId],randomRoll());
  const name=players[result.player].name;
  for (let i=0;i<(reduced.matches?0:7);i++) {drawDie(randomRoll());await pause(65);}
  $('roll').classList.remove('rolling');
  drawDie(result.state.lastRoll);
  $('status').textContent=`${name}掷出 ${result.state.lastRoll} 点。一起数格子吧！`;
  say(`${result.state.lastRoll} 点`);
  await pause(420);
  const piece=$(`piece-${result.player}`);
  piece.classList.add('moving');
  let steps=0;
  for (const position of result.path) {
    const special=result.effect && position===result.effect.to;
    steps++;
    $('status').textContent=special?(result.effect.kind==='ladder'?'爬上梯子，走一条捷径！':`${boards[boardId].cells[result.effect.from].label}，再往前走。`):`${name}：第 ${steps} 步`;
    await hopPiece(result.player,position,special && result.effect.kind==='ladder');
  }
  games[boardId]=result.state;
  busy=false;
  piece.classList.remove('moving');
  piece.style.removeProperty('--move-duration');
  lastWord=result.landed.label;
  $('landed-card').hidden=false;
  $('landed-caption').textContent=`${name}来到`;
  $('landed-word').textContent=lastWord;
  const action=result.effect?(result.effect.kind==='ladder'?'，爬梯子':'，额外前进'):'';
  const message=result.state.winner!==null?`${name}到达终点，获胜啦！`:`${name}掷出 ${result.state.lastRoll} 点${action}，来到“${lastWord}”。`;
  $('status').textContent=result.state.winner!==null?message:`${message} 轮到${players[result.state.turn].name}。`;
  histories[boardId].unshift(message);histories[boardId]=histories[boardId].slice(0,6);
  drawStatus();drawHistory();persist();
  say(result.state.winner!==null?`${name}到达终点，真棒！`:lastWord);
}

function resetGame(count) {
  games[boardId]=createGame(boardId,count);
  histories[boardId]=[];
  switchBoard(boardId);
  $('roll').focus();
}
function requestReset(count) {
  if (busy) return;
  if (games[boardId].rounds===0) {resetGame(count);return;}
  pendingReset=count;
  lastFocus=document.activeElement;
  $('reset-dialog').returnValue='';
  $('reset-dialog').showModal();
}

$('roll').addEventListener('click',roll);
$('restart').addEventListener('click',()=>requestReset(games[boardId].count));
$('player-count').addEventListener('change',()=>{
  const n=Number($('player-count').value);
  $('player-count').value=games[boardId].count;
  requestReset(n);
});
$('reset-dialog').addEventListener('close',()=>{
  if ($('reset-dialog').returnValue==='confirm' && pendingReset!==null) resetGame(pendingReset);
  else if (lastFocus) lastFocus.focus();
  pendingReset=null;
});
document.querySelectorAll('[data-board]').forEach(b=>b.addEventListener('click',()=>switchBoard(b.dataset.board)));
$('route-toggle').addEventListener('click',()=>{
  showRoute=!showRoute;
  $('route-svg').toggleAttribute('hidden',!showRoute);
  $('route-toggle').textContent=`路线：${showRoute?'开':'关'}`;
  $('route-toggle').setAttribute('aria-pressed',String(showRoute));
});
$('sound').addEventListener('click',()=>{
  sound=!sound;updateSound();
  if (!sound && 'speechSynthesis' in window) speechSynthesis.cancel();
  try {localStorage.setItem('kids-board-sound',sound?'on':'off');}catch{}
});
function updateSound() {
  const supported='speechSynthesis' in window;
  $('sound').textContent=supported?`朗读：${sound?'开':'关'}`:'设备不支持朗读';
  $('sound').setAttribute('aria-pressed',String(sound&&supported));
  $('sound').disabled=!supported;
}
$('read-again').addEventListener('click',()=>{if(lastWord)say(lastWord);});
$('zoom-open').addEventListener('click',()=>{
  $('zoom-mount').append($('board-surface'));
  $('zoom-dialog').showModal();
});
$('zoom-close').addEventListener('click',()=>$('zoom-dialog').close());
$('zoom-dialog').addEventListener('close',()=>{
  $('board-mount').append($('board-surface'));
  $('zoom-open').focus();
});
document.addEventListener('keydown',event=>{
  if (event.code==='Space' && (event.target===document.body || event.target===$('board-surface'))) {
    event.preventDefault();roll();
  }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&'speechSynthesis' in window)speechSynthesis.cancel();});
if (typeof window.ResizeObserver==='function') new window.ResizeObserver(layoutPieces).observe($('board-surface'));
else {
  window.addEventListener('resize',layoutPieces);
  $('zoom-dialog').addEventListener('close',()=>requestAnimationFrame(layoutPieces));
  $('zoom-open').addEventListener('click',()=>requestAnimationFrame(layoutPieces));
}
updateSound();switchBoard(boardId);
window.__boardGameReady=true;
$('load-error').hidden=true;
