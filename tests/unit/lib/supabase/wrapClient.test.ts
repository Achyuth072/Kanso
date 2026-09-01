import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP, type FieldMap } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext, encryptField } from "@/lib/crypto/contentCipher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
});

// In-memory query builder mock simulating PostgREST chaining and execution semantics.
function createFakeTable(getRows: () => Row[], setRows: (rows: Row[]) => void) {
  function builder(
    kind: "select" | "insert" | "update" | "upsert" | "delete",
    payload: unknown,
    opts: Row | undefined,
  ) {
    const state: {
      filters: Array<[string, unknown]>;
      selected: boolean;
      single: boolean;
      maybeSingle: boolean;
    } = { filters: [], selected: false, single: false, maybeSingle: false };

    const api: Row = {
      select() {
        state.selected = true;
        return api;
      },
      eq(col: string, val: unknown) {
        state.filters.push([col, val]);
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      then(
        onFulfilled: (v: unknown) => unknown,
        onRejected: (e: unknown) => unknown,
      ) {
        return execute().then(onFulfilled, onRejected);
      },
      single() {
        state.single = true;
        return api;
      },
      maybeSingle() {
        state.maybeSingle = true;
        return api;
      },
    };

    async function execute() {
      const rows = getRows();
      const matches = (row: Row) =>
        state.filters.every(([col, val]) => row[col] === val);

      let resultRows: Row[];
      if (kind === "select") {
        resultRows = rows.filter(matches);
      } else if (kind === "insert") {
        const inserted = (Array.isArray(payload) ? payload : [payload]).map(
          (row, i) => ({ id: `id-${rows.length + i}`, ...(row as Row) }),
        );
        setRows([...rows, ...inserted]);
        resultRows = inserted;
      } else if (kind === "update") {
        const updated: Row[] = [];
        setRows(
          rows.map((row) => {
            if (!matches(row)) return row;
            const merged = { ...row, ...(payload as Row) };
            updated.push(merged);
            return merged;
          }),
        );
        resultRows = updated;
      } else if (kind === "upsert") {
        const conflictCols = (opts?.onConflict as string | undefined)?.split(
          ",",
        ) ?? ["id"];
        const next = [...rows];
        const result: Row[] = [];
        for (const item of (Array.isArray(payload)
          ? payload
          : [payload]) as Row[]) {
          const idx = next.findIndex((row) =>
            conflictCols.every((col) => row[col] === item[col]),
          );
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...item };
            result.push(next[idx]);
          } else {
            const created = { id: item.id ?? `id-${next.length}`, ...item };
            next.push(created);
            result.push(created);
          }
        }
        setRows(next);
        resultRows = result;
      } else {
        resultRows = rows.filter(matches);
        setRows(rows.filter((row) => !matches(row)));
      }

      if (kind !== "select" && !state.selected) {
        return { data: null, error: null };
      }
      if (state.single) return { data: resultRows[0] ?? null, error: null };
      if (state.maybeSingle)
        return { data: resultRows[0] ?? null, error: null };
      return { data: resultRows, error: null };
    }

    return api;
  }

  return {
    select: () => builder("select", null, undefined),
    insert: (values: unknown, opts?: Row) => builder("insert", values, opts),
    update: (values: unknown, opts?: Row) => builder("update", values, opts),
    upsert: (values: unknown, opts?: Row) => builder("upsert", values, opts),
    delete: (opts?: Row) => builder("delete", null, opts),
  };
}

function createFakeSupabaseClient(seed: Record<string, Row[]> = {}) {
  const store = new Map<string, Row[]>(
    Object.entries(seed).map(([table, rows]) => [table, [...rows]]),
  );
  return {
    from(table: string) {
      return createFakeTable(
        () => store.get(table) ?? [],
        (rows) => store.set(table, rows),
      );
    },
    rawRows: (table: string) => {
      if (!store.has(table)) store.set(table, []);
      return store.get(table)!;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("wrapSupabaseClient — with a populated field map", () => {
  const testFieldMap: FieldMap = { tasks: ["content", "description"] };

  it("stores an inserted row as ciphertext and reads back the plaintext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data: inserted, error } = await client
      .from("tasks")
      .insert({ content: "Buy milk", priority: 1 })
      .select()
      .single();

    expect(error).toBeNull();
    expect(inserted.content).toBe("Buy milk");
    expect(inserted.priority).toBe(1);

    const stored = raw.rawRows("tasks")[0];
    expect(isCiphertext(stored.content)).toBe(true);
    expect(stored.priority).toBe(1);

    const { data: read } = await client
      .from("tasks")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.content).toBe("Buy milk");
  });

  it("encrypts every row in an array insert", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("tasks")
      .insert([{ content: "First" }, { content: "Second" }])
      .select();

    expect(data.map((r: Row) => r.content)).toEqual(["First", "Second"]);
    for (const row of raw.rawRows("tasks")) {
      expect(isCiphertext(row.content)).toBe(true);
    }
  });

  it("encrypts on update and upsert", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "old", user_id: "u1" }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);

    await client
      .from("tasks")
      .update({ content: "new" })
      .eq("id", "t1")
      .select()
      .single();
    expect(isCiphertext(raw.rawRows("tasks")[0].content)).toBe(true);

    await client
      .from("tasks")
      .upsert({ id: "t1", content: "upserted" }, { onConflict: "id" });
    expect(isCiphertext(raw.rawRows("tasks")[0].content)).toBe(true);
  });

  it("does not double-encrypt a value that is already ciphertext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const alreadyEncrypted = await encryptField(
      keyStoreState.key!,
      "already encrypted",
    );

    await client.from("tasks").insert({ content: alreadyEncrypted });

    expect(raw.rawRows("tasks")[0].content).toBe(alreadyEncrypted);
  });

  it("passes an untagged (plaintext) value through unchanged on read", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "pre-existing plaintext row" }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .single();
    expect(data.content).toBe("pre-existing plaintext row");
  });

  it("decrypts nested objects from an embedded select", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, {
      tasks: ["content"],
      projects: ["name"],
    });

    await client.from("projects").insert({ name: "Secret project" });
    await client.from("tasks").insert({ id: "t1", content: "task" });

    // Simulates PostgREST nested relation response structure.
    const rawTask = raw.rawRows("tasks").find((r: Row) => r.id === "t1");
    rawTask.projects = raw.rawRows("projects")[0];
    expect(isCiphertext(rawTask.content)).toBe(true);
    expect(isCiphertext(rawTask.projects.name)).toBe(true);

    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .maybeSingle();
    expect(data.content).toBe("task");
    expect(data.projects.name).toBe("Secret project");
  });

  it("leaves a table absent from the field map completely untouched", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("profiles")
      .insert({ display_name: "Ada" })
      .select()
      .single();

    expect(data.display_name).toBe("Ada");
    expect(raw.rawRows("profiles")[0].display_name).toBe("Ada");
  });

  it("throws rather than silently writing plaintext when the key is unavailable", async () => {
    keyStoreState.key = null;
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    await expect(
      client.from("tasks").insert({ content: "should not be written" }),
    ).rejects.toThrow();
    expect(raw.rawRows("tasks")).toHaveLength(0);
  });
});

describe("wrapSupabaseClient — verified no-op with the real (empty) field map", () => {
  it("stores every field exactly as written, with no ciphertext produced", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data } = await client
      .from("tasks")
      .insert({ content: "Buy milk", description: "2%", priority: 1 })
      .select()
      .single();

    expect(data).toEqual(raw.rawRows("tasks")[0]);
    expect(data.content).toBe("Buy milk");
    expect(isCiphertext(data.content)).toBe(false);
  });

  it("round-trips arrays, single(), and maybeSingle() unchanged", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("habits").insert([{ name: "Read" }, { name: "Run" }]);
    const { data: all } = await client.from("habits").select().limit(10);
    expect(all.map((r: Row) => r.name)).toEqual(["Read", "Run"]);

    const { data: single } = await client
      .from("habits")
      .select()
      .eq("name", "Read")
      .single();
    expect(single.name).toBe("Read");

    const { data: maybe } = await client
      .from("habits")
      .select()
      .eq("name", "missing")
      .maybeSingle();
    expect(maybe).toBeNull();
  });
});
