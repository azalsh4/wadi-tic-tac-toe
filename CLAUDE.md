# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based Tic-Tac-Toe game delivered as a single self-contained HTML file (`tic-tac-toe.html`) with no build step, no dependencies, and no package manager. Open the file directly in a browser to run it.

## Running the Game

```bash
open tic-tac-toe.html
```

## Git & GitHub Workflow

All changes must be committed with clean, descriptive messages and pushed to GitHub after every meaningful change.

Commit message format:
```
type: short summary (imperative, max 72 chars)

- bullet detail if needed
- another detail if needed
```

Common types: `feat`, `fix`, `style`, `refactor`.

Push after every commit:
```bash
git push
```

Remote: `https://github.com/azalsh4/wadi-tic-tac-toe`

## Architecture

Everything lives in `tic-tac-toe.html` in three co-located sections:

- **`<style>`** — dark-theme CSS using CSS custom properties and grid layout. Player X is purple (`#a78bfa`), player O is blue (`#60a5fa`), wins highlight green (`#34d399`).
- **`<body>`** — static HTML structure: scoreboard (3 score cards), status line, 3×3 board (9 `.cell` divs with `data-i` indices 0–8), restart button.
- **`<script>`** — vanilla JS with no framework. Key pieces:
  - `board` — flat 9-element array (`null | 'X' | 'O'`), indices match `data-i`
  - `WINS` — hardcoded array of all 8 winning triples
  - `init()` — resets board and DOM, keeps `scores` object intact across games
  - `checkWin()` — iterates `WINS`, returns winning triple or `null`
  - Click handler on each cell drives the full game loop: place mark → check win → check draw → swap player
  - `scores` object (`{ X, O, draw }`) persists in memory for the session; resets on page reload
