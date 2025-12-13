# Repository Guidelines

## Project Structure & Module Organization
- Scripts: `testPy.py` at the repo root for quick experiments.
- Notebooks: `test.ipynb` for exploratory work and demos.
- Model artifacts: `kobert-6cls-overfit/` and `kobert-6cls-out/` contain Hugging Face Trainer checkpoints under `checkpoint-*/`. Treat these as read-only; avoid committing new large artifacts unless explicitly required.

## Build, Test, and Development Commands
- Environment (Windows PowerShell):
  - `python -m venv .venv`
  - `.\.venv\Scripts\Activate`
  - `pip install -r requirements.txt` (if present; add one when dependencies stabilize)
- Run script: `python testPy.py`
- Run notebook: `jupyter notebook test.ipynb` (or `jupyter lab`)
- No formal build step at present.

## Coding Style & Naming Conventions
- Python 3.9+; use 4-space indentation and UTF-8 encoding.
- Naming: `snake_case` for functions/variables, `PascalCase` for classes, UPPER_CASE for constants.
- Add type hints and short docstrings for new/updated functions.
- Formatting: prefer `black` (line length 88). Lint with `ruff` or `flake8` when available.
  - Examples: `black .` and `ruff check .`

## Testing Guidelines
- If adding tests, use `pytest`.
- Place tests in `tests/` with files named `test_*.py`.
- Run locally: `pytest -q`; optional coverage: `pytest --cov=.`. Aim for ≥80% coverage on new code.

## Commit & Pull Request Guidelines
- Commits: imperative mood and concise scope, e.g., `feat(scripts): add data loader` or `fix(notebook): correct preprocessing step`.
- Do not commit secrets or new large binaries (models, datasets). Reference storage or provide download scripts instead.
- PRs: include a clear description, linked issues, rationale, and before/after notes or screenshots for notebook changes.

## Security & Configuration Tips
- Keep tokens/keys out of code; use environment variables or a local `.env` (do not commit).
- Consider adding `.gitignore` entries for large artifacts (e.g., `*.pt`, `*.bin`, `*.safetensors`) to avoid new accidental commits.

## Agent-Specific Instructions
- Scope covers the entire repository. Prefer minimal, surgical changes to code and notebooks.
- Do not modify checkpoint directories unless explicitly requested.
