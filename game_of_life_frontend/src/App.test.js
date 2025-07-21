import { render, fireEvent, screen, act } from "@testing-library/react";
import App from "./App";

describe("Game of Life App", () => {
  test("renders title and controls", () => {
    render(<App />);
    expect(screen.getByText(/Conway's Game of Life/i)).toBeInTheDocument();
    expect(screen.getByText(/Start/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Switch to dark/i)).toBeInTheDocument();
  });

  test("toggle theme button switches theme", () => {
    render(<App />);
    const toggle = screen.getByLabelText(/Switch to dark/i);
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("can change grid cell state with click", () => {
    render(<App />);
    // Find a cell (first cell)
    const liveCells = screen.getAllByRole('cell', { hidden: true })
      .concat(screen.queryAllByLabelText(/Cell \d+,\d+/i));
    let anyCell = screen.getAllByRole("cell")[0] || liveCells[0] || screen.getAllByLabelText(/Cell/)[0];
    if (!anyCell) {
      // Try to find td with aria-label
      anyCell = screen.getByLabelText(/Cell 0,0/i);
    }
    expect(anyCell).toBeInTheDocument();
    // Cell click toggles state to alive
    fireEvent.click(anyCell);
    // Color should change to live (best effort since CSS vars)
    expect(anyCell).toHaveStyle("background: var(--text-secondary)");
  });

  test("advance simulation generation on Step", () => {
    render(<App />);
    // Set a glider (use pattern tool)
    const gliderBtn = screen.getByText(/Glider/);
    fireEvent.click(gliderBtn);
    // Place at cell 1,1
    const targetCell = screen.getByLabelText("Cell 1,1");
    fireEvent.click(targetCell);
    // Count live cells before
    const liveCellsBefore = screen.getAllByLabelText(/Cell \d+,\d+ \(alive\)/i).length;
    fireEvent.click(screen.getByText("Step"));
    // After a generation, the live cells should move/change
    const liveCellsAfter = screen.getAllByLabelText(/Cell \d+,\d+ \(alive\)/i).length;
    // The patterns should change in the grid
    expect(liveCellsBefore).not.toBe(liveCellsAfter);
  });

  test("reset clears the grid", () => {
    render(<App />);
    // Set a cell alive:
    const cell = screen.getByLabelText("Cell 0,0");
    fireEvent.click(cell);
    expect(cell).toHaveStyle("background: var(--text-secondary)");
    fireEvent.click(screen.getByText("Reset"));
    // After reset, returns to dead (light/dark)
    expect(cell).not.toHaveStyle("background: var(--text-secondary)");
  });

  test("can change number of rows and columns", () => {
    render(<App />);
    const rowsInput = screen.getByLabelText(/Rows:/i);
    const colsInput = screen.getByLabelText(/Columns:/i);
    fireEvent.change(rowsInput, { target: { value: 12 } });
    fireEvent.change(colsInput, { target: { value: 15 } });
    expect(rowsInput.value).toBe("12");
    expect(colsInput.value).toBe("15");
  });

  test("pattern tool UI: placing a pattern, cancelling, disables when running", () => {
    render(<App />);
    // Choose pattern
    const beaconBtn = screen.getByText(/Beacon/);
    fireEvent.click(beaconBtn);
    expect(screen.getByText(/Click grid to place: "Beacon"/i)).toBeInTheDocument();
    // Cancel works
    fireEvent.click(screen.getByText(/Cancel/));
    expect(screen.queryByText(/Click grid to place/)).not.toBeInTheDocument();
    // Start disables buttons
    fireEvent.click(screen.getByText(/Start/));
    expect(beaconBtn).toBeDisabled();
    expect(screen.getByText("Reset")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Pause/));
  });
});
