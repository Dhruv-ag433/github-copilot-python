from flask import Flask, render_template, jsonify, request
import sudoku_logic

app = Flask(__name__)

# Keep a simple in-memory store for current puzzle and solution
CURRENT = {
    'puzzle': None,
    'solution': None
}

def get_request_difficulty():
    return request.args.get('difficulty', 'medium')

def get_request_clues():
    clues = request.args.get('clues')
    return int(clues) if clues is not None else None

def store_current_game(puzzle, solution):
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution

def has_locked_cell_changed(board, puzzle):
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if puzzle[i][j] != sudoku_logic.EMPTY and board[i][j] != puzzle[i][j]:
                return True
    return False

def get_empty_cells(board):
    empty_cells = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if board[i][j] == sudoku_logic.EMPTY:
                empty_cells.append((i, j))
    return empty_cells

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/new')
def new_game():
    clues = get_request_clues()
    difficulty = get_request_difficulty()
    puzzle, solution = sudoku_logic.generate_puzzle(clues=clues, difficulty=difficulty)
    store_current_game(puzzle, solution)
    return jsonify({'puzzle': puzzle})

@app.route('/check', methods=['POST'])
def check_solution():
    data = request.json
    board = data.get('board')
    puzzle = CURRENT.get('puzzle')
    solution = CURRENT.get('solution')
    if solution is None or puzzle is None:
        return jsonify({'error': 'No game in progress'}), 400

    if has_locked_cell_changed(board, puzzle):
        return jsonify({'error': 'Locked cells cannot be changed'}), 400

    incorrect = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if board[i][j] != solution[i][j]:
                incorrect.append([i, j])
    return jsonify({'incorrect': incorrect})

@app.route('/hint', methods=['POST'])
def get_hint():
    puzzle = CURRENT.get('puzzle')
    solution = CURRENT.get('solution')
    if solution is None or puzzle is None:
        return jsonify({'error': 'No game in progress'}), 400

    empty_cells = get_empty_cells(puzzle)
    if not empty_cells:
        return jsonify({'error': 'No hints available'}), 400

    row, col = sudoku_logic.random.choice(empty_cells) if hasattr(sudoku_logic, 'random') else empty_cells[0]
    value = solution[row][col]
    puzzle[row][col] = value
    return jsonify({'row': row, 'col': col, 'value': value})

if __name__ == '__main__':
    app.run(debug=True)