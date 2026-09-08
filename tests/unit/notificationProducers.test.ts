import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

const schemaSql = read("supabase/schema.sql");
const dailyBriefing = read("supabase/functions/daily-briefing/index.ts");

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}()`);
  expect(start, `${name} not found in schema.sql`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$$;", start);
  expect(end, `${name} has no terminator in schema.sql`).toBeGreaterThan(start);
  // Strip SQL comments so assertions inspect executable code only.
  return sql.slice(start, end).replace(/^\s*--.*$/gm, "");
}

describe("handle_task_notification_sync", () => {
  const body = functionBody(schemaSql, "handle_task_notification_sync");

  it("passes the task's ciphertext through instead of interpolating content", () => {
    expect(body).not.toMatch(/\|\|\s*NEW\.content/);
    expect(body).toContain("public.encrypted_notification_body(");
  });

  it("queues a body that names no item for a device with no key", () => {
    expect(body).toContain("'You have a task due now.'");
    expect(body).toContain("'You have a task scheduled now.'");
  });
});

describe("handle_timer_notification_sync", () => {
  const body = functionBody(schemaSql, "handle_timer_notification_sync");

  it("queues no readable task text when a focus session completes", () => {
    expect(body).not.toMatch(/\bFROM\s+tasks\b/i);
    expect(body).not.toMatch(/\bcontent\b/);
  });

  it("still deep-links to the task it was run against", () => {
    expect(body).toContain("'taskId', NEW.active_task_id");
  });
});

describe("daily-briefing", () => {
  it("counts tasks without selecting their content", () => {
    expect(dailyBriefing).not.toMatch(/\.select\(\s*"[^"]*content/);
    expect(dailyBriefing).not.toContain("tasks[0].content");
  });
});
