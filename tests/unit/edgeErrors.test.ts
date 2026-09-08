import { describe, it, expect } from "vitest";
import {
  describeError as describeEdgeError,
  toErrorMessage,
} from "../../supabase/functions/_shared/errors";
import { describeError } from "@/lib/errors/describeError";

describe("toErrorMessage", () => {
  it("keeps the text of a thrown Error", () => {
    expect(toErrorMessage(new Error("VAPID configuration missing"))).toBe(
      "VAPID configuration missing",
    );
  });

  it("keeps the text of a PostgrestError, which is not an Error instance", () => {
    expect(
      toErrorMessage({
        message: "permission denied for table notification_queue",
        code: "42501",
      }),
    ).toBe("permission denied for table notification_queue");
  });

  it("always yields a string, so recording a failure cannot itself throw", () => {
    for (const thrown of [null, undefined, 42, { code: "x" }, []]) {
      expect(typeof toErrorMessage(thrown)).toBe("string");
    }
  });
});

describe("describeError", () => {
  const cases: Array<[string, unknown, string]> = [
    ["names the error class", new TypeError("boom"), "TypeError"],
    [
      "keeps a PostgREST SQLSTATE",
      { name: "PostgrestError", message: "x", code: "42501" },
      "PostgrestError code=42501",
    ],
    [
      "keeps a web-push HTTP status",
      Object.assign(new Error("x"), { statusCode: 410 }),
      "Error status=410",
    ],
    ["falls back for a non-object throw", "just a string", "UnknownError"],
  ];

  for (const [name, thrown, expected] of cases) {
    it(name, () => {
      expect(describeError(thrown)).toBe(expected);
      expect(describeEdgeError(thrown)).toBe(expected);
    });
  }

  it("drops the message, which is where rejected payloads get echoed back", () => {
    const content = "Oncology follow-up with Dr Bhatt";
    const thrown = Object.assign(new Error(`Payload too large: ${content}`), {
      statusCode: 413,
      body: content,
    });

    for (const describe of [describeError, describeEdgeError]) {
      expect(describe(thrown)).toBe("Error status=413");
      expect(describe(thrown)).not.toContain("Bhatt");
    }
  });

  it("refuses a code that is not a short opaque token", () => {
    const thrown = { name: "PostgrestError", code: "Key (title)=(Dentist)" };
    expect(describeError(thrown)).toBe("PostgrestError");
    expect(describeEdgeError(thrown)).toBe("PostgrestError");
  });
});
