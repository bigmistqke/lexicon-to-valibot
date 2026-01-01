import { describe, it, expect } from "vitest";
import * as v from "valibot";
import {
  convertBoolean,
  convertInteger,
  convertString,
  convertUnknown,
  convertBytes,
} from "./primitives.js";

describe("convertBoolean", () => {
  it("converts basic boolean", () => {
    const schema = convertBoolean({ type: "boolean" });
    expect(v.safeParse(schema, true).success).toBe(true);
    expect(v.safeParse(schema, false).success).toBe(true);
    expect(v.safeParse(schema, "true").success).toBe(false);
  });

  it("handles const constraint", () => {
    const schema = convertBoolean({ type: "boolean", const: true });
    expect(v.safeParse(schema, true).success).toBe(true);
    expect(v.safeParse(schema, false).success).toBe(false);
  });
});

describe("convertInteger", () => {
  it("converts basic integer", () => {
    const schema = convertInteger({ type: "integer" });
    expect(v.safeParse(schema, 42).success).toBe(true);
    expect(v.safeParse(schema, 0).success).toBe(true);
    expect(v.safeParse(schema, -10).success).toBe(true);
    expect(v.safeParse(schema, 3.14).success).toBe(false);
    expect(v.safeParse(schema, "42").success).toBe(false);
  });

  it("handles minimum constraint", () => {
    const schema = convertInteger({ type: "integer", minimum: 0 });
    expect(v.safeParse(schema, 0).success).toBe(true);
    expect(v.safeParse(schema, 10).success).toBe(true);
    expect(v.safeParse(schema, -1).success).toBe(false);
  });

  it("handles maximum constraint", () => {
    const schema = convertInteger({ type: "integer", maximum: 100 });
    expect(v.safeParse(schema, 100).success).toBe(true);
    expect(v.safeParse(schema, 50).success).toBe(true);
    expect(v.safeParse(schema, 101).success).toBe(false);
  });

  it("handles enum constraint", () => {
    const schema = convertInteger({ type: "integer", enum: [1, 2, 3] });
    expect(v.safeParse(schema, 1).success).toBe(true);
    expect(v.safeParse(schema, 2).success).toBe(true);
    expect(v.safeParse(schema, 4).success).toBe(false);
  });

  it("handles const constraint", () => {
    const schema = convertInteger({ type: "integer", const: 42 });
    expect(v.safeParse(schema, 42).success).toBe(true);
    expect(v.safeParse(schema, 43).success).toBe(false);
  });
});

describe("convertString", () => {
  it("converts basic string", () => {
    const schema = convertString({ type: "string" });
    expect(v.safeParse(schema, "hello").success).toBe(true);
    expect(v.safeParse(schema, "").success).toBe(true);
    expect(v.safeParse(schema, 42).success).toBe(false);
  });

  it("handles minLength constraint", () => {
    const schema = convertString({ type: "string", minLength: 3 });
    expect(v.safeParse(schema, "abc").success).toBe(true);
    expect(v.safeParse(schema, "abcd").success).toBe(true);
    expect(v.safeParse(schema, "ab").success).toBe(false);
  });

  it("handles maxLength constraint", () => {
    const schema = convertString({ type: "string", maxLength: 5 });
    expect(v.safeParse(schema, "hello").success).toBe(true);
    expect(v.safeParse(schema, "hi").success).toBe(true);
    expect(v.safeParse(schema, "hello!").success).toBe(false);
  });

  it("handles enum constraint", () => {
    const schema = convertString({ type: "string", enum: ["a", "b", "c"] });
    expect(v.safeParse(schema, "a").success).toBe(true);
    expect(v.safeParse(schema, "b").success).toBe(true);
    expect(v.safeParse(schema, "d").success).toBe(false);
  });

  it("handles const constraint", () => {
    const schema = convertString({ type: "string", const: "fixed" });
    expect(v.safeParse(schema, "fixed").success).toBe(true);
    expect(v.safeParse(schema, "other").success).toBe(false);
  });

  it("handles datetime format", () => {
    const schema = convertString({ type: "string", format: "datetime" });
    expect(v.safeParse(schema, "2024-01-01T12:00:00Z").success).toBe(true);
    expect(v.safeParse(schema, "2024-01-01T12:00:00.123Z").success).toBe(true);
    expect(v.safeParse(schema, "not-a-date").success).toBe(false);
  });

  it("handles uri format", () => {
    const schema = convertString({ type: "string", format: "uri" });
    expect(v.safeParse(schema, "https://example.com").success).toBe(true);
    expect(v.safeParse(schema, "http://localhost:3000/path").success).toBe(true);
    expect(v.safeParse(schema, "not-a-url").success).toBe(false);
  });

  it("handles did format", () => {
    const schema = convertString({ type: "string", format: "did" });
    expect(v.safeParse(schema, "did:plc:abc123").success).toBe(true);
    expect(v.safeParse(schema, "did:web:example.com").success).toBe(true);
    expect(v.safeParse(schema, "not-a-did").success).toBe(false);
  });

  it("handles handle format", () => {
    const schema = convertString({ type: "string", format: "handle" });
    expect(v.safeParse(schema, "user.bsky.social").success).toBe(true);
    expect(v.safeParse(schema, "example.com").success).toBe(true);
    expect(v.safeParse(schema, "invalid").success).toBe(false);
  });
});

describe("convertUnknown", () => {
  it("accepts any value", () => {
    const schema = convertUnknown({ type: "unknown" });
    expect(v.safeParse(schema, "string").success).toBe(true);
    expect(v.safeParse(schema, 42).success).toBe(true);
    expect(v.safeParse(schema, { foo: "bar" }).success).toBe(true);
    expect(v.safeParse(schema, null).success).toBe(true);
    expect(v.safeParse(schema, undefined).success).toBe(true);
  });
});

describe("convertBytes", () => {
  it("converts basic bytes", () => {
    const schema = convertBytes({ type: "bytes" });
    expect(v.safeParse(schema, new Uint8Array([1, 2, 3])).success).toBe(true);
    expect(v.safeParse(schema, new Uint8Array()).success).toBe(true);
    expect(v.safeParse(schema, [1, 2, 3]).success).toBe(false);
    expect(v.safeParse(schema, "bytes").success).toBe(false);
  });

  it("handles minLength constraint", () => {
    const schema = convertBytes({ type: "bytes", minLength: 2 });
    expect(v.safeParse(schema, new Uint8Array([1, 2])).success).toBe(true);
    expect(v.safeParse(schema, new Uint8Array([1, 2, 3])).success).toBe(true);
    expect(v.safeParse(schema, new Uint8Array([1])).success).toBe(false);
  });

  it("handles maxLength constraint", () => {
    const schema = convertBytes({ type: "bytes", maxLength: 3 });
    expect(v.safeParse(schema, new Uint8Array([1, 2, 3])).success).toBe(true);
    expect(v.safeParse(schema, new Uint8Array([1])).success).toBe(true);
    expect(v.safeParse(schema, new Uint8Array([1, 2, 3, 4])).success).toBe(false);
  });
});
