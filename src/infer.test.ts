import { describe, it, expectTypeOf } from "vitest";
import { lexiconToValibot, type InferLexiconOutput } from "./index.js";
import * as v from "valibot";

describe("Type inference", () => {
  it("infers primitive types correctly", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.primitives",
      defs: {
        main: {
          type: "object",
          required: ["name", "age", "active"],
          properties: {
            name: { type: "string" },
            age: { type: "integer" },
            active: { type: "boolean" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      name: string;
      age: number;
      active: boolean;
    }>();
  });

  it("infers optional properties", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.optional",
      defs: {
        main: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      id: string;
      label?: string;
    }>();
  });

  it("infers nullable properties", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.nullable",
      defs: {
        main: {
          type: "object",
          required: ["value"],
          nullable: ["value"],
          properties: {
            value: { type: "string" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      value: string | null;
    }>();
  });

  it("infers array types", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.array",
      defs: {
        main: {
          type: "object",
          required: ["tags"],
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      tags: string[];
    }>();
  });

  it("infers const/enum types", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.literals",
      defs: {
        main: {
          type: "object",
          required: ["status", "priority"],
          properties: {
            status: { type: "string", const: "active" },
            priority: { type: "integer", enum: [1, 2, 3] },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      status: "active";
      priority: 1 | 2 | 3;
    }>();
  });

  it("infers local refs", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.refs",
      defs: {
        main: {
          type: "object",
          required: ["author"],
          properties: {
            author: { type: "ref", ref: "#author" },
          },
        },
        author: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      author: { name: string };
    }>();
  });

  it("infers union types", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.union",
      defs: {
        main: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "union", refs: ["#text", "#image"] },
          },
        },
        text: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "string" },
          },
        },
        image: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      content: { value: string } | { url: string };
    }>();
  });

  it("infers record types", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.record",
      defs: {
        main: {
          type: "record",
          record: {
            type: "object",
            required: ["text"],
            properties: {
              text: { type: "string" },
            },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    type MainOutput = v.InferOutput<typeof validators.main>;

    expectTypeOf<MainOutput>().toMatchTypeOf<{
      text: string;
    }>();
  });

  it("provides InferLexiconOutput helper", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.helper",
      defs: {
        main: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    } as const;

    type MainType = InferLexiconOutput<typeof lexicon, "main">;

    expectTypeOf<MainType>().toMatchTypeOf<{ id: string }>();
  });
});
