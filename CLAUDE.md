# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EpidemicSim v2.0 — an agent-based epidemic contagion simulator built as an Alpine.js learning exercise. Agents (personas) move on an HTML5 canvas, collide, infect each other, and the simulation tracks epidemiological statistics in real time. Hosted as a GitHub Pages site.

## Development

**Zero-build static app.** No package.json, no bundler, no transpiler, no test framework.

To run locally: open `index.html` in a browser or serve with any static HTTP server (e.g., `npx serve .`, `python -m http.server`). All dependencies load from CDNs.

To deploy: push to `gh-pages` branch (the current branch for GitHub Pages hosting).

## Architecture

Four source files, ~63 KB total, no subdirectories:

- **`index.html`** — Entry point. Loads CDN dependencies, contains full UI markup with Alpine.js directives. The root Alpine component manages sidebar/chart/overlay visibility.
- **`Persona.js`** — `Persona` class (agent entity). Handles movement, wall bouncing, collision detection, infection logic, drawing (aura, quarantine ring, body). Defines `ESTADOS` enum (`SANO`/`ENFERMO`/`RECUPERADO`/`MUERTO`) and `COLOR_ESTADO` map. Exports to global scope.
- **`sketch.js`** — Simulation orchestration. P5.js lifecycle (`setup`/`draw`), Alpine store initialization (`Alpine.store("simula", {...})`), QuadTree-based collision resolution, ApexCharts epidemiological curve, interactive God Mode tools (vaccine/infection brushes, wall drawing), R0 calculation.
- **`global.css`** — Dark theme with glassmorphism panels, responsive breakpoints at 1024px/768px, custom slider/toggle/scrollbar styles.

### Data Flow

1. Alpine.js store (`sketch.js`) holds all reactive simulation parameters and state
2. `index.html` binds UI controls to the store via `x-model`, `x-text`, `@click`
3. P5.js `draw()` loop reads store state, updates `Persona` instances, builds QuadTree each frame
4. `Persona` instances query QuadTree neighbors for collision/infection resolution
5. ApexCharts samples history array every 30 frames for the curve chart

### Key Patterns

- **No ES modules** — `Persona.js` defines globals (`ESTADOS`, `COLOR_ESTADO`, `Persona`) consumed by `sketch.js` via `<script>` tag ordering in `index.html`
- **QuadTree optimization** — spatial indexing rebuilds each frame; `Persona` pre-creates its QuadTree `Point` reference in the constructor to avoid per-frame allocation
- **Continuous collision with barriers** — wall tool draws line segments; `_colisionContinuaConBarrera` uses cross-product math for line-segment intersection detection
- **God Mode tools** — vaccine brush (immunize), infection brush (infect), wall tool (draw barriers). State managed via `store.toolActivo` and canvas mouse events in `sketch.js`

## Language

The UI and README are in Spanish. Code comments and variable names mix Spanish and English. Key Spanish terms: `sano` (healthy), `enfermo` (sick), `recuperado` (recovered), `muerto` (dead), `persona` (agent/person), `contagio` (contagion), `vacuna` (vaccine), `barrera` (barrier).

Tu contéstame siempre en Español.
