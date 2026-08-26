"""
Unit tests for sudoku_logic module.
Tests puzzle generation, validation, and solving.
"""

import pytest # type: ignore
import sudoku_logic


class TestBoardCreation:
    """Tests for board creation and utility functions."""

    def test_create_empty_board(self):
        """Test that empty board is 9x9 and filled with zeros."""
        board = sudoku_logic.create_empty_board()
        assert len(board) == 9
        assert all(len(row) == 9 for row in board)
        assert all(cell == 0 for row in board for cell in row)

    def test_deep_copy_independence(self, empty_board):
        """Test that deep_copy creates independent copy."""
        original = empty_board
        original[0][0] = 5
        copied = sudoku_logic.deep_copy(original)
        copied[0][0] = 9
        assert original[0][0] == 5
        assert copied[0][0] == 9

    def test_find_empty_cell_in_empty_board(self, empty_board):
        """Test finding empty cell in completely empty board."""
        result = sudoku_logic.find_empty_cell(empty_board)
        assert result == (0, 0)

    def test_find_empty_cell_returns_none_when_full(self, valid_solved_board):
        """Test that find_empty_cell returns None for full board."""
        result = sudoku_logic.find_empty_cell(valid_solved_board)
        assert result is None


class TestValidation:
    """Tests for Sudoku rule validation."""

    def test_is_safe_empty_cell(self, empty_board):
        """Test that any number is safe in empty board."""
        for num in range(1, 10):
            assert sudoku_logic.is_safe(empty_board, 0, 0, num) is True

    def test_is_safe_duplicate_in_row(self, empty_board):
        """Test that duplicate number in row returns False."""
        empty_board[0][0] = 5
        assert sudoku_logic.is_safe(empty_board, 0, 1, 5) is False
        assert sudoku_logic.is_safe(empty_board, 0, 1, 6) is True

    def test_is_safe_duplicate_in_column(self, empty_board):
        """Test that duplicate number in column returns False."""
        empty_board[0][0] = 5
        assert sudoku_logic.is_safe(empty_board, 1, 0, 5) is False
        assert sudoku_logic.is_safe(empty_board, 1, 0, 6) is True

    def test_is_safe_duplicate_in_3x3_box(self, empty_board):
        """Test that duplicate in 3x3 box returns False."""
        empty_board[0][0] = 5
        # (1, 1) is in same 3x3 box as (0, 0)
        assert sudoku_logic.is_safe(empty_board, 1, 1, 5) is False
        # (0, 4) is NOT in same 3x3 box as (0, 0)
        assert sudoku_logic.is_safe(empty_board, 0, 4, 5) is True

    @pytest.mark.parametrize("row,col", [(0, 3), (3, 0), (3, 3)])
    def test_is_safe_different_3x3_boxes(self, empty_board, row, col):
        """Test that same number is safe in different 3x3 boxes."""
        empty_board[0][0] = 5
        assert sudoku_logic.is_safe(empty_board, row, col, 5) is True


class TestPuzzleGeneration:
    """Tests for puzzle generation and solving."""

    def test_fill_board_creates_valid_solution(self, empty_board):
        """Test that fill_board creates a completely filled valid board."""
        result = sudoku_logic.fill_board(empty_board)
        assert result is True
        # Check all cells are filled
        assert all(cell != 0 for row in empty_board for cell in row)
        # Check solution is valid
        assert is_valid_board(empty_board)

    def test_count_solutions_returns_positive_int(self, empty_board):
        """Test that count_solutions returns valid count."""
        sudoku_logic.fill_board(empty_board)
        count = sudoku_logic.count_solutions(sudoku_logic.deep_copy(empty_board), limit=2)
        assert count >= 1
        assert isinstance(count, int)

    def test_has_unique_solution_valid_puzzle(self, puzzle_and_solution):
        """Test that generated puzzles have unique solutions."""
        puzzle, _ = puzzle_and_solution
        assert sudoku_logic.has_unique_solution(puzzle) is True

    def test_generate_puzzle_easy(self):
        """Test generating easy puzzle."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        assert puzzle is not None
        assert solution is not None
        assert count_clues(puzzle) >= 40  # Easy has ~42 clues

    def test_generate_puzzle_medium(self):
        """Test generating medium puzzle."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='medium')
        assert puzzle is not None
        assert solution is not None
        assert count_clues(puzzle) >= 30  # Medium has ~34 clues

    def test_generate_puzzle_hard(self):
        """Test generating hard puzzle."""
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty='hard')
        assert puzzle is not None
        assert solution is not None
        assert count_clues(puzzle) >= 26  # Hard has ~28 clues

    def test_generate_puzzle_custom_clues(self):
        """Test generating puzzle with custom clue count."""
        puzzle, solution = sudoku_logic.generate_puzzle(clues=50)
        clue_count = count_clues(puzzle)
        assert clue_count == 50

    def test_generate_puzzle_solution_validity(self):
        """Test that generated solutions are valid."""
        _, solution = sudoku_logic.generate_puzzle(difficulty='easy')
        assert is_valid_board(solution)

    def test_resolve_clues_defaults(self):
        """Test clue resolution with defaults."""
        clues = sudoku_logic.resolve_clues(difficulty='medium')
        assert clues == sudoku_logic.DIFFICULTY_CLUES['medium']

    def test_resolve_clues_custom_value(self):
        """Test clue resolution with custom value."""
        clues = sudoku_logic.resolve_clues(clues=40)
        assert clues == 40

    def test_resolve_clues_bounds(self):
        """Test clue resolution respects min/max bounds."""
        clues_low = sudoku_logic.resolve_clues(clues=5)
        assert clues_low >= 17  # Minimum for valid puzzle
        clues_high = sudoku_logic.resolve_clues(clues=100)
        assert clues_high <= 81  # Maximum cells in board


class TestCarving:
    """Tests for carve_puzzle function."""

    def test_carve_puzzle_removes_correct_count(self, valid_solved_board):
        """Test that carve_puzzle removes the right number of clues."""
        target_clues = 34
        puzzle, removed = sudoku_logic.carve_puzzle(
            sudoku_logic.deep_copy(valid_solved_board),
            clues=target_clues
        )
        remaining_clues = count_clues(puzzle)
        assert remaining_clues == target_clues

    def test_carve_puzzle_maintains_unique_solution(self, valid_solved_board):
        """Test that carved puzzle maintains unique solution."""
        puzzle, _ = sudoku_logic.carve_puzzle(
            sudoku_logic.deep_copy(valid_solved_board),
            clues=40
        )
        assert sudoku_logic.has_unique_solution(puzzle) is True


# Helper functions for testing
def is_valid_board(board):
    """Check if board is a valid, complete Sudoku solution."""
    # Check all cells are filled
    if any(cell == 0 for row in board for cell in row):
        return False

    # Check all rows have numbers 1-9
    for row in board:
        if sorted(row) != list(range(1, 10)):
            return False

    # Check all columns have numbers 1-9
    for col in range(9):
        column = [board[row][col] for row in range(9)]
        if sorted(column) != list(range(1, 10)):
            return False

    # Check all 3x3 boxes have numbers 1-9
    for box_row in range(3):
        for box_col in range(3):
            box = []
            for i in range(3):
                for j in range(3):
                    box.append(board[box_row * 3 + i][box_col * 3 + j])
            if sorted(box) != list(range(1, 10)):
                return False

    return True


def count_clues(board):
    """Count number of non-empty cells in board."""
    return sum(1 for row in board for cell in row if cell != 0)
