"""
Shared fixtures and configuration for pytest.
"""

import pytest # type: ignore
import sys
import os

# Add parent directory to path to import app and sudoku_logic
sys.path.insert(0, os.path.dirname(__file__))

import app
import sudoku_logic


@pytest.fixture
def flask_app():
    """Create and configure a test Flask app instance."""
    app.app.config['TESTING'] = True
    return app.app


@pytest.fixture
def client(flask_app):
    """Provide a Flask test client."""
    return flask_app.test_client()


@pytest.fixture
def app_context(flask_app):
    """Provide Flask app context for database/session operations."""
    with flask_app.app_context():
        yield flask_app


@pytest.fixture
def empty_board():
    """Provide an empty 9x9 Sudoku board."""
    return sudoku_logic.create_empty_board()


@pytest.fixture
def valid_solved_board():
    """
    Provide a valid completed Sudoku board.
    Generated fresh for each test to ensure independence.
    """
    board = sudoku_logic.create_empty_board()
    sudoku_logic.fill_board(board)
    return board


@pytest.fixture
def puzzle_and_solution():
    """Provide both a puzzle and its solution."""
    puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
    return puzzle, solution


@pytest.fixture
def sample_puzzle():
    """Provide a sample puzzle board with some clues."""
    puzzle, _ = sudoku_logic.generate_puzzle(difficulty='medium')
    return puzzle


@pytest.fixture
def sample_solution():
    """Provide a sample completed solution."""
    _, solution = sudoku_logic.generate_puzzle(difficulty='easy')
    return solution
