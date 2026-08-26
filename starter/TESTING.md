# Testing Guide for Flask Sudoku App

## Overview

This project uses **pytest** as the testing framework with comprehensive test coverage for both the Sudoku logic and Flask routes.

### Why Pytest?
- **Simple syntax**: Readable, easy-to-write tests
- **Flask-native**: Perfect integration with Flask test client
- **Fixtures**: Great for reusable test data (puzzles, app instances)
- **Parametrization**: Test multiple scenarios efficiently
- **Better assertions**: Clear error messages on failures
- **Coverage reports**: Built-in coverage analysis with pytest-cov
- **Industry standard**: Widely adopted in Python community

---

## Installation

Install testing dependencies:

```bash
pip install -r requirements.txt
```

This installs:
- `pytest` - Testing framework
- `pytest-cov` - Code coverage plugin
- `pytest-flask` - Flask test utilities

---

## Project Test Structure

```
starter/
├── app.py                 # Flask application
├── sudoku_logic.py       # Sudoku puzzle logic
├── conftest.py           # Shared pytest fixtures
├── test_sudoku_logic.py  # Tests for sudoku_logic module
├── test_app.py           # Tests for Flask routes
├── pytest.ini            # Pytest configuration
└── requirements.txt      # Project dependencies
```

### File Descriptions

#### `conftest.py`
Provides shared fixtures used across all tests:
- `flask_app` - Test Flask application instance
- `client` - Flask test client for making requests
- `app_context` - Flask application context
- `empty_board` - Empty 9×9 Sudoku board
- `valid_solved_board` - Completely solved, valid board
- `puzzle_and_solution` - Puzzle with its solution
- `sample_puzzle` / `sample_solution` - Pre-generated puzzles

#### `test_sudoku_logic.py`
Unit tests for the Sudoku logic module (~60 tests):
- **Board Creation**: Empty board generation, copying
- **Validation**: Row/column/box duplicate checks
- **Puzzle Generation**: Fill algorithm, solution counting
- **Carving**: Creating puzzles from solved boards
- **Difficulty Levels**: Easy, medium, hard generation
- **Helper Functions**: Clue resolution, unique solution validation

#### `test_app.py`
Integration tests for Flask routes (~40 tests):
- **Index Route**: HTML rendering
- **New Game**: Puzzle generation via API
- **Check Solution**: Solution validation
- **Hint System**: Providing hints from solutions
- **Game Flow**: Complete gameplay scenarios
- **Error Handling**: Invalid inputs, missing games
- **Helper Functions**: Internal app utilities

---

## Running Tests

### Run All Tests
```bash
pytest
```

### Run Specific Test File
```bash
pytest test_sudoku_logic.py
pytest test_app.py
```

### Run Specific Test Class
```bash
pytest test_sudoku_logic.py::TestValidation
pytest test_app.py::TestNewGameRoute
```

### Run Specific Test
```bash
pytest test_sudoku_logic.py::TestValidation::test_is_safe_duplicate_in_row
```

### Run with Verbose Output
```bash
pytest -v
```

### Run with Markers
```bash
pytest -m unit          # Only unit tests
pytest -m integration   # Only integration tests
```

### Generate Coverage Report
```bash
pytest --cov=. --cov-report=html --cov-report=term
```

Creates an HTML report in `htmlcov/index.html` showing which lines are covered by tests.

### Run Tests with Timeout (optional, requires pytest-timeout)
```bash
pytest --timeout=10  # Fail tests that take >10 seconds
```

---

## Test Coverage Summary

### `test_sudoku_logic.py` Coverage

| Category | Tests | Focus |
|----------|-------|-------|
| Board Creation | 4 | Empty board, copying, finding empty cells |
| Validation | 5 | Row, column, 3×3 box rules |
| Puzzle Generation | 8 | Fill algorithm, solution counting, uniqueness |
| Carving | 2 | Removing clues while maintaining uniqueness |
| Difficulty Levels | 4 | Easy, medium, hard generation |
| **Total** | **23** | Core logic validation |

### `test_app.py` Coverage

| Route | Tests | Focus |
|-------|-------|-------|
| `/` (Index) | 2 | HTTP status, HTML content |
| `/new` (New Game) | 6 | Generation, difficulties, custom clues, storage |
| `/check` (Validate) | 6 | Correct/incorrect solutions, locked cells |
| `/hint` (Hints) | 4 | Valid hints, correct values |
| Helpers | 5 | Utility functions |
| Game Flow | 2 | End-to-end scenarios |
| **Total** | **25** | API endpoints and game logic |

---

## Test Examples

### Example 1: Testing Sudoku Validation
```python
def test_is_safe_duplicate_in_row(self, empty_board):
    """Test that duplicate number in row returns False."""
    empty_board[0][0] = 5
    assert sudoku_logic.is_safe(empty_board, 0, 1, 5) is False
    assert sudoku_logic.is_safe(empty_board, 0, 1, 6) is True
```

### Example 2: Testing Flask Route
```python
def test_new_game_contains_puzzle(self, client):
    """Test that /new response contains puzzle data."""
    response = client.get('/new')
    data = json.loads(response.data)
    assert 'puzzle' in data
```

### Example 3: Using Fixtures
```python
def test_check_solution_correct(self, client, app_context):
    """Test checking a correct solution."""
    puzzle, solution = sudoku_logic.generate_puzzle(difficulty='easy')
    app_module.store_current_game(puzzle, solution)
    response = client.post('/check', json={'board': solution})
    assert response.status_code == 200
```

---

## Common Test Commands

```bash
# Run all tests with coverage
pytest --cov=. -v

# Run tests matching a pattern
pytest -k "test_is_safe"

# Run tests in parallel (requires pytest-xdist)
pytest -n auto

# Run tests and stop on first failure
pytest -x

# Run tests with detailed output
pytest -vv

# Generate coverage report
pytest --cov=. --cov-report=html
open htmlcov/index.html  # View report
```

---

## Continuous Integration

To run tests in CI/CD pipeline:

```bash
# Run all tests, exit with code if failures
pytest --tb=short --strict-markers

# Generate coverage and fail if below threshold
pytest --cov=. --cov-fail-under=80
```

---

## Test Development Workflow

1. **Write tests first** (TDD approach):
   ```bash
   pytest test_sudoku_logic.py::TestNewFeature -v
   ```

2. **Run tests while developing**:
   ```bash
   pytest -k "feature_name" --tb=short
   ```

3. **Check coverage**:
   ```bash
   pytest --cov=. --cov-report=term-missing
   ```

4. **Verify no regressions**:
   ```bash
   pytest -v
   ```

---

## Fixture Reference

Use fixtures by adding them as function parameters:

```python
def test_example(client, empty_board, valid_solved_board):
    # client: Flask test client
    # empty_board: Empty 9x9 board
    # valid_solved_board: Solved puzzle
    pass
```

### Available Fixtures

| Fixture | Type | Purpose |
|---------|------|---------|
| `flask_app` | Flask app | Test application instance |
| `client` | Flask client | Make HTTP requests |
| `app_context` | Context | Flask context manager |
| `empty_board` | List[List[int]] | Empty board (all zeros) |
| `valid_solved_board` | List[List[int]] | Complete valid solution |
| `puzzle_and_solution` | Tuple | Both puzzle and solution |
| `sample_puzzle` | List[List[int]] | Generated puzzle |
| `sample_solution` | List[List[int]] | Generated solution |

---

## Troubleshooting

### Tests fail with "No game in progress"
- Tests run independently; each test sets up required game state
- Use fixtures to provide initial state

### Puzzle generation is slow
- Some tests generate puzzles (especially difficulty='hard')
- Mark slow tests: `@pytest.mark.slow`
- Run fast tests only: `pytest -m "not slow"`

### Import errors in tests
- Ensure you're running pytest from the `starter/` directory
- `conftest.py` adds the directory to sys.path

### Test isolation issues
- Use fixtures instead of global state
- Each test should be independent and repeatable

---

## Next Steps

1. **Run the tests**: `pytest -v`
2. **Check coverage**: `pytest --cov=. --cov-report=html`
3. **Add more tests** for new features
4. **Integrate into CI/CD** pipeline
5. **Aim for >80% code coverage**

---

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Flask Testing Guide](https://flask.palletsprojects.com/testing/)
- [Pytest Fixtures](https://docs.pytest.org/fixtures.html)
- [Code Coverage with pytest-cov](https://pytest-cov.readthedocs.io/)
