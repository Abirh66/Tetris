/*
  DOM-based Tetris (no canvas)
  - Uses "locked" cells for fixed blocks and "active" for moving piece (prevents self-collision)
  - Mobile swipes & taps
  - No alert() on game over; uses modal
  - GitHub Pages friendly (static files)
*/

const COLS = 10, ROWS = 20;
const COLORS = { I:'#00f0f0', J:'#0000f0', L:'#f0a000', O:'#f0f000', S:'#00f000', T:'#a000f0', Z:'#f00000' };
const SHAPES = {
  I: [[[1,1,1,1]]],
  J: [[[1,0,0],[1,1,1]]],
  L: [[[0,0,1],[1,1,1]]],
  O: [[[1,1],[1,1]]],
  S: [[[0,1,1],[1,1,0]]],
  T: [[[0,1,0],[1,1,1]]],
  Z: [[[1,1,0],[0,1,1]]],
};
const shapeKeys = Object.keys(SHAPES);

const boardEl = document.getElementById('board');
const nextEl = document.getElementById('next');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnHold = document.getElementById('btn-hold');
const btnReset = document.getElementById('btn-reset');
const modal = document.getElementById('modal');
const modalRestart = document.getElementById('modal-restart');
const modalClose = document.getElementById('modal-close');
const finalScore = document.getElementById('final-score');

const mLeft = document.getElementById('m-left');
const mRight = document.getElementById('m-right');
const mRot = document.getElementById('m-rot');
const mDown = document.getElementById('m-down');
const mDrop = document.getElementById('m-drop');

let grid = []; // store DOM cell elements
let locked = []; // boolean map for locked cells (fixed)
let active = null; // {type, rot, shape, x, y, color}
let nextPiece = null;
let holdPiece = null;
let canHold = true;

let score = 0, level = 1, lines = 0;
let tick = 0, speed = 700;
let running = false;
let timerId = null;

/* Initialize board DOM */
function buildBoard(){
  boardEl.innerHTML = '';
  grid = [];
  locked = [];
  for(let r=0;r<ROWS;r++){
    const row = []; const lockRow = [];
    for(let c=0;c<COLS;c++){
      const div = document.createElement('div');
      div.className = 'cell';
      const inner = document.createElement('span');
      inner.className = 'inner';
      div.appendChild(inner);
      boardEl.appendChild(div);
      row.push(div);
      lockRow.push(null); // null or {type,color}
    }
    grid.push(row);
    locked.push(lockRow);
  }
}

/* Utility: create next preview grid */
function drawNext(){
  nextEl.innerHTML = '';
  for(let i=0;i<16;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    nextEl.appendChild(cell);
  }
  if(!nextPiece) return;
  const shape = nextPiece.shape;
  const size = shape.length;
  // center preview in 4x4
  const offsetR = Math.floor((4-size)/2);
  const offsetC = Math.floor((4-size)/2);
  for(let r=0;r<size;r++){
    for(let c=0;c<size;c++){
      if(shape[r][c]){
        const idx = (offsetR + r) * 4 + (offsetC + c);
        const el = nextEl.children[idx];
        el.style.setProperty('--bg', nextPiece.color);
        el.firstChild && (el.firstChild.style.background = '');
        el.style.background = nextPiece.color;
        el.classList.add('locked');
      }
    }
  }
}

/* Pick random piece (basic shapes); shape is square matrix */
function randomPiece(){
  const t = shapeKeys[Math.floor(Math.random()*shapeKeys.length)];
  const s = SHAPES[t][0].map(row => row.slice());
  return { type:t, shape:s, color: COLORS[t] };
}

/* place active piece into DOM with class 'active' (not locked) */
function drawActive(){
  if(!active) return;
  const shape = active.shape;
  for(let r=0;r<shape.length;r++){
    for(let c=0;c<shape[r].length;c++){
      if(shape[r][c]){
        const x = active.x + c;
        const y = active.y + r;
        if(y>=0 && y<ROWS && x>=0 && x<COLS){
          const cell = grid[y][x];
          cell.classList.add('active');
          cell.style.background = active.color;
        }
      }
    }
  }
}

/* clear active markers */
function clearActive(){
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell = grid[r][c];
      if(cell.classList.contains('active')){
        cell.classList.remove('active');
        cell.style.background = '';
      }
    }
  }
}

/* lock active piece into locked[][] and DOM classes */
function lockActive(){
  if(!active) return;
  const shape = active.shape;
  for(let r=0;r<shape.length;r++){
    for(let c=0;c<shape[r].length;c++){
      if(shape[r][c]){
        const x = active.x + c;
        const y = active.y + r;
        if(y>=0 && y<ROWS && x>=0 && x<COLS){
          locked[y][x] = { type: active.type, color: active.color };
          const cell = grid[y][x];
          cell.classList.remove('active');
          cell.classList.add('locked');
          cell.style.background = active.color;
        }
      }
    }
  }
  active = null;
  canHold = true;
}

/* collision ONLY checks locked[][] — prevents self-collision bug */
function collides(shape, x, y){
  for(let r=0;r<shape.length;r++){
    for(let c=0;c<shape[r].length;c++){
      if(shape[r][c]){
        const cx = x + c;
        const cy = y + r;
        if(cx<0 || cx>=COLS || cy>=ROWS) return true;
        if(cy>=0 && locked[cy][cx]) return true;
      }
    }
  }
  return false;
}

/* rotate square matrix clockwise */
function rotate(shape){
  const N = shape.length;
  const out = Array.from({length:N}, ()=>Array(N).fill(0));
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) out[c][N-1-r] = shape[r][c];
  return out;
}

/* spawn new piece — if spawn collides => game over */
function spawn(){
  active = nextPiece || randomPiece();
  // make square matrix for convenience (pad)
  const size = Math.max(active.shape.length, active.shape[0].length);
  // ensure shape is square matrix (pad)
  if(active.shape.length !== size){
    const padded = Array.from({length:size}, ()=>Array(size).fill(0));
    for(let r=0;r<active.shape.length;r++){
      for(let c=0;c<active.shape[r].length;c++) padded[r][c] = active.shape[r][c];
    }
    active.shape = padded;
  }
  active.x = Math.floor((COLS - active.shape[0].length)/2);
  active.y = -Math.max(1, active.shape.length - 1); // start slightly above board
  nextPiece = randomPiece();
  drawNext();
  // if piece already collides when spawned -> game over
  if(collides(active.shape, active.x, active.y)){
    endGame();
    return false;
  }
  return true;
}

/* clear full lines */
function clearLines(){
  let cleared = 0;
  for(let r = ROWS-1; r>=0; r--){
    let full = true;
    for(let c=0;c<COLS;c++){
      if(!locked[r][c]){ full = false; break; }
    }
    if(full){
      cleared++;
      // remove row r and add empty row at top
      locked.splice(r,1);
      locked.unshift(new Array(COLS).fill(null));
      // update DOM: move row elements down (simple approach: rebuild whole board visuals)
      r++; // re-check same index after shift
    }
  }
  if(cleared){
    // scoring typical tetris: 1->100,2->300,3->500,4->800 (simple scale)
    const gain = [0,100,300,500,800][cleared] || (cleared*200);
    score += gain * level;
    lines += cleared;
    level = 1 + Math.floor(lines/10);
    speed = Math.max(80, 700 - (level-1)*50);
    renderLocked();
    updateHUD();
  }
}

/* render locked[][] into DOM (used after clears) */
function renderLocked(){
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell = grid[r][c];
      if(locked[r][c]){
        cell.classList.add('locked');
        cell.style.background = locked[r][c].color;
      } else {
        cell.classList.remove('locked');
        cell.style.background = '';
      }
      cell.classList.remove('active');
    }
  }
}

/* update HUD */
function updateHUD(){
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

/* attempt to move; returns true if moved */
function move(dx,dy){
  if(!active) return false;
  const newX = active.x + dx;
  const newY = active.y + dy;
  if(!collides(active.shape, newX, newY)){
    clearActive();
    active.x = newX; active.y = newY;
    drawActive();
    return true;
  }
  return false;
}

/* attempt rotation with simple wall-kick tries */
function tryRotate(){
  if(!active) return;
  const rotated = rotate(active.shape);
  const kicks = [0, -1, 1, -2, 2];
  for(const k of kicks){
    if(!collides(rotated, active.x + k, active.y)){
      clearActive();
      active.shape = rotated;
      active.x += k;
      drawActive();
      return;
    }
  }
}

/* hold current piece */
function hold(){
  if(!active || !canHold) return;
  clearActive();
  if(!holdPiece){
    holdPiece = { type: active.type, shape: active.shape.map(r=>r.slice()), color: active.color };
    active = null;
    canHold = false;
    spawn();
  } else {
    const temp = holdPiece;
    holdPiece = { type: active.type, shape: active.shape.map(r=>r.slice()), color: active.color };
    active = { type: temp.type, shape: temp.shape.map(r=>r.slice()), color: temp.color, x:0, y:0 };
    active.x = Math.floor((COLS - active.shape[0].length)/2);
    active.y = -Math.max(1, active.shape.length - 1);
    if(collides(active.shape, active.x, active.y)) endGame();
    canHold = false;
    drawActive();
  }
}

/* soft drop / hard drop */
function softDrop(){
  if(!active) return;
  if(!move(0,1)){
    // cannot move down -> lock if below top
    if(active.y < 0){
      // piece cannot be placed (top) => game over
      endGame();
    } else {
      lockActive();
      clearLines();
      spawn();
      drawActive();
    }
  }
}
function hardDrop(){
  if(!active) return;
  while(move(0,1)){}
  // then lock
  if(active){
    if(active.y < 0) endGame();
    else {
      lockActive();
      clearLines();
      spawn();
      drawActive();
    }
  }
}

/* Main tick */
function tickLoop(){
  if(!running) return;
  const moved = move(0,1);
  if(!moved){
    // lock piece if cannot go down and it's on board
    if(active && active.y >= 0){
      lockActive();
      clearLines();
      spawn();
      drawActive();
    } else if(active && active.y < 0){
      // if active is above board and cant move -> immediate game over
      endGame();
    }
  }
  scheduleNext();
}

/* schedule next tick based on speed */
function scheduleNext(){
  if(timerId) clearTimeout(timerId);
  timerId = setTimeout(()=> requestAnimationFrame(tickLoop), speed);
}

/* start / pause / reset / end */
function startGame(){
  if(running) return;
  // reset state
  clearTimeout(timerId);
  buildBoard();
  locked = Array.from({length:ROWS}, ()=>new Array(COLS).fill(null));
  score = 0; lines = 0; level = 1; speed = 700;
  nextPiece = randomPiece();
  active = null;
  holdPiece = null;
  canHold = true;
  updateHUD();
  drawNext();
  // spawn first piece and draw
  spawn();
  drawActive();
  running = true;
  scheduleNext();
}
function pauseGame(){
  running = !running;
  if(running) scheduleNext();
  else clearTimeout(timerId);
  btnPause.textContent = running ? 'Pause' : 'Resume';
}
function resetGame(){
  running = false;
  clearTimeout(timerId);
  score = 0; lines = 0; level = 1; speed = 700;
  buildBoard();
  locked = Array.from({length:ROWS}, ()=>new Array(COLS).fill(null));
  nextPiece = randomPiece();
  active = null;
  canHold = true;
  updateHUD();
  drawNext();
  btnPause.textContent = 'Pause';
}

/* end game with modal */
function endGame(){
  running = false;
  clearTimeout(timerId);
  finalScore.textContent = score;
  modal.classList.remove('hidden');
}

/* render locked initial (after build or clear) */
function renderLocked(){
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell = grid[r][c];
      if(locked[r][c]){
        cell.classList.add('locked');
        cell.style.background = locked[r][c].color;
      } else {
        cell.classList.remove('locked');
        cell.style.background = '';
      }
      cell.classList.remove('active');
    }
  }
}

/* events */
btnStart.addEventListener('click', ()=> startGame());
btnPause.addEventListener('click', ()=> pauseGame());
btnReset.addEventListener('click', ()=> resetGame());
btnHold.addEventListener('click', ()=> hold());

modalRestart.addEventListener('click', ()=> {
  modal.classList.add('hidden');
  resetGame();
  startGame();
});
modalClose.addEventListener('click', ()=> {
  modal.classList.add('hidden');
});

document.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); move(-1,0); }
  else if(e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); move(1,0); }
  else if(e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); softDrop(); }
  else if(e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); tryRotate(); }
  else if(e.key === ' ') { e.preventDefault(); hardDrop(); }
  else if(e.key === 'c') hold();
});

/* mobile touch: tap = rotate, swipe left/right = move, swipe down = soft drop */
let touch = { x:0, y:0, t:0 };
const boardArea = document.getElementById('board-area');
boardArea.addEventListener('touchstart', (ev)=>{
  const t = ev.changedTouches[0];
  touch.x = t.clientX; touch.y = t.clientY; touch.t = Date.now();
});
boardArea.addEventListener('touchend', (ev)=>{
  const t = ev.changedTouches[0];
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y, dt = Date.now() - touch.t;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  if(absX < 25 && absY < 25 && dt < 400){
    tryRotate();
    return;
  }
  if(absX > absY){
    if(dx > 0) move(1,0); else move(-1,0);
  } else {
    if(dy > 0) softDrop(); else tryRotate();
  }
});

/* mobile buttons */
if(mLeft) mLeft.addEventListener('click', ()=> move(-1,0));
if(mRight) mRight.addEventListener('click', ()=> move(1,0));
if(mRot) mRot.addEventListener('click', ()=> tryRotate());
if(mDown) mDown.addEventListener('click', ()=> softDrop());
if(mDrop) mDrop.addEventListener('click', ()=> hardDrop());

/* initial build */
buildBoard();
locked = Array.from({length:ROWS}, ()=>new Array(COLS).fill(null));
nextPiece = randomPiece();
drawNext();
updateHUD();

/* make board responsive by changing CSS size depending on viewport if you want finer control
   but layout.css already handles the main breakpoints. */

/* Expose utilities for debug (optional) */
window.Tetris = { start:startGame, pause:pauseGame, reset:resetGame };
