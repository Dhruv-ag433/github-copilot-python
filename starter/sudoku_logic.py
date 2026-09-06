"""
Sudoku puzzle generator with guaranteed unique solutions.

Algorithm Overview:
1. Generate a complete, valid solution using randomized backtracking
2. Carve the solution by removing numbers while maintaining exactly one solution
3. Verify the final puzzle has precisely one unique solution

The puzzle generation is 100% guaranteed to produce puzzles with exactly one solution
because every removed cell is verified to maintain uniqueness before being committed.
"""

import copy
import random

SIZE = 9
EMPTY = 0
DIFFICULTY_CLUES = {
    'easy': 42,
    'medium': 34,
    'hard': 28,
}

def deep_copy(board):
    return copy.deepcopy(board)

def create_empty_board():
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]

def find_empty_cell(board):
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] == EMPTY:
                return row, col
    return None

def is_safe(board, row, col, num):
    # Check row and column
    for x in range(SIZE):
        if board[row][x] == num or board[x][col] == num:
            return False
    # Check 3x3 box
    start_row = row - row % 3
    start_col = col - col % 3
    for i in range(3):
        for j in range(3):
            if board[start_row + i][start_col + j] == num:
                return False
    return True

def fill_board(board):
    empty_cell = find_empty_cell(board)
    if empty_cell is None:
        return True

    row, col = empty_cell
    possible = list(range(1, SIZE + 1))
    random.shuffle(possible)
    for candidate in possible:
        if is_safe(board, row, col, candidate):
            board[row][col] = candidate
            if fill_board(board):
                return True
            board[row][col] = EMPTY
    return False

def count_solutions(board, limit=2):
    """
    Count the number of valid solutions for a given puzzle.
    
    Args:
        board: The Sudoku board to analyze
        limit: Early exit threshold (default 2 - we only need to know if unique)
        
    Returns:
        Integer count of solutions (capped at limit for efficiency)
        
    Algorithm:
        - Recursively tries each valid number for each empty cell
        - Early exit when solution count reaches limit (optimization)
        - Does NOT modify the original board (backtracking cleans up)
    
    Why this guarantees uniqueness checking:
        By setting limit=2, if we find 2+ solutions, we immediately stop counting.
        For uniqueness, we only care: is count == 1? This is much faster than
        counting all solutions.
    """
    empty_cell = find_empty_cell(board)
    if empty_cell is None:
        return 1  # Found a complete valid solution

    row, col = empty_cell
    solution_count = 0
    for candidate in range(1, SIZE + 1):
        if is_safe(board, row, col, candidate):
            board[row][col] = candidate
            solution_count += count_solutions(board, limit)
            board[row][col] = EMPTY  # Backtrack: restore empty cell
            if solution_count >= limit:
                return solution_count  # Early exit - found enough solutions
    return solution_count

def has_unique_solution(board):
    """
    Verify that a puzzle has exactly one unique solution.
    
    Args:
        board: The Sudoku puzzle to verify
        
    Returns:
        True if exactly one solution exists, False otherwise
        
    Guarantees:
        - SAFE: Does not modify original board (uses deep copy)
        - FAST: Early exit in count_solutions when 2+ solutions found
        - PRECISE: Counts only to 2, then checks if count == 1
        
    Why this is reliable for uniqueness checking:
        We create a deep copy before counting, so the original puzzle is never
        modified. We count solutions until we reach 2, then check if the count
        is exactly 1. This is both efficient and accurate.
    """
    return count_solutions(deep_copy(board), limit=2) == 1

def carve_puzzle(board, clues):
    """
    Create a puzzle by removing numbers from a complete solution.
    
    This is the core function that guarantees puzzle uniqueness because every
    removal is validated before being committed.
    
    Args:
        board: A completely filled, valid Sudoku solution
        clues: Number of clues (given numbers) to keep in the final puzzle
        
    Returns:
        Tuple of (carved_puzzle, number_of_cells_removed)
        
    Algorithm (Uniqueness Guarantee):
        1. Calculate target removals: 81 - clues
        2. Visit cells in random order (prevents patterns that break uniqueness)
        3. For each non-empty cell:
           a. Save its value
           b. Remove it (set to EMPTY)
           c. Test if puzzle still has EXACTLY ONE solution
           d. If yes: keep it removed (COUNT IT)
           e. If no: restore it (REJECT removal)
        4. Continue until target removals reached
        
    Key Insight:
        By checking has_unique_solution() AFTER EACH REMOVAL, we guarantee that
        the final puzzle has exactly one solution. If any removal would create
        multiple solutions, it's rejected immediately.
        
    Why randomization matters:
        Removing cells in random order prevents systematic patterns that might
        accidentally create multiple solutions or accidentally solve the puzzle.
    """
    target_removals = SIZE * SIZE - clues
    positions = [(row, col) for row in range(SIZE) for col in range(SIZE)]
    random.shuffle(positions)  # Random order prevents biased patterns

    removed = 0
    for row, col in positions:
        if removed >= target_removals:
            break  # Target reached
        if board[row][col] == EMPTY:
            continue  # Already removed

        # Attempt removal
        saved_value = board[row][col]
        board[row][col] = EMPTY
        
        # Verify puzzle still has unique solution
        if has_unique_solution(board):
            removed += 1  # Removal is valid - keep it
        else:
            board[row][col] = saved_value  # Removal breaks uniqueness - restore it

    return board, removed

def resolve_clues(clues=None, difficulty='medium'):
    if clues is not None:
        return max(17, min(SIZE * SIZE, int(clues)))
    return DIFFICULTY_CLUES.get(difficulty, DIFFICULTY_CLUES['medium'])


# ============================================================================
# VERIFICATION & VALIDATION FUNCTIONS
# ============================================================================

def verify_puzzle_uniqueness(puzzle, verbose=False):
    """
    Verify that a puzzle has exactly one unique solution.
    
    This is a utility function for testing/validation purposes. Use this to
    confirm that a puzzle (whether generated here or from external source)
    has exactly one solution.
    
    Args:
        puzzle: The Sudoku puzzle to verify (board with some empty cells)
        verbose: If True, print detailed analysis results
        
    Returns:
        Dict with keys:
        - 'unique': bool - True if exactly one solution exists
        - 'solution_count': int - Number of solutions found (capped at 2)
        - 'clue_count': int - Number of given numbers
        
    Example:
        result = verify_puzzle_uniqueness(puzzle)
        if result['unique']:
            print(f"Valid puzzle with {result['clue_count']} clues")
    """
    clue_count = sum(1 for row in puzzle for cell in row if cell != 0)
    solution_count = count_solutions(deep_copy(puzzle), limit=2)
    is_unique = solution_count == 1
    
    if verbose:
        print(f"Puzzle Verification Results:")
        print(f"  Clues: {clue_count}/81")
        print(f"  Solutions: {'Exactly 1 (Valid)' if is_unique else f'{solution_count}+ (Invalid)'}")
    
    return {
        'unique': is_unique,
        'solution_count': solution_count,
        'clue_count': clue_count
    }


def count_clues(board):
    """
    Count the number of non-empty cells (given numbers) in a puzzle.
    
    Args:
        board: The Sudoku board
        
    Returns:
        Integer count of cells that are not empty (not 0)
    """
    return sum(1 for row in board for cell in row if cell != 0)

def is_valid_generated_puzzle(puzzle, clues):
    """Return whether a generated puzzle has the requested clue count and one solution."""
    return (
        count_clues(puzzle) == clues
        and verify_puzzle_uniqueness(puzzle)['unique']
    )

def generate_puzzle(clues=None, difficulty='medium'):
    """
    Generate a Sudoku puzzle with GUARANTEED unique solution.
    
    This function orchestrates the complete generation process and verifies
    the result before returning.
    
    Args:
        clues: Optional custom number of clues (17-81). Overrides difficulty.
        difficulty: 'easy' (42 clues), 'medium' (34 clues), or 'hard' (28 clues)
        
    Returns:
        Tuple of (puzzle, solution) where:
        - puzzle: Board with some cells empty (0), others filled (1-9)
        - solution: Completely filled board (answer key)
        
    Raises:
        RuntimeError: If unable to generate valid puzzle after 100 attempts
        
    Uniqueness Guarantee:
        This function has TRIPLE VERIFICATION:
        1. Each removal in carve_puzzle() is verified individually
        2. Final puzzle is verified with has_unique_solution()
        3. Retry loop (100 attempts) handles unlucky seeds
        
        The puzzle is 100% guaranteed to have exactly one solution.
        
    Algorithm:
        For up to 100 attempts:
        1. Create empty board
        2. Fill it completely (fill_board) -> this is the solution
        3. Copy solution as starting point
        4. Carve out numbers while maintaining uniqueness
        5. Verify: correct number of cells removed AND unique solution exists
        6. If all checks pass: return puzzle and solution
        If 100 attempts fail, raise error (extremely rare)
    """
    clues = resolve_clues(clues, difficulty)
    
    for attempt in range(100):
        board = create_empty_board()
        
        # Phase 1: Generate complete solution
        if not fill_board(board):
            continue  # Failed to fill - rare, try again

        # Phase 2: Carve puzzle
        solution = deep_copy(board)
        puzzle, removed = carve_puzzle(board, clues)
        
        # Phase 3: Verify puzzle meets all criteria
        cells_removed_correct = removed == SIZE * SIZE - clues

        if cells_removed_correct and is_valid_generated_puzzle(puzzle, clues):
            return deep_copy(puzzle), solution
    
    # Should almost never reach here - 100 attempts is excessive redundancy
    raise RuntimeError(
        f'Failed to generate a valid unique Sudoku puzzle after 100 attempts. '
        f'Requested {clues} clues for difficulty "{difficulty}"'
    )
