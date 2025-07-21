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
 * OrganicWebGLGrid: A PixiJS-based, organic, multicolor Game of Life visualization
 * @param {number[][]} grid  - Array-of-arrays (0=dead, >0 = age in generations alive)
 * @param {number} cellSize  - Size of a cell in pixels (ideal 14-32)
 * @param {function} onCellClick - Callback(row,col): cell click/tap handler
 * @param {bool} running - If simulation is running (for interaction hints)
 * @param {theme} theme - Current UI theme ("light"|"dark")
 */
export default function OrganicWebGLGrid({ grid, cellSize, onCellClick, running, theme }) {
  const gridRef = useRef();
  const appRef = useRef();        // Pixi.Application instance
  const containerRef = useRef();  // Main containers

  // Update drawing on mount or when grid/cellSize changes
  useEffect(() => {
    const width = grid[0].length * cellSize;
    const height = grid.length * cellSize;
    let app = appRef.current;
    if (!app) {
      app = new PIXI.Application({
        width, height,
        backgroundColor: theme === "dark" ? 0x181a25 : 0xf4f6fc,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preserveDrawingBuffer: true
      });
      appRef.current = app;
      gridRef.current.appendChild(app.view);

      // Container for cell graphics
      containerRef.current = new PIXI.Container();
      app.stage.addChild(containerRef.current);

      // Safe detach cleanup
      return () => {
        app.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
        containerRef.current = null;
      };
    }

    // Resize when needed
    if (app.renderer.width !== width || app.renderer.height !== height) {
      app.renderer.resize(width, height);
    }

    // Remove previous cell graphics
    containerRef.current.removeChildren();

    // Organic Drawing: Draw each live cell w/ metaball circles, color by age
    const rows = grid.length;
    const cols = grid[0].length;
    for (let r=0; r<rows; ++r) {
      for (let c=0; c<cols; ++c) {
        const age = grid[r][c];
        // trail/fading for recently dead cells
        const isDead = age === 0;
        if (!isDead || (app.lastGenGrid && app.lastGenGrid[r][c] > 0)) {
          // Animate: "puff" on birth, "fade" on death
          const fade = isDead ? 0.3 : 1.0;
          const circle = new PIXI.Graphics();
          // slightly organic (metaball): add jitter/variation to size/pulse
          const jitter = !isDead
            ? cellSize * 0.06 * Math.sin((r+1)*(c+7) + age*0.77)
            : 0;
          const baseRad = cellSize * (isDead ? 0.46 : 0.48) + jitter;
          circle.beginFill(
            isDead
              ? (theme === "dark" ? 0x191b30 : 0xdfe4ee)
              : cellColor(age)
            , fade
          );
          circle.lineStyle({ width: isDead ? 0 : 1.1, color: 0xffffff, alpha: !isDead ? 0.18 : 0 });
          circle.drawCircle(
            c * cellSize + cellSize / 2 + Math.sin(r * 3.1 + c), // organic center jitter
            r * cellSize + cellSize / 2 + Math.cos(c * 2.3 + r),
            baseRad * (isDead ? 0.88 : 1.05)
          );
          circle.endFill();

          // Drop shadow under each live cell: a blurred ellipse
          if (!isDead) {
            const shadow = new PIXI.Graphics();
            shadow.beginFill(theme === "dark" ? 0x111218 : 0xcfd3db, 0.13);
            shadow.drawEllipse(
              c * cellSize + cellSize/2, r * cellSize + cellSize / 2 + cellSize * 0.07,
              baseRad * 0.92, baseRad * 0.46
            );
            shadow.endFill();
            shadow.zIndex = 0;
            containerRef.current.addChild(shadow);
          }

          circle.interactive = !running; // Allow click when not running
          circle.buttonMode = !running;
          circle.cursor = running ? "not-allowed" : "pointer";
          circle.zIndex = 1;
          circle.on("pointertap", () => {
            if (!running && typeof onCellClick === "function") {
              onCellClick(r, c);
            }
          });
          containerRef.current.addChild(circle);
        }
      }
    }
    // Save previous grid for trail/fade animation (dead cell memory)
    app.lastGenGrid = grid.map(row => row.slice());
    app.render();

    // Animate: Could set up additional transitions or effects here.

  }, [grid, cellSize, onCellClick, running, theme]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // PixiJS cleanup
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);

  // Main container (fixed size)
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
        userSelect: "none"
      }}
      aria-label="Organic Game of Life (WebGL Canvas)"
    />
  );
}
