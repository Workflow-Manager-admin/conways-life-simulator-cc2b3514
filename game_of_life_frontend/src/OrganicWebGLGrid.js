import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

/**
 * Utility: pick a color from a multi-color ramp based on cell "age"
 */
function cellColor(age) {
  // Multicolor HSV/gradient: young-blue, mid-green, old-yellow/orange
  if (age <= 0) return 0x151930; // Dead cell: background shade
  if (age === 1) return 0x69aefc; // Newborn: blueish
  if (age < 5) return 0x4ade80;   // Young: green
  if (age < 10) return 0xfacc15;  // Mature: yellow
  if (age < 20) return 0xfd8b15;  // Older: orange
  return 0xe34444; // Oldest: reddish
}

/**
 * ORGANIC_WEBGL_GRID - A PixiJS/WebGL organic grid visualization for Game of Life, with full cell interactivity.
 * 
 * Props:
 *   grid: number[][] - 0=dead, >0=age; cell values
 *   cellSize: number
 *   onCellClick: function(row, col)
 *   running: boolean
 *   theme: "light" | "dark"
 *
 * - Ensures that only one PIXI application instance is created at a time, and cleans up on unmount/switch
 * - Correctly maps pointer events to cell row/col for clicks, regardless of cellSize/scroll
 */
// PUBLIC_INTERFACE
export default function OrganicWebGLGrid({ grid, cellSize, onCellClick, running, theme }) {
  const gridRef = useRef(); // DOM node for mounting canvas
  const appRef = useRef(); // Pixi.Application instance
  const containerRef = useRef(); // Cell graphics container
  const listenersRef = useRef({}); // Track pointer events

  // Safe cleanup: destroy Pixi application if it exists
  const cleanupPixi = () => {
    if (appRef.current) {
      appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
      containerRef.current = null;
    }
  };

  // Mount PixiJS instance only once, but recreate on size/mode switch
  useEffect(() => {
    cleanupPixi();
    // Set up PixiJS app with sensible config
    const width = grid[0].length * cellSize;
    const height = grid.length * cellSize;
    const app = new PIXI.Application({
      width,
      height,
      backgroundColor: theme === "dark" ? 0x181a25 : 0xf4f6fc,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    appRef.current = app;
    // Remove previous canvas content if present (avoiding stacking/canvas flashing)
    if (gridRef.current) {
      while (gridRef.current.firstChild) gridRef.current.removeChild(gridRef.current.firstChild);
      gridRef.current.appendChild(app.view);
    }
    // Container for all cell sprites
    const container = new PIXI.Container();
    containerRef.current = container;
    app.stage.addChild(container);

    // Attach pointer handler on root for accurate cell hit detection
    // When pointerdown, compute grid coordinates based on event data
    // This allows click on empty space (activation toggles) as well as on filled cell blobs
    // Remove any previous listeners to avoid stacking
    if (listenersRef.current && listenersRef.current.pointerdown) {
      app.view.removeEventListener("pointerdown", listenersRef.current.pointerdown);
      listenersRef.current.pointerdown = null;
    }
    // Define handler and store for later removal
    listenersRef.current.pointerdown = evt => {
      // Only handle when not running and if user is allowed to interact
      if (running) return;
      // Determine offset relative to canvas
      const rect = app.view.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      if (
        row >= 0 &&
        row < grid.length &&
        col >= 0 &&
        col < grid[0].length &&
        typeof onCellClick === "function"
      ) {
        onCellClick(row, col);
      }
    };
    app.view.addEventListener("pointerdown", listenersRef.current.pointerdown);

    // Cleanup event handler and app on unmount/switch (prevents double canvas or leaks)
    return () => {
      if (listenersRef.current.pointerdown)
        app.view.removeEventListener("pointerdown", listenersRef.current.pointerdown);
      cleanupPixi();
    };
    // eslint-disable-next-line
  }, [grid.length, grid[0].length, cellSize, theme]);

  // Draw the grid contents whenever changed
  useEffect(() => {
    const app = appRef.current;
    const container = containerRef.current;
    if (!app || !container) return;
    // Resize renderer if needed
    const width = grid[0].length * cellSize;
    const height = grid.length * cellSize;
    if (app.renderer.width !== width || app.renderer.height !== height) {
      app.renderer.resize(width, height);
    }
    // Remove previous graphics
    container.removeChildren();
    // Draw all cells
    const rows = grid.length;
    const cols = grid[0].length;
    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < cols; ++c) {
        const age = grid[r][c];
        const isDead = age === 0;
        // Dead cell: only add slight trail if just died; otherwise skip for performance
        if (!isDead || (app.lastGenGrid && app.lastGenGrid[r][c] > 0)) {
          // Animate "puff/fade": makes cells feel organic for both alive and trail
          const fade = isDead ? 0.27 : 1.0;
          const circle = new PIXI.Graphics();
          // Add "organic jitter" for bouncy/morphing cell blobs per age, row, col
          const jitter = !isDead
            ? cellSize * 0.06 * Math.sin((r + 1) * (c + 7) + age * 0.77)
            : 0;
          const baseRad = cellSize * (isDead ? 0.46 : 0.48) + jitter;
          circle.beginFill(
            isDead
              ? (theme === "dark" ? 0x191b30 : 0xdfe4ee)
              : cellColor(age),
            fade
          );
          circle.lineStyle({
            width: isDead ? 0 : 1,
            color: 0xffffff,
            alpha: !isDead ? 0.13 : 0,
          });
          circle.drawCircle(
            c * cellSize + cellSize / 2 + Math.sin(r * 3.1 + c),
            r * cellSize + cellSize / 2 + Math.cos(c * 2.3 + r),
            baseRad * (isDead ? 0.9 : 1.055)
          );
          circle.endFill();
          // Drop shadow for live cell
          if (!isDead) {
            const shadow = new PIXI.Graphics();
            shadow.beginFill(theme === "dark" ? 0x111218 : 0xcfd3db, 0.13);
            shadow.drawEllipse(
              c * cellSize + cellSize / 2,
              r * cellSize + cellSize / 2 + cellSize * 0.07,
              baseRad * 0.94,
              baseRad * 0.45
            );
            shadow.endFill();
            shadow.zIndex = 0;
            container.addChild(shadow);
          }
          // Per-shape interactivity (pointer): optional for accessibility, but root handler above is enough.
          //circle.interactive = !running;
          //circle.buttonMode = !running;
          //circle.cursor = running ? "not-allowed" : "pointer";
          circle.zIndex = 1;
          container.addChild(circle);
        }
      }
    }
    // Save previous grid for live/dead memory
    app.lastGenGrid = grid.map(row => row.slice());
    app.render();
  }, [grid, cellSize, running, theme]);

  // On component unmount, ensure Pixi is always cleaned up
  useEffect(() => cleanupPixi, []);

  // Container for Pixi's canvas (not an actual grid drawing!)
  return (
    <div
      ref={gridRef}
      tabIndex={-1}
      style={{
        outline: "none",
        width: grid[0].length * cellSize + 2,
        height: grid.length * cellSize + 2,
        margin: "0 auto",
        background: theme === "dark" ? "#191b30" : "#dfe4ee",
        border: "2px solid var(--border-color)",
        borderRadius: 14,
        boxShadow: "0 2px 16px rgb(0 0 0 / 10%)",
        overflow: "auto",
        userSelect: "none",
        fontFamily:
          "-apple-system, system-ui, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif",
      }}
      aria-label="Organic Game of Life (WebGL Canvas)"
    />
  );
}
