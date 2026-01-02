import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { convertArray, convertObject, convertRef, convertUnion } from "./complex.js";
import type { ConverterContext, LexArray, LexObject } from "../types.js";

// Helper to create a basic context
function createContext(
  resolveRef: (ref: string) => v.GenericSchema = () => v.string()
): ConverterContext {
  return {
    lexiconId: "test.lexicon",
    defs: {},
    resolveRef,
    blobFormat: "sdk",
  };
}

// Helper to convert primitive types
function convertType(type: unknown, _ctx: ConverterContext): v.GenericSchema {
  const t = type as { type: string };
  switch (t.type) {
    case "string":
      return v.string();
    case "integer":
      return v.pipe(v.number(), v.integer());
    case "boolean":
      return v.boolean();
    default:
      return v.unknown();
  }
}

describe("convertArray", () => {
  it("converts basic array of strings", () => {
    const lexArray: LexArray = {
      type: "array",
      items: { type: "string" },
    };
    const schema = convertArray(lexArray, createContext(), convertType);

    expect(v.safeParse(schema, ["a", "b", "c"]).success).toBe(true);
    expect(v.safeParse(schema, []).success).toBe(true);
    expect(v.safeParse(schema, [1, 2, 3]).success).toBe(false);
    expect(v.safeParse(schema, "not-an-array").success).toBe(false);
  });

  it("handles minLength constraint", () => {
    const lexArray: LexArray = {
      type: "array",
      items: { type: "string" },
      minLength: 2,
    };
    const schema = convertArray(lexArray, createContext(), convertType);

    expect(v.safeParse(schema, ["a", "b"]).success).toBe(true);
    expect(v.safeParse(schema, ["a", "b", "c"]).success).toBe(true);
    expect(v.safeParse(schema, ["a"]).success).toBe(false);
  });

  it("handles maxLength constraint", () => {
    const lexArray: LexArray = {
      type: "array",
      items: { type: "string" },
      maxLength: 3,
    };
    const schema = convertArray(lexArray, createContext(), convertType);

    expect(v.safeParse(schema, ["a", "b", "c"]).success).toBe(true);
    expect(v.safeParse(schema, ["a"]).success).toBe(true);
    expect(v.safeParse(schema, ["a", "b", "c", "d"]).success).toBe(false);
  });
});

describe("convertObject", () => {
  it("converts basic object", () => {
    const lexObject: LexObject = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    };
    const schema = convertObject(lexObject, createContext(), convertType);

    expect(v.safeParse(schema, { name: "John" }).success).toBe(true);
    expect(v.safeParse(schema, { name: "John", age: 30 }).success).toBe(true);
    expect(v.safeParse(schema, {}).success).toBe(true); // all optional by default
    expect(v.safeParse(schema, "not-an-object").success).toBe(false);
  });

  it("handles required properties", () => {
    const lexObject: LexObject = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    };
    const schema = convertObject(lexObject, createContext(), convertType);

    expect(v.safeParse(schema, { name: "John" }).success).toBe(true);
    expect(v.safeParse(schema, { name: "John", age: 30 }).success).toBe(true);
    expect(v.safeParse(schema, { age: 30 }).success).toBe(false);
    expect(v.safeParse(schema, {}).success).toBe(false);
  });

  it("handles nullable properties", () => {
    const lexObject: LexObject = {
      type: "object",
      required: ["name"],
      nullable: ["name"],
      properties: {
        name: { type: "string" },
      },
    };
    const schema = convertObject(lexObject, createContext(), convertType);

    expect(v.safeParse(schema, { name: "John" }).success).toBe(true);
    expect(v.safeParse(schema, { name: null }).success).toBe(true);
    expect(v.safeParse(schema, {}).success).toBe(false);
  });

  it("handles empty object", () => {
    const lexObject = {
      type: "object",
      properties: {},
    } as LexObject;
    const schema = convertObject(lexObject, createContext(), convertType);

    expect(v.safeParse(schema, {}).success).toBe(true);
  });
});

describe("convertRef", () => {
  it("resolves local ref", () => {
    const resolveRef = (ref: string) => {
      if (ref === "#user") {
        return v.object({ name: v.string() });
      }
      return v.unknown();
    };

    const schema = convertRef({ type: "ref", ref: "#user" }, createContext(resolveRef));

    expect(v.safeParse(schema, { name: "John" }).success).toBe(true);
    expect(v.safeParse(schema, { name: 123 }).success).toBe(false);
  });
});

describe("convertUnion", () => {
  it("handles empty union", () => {
    const schema = convertUnion(
      { type: "union", refs: [] },
      createContext()
    );

    expect(v.safeParse(schema, "anything").success).toBe(false);
  });

  it("handles single ref union", () => {
    const resolveRef = () => v.string();
    const schema = convertUnion(
      { type: "union", refs: ["#single"] },
      createContext(resolveRef)
    );

    expect(v.safeParse(schema, "valid").success).toBe(true);
    expect(v.safeParse(schema, 123).success).toBe(false);
  });

  it("handles multiple refs union", () => {
    const resolveRef = (ref: string) => {
      if (ref === "#string") return v.string();
      if (ref === "#number") return v.number();
      return v.unknown();
    };

    const schema = convertUnion(
      { type: "union", refs: ["#string", "#number"] },
      createContext(resolveRef)
    );

    expect(v.safeParse(schema, "text").success).toBe(true);
    expect(v.safeParse(schema, 42).success).toBe(true);
    expect(v.safeParse(schema, true).success).toBe(false);
  });
});
