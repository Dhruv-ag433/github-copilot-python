// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
const LEADERBOARD_STORAGE_KEY = 'sudoku-leaderboard-v1';
const THEME_STORAGE_KEY = 'sudoku-theme-v1';
const MAX_LEADERBOARD_ENTRIES = 10;  // Keep only top 10 scores
let puzzle = [];
let currentBoard = [];
let timerIntervalId = null;
let timerStartTime = null;
let elapsedSeconds = 0;
let currentDifficulty = 'medium';
let currentTheme = 'light';
let gameCompleted = false;

function getSelectedDifficulty() {
  const select = document.getElementById('difficulty');
  return select ? select.value : 'medium';
}

function getSavedTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch (error) {
    return 'light';
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    // Ignore storage failures so gameplay still works.
  }
}

function updateThemeButton() {
  const button = document.getElementById('theme-toggle');
  if (!button) {
    return;
  }

  const isDark = currentTheme === 'dark';
  button.innerText = isDark ? '☀' : '🌙';
  button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  button.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function applyTheme(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = currentTheme;
  saveTheme(currentTheme);
  updateThemeButton();
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function formatElapsedTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getElapsedSeconds() {
  if (!timerStartTime) {
    return elapsedSeconds;
  }
  return Math.floor((Date.now() - timerStartTime) / 1000);
}

function renderTimer() {
  const timer = document.getElementById('timer');
  if (!timer) {
    return;
  }

  const elapsedSeconds = getElapsedSeconds();
  timer.innerText = `Time: ${formatElapsedTime(elapsedSeconds)}`;
}

function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  timerStartTime = Date.now();
  renderTimer();
  timerIntervalId = window.setInterval(renderTimer, 1000);
}

function stopTimer() {
  if (timerStartTime !== null) {
    elapsedSeconds = Math.floor((Date.now() - timerStartTime) / 1000);
    timerStartTime = null;
  }
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function resetTimer() {
  stopTimer();
  elapsedSeconds = 0;
  renderTimer();
}

function normalizeLeaderboardEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => (
    entry &&
    typeof entry === 'object' &&
    typeof entry.name === 'string' &&
    Number.isFinite(entry.timeSeconds) &&
    entry.timeSeconds >= 0 &&
    typeof entry.difficulty === 'string' &&
    entry.difficulty.length > 0
  ));
}

function sortLeaderboardEntries(entries) {
  return normalizeLeaderboardEntries(entries).sort((left, right) => {
    if (left.timeSeconds !== right.timeSeconds) {
      return left.timeSeconds - right.timeSeconds;
    }
    return (left.createdAt || 0) - (right.createdAt || 0);
  });
}

function loadLeaderboard() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    const sortedEntries = sortLeaderboardEntries(entries).slice(0, MAX_LEADERBOARD_ENTRIES);

    if (raw && JSON.stringify(sortedEntries) !== JSON.stringify(entries)) {
      window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(sortedEntries));
    }

    return sortedEntries;
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return [];
  }
}

function saveLeaderboard(entries) {
  try {
    const sortedEntries = sortLeaderboardEntries(entries).slice(0, MAX_LEADERBOARD_ENTRIES);
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(sortedEntries));
    return sortedEntries;
  } catch (error) {
    console.error('Error saving leaderboard:', error);
    return [];
  }
}

function clearLeaderboard() {
  if (!confirm('Are you sure you want to delete all high scores? This cannot be undone.')) {
    return false;
  }

  try {
    window.localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
    renderLeaderboard();
    return true;
  } catch (error) {
    console.error('Error clearing leaderboard:', error);
    return false;
  }
}

function getLeaderboardStats() {
  const entries = loadLeaderboard();
  if (entries.length === 0) {
    return { count: 0, bestTime: null, averageTime: null, byDifficulty: {} };
  }

  const totalTime = entries.reduce((sum, entry) => sum + entry.timeSeconds, 0);
  const byDifficulty = {};
  for (const entry of entries) {
    const difficulty = entry.difficulty || 'unknown';
    if (!byDifficulty[difficulty]) {
      byDifficulty[difficulty] = [];
    }
    byDifficulty[difficulty].push(entry);
  }

  return {
    count: entries.length,
    bestTime: entries[0].timeSeconds,
    averageTime: Math.round(totalTime / entries.length),
    byDifficulty
  };
}

function checkLeaderboardPlacement(timeSeconds) {
  const entries = loadLeaderboard();
  const rank = entries.findIndex(entry => entry.timeSeconds > timeSeconds);
  if (rank !== -1) {
    return { wouldPlace: true, rank: rank + 1 };
  }
  if (entries.length < MAX_LEADERBOARD_ENTRIES) {
    return { wouldPlace: true, rank: entries.length + 1 };
  }
  return { wouldPlace: false, rank: null };
}

function exportLeaderboard() {
  return JSON.stringify(loadLeaderboard(), null, 2);
}

function importLeaderboard(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported) || normalizeLeaderboardEntries(imported).length !== imported.length) {
      return false;
    }
    saveLeaderboard([...loadLeaderboard(), ...imported]);
    renderLeaderboard();
    return true;
  } catch (error) {
    console.error('Error importing leaderboard:', error);
    return false;
  }
}

function addLeaderboardEntry(name, timeSeconds, difficulty) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    return { placed: false, rank: null };
  }

  const entry = {
    name: trimmedName || 'Anonymous',
    timeSeconds,
    difficulty: difficulty || 'medium',
    createdAt: Date.now(),
  };
  const sortedEntries = sortLeaderboardEntries([...loadLeaderboard(), entry]);
  const placementIndex = sortedEntries.indexOf(entry);

  if (placementIndex >= 0 && placementIndex < MAX_LEADERBOARD_ENTRIES) {
    saveLeaderboard(sortedEntries);
    renderLeaderboard();
    return { placed: true, rank: placementIndex + 1 };
  }

  return { placed: false, rank: null };
}

function formatDifficultyLabel(difficulty) {
  if (!difficulty) {
    return 'Medium';
  }
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

/**
 * Render the leaderboard table with rank numbers.
 * Displays top 10 scores sorted by time (fastest first).
 * Highlights top 3 scores with special styling.
 */
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) {
    return;
  }

  const entries = loadLeaderboard();
  tbody.innerHTML = '';

  if (entries.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'leaderboard-empty';
    cell.innerText = 'No scores yet. Solve a puzzle to set the first record.';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const row = document.createElement('tr');
    
    // Add rank class for styling top 3
    if (i === 0) row.classList.add('rank-1st');
    else if (i === 1) row.classList.add('rank-2nd');
    else if (i === 2) row.classList.add('rank-3rd');

    // Rank column
    const rankCell = document.createElement('td');
    rankCell.className = 'rank-cell';
    rankCell.innerText = `#${i + 1}`;
    row.appendChild(rankCell);

    // Name column
    const nameCell = document.createElement('td');
    nameCell.innerText = entry.name;
    row.appendChild(nameCell);

    // Time column
    const timeCell = document.createElement('td');
    timeCell.innerText = formatElapsedTime(entry.timeSeconds);
    row.appendChild(timeCell);

    // Difficulty column
    const difficultyCell = document.createElement('td');
    difficultyCell.innerText = formatDifficultyLabel(entry.difficulty);
    row.appendChild(difficultyCell);

    tbody.appendChild(row);
  }
}

function getBoxClass(row, col) {
  const boxRow = Math.floor(row / 3);
  const boxCol = Math.floor(col / 3);
  const boxIndex = boxRow * 3 + boxCol;  // 0-8 based on 3x3 subgrid position
  return `box-${boxIndex}`;
}

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = `sudoku-cell ${getBoxClass(i, j)}`;
      input.dataset.row = i;
      input.dataset.col = j;
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = val;
        updateCurrentBoardFromInputs();
        applyLiveValidationFeedback();
      });
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function getBoardInputs() {
  const boardDiv = document.getElementById('sudoku-board');
  return boardDiv.getElementsByTagName('input');
}

function updateCurrentBoardFromInputs() {
  const inputs = getBoardInputs();
  currentBoard = [];
  for (let i = 0; i < SIZE; i++) {
    currentBoard[i] = [];
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = inputs[idx].value;
      currentBoard[i][j] = val ? parseInt(val, 10) : 0;
    }
  }
}

function getConflictKeys(board) {
  const conflicts = new Set();

  function markIfDuplicate(cells) {
    const seen = new Map();
    for (const cell of cells) {
      const value = board[cell.row][cell.col];
      if (value === 0) {
        continue;
      }
      if (seen.has(value)) {
        conflicts.add(`${cell.row},${cell.col}`);
        conflicts.add(`${seen.get(value).row},${seen.get(value).col}`);
      } else {
        seen.set(value, cell);
      }
    }
  }

  for (let row = 0; row < SIZE; row++) {
    markIfDuplicate(Array.from({ length: SIZE }, (_, col) => ({ row, col })));
  }

  for (let col = 0; col < SIZE; col++) {
    markIfDuplicate(Array.from({ length: SIZE }, (_, row) => ({ row, col })));
  }

  for (let startRow = 0; startRow < SIZE; startRow += 3) {
    for (let startCol = 0; startCol < SIZE; startCol += 3) {
      const cells = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          cells.push({ row: startRow + row, col: startCol + col });
        }
      }
      markIfDuplicate(cells);
    }
  }

  return conflicts;
}

function applyLiveValidationFeedback() {
  const inputs = getBoardInputs();
  const conflictKeys = getConflictKeys(currentBoard);

  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    if (inp.readOnly) {
      continue;
    }

    const row = Number(inp.dataset.row);
    const col = Number(inp.dataset.col);
    inp.className = `sudoku-cell editable ${getBoxClass(row, col)}`;
    if (conflictKeys.has(`${row},${col}`)) {
      inp.classList.add('invalid');
    }
  }
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  const inputs = getBoardInputs();
  for (let i = 0; i < SIZE; i++) {
    currentBoard[i] = [];
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.readOnly = true;
        inp.classList.add('prefilled');
        currentBoard[i][j] = val;
      } else {
        inp.value = '';
        inp.readOnly = false;
        inp.classList.add('editable');
        currentBoard[i][j] = 0;
      }
    }
  }
  applyLiveValidationFeedback();
}

function applyHintToBoard(row, col, value) {
  const inputs = getBoardInputs();
  const idx = row * SIZE + col;
  const inp = inputs[idx];
  if (!inp) {
    return;
  }

  puzzle[row][col] = value;
  currentBoard[row][col] = value;
  inp.value = value;
  inp.readOnly = true;
  inp.className = `sudoku-cell prefilled hinted ${getBoxClass(row, col)}`;
  applyLiveValidationFeedback();
}

async function newGame() {
  resetTimer();
  gameCompleted = false;
  currentDifficulty = getSelectedDifficulty();
  const res = await fetch(`/new?difficulty=${encodeURIComponent(currentDifficulty)}`);
  const data = await res.json();
  renderPuzzle(data.puzzle);
  startTimer();
  document.getElementById('message').innerText = '';
}

async function requestHint() {
  const res = await fetch('/hint', { method: 'POST' });
  const data = await res.json();
  const msg = document.getElementById('message');

  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }

  applyHintToBoard(data.row, data.col, data.value);
  msg.style.color = '#1565c0';
  msg.innerText = 'Hint applied.';
}

async function checkSolution() {
  if (gameCompleted) {
    return;
  }

  const inputs = getBoardInputs();
  updateCurrentBoardFromInputs();
  const res = await fetch('/check', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({board: currentBoard})
  });
  const data = await res.json();
  const msg = document.getElementById('message');
  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }
  const incorrect = new Set(data.incorrect.map(x => x[0]*SIZE + x[1]));
  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    if (inp.readOnly) continue;
    if (incorrect.has(idx)) {
      inp.classList.add('invalid');
    } else {
      inp.classList.remove('invalid');
    }
  }
  if (incorrect.size === 0) {
    gameCompleted = true;
    stopTimer();
    const timeSeconds = getElapsedSeconds();
    
    // Check if score would place on leaderboard
    const placement = checkLeaderboardPlacement(timeSeconds);
    let leaderboardMsg = '';
    if (placement.wouldPlace) {
      leaderboardMsg = placement.rank <= 3 
        ? ` You rank #${placement.rank}! 🏆` 
        : ` You rank #${placement.rank} on the leaderboard!`;
    } else if (loadLeaderboard().length > 0) {
      leaderboardMsg = ' (Did not make top 10)';
    }
    
    const playerName = window.prompt(
      `Puzzle solved in ${formatElapsedTime(timeSeconds)}!${leaderboardMsg}\n\nEnter your name for the leaderboard:`, 
      'Player'
    );
    
    if (playerName !== null) {
      const result = addLeaderboardEntry(playerName, timeSeconds, currentDifficulty);
      if (result.placed) {
        msg.style.color = '#388e3c';
        msg.innerText = `🎉 Congratulations! Solved in ${formatElapsedTime(timeSeconds)}. Rank: #${result.rank}`;
      } else {
        msg.style.color = '#f57c00';
        msg.innerText = `Congratulations! Solved in ${formatElapsedTime(timeSeconds)}. (Not in top 10)`;
      }
    } else {
      msg.style.color = '#388e3c';
      msg.innerText = `Congratulations! You solved it in ${formatElapsedTime(timeSeconds)}.`;
    }
  } else {
    msg.style.color = '#d32f2f';
    msg.innerText = 'Some cells are incorrect.';
  }
}

// Wire buttons
window.addEventListener('load', () => {
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('hint-button').addEventListener('click', requestHint);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('difficulty').addEventListener('change', newGame);
  
  // Wire leaderboard actions if buttons exist
  const clearBtn = document.getElementById('clear-leaderboard');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (clearLeaderboard()) {
        const msg = document.getElementById('message');
        if (msg) {
          msg.style.color = '#d32f2f';
          msg.innerText = 'Leaderboard cleared.';
        }
      }
    });
  }
  
  // Initialize
  applyTheme(getSavedTheme());
  renderTimer();
  renderLeaderboard();
  newGame();
});