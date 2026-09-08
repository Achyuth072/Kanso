// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export type FailWrite = (ctx: {
  table: string;
  kind: "insert" | "update" | "upsert" | "delete";
  payload: unknown;
}) => Row | null | undefined;

function createFakeTable(
  table: string,
  getRows: () => Row[],
  setRows: (rows: Row[]) => void,
  failWrite: FailWrite | undefined,
) {
  function builder(
    kind: "select" | "insert" | "update" | "upsert" | "delete",
    payload: unknown,
    opts: Row | undefined,
  ) {
    const state: {
      filters: Array<(row: Row) => boolean>;
      range: [number, number] | null;
      selected: boolean;
      single: boolean;
      maybeSingle: boolean;
    } = {
      filters: [],
      range: null,
      selected: false,
      single: false,
      maybeSingle: false,
    };

    const api: Row = {
      select() {
        state.selected = true;
        return api;
      },
      eq(col: string, val: unknown) {
        state.filters.push((row) => row[col] === val);
        return api;
      },
      in(col: string, vals: unknown[]) {
        state.filters.push((row) => vals.includes(row[col]));
        return api;
      },
      // Only the `.not(col, "is", null)` form the sync paths use.
      not(col: string, _op: string, _val: unknown) {
        state.filters.push((row) => row[col] != null);
        return api;
      },
      order() {
        return api;
      },
      range(from: number, to: number) {
        state.range = [from, to];
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
      const matches = (row: Row) => state.filters.every((f) => f(row));

      if (kind !== "select") {
        const failure = failWrite?.({ table, kind, payload });
        if (failure) return { data: null, error: failure, count: null };
      }

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
      if (state.range) {
        resultRows = resultRows.slice(state.range[0], state.range[1] + 1);
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

export function createFakeSupabaseClient(
  seed: Record<string, Row[]> = {},
  opts: { failWrite?: FailWrite } = {},
) {
  const store = new Map<string, Row[]>(
    Object.entries(seed).map(([table, rows]) => [table, [...rows]]),
  );
  return {
    from(table: string) {
      return createFakeTable(
        table,
        () => store.get(table) ?? [],
        (rows) => store.set(table, rows),
        opts.failWrite,
      );
    },
    rawRows: (table: string) => {
      if (!store.has(table)) store.set(table, []);
      return store.get(table)!;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
