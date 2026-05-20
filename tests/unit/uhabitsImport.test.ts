import { describe, it, expect } from "vitest";
import { mapUhabitsToKanso } from "../../src/lib/import/uhabits";
import {
  classifyUhabitsError,
  WASM_ERROR_MESSAGE,
  SCHEMA_ERROR_MESSAGE,
} from "../../src/lib/import/uhabitsErrors";
import { PROJECT_COLORS } from "../../src/lib/constants/colors";

describe("uhabitsImport", () => {
  it("should correctly map habits from uhabits schema", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Drink Water",
        description: "Stay hydrated",
        color: 8, // Loop palette index 8 = Cyan
        archived: 0,
      },
    ];

    // Loop Habit Tracker uses value=2 for YES (completed)
    const mockRepetitions = [
      {
        habit: 1,
        timestamp: 1715097600000, // 2024-05-07
        value: 2,
      },
    ];

    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);

    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].name).toBe("Drink Water");
    expect(result.habits[0].description).toBe("Stay hydrated");
    expect(result.habits[0].icon).toBe("Droplet"); // "water" keyword → Droplet

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].date).toBe("2024-05-07");
    // Loop's YES (value=2) must be normalized to Kanso's completed (value=1)
    expect(result.entries[0].value).toBe(1);
  });

  it("should handle empty data", () => {
    const result = mapUhabitsToKanso([], []);
    expect(result.habits).toHaveLength(0);
    expect(result.entries).toHaveLength(0);
  });

  it("should skip archived habits", () => {
    const mockHabits = [
      {
        id: 1,
        name: "Old Habit",
        archived: 1,
      },
    ];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits).toHaveLength(0);
  });

  it("should filter out value=0 (NO) repetitions — only completed entries imported", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 0 }, // NO — should be skipped
      { habit: 1, timestamp: 1715184000000, value: 2 }, // YES — should be imported
      { habit: 1, timestamp: 1715270400000, value: 3 }, // SKIP — should be skipped
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].value).toBe(1);
  });

  it("should normalize value=2 (Loop YES) to value=1 (Kanso completed)", () => {
    const mockHabits = [{ id: 1, name: "Read", archived: 0 }];
    const mockRepetitions = [{ habit: 1, timestamp: 1715097600000, value: 2 }];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries[0].value).toBe(1);
  });

  it("should map Loop palette indices to the closest Kanso palette color", () => {
    const kansoHexes = new Set(PROJECT_COLORS.map((c) => c.hex.toLowerCase()));

    const mockHabits = [
      { id: 1, name: "Test", archived: 0, color: 0 }, // Loop Red → closest Kanso
      { id: 2, name: "Test2", archived: 0, color: 7 }, // Loop Teal → closest Kanso
      { id: 3, name: "Test3", archived: 0, color: 99 }, // Unknown index → default
    ];
    const result = mapUhabitsToKanso(mockHabits, []);

    // All mapped colors must exist in the Kanso palette
    expect(kansoHexes.has(result.habits[0].color.toLowerCase())).toBe(true);
    expect(kansoHexes.has(result.habits[1].color.toLowerCase())).toBe(true);

    // Specific mappings (nearest-neighbor in RGB space against the 24-color palette)
    expect(result.habits[0].color).toBe("#B56C5A"); // Loop Red #f44336 → Terracotta
    expect(result.habits[1].color).toBe("#4A8A8A"); // Loop Teal #009688 → Teal
    expect(result.habits[2].color).toBe("#4B6CB7"); // unknown → Kanso Blue default
  });

  it("should infer icon from habit name keywords", () => {
    const habits = [
      { id: 1, name: "WORKOUT", archived: 0, color: 0 },
      { id: 2, name: "READ A BOOK", archived: 0, color: 0 },
      { id: 3, name: "MEDITATION", archived: 0, color: 0 },
      { id: 4, name: "EARLY TO RISE", archived: 0, color: 0 },
      { id: 5, name: "SHAMPOO", archived: 0, color: 0 },
      { id: 6, name: "RANDOM HABIT XYZ", archived: 0, color: 0 },
    ];
    const result = mapUhabitsToKanso(habits, []);
    expect(result.habits[0].icon).toBe("Dumbbell"); // workout
    expect(result.habits[1].icon).toBe("Book"); // read
    expect(result.habits[2].icon).toBe("Brain"); // meditation
    expect(result.habits[3].icon).toBe("Sun"); // rise/morning
    expect(result.habits[4].icon).toBe("Droplet"); // shampoo/hygiene
    expect(result.habits[5].icon).toBe("Flame"); // no match → default
  });

  it("should set start_date from earliest completed entry, not today", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1689120000000, value: 2 }, // 2023-07-12
      { habit: 1, timestamp: 1715097600000, value: 2 }, // 2024-05-07 (later)
      { habit: 1, timestamp: 1688947200000, value: 2 }, // 2023-07-10 (earliest)
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.habits[0].start_date).toBe("2023-07-10");
  });

  it("should default start_date to today when no completed entries exist", () => {
    const today = new Date().toISOString().split("T")[0];
    const mockHabits = [{ id: 1, name: "New Habit", archived: 0 }];
    const result = mapUhabitsToKanso(mockHabits, []);
    expect(result.habits[0].start_date).toBe(today);
  });

  it("should deduplicate entries with the same habit+date", () => {
    const mockHabits = [{ id: 1, name: "Exercise", archived: 0 }];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 2 }, // 2024-05-07
      { habit: 1, timestamp: 1715097600000, value: 2 }, // 2024-05-07 duplicate
      { habit: 1, timestamp: 1715184000000, value: 2 }, // 2024-05-08 different date
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.entries).toHaveLength(2); // not 3
    const dates = result.entries.map((e) => e.date);
    expect(new Set(dates).size).toBe(dates.length); // all unique dates
  });

  it("should not import entries for archived habits", () => {
    const mockHabits = [
      { id: 1, name: "Active", archived: 0 },
      { id: 2, name: "Archived", archived: 1 },
    ];
    const mockRepetitions = [
      { habit: 1, timestamp: 1715097600000, value: 2 },
      { habit: 2, timestamp: 1715097600000, value: 2 }, // archived habit — entries skipped
    ];
    const result = mapUhabitsToKanso(mockHabits, mockRepetitions);
    expect(result.habits).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].habit_id).toBe(result.habits[0].id);
  });
});

describe("classifyUhabitsError", () => {
  it("returns WASM_ERROR_MESSAGE for WASM streaming compile errors", () => {
    const err = new Error(
      "wasm streaming compile failed: TypeError: Failed to fetch",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for both async and sync fetching failed error", () => {
    const err = new Error("both async and sync fetching of the wasm failed");
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for Aborted WASM errors", () => {
    const err = new Error(
      "Aborted(both async and sync fetching of the wasm failed)",
    );
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns WASM_ERROR_MESSAGE for failed to asynchronously prepare wasm errors", () => {
    const err = new Error("failed to asynchronously prepare wasm: TypeError");
    expect(classifyUhabitsError(err)).toBe(WASM_ERROR_MESSAGE);
  });

  it("returns SCHEMA_ERROR_MESSAGE for non-WASM errors", () => {
    const err = new Error("no such table: habits");
    expect(classifyUhabitsError(err)).toBe(SCHEMA_ERROR_MESSAGE);
  });

  it("returns SCHEMA_ERROR_MESSAGE for generic errors", () => {
    const err = new Error("some unexpected db error");
    expect(classifyUhabitsError(err)).toBe(SCHEMA_ERROR_MESSAGE);
  });

  it("returns SCHEMA_ERROR_MESSAGE for non-Error objects", () => {
    expect(classifyUhabitsError("string error")).toBe(SCHEMA_ERROR_MESSAGE);
    expect(classifyUhabitsError(null)).toBe(SCHEMA_ERROR_MESSAGE);
    expect(classifyUhabitsError(undefined)).toBe(SCHEMA_ERROR_MESSAGE);
  });
});

describe("uhabits module exports", () => {
  it("exports parseUhabitsFile as an async function", async () => {
    const mod = await import("../../src/lib/import/uhabits");
    expect(typeof mod.parseUhabitsFile).toBe("function");
  });

  it("exports mapUhabitsToKanso as a function", async () => {
    const mod = await import("../../src/lib/import/uhabits");
    expect(typeof mod.mapUhabitsToKanso).toBe("function");
  });
});
