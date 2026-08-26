// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
const LEADERBOARD_STORAGE_KEY = 'sudoku-leaderboard-v1';
const THEME_STORAGE_KEY = 'sudoku-theme-v1';
const MAX_LEADERBOARD_ENTRIES = 10;  // Keep only top 10 scores
let puzzle = [];
let currentBoard = [];
let timerIntervalId = null;
let timerStartTime = null;
let currentDifficulty = 'medium';
let currentTheme = 'light';

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
    return 0;
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
  timerStartTime = Date.now();
  renderTimer();
  timerIntervalId = window.setInterval(renderTimer, 1000);
}

function stopTimer() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function resetTimer() {
  stopTimer();
  timerStartTime = null;
  renderTimer();
}

/**
 * Load high scores from localStorage.
 * Returns an array sorted by time (fastest first).
 * @returns {Array} Array of score entries, already sorted and limited to top 10
 */
function loadLeaderboard() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) {
      return [];
    }
    // Ensure entries are sorted by time (fastest first)
    return entries.sort((left, right) => left.timeSeconds - right.timeSeconds).slice(0, 10);
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return [];
  }
}

/**
 * Save high scores to localStorage.
 * Automatically maintains only top 10 entries.
 * @param {Array} entries - Array of score entries to save
 */
function saveLeaderboard(entries) {
  try {
    // Sort and keep only top 10
    const sortedEntries = entries
      .sort((left, right) => {
        if (left.timeSeconds !== right.timeSeconds) {
          return left.timeSeconds - right.timeSeconds;
        }
        return left.createdAt - right.createdAt;
      })
      .slice(0, 10);
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(sortedEntries));
  } catch (error) {
    console.error('Error saving leaderboard:', error);
    // Ignore storage failures so gameplay still works.
  }
}

/**
 * Clear all scores from the leaderboard.
 * Requires user confirmation.
 * @returns {Boolean} True if cleared, false if cancelled
 */
function clearLeaderboard() {
  if (confirm('Are you sure you want to delete all high scores? This cannot be undone.')) {
    try {
      window.localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
      renderLeaderboard();
      return true;
    } catch (error) {
      console.error('Error clearing leaderboard:', error);
      return false;
    }
  }
  return false;
}

/**
 * Get leaderboard statistics.
 * @returns {Object} Object containing count, best time, average time, by difficulty
 */
function getLeaderboardStats() {
  const entries = loadLeaderboard();
  if (entries.length === 0) {
    return {
      count: 0,
      bestTime: null,
      averageTime: null,
      byDifficulty: {}
    };
  }

  const totalTime = entries.reduce((sum, entry) => sum + entry.timeSeconds, 0);
  const avgTime = Math.round(totalTime / entries.length);

  const byDifficulty = {};
  for (const entry of entries) {
    const diff = entry.difficulty || 'unknown';
    if (!byDifficulty[diff]) {
      byDifficulty[diff] = [];
    }
    byDifficulty[diff].push(entry);
  }

  return {
    count: entries.length,
    bestTime: entries[0]?.timeSeconds || null,
    averageTime: avgTime,
    byDifficulty
  };
}

/**
 * Check if a score would place on the leaderboard.
 * @param {number} timeSeconds - Time to check
 * @returns {Object} Object with {wouldPlace: boolean, rank: number|null}
 */
function checkLeaderboardPlacement(timeSeconds) {
  const entries = loadLeaderboard();
  const rank = entries.findIndex(entry => entry.timeSeconds > timeSeconds);
  
  if (entries.length < 10) {
    return { wouldPlace: true, rank: entries.length + 1 };
  }
  
  if (rank !== -1) {
    return { wouldPlace: true, rank: rank + 1 };
  }
  
  return { wouldPlace: false, rank: null };
}

/**
 * Export leaderboard as JSON.
 * @returns {string} JSON string of all scores
 */
function exportLeaderboard() {
  const entries = loadLeaderboard();
  return JSON.stringify(entries, null, 2);
}

/**
 * Import leaderboard from JSON.
 * Merges with existing scores and keeps top 10.
 * @param {string} jsonString - JSON string to import
 * @returns {Boolean} True if successful, false if error
 */
function importLeaderboard(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) {
      console.error('Invalid format: expected array');
      return false;
    }
    
    // Validate entries have required fields
    for (const entry of imported) {
      if (!entry.name || typeof entry.timeSeconds !== 'number' || !entry.difficulty) {
        console.error('Invalid entry format');
        return false;
      }
    }
    
    const existing = loadLeaderboard();
    const merged = [...existing, ...imported];
    saveLeaderboard(merged);
    renderLeaderboard();
    return true;
  } catch (error) {
    console.error('Error importing leaderboard:', error);
    return false;
  }
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

/**
 * Add a new entry to the leaderboard and save.
 * Automatically maintains top 10.
 * @param {string} name - Player name
 * @param {number} timeSeconds - Time in seconds
 * @param {string} difficulty - Difficulty level
 * @returns {Object} Result object with {placed: boolean, rank: number|null}
 */
function addLeaderboardEntry(name, timeSeconds, difficulty) {
  const trimmedName = name.trim();
  const entry = {
    name: trimmedName || 'Anonymous',
    timeSeconds: Math.max(0, timeSeconds), // Ensure non-negative
    difficulty: difficulty || 'medium',
    createdAt: Date.now(),
  };

  // Check placement before adding
  const placement = checkLeaderboardPlacement(entry.timeSeconds);

  if (placement.wouldPlace) {
    const entries = loadLeaderboard();
    entries.push(entry);
    saveLeaderboard(entries);
    renderLeaderboard();
    return { placed: true, rank: placement.rank };
  }

  return { placed: false, rank: null };
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