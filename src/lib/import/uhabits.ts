import initSqlJs from "sql.js";
import type { Habit, HabitEntry } from "../types/habit";
import { PROJECT_COLORS } from "../constants/colors";

export async function parseUhabitsFile(
  file: File,
): Promise<{ habits: Habit[]; entries: HabitEntry[] }> {
  // Use the locally served WASM binary so the import works in all environments
  // (including offline / PWA) without depending on an external CDN.
  // The file is copied to public/sql-wasm.wasm by `npm run copy-wasm` (prepare).
  const SQL = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });

  const buffer = await file.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  const habitsResult = db.exec("SELECT * FROM habits");
  const repetitionsResult = db.exec("SELECT * FROM Repetitions");

  if (!habitsResult.length) return { habits: [], entries: [] };

  const habitsData = resultToObjects(habitsResult[0]);
  const repetitionsData = repetitionsResult.length
    ? resultToObjects(repetitionsResult[0])
    : [];

  db.close();

  return mapUhabitsToKanso(habitsData, repetitionsData);
}

function resultToObjects(result: {
  columns: string[];
  values: unknown[][];
}): Record<string, unknown>[] {
  const columns = result.columns;
  return result.values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Loop Habit Tracker stores colors as palette indices (not ARGB ints).
// Source: HabitColor enum in uhabits-core (indices 0-20).
const LOOP_COLOR_PALETTE: Record<number, string> = {
  0: "#f44336", // Red
  1: "#ff5722", // Deep Orange
  2: "#ff9800", // Orange
  3: "#ffc107", // Amber
  4: "#ffeb3b", // Yellow
  5: "#cddc39", // Lime
  6: "#4caf50", // Green
  7: "#009688", // Teal
  8: "#00bcd4", // Cyan
  9: "#03a9f4", // Light Blue
  10: "#2196f3", // Blue
  11: "#3f51b5", // Indigo
  12: "#673ab7", // Deep Purple
  13: "#9c27b0", // Purple
  14: "#e91e63", // Pink
  15: "#f50057", // Magenta
  16: "#607d8b", // Blue Grey
  17: "#9e9e9e", // Grey
  18: "#616161", // Dark Grey
  19: "#795548", // Brown
  20: "#4e342e", // Dark Brown
};

// Keyword → icon mapping for common habit categories
const ICON_KEYWORDS: Array<[RegExp, string]> = [
  [/workout|exercise|gym|run(ning)?|jog|swim|sport|fitness|lift/i, "Dumbbell"],
  [/read|book|study|learn/i, "Book"],
  [/meditat|breath|relax|calm|mindful|zen/i, "Brain"],
  [/water|hydrat|drink/i, "Droplet"],
  [/sleep|bed|rest|nap/i, "Moon"],
  [/wake|rise|morning|alarm|early/i, "Sun"],
  [/food|eat|diet|meal|cook|nutrition/i, "Cooking"],
  [/walk|step|hike|bike|cycl/i, "Bike"],
  [/journal|write|diary|pencil/i, "Pencil"],
  [/music|guitar|piano|sing/i, "Music"],
  [/code|program|develop/i, "Code"],
  [/photo|camera|picture/i, "Camera"],
  [/medic|pill|vitamin|supplement/i, "Heart"],
  [/money|budget|financ|saving|invest/i, "Finances"],
  [/language|vocab|spanish|french|english/i, "Language"],
  [/clean|wash|shower|bath|hygiene|shampoo|exfoliat|haircut|groom/i, "Droplet"],
  [/garden|plant|tree|nature|outdoor/i, "Trees"],
  [/social|friend|family|call/i, "User"],
  [/game|play|chess/i, "Gamepad"],
  [/travel|flight|trip/i, "Plane"],
  [/sun|sunscreen/i, "Sun"],
  [/target|goal|achiev/i, "Target"],
  [/news|newspaper|article/i, "Book"],
  [/knee|stretch|yoga|flex/i, "Dumbbell"],
  [/coffee|tea/i, "Coffee"],
  [/smile|mood|happy|gratitude/i, "Smile"],
  [/leaf|salad|veggie|vegetable|organic/i, "Leaf"],
];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function findClosestKansoColor(loopHex: string): string {
  let closest = PROJECT_COLORS[0].hex;
  let minDistance = Infinity;

  for (const color of PROJECT_COLORS) {
    const dist = colorDistance(loopHex, color.hex);
    if (dist < minDistance) {
      minDistance = dist;
      closest = color.hex;
    }
  }

  return closest;
}

function paletteToHex(colorIndex: number): string {
  const loopHex = LOOP_COLOR_PALETTE[colorIndex];
  if (!loopHex) return "#4B6CB7"; // default Kanso Blue
  return findClosestKansoColor(loopHex);
}

function inferIcon(habitName: string, description?: string): string {
  const text = description ? `${habitName} ${description}` : habitName;
  for (const [pattern, icon] of ICON_KEYWORDS) {
    if (pattern.test(text)) return icon;
  }
  return "Flame";
}

export function mapUhabitsToKanso(
  uhHabits: Record<string, unknown>[],
  uhRepetitions: Record<string, unknown>[],
) {
  const today = new Date().toISOString().split("T")[0];

  // Pre-compute earliest completed entry date per Loop integer habit ID
  const earliestDate = new Map<number, string>();
  uhRepetitions.forEach((ci) => {
    if ((ci.value as number) !== 2) return;
    const loopId = ci.habit as number;
    const date = new Date(ci.timestamp as number).toISOString().split("T")[0];
    const prev = earliestDate.get(loopId);
    if (!prev || date < prev) earliestDate.set(loopId, date);
  });

  const habits: Habit[] = [];
  const rawEntries: HabitEntry[] = [];
  const idMap = new Map<number, string>();

  uhHabits.forEach((uh) => {
    if (uh.archived === 1) return;

    const id = crypto.randomUUID();
    idMap.set(uh.id as number, id);

    habits.push({
      id,
      user_id: "",
      name: uh.name as string,
      description:
        (uh.description as string) || (uh.question as string) || null,
      color: paletteToHex(uh.color as number),
      icon: inferIcon(
        uh.name as string,
        (uh.description as string) || (uh.question as string),
      ),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
      start_date: earliestDate.get(uh.id as number) ?? today,
    });
  });

  uhRepetitions.forEach((ci) => {
    const habitId = idMap.get(ci.habit as number);
    if (!habitId) return;

    // Loop uses value=2 (YES_MANUAL) for completed. value=0=NO, value=3=SKIP.
    if ((ci.value as number) !== 2) return;

    rawEntries.push({
      id: crypto.randomUUID(),
      habit_id: habitId,
      date: new Date(ci.timestamp as number).toISOString().split("T")[0],
      value: 1,
      created_at: new Date().toISOString(),
    });
  });

  // Deduplicate by habit_id+date — keep first seen (all are value=1 at this point)
  const seen = new Set<string>();
  const entries = rawEntries.filter((e) => {
    const key = `${e.habit_id}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { habits, entries };
}
