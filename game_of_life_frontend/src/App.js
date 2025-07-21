import React, { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";
import OrganicWebGLGrid from "./OrganicWebGLGrid";

/**
 * Conway's Game of Life Simulation in React
 *
 * - Interactive, responsive grid
 * - Control bar: Start, Pause, Reset, Step
 * - Adjustable grid size (10x10 to 80x60)
 * - Custom pattern placement (with classic patterns)
 * - Minimalistic, modern design; responsive
 */

// Helper: create an empty grid of WxH
const createGrid = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(0));

/**
 * Enhanced version: Track cell age.
 * If cell is alive: positive integer = how many generations alive.
 * If cell is dead: 0.
 */
const createAgeGrid = (rows, cols) =>
  Array.from({ length: rows }, () => Array(cols).fill(0));

// Predefined patterns for placement
const PATTERNS = {
  Glider: [
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2]
  ],
  SmallExploder: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [2, 2],
    [1, 3]
  ],
  Toad: [
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  Beacon: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3]
  ],
  LightweightSpaceship: [
    [1,0], [4,0],
    [0,1], [0,2], [4,2],
    [0,3], [1,3], [2,3], [3,3]
  ]
};

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 48;
const MIN_ROWS = 10;
const MIN_COLS = 10;
const MAX_ROWS = 80;
const MAX_COLS = 60;

/**
 * Main App component — now supports "classic" and "organic/WebGL" visualization modes.
 * Both modes read from the same consistent app state.
 */
// PUBLIC_INTERFACE
function App() {
  // Theme support (dark/light)
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  // Visualization mode: "classic" HTML table, or "organic" WebGL (PixiJS) canvas
  const [visualizationMode, setVisualizationMode] = useState("classic"); // "classic" or "organic"

  // Core state
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  // For "classic" view: keep grid of 0/1 (dead/alive)
  const [classicGrid, setClassicGrid] = useState(() => createGrid(DEFAULT_ROWS, DEFAULT_COLS));
  // For "organic" view: keep grid of cell ages (0=dead, >0 = generations alive)
  const [ageGrid, setAgeGrid] = useState(() => createAgeGrid(DEFAULT_ROWS, DEFAULT_COLS));

  const [running, setRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [pattern, setPattern] = useState("");
  const [placing, setPlacing] = useState(false);

  // Timer reference for simulation loop
  const runningRef = useRef(running);
  runningRef.current = running;

  // Resize grid handler
  const changeGridSize = (newRows, newCols) => {
    setRows(newRows);
    setCols(newCols);
    setClassicGrid(prev => {
      const newGrid = createGrid(newRows, newCols);
      for (let r = 0; r < Math.min(prev.length, newRows); ++r)
        for (let c = 0; c < Math.min(prev[0].length, newCols); ++c)
          newGrid[r][c] = prev[r][c];
      return newGrid;
    });
    setAgeGrid(prev => {
      const newGrid = createAgeGrid(newRows, newCols);
      for (let r = 0; r < Math.min(prev.length, newRows); ++r)
        for (let c = 0; c < Math.min(prev[0].length, newCols); ++c)
          newGrid[r][c] = prev[r][c];
      return newGrid;
    });
    setGeneration(0);
    setRunning(false);
  };

  // Simulation function
  // Next gen for classic ("0/1" grid)
  const nextGenerationClassic = useCallback((oldGrid) => {
    const newGrid = createGrid(rows, cols);
    let changes = false;
    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < cols; ++c) {
        const neighbors = [
          [-1, -1],[-1,0],[-1,1],
          [0,-1],      [0,1],
          [1,-1],[1,0],[1,1],
        ];
        let count = 0;
        neighbors.forEach(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            count += oldGrid[nr][nc];
          }
        });
        if (oldGrid[r][c]) {
          newGrid[r][c] = count === 2 || count === 3 ? 1 : 0;
        } else {
          newGrid[r][c] = count === 3 ? 1 : 0;
        }
        if (newGrid[r][c] !== oldGrid[r][c]) changes = true;
      }
    }
    return { newGrid, hasChange: changes };
  }, [rows, cols]);

  // Next gen for "organic" grid (age tracking)
  const nextGenerationAged = useCallback((oldAgeGrid, oldClassicGrid) => {
    // Advance by Game of Life, but update age:
    // - If a cell is alive in new gen: age +1 if was alive, 1 if just born
    // - If dead: set to 0 (but could support trails etc)
    const newClassic = createGrid(rows, cols);
    const newAged = createAgeGrid(rows, cols);
    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < cols; ++c) {
        const neighbors = [
          [-1, -1],[-1,0],[-1,1],
          [0,-1],      [0,1],
          [1,-1],[1,0],[1,1],
        ];
        let count = 0;
        neighbors.forEach(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            count += oldClassicGrid[nr][nc];
          }
        });
        let alive = 0;
        if (oldClassicGrid[r][c]) {
          alive = count === 2 || count === 3 ? 1 : 0;
        } else {
          alive = count === 3 ? 1 : 0;
        }
        newClassic[r][c] = alive;
        newAged[r][c] = alive ? (oldAgeGrid[r][c] > 0 ? oldAgeGrid[r][c] + 1 : 1) : 0;
      }
    }
    return { newClassic, newAged };
  }, [rows, cols]);

  // Simulation interval (controlled by 'running')
  // Simulation interval: run both classic and ageGrid in sync
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setClassicGrid(prevGrid => {
        const { newGrid } = nextGenerationClassic(prevGrid);
        return newGrid;
      });
      setAgeGrid((prevAged) => {
        return nextGenerationAged(prevAged, classicGrid).newAged;
      });
      setGeneration(g => g + 1);
    }, 120);
    return () => clearInterval(interval);
  }, [running, nextGenerationClassic, nextGenerationAged, classicGrid]);

  // Reset grid/generation
  const handleReset = () => {
    setClassicGrid(createGrid(rows, cols));
    setAgeGrid(createAgeGrid(rows, cols));
    setGeneration(0);
    setRunning(false);
  };

  // Step forward single generation
  const handleStep = () => {
    setClassicGrid(prev => nextGenerationClassic(prev).newGrid);
    setAgeGrid((prevAged) => nextGenerationAged(prevAged, classicGrid).newAged);
    setGeneration(g => g + 1);
  };

  // Toggle cell (alive/dead) or pattern placement
  const handleCellClick = (r, c) => {
    if (placing && pattern && PATTERNS[pattern]) {
      // Place pattern (same to both classic & aged grid)
      setClassicGrid(prev => {
        const next = prev.map(row => row.slice());
        PATTERNS[pattern].forEach(([dx, dy]) => {
          const nr = r + dx, nc = c + dy;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
            next[nr][nc] = 1;
        });
        return next;
      });
      setAgeGrid(prev => {
        const next = prev.map(row => row.slice());
        PATTERNS[pattern].forEach(([dx, dy]) => {
          const nr = r + dx, nc = c + dy;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
            next[nr][nc] = 1;
        });
        return next;
      });
      setPlacing(false);
      setPattern("");
    } else {
      setClassicGrid(prev => {
        const next = prev.map(row => row.slice());
        next[r][c] = prev[r][c] ? 0 : 1;
        return next;
      });
      setAgeGrid(prev => {
        const next = prev.map(row => row.slice());
        next[r][c] = (prev[r][c] > 0) ? 0 : 1;
        return next;
      });
    }
  };

  // Responsive: calculate cell size based on available viewport
  // Responsive: calculate cell size based on available viewport
  const gridRef = useRef();
  const [cellSize, setCellSize] = useState(16);
  useEffect(() => {
    // On resize, calculate max cell size to fit container
    const handleResize = () => {
      const containerWidth = window.innerWidth * 0.96;
      const containerHeight = window.innerHeight * 0.56;
      setCellSize(Math.floor(Math.min(
        Math.max(containerWidth / cols, 12),
        Math.max(containerHeight / rows, 14),
        32
      )));
    };
    handleResize(); // initial
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [rows, cols]);

  // UI RENDER

  return (
    <div className="App">
      <header className="App-header">
        {/* Theme Toggle */}
        <button 
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        {/* Title */}
        <h1 style={{ color: "var(--text-primary)", letterSpacing: "1px", fontWeight: 600, fontSize: "2.2rem" }}>
          Conway's Game of Life
        </h1>
        <h4 style={{ color: "var(--text-secondary)", fontWeight: 400, marginTop: "0.2em", marginBottom: "1.2em" }}>
          Interactive cellular automaton simulator
        </h4>

        {/* Visualization mode toggle */}
        <div style={{ marginBottom: 18, marginTop: -2 }}>
          <button
            className="gol-btn secondary"
            style={{
              border: "2px solid var(--border-color)",
              background: visualizationMode === "classic" ? "var(--button-bg)" : "var(--button-bg-2)",
              color: visualizationMode === "classic" ? "var(--button-text)" : "inherit",
              boxShadow: visualizationMode === "classic" ? "0 0 5px #aadcff44" : undefined,
              marginRight: 12
            }}
            onClick={() => setVisualizationMode("classic")}
            aria-label="Switch to Classic (grid) view"
            disabled={visualizationMode === "classic"}
          >
            ⬛ Classic View
          </button>
          <button
            className="gol-btn secondary"
            style={{
              border: "2px solid var(--border-color)",
              background: visualizationMode === "organic" ? "var(--button-bg)" : "var(--button-bg-2)",
              color: visualizationMode === "organic" ? "var(--button-text)" : "inherit",
              boxShadow: visualizationMode === "organic" ? "0 0 7px #FFC043BB" : undefined,
            }}
            onClick={() => setVisualizationMode("organic")}
            aria-label="Switch to Organic (WebGL) view"
            disabled={visualizationMode === "organic"}
          >
            🧬 Organic View
          </button>
          <span className="gol-info" style={{ marginLeft: 17, fontWeight: 500, letterSpacing: "0.05em" }}>
            {visualizationMode === "classic"
              ? "Classic grid (HTML table)"
              : "WebGL organic/multicolor canvas"}
          </span>
        </div>

        {/* Controls */}
        <div className="gol-controls">
          <button
            className={`gol-btn ${running ? "paused" : "run"}`} onClick={() => setRunning(r => !r)}
            aria-label={running ? "Pause simulation" : "Start simulation"}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button className="gol-btn secondary" onClick={handleStep} disabled={running}>Step</button>
          <button className="gol-btn secondary" onClick={handleReset}>Reset</button>
          <span className="gol-info">Generation: <b>{generation}</b></span>
        </div>
        {/* Grid Size adjuster */}
        <div className="gol-size-controls">
          <label>
            Rows:
            <input
              type="number" min={MIN_ROWS} max={MAX_ROWS} value={rows}
              onChange={e => changeGridSize(Number(e.target.value), cols)}
              disabled={running}
              style={{ width: 56, marginLeft: 4, marginRight: 16, fontSize: 16 }}
            />
          </label>
          <label>
            Columns:
            <input
              type="number" min={MIN_COLS} max={MAX_COLS} value={cols}
              onChange={e => changeGridSize(rows, Number(e.target.value))}
              disabled={running}
              style={{ width: 56, marginLeft: 4, fontSize: 16 }}
            />
          </label>
        </div>
        {/* Pattern tools */}
        <div className="gol-patterns">
          <span style={{ marginRight: 10, fontWeight: 500, fontSize: "1rem" }}>Pattern:</span>
          {Object.keys(PATTERNS).map(name =>
            <button
              key={name}
              className={`gol-btn pattern ${placing && pattern === name ? "active" : ""}`}
              onClick={() => {
                setPattern(name); setPlacing(true);
              }}
              disabled={running}
            >
              {name}
            </button>
          )}
          <button
            className="gol-btn pattern"
            onClick={() => { setPattern(""); setPlacing(false); }}
            disabled={running}
            style={{ background: "#fae298", color: "#6a4d00", marginLeft: 8 }}
          >
            Cancel
          </button>
          <span className="gol-instr" style={{ marginLeft: 18, color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            {placing && pattern ? `Click grid to place: "${pattern}"` : ""}
          </span>
        </div>

        {/* Game grid */}
        <div
          className="gol-grid-container"
          style={{
            margin: "24px auto 0",
            background: "var(--border-color)",
            width: cellSize * cols + 2,
            height: cellSize * rows + 2,
            border: "2px solid var(--border-color)",
            borderRadius: 12,
            boxShadow: "0 2px 16px rgb(0 0 0 / 6%)",
            overflow: "auto",
            touchAction: "manipulation"
          }}
          ref={gridRef}
        >
          {visualizationMode === "classic" ? (
            <table
              className="gol-grid"
              style={{
                borderCollapse: "collapse",
                margin: 0, padding: 0, border: "none",
                width: cellSize * cols, height: cellSize * rows, tableLayout: "fixed"
              }}
            >
              <tbody>
                {classicGrid.map((row, r) =>
                  <tr key={r}>
                    {row.map((cell, c) =>
                      <td
                        key={c}
                        className={cell ? "alive" : "dead"}
                        data-state={cell ? "alive" : "dead"}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          background: cell
                            ? "var(--text-secondary)" // live cell color
                            : theme === "light"
                              ? "#f4f6fc"
                              : "#22263C",
                          border: "1px solid var(--border-color)",
                          cursor: running ? "not-allowed" : placing && pattern ? "crosshair" : "pointer",
                          transition: "background 0.12s"
                        }}
                        aria-label={`Cell ${r},${c}${cell ? " (alive)" : ""}`}
                        onClick={() => !running && handleCellClick(r, c)}
                      />
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <OrganicWebGLGrid
              grid={ageGrid}
              cellSize={cellSize}
              onCellClick={handleCellClick}
              running={running}
              theme={theme}
            />
          )}
        </div>
        {/* Footer */}
        <footer style={{
          fontSize: "0.9rem",
          color: "var(--text-secondary)",
          marginTop: 32,
          marginBottom: 12,
        }}>
          <span>
            &copy; {new Date().getFullYear()} Conway's Game of Life | Built with React
          </span>
        </footer>
      </header>
    </div>
  );
}

export default App;
