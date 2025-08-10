const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const nextContainer = document.getElementById("next");
const startBtn = document.getElementById("start-btn");

const rows = 20;
const cols = 10;
let grid = [];
let score = 0;
let level = 1;
let lines = 0;
let gameInterval;
let speed = 500;

const colors = ["#FF0D72", "#0DC2FF", "#0DFF72", "#F538FF", "#FF8E0D", "#FFE138", "#3877FF"];

const shapes = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 0], [1, 1, 1]], // T
  [[1, 0, 0], [1, 1, 1]], // J
  [[0, 0, 1], [1, 1, 1]], // L
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 0], [0, 1, 1]], // Z
];

let currentPiece, currentPos, nextPiece;

function createBoard() {
  board.innerHTML = "";
  grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      board.appendChild(cell);
      row.push(cell);
    }
    grid.push(row);
  }
}

function drawPiece(shape, pos, color) {
  shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        const x = pos.x + c;
        const y = pos.y + r;
        if (y >= 0 && grid[y] && grid[y][x]) {
          grid[y][x].classList.add("filled");
          grid[y][x].style.setProperty("--color", color);
        }
      }
    });
  });
}

function clearPiece(shape, pos) {
  shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        const x = pos.x + c;
        const y = pos.y + r;
        if (y >= 0 && grid[y] && grid[y][x]) {
          grid[y][x].classList.remove("filled");
        }
      }
    });
  });
}

function spawnPiece() {
  currentPiece = nextPiece || randomPiece();
  currentPos = { x: Math.floor(cols / 2) - Math.floor(currentPiece.shape[0].length / 2), y: -1 };
  nextPiece = randomPiece();
  drawNext();
}

function drawNext() {
  nextContainer.innerHTML = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const div = document.createElement("div");
      div.classList.add("cell");
      nextContainer.appendChild(div);
    }
  }
  nextPiece.shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        const index = r * 4 + c;
        nextContainer.children[index].classList.add("filled");
        nextContainer.children[index].style.setProperty("--color", nextPiece.color);
      }
    });
  });
}

function randomPiece() {
  const index = Math.floor(Math.random() * shapes.length);
  return { shape: shapes[index], color: colors[index] };
}

function movePiece(dx, dy) {
  if (!collision(currentPiece.shape, { x: currentPos.x + dx, y: currentPos.y + dy })) {
    clearPiece(currentPiece.shape, currentPos);
    currentPos.x += dx;
    currentPos.y += dy;
    drawPiece(currentPiece.shape, currentPos, currentPiece.color);
    return true;
  }
  return false;
}

function rotatePiece() {
  const rotated = currentPiece.shape[0].map((_, i) =>
    currentPiece.shape.map(row => row[i]).reverse()
  );
  if (!collision(rotated, currentPos)) {
    clearPiece(currentPiece.shape, currentPos);
    currentPiece.shape = rotated;
    drawPiece(currentPiece.shape, currentPos, currentPiece.color);
  }
}

function collision(shape, pos) {
  return shape.some((row, r) => {
    return row.some((value, c) => {
      if (value) {
        const x = pos.x + c;
        const y = pos.y + r;
        return (
          x < 0 || x >= cols || y >= rows || (y >= 0 && grid[y][x].classList.contains("filled"))
        );
      }
      return false;
    });
  });
}

function placePiece() {
  if (currentPos.y < 0) {
    clearInterval(gameInterval);
    alert("Game Over!");
    return;
  }
  score += 10;
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = rows - 1; r >= 0; r--) {
    if (grid[r].every(cell => cell.classList.contains("filled"))) {
      grid[r].forEach(cell => cell.classList.remove("filled"));
      const row = grid.splice(r, 1)[0];
      grid.unshift(row);
      cleared++;
      r++;
    }
  }
  if (cleared > 0) {
    score += cleared * 100;
    lines += cleared;
    if (lines % 10 === 0) {
      level++;
      speed = Math.max(100, speed - 50);
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, speed);
    }
  }
  updateScore();
}

function updateScore() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function gameLoop() {
  if (!movePiece(0, 1)) {
    placePiece();
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") movePiece(-1, 0);
  else if (e.key === "ArrowRight") movePiece(1, 0);
  else if (e.key === "ArrowDown") movePiece(0, 1);
  else if (e.key === "ArrowUp") rotatePiece();
  else if (e.key === " ") {
    while (movePiece(0, 1)) {}
    placePiece();
  }
});

startBtn.addEventListener("click", () => {
  createBoard();
  score = 0;
  level = 1;
  lines = 0;
  speed = 500;
  updateScore();
  spawnPiece();
  gameInterval = setInterval(gameLoop, speed);
});
