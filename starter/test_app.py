"""
Integration tests for Flask app routes.
Tests API endpoints and game logic.
"""

import pytest # type: ignore
import json
import app as app_module
import sudoku_logic


class TestRoutes:
    """Tests for Flask route handlers."""

    def test_index_route_returns_200(self, client):
        """Test that index route returns 200 OK."""
        response = client.get('/')
        assert response.status_code == 200

    def test_index_route_returns_html(self, client):
        """Test that index route returns HTML content."""
        response = client.get('/')
        assert b'<!DOCTYPE' in response.data or b'<html' in response.data


class TestNewGameRoute:
    """Tests for /new route that generates new puzzles."""

    def test_new_game_returns_200(self, client):
        """Test that /new route returns 200 OK."""
        response = client.get('/new')
        assert response.status_code == 200

    def test_new_game_returns_json(self, client):
        """Test that /new route returns JSON response."""
        response = client.get('/new')
        assert response.content_type.startswith('application/json')

    def test_new_game_contains_puzzle(self, client):
        """Test that /new response contains puzzle data."""
        response = client.get('/new')
        data = json.loads(response.data)
        assert 'puzzle' in data
        puzzle = data['puzzle']
        assert len(puzzle) == 9
        assert all(len(row) == 9 for row in puzzle)

    def test_new_game_stores_current_game(self, client, app_context):
        """Test that /new stores puzzle and solution in CURRENT."""
        response = client.get('/new')
        assert app_module.CURRENT['puzzle'] is not None
        assert app_module.CURRENT['solution'] is not None

    @pytest.mark.parametrize("difficulty", ["easy", "medium", "hard"])
    def test_new_game_with_difficulty(self, client, difficulty):
        """Test generating puzzles with different difficulties."""
        response = client.get(f'/new?difficulty={difficulty}')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'puzzle' in data
        clue_count = sum(1 for row in data['puzzle'] for cell in row if cell != 0)
        assert clue_count == sudoku_logic.DIFFICULTY_CLUES[difficulty]

    def test_new_game_with_custom_clues(self, client):
        """Test generating puzzle with custom clue count."""
        response = client.get('/new?clues=50')
        assert response.status_code == 200
        data = json.loads(response.data)
        puzzle = data['puzzle']
        clue_count = sum(1 for row in puzzle for cell in row if cell != 0)
        assert clue_count == 50


class TestCheckSolutionRoute:
    """Tests for /check route that validates solutions."""

    def test_check_solution_requires_game(self, client):
        """Test that /check requires active game."""
        # Reset current game
        app_module.CURRENT['puzzle'] = None
        app_module.CURRENT['solution'] = None

        response = client.post('/check', json={'board': sudoku_logic.create_empty_board()})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_check_solution_correct_board(self, client, app_context):
        """Test checking a correct solution."""
        # Generate a new game
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        response = client.post('/check', json={'board': solution})
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'incorrect' in data
        assert len(data['incorrect']) == 0

    def test_check_solution_incorrect_board(self, client, app_context):
        """Test checking an incorrect solution."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        # Create incorrect board
        incorrect_board = sudoku_logic.deep_copy(solution)
        # Find first empty cell in puzzle and change it
        for i in range(9):
            for j in range(9):
                if puzzle[i][j] == 0:
                    incorrect_board[i][j] = (incorrect_board[i][j] % 9) + 1
                    break

        response = client.post('/check', json={'board': incorrect_board})
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'incorrect' in data
        assert len(data['incorrect']) > 0

    def test_check_solution_locked_cells_unchanged(self, client, app_context):
        """Test that locked cells (from puzzle) cannot be changed."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        # Create board with locked cell changed
        tampered_board = sudoku_logic.deep_copy(puzzle)
        # Find first locked cell and change it
        for i in range(9):
            for j in range(9):
                if puzzle[i][j] != 0:
                    tampered_board[i][j] = (puzzle[i][j] % 9) + 1
                    break

        response = client.post('/check', json={'board': tampered_board})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'Locked' in data['error']

    def test_check_solution_returns_json(self, client, app_context):
        """Test that /check returns JSON response."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        response = client.post('/check', json={'board': solution})
        assert response.content_type.startswith('application/json')


class TestHintRoute:
    """Tests for /hint route that provides hints."""

    def test_hint_requires_game(self, client):
        """Test that /hint requires active game."""
        app_module.CURRENT['puzzle'] = None
        app_module.CURRENT['solution'] = None

        response = client.post('/hint')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_hint_returns_valid_cell(self, client, app_context):
        """Test that hint returns a valid empty cell from puzzle."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        response = client.post('/hint')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'row' in data
        assert 'col' in data
        assert 'value' in data
        row, col, value = data['row'], data['col'], data['value']
        assert 0 <= row < 9
        assert 0 <= col < 9
        assert 1 <= value <= 9

    def test_hint_provides_correct_value(self, client, app_context):
        """Test that hint value matches solution."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        response = client.post('/hint')
        assert response.status_code == 200
        data = json.loads(response.data)
        row, col, value = data['row'], data['col'], data['value']
        assert solution[row][col] == value

    def test_hint_returns_json(self, client, app_context):
        """Test that /hint returns JSON response."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        app_module.store_current_game(puzzle, solution)

        response = client.post('/hint')
        assert response.content_type.startswith('application/json')


class TestHelperFunctions:
    """Tests for app helper functions."""

    def test_get_request_difficulty_default(self, client, app_context):
        """Test that difficulty defaults to medium."""
        with app_module.app.test_request_context('/new'):
            assert app_module.get_request_difficulty() == 'medium'

    def test_has_locked_cell_changed_unchanged(self):
        """Test locked cell detection when no changes."""
        puzzle = sudoku_logic.create_empty_board()
        puzzle[0][0] = 5
        board = sudoku_logic.deep_copy(puzzle)
        assert app_module.has_locked_cell_changed(board, puzzle) is False

    def test_has_locked_cell_changed_modified(self):
        """Test locked cell detection when changed."""
        puzzle = sudoku_logic.create_empty_board()
        puzzle[0][0] = 5
        board = sudoku_logic.deep_copy(puzzle)
        board[0][0] = 6
        assert app_module.has_locked_cell_changed(board, puzzle) is True

    def test_get_empty_cells(self):
        """Test getting list of empty cells."""
        puzzle = sudoku_logic.create_empty_board()
        puzzle[0][0] = 5
        puzzle[1][1] = 3
        empty_cells = app_module.get_empty_cells(puzzle)
        assert (0, 0) not in empty_cells
        assert (1, 1) not in empty_cells
        assert (0, 1) in empty_cells
        assert len(empty_cells) == 81 - 2

    def test_store_current_game(self):
        """Test storing puzzle and solution."""
        puzzle = sudoku_logic.create_empty_board()
        solution = sudoku_logic.deep_copy(puzzle)
        app_module.store_current_game(puzzle, solution)
        assert app_module.CURRENT['puzzle'] is puzzle
        assert app_module.CURRENT['solution'] is solution


class TestGameFlow:
    """Tests for complete game flows."""

    def test_complete_game_flow(self, client, app_context):
        """Test a complete game flow: new game -> check -> hint."""
        # Create new game
        response = client.get('/new?difficulty=easy')
        assert response.status_code == 200
        puzzle_data = json.loads(response.data)
        puzzle = puzzle_data['puzzle']

        # Create a working board
        board = sudoku_logic.deep_copy(app_module.CURRENT['solution'])

        # Check solution
        response = client.post('/check', json={'board': board})
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data['incorrect']) == 0

    def test_multiple_games_in_sequence(self, client, app_context):
        """Test starting multiple games in sequence."""
        for _ in range(3):
            response = client.get('/new?difficulty=easy')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert 'puzzle' in data
