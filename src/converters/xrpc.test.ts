import { describe, it, expect, expectTypeOf } from "vitest";
import * as v from "valibot";
import { xrpcToValibot } from "../index.js";

describe("XRPC Query", () => {
  it("converts query with parameters and output", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.query",
      defs: {
        main: {
          type: "query",
          parameters: {
            type: "params",
            required: ["uri"],
            properties: {
              uri: { type: "string", format: "at-uri" },
              limit: { type: "integer", minimum: 1, maximum: 100 },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["items"],
              properties: {
                items: { type: "array", items: { type: "string" } },
                cursor: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    // Test parameters validator
    expect(v.safeParse(main.parameters, { uri: "at://did:plc:abc/app.bsky.feed.post/123" }).success).toBe(true);
    expect(v.safeParse(main.parameters, { uri: "at://did:plc:abc/app.bsky.feed.post/123", limit: 50 }).success).toBe(true);
    expect(v.safeParse(main.parameters, {}).success).toBe(false); // missing required uri
    expect(v.safeParse(main.parameters, { uri: "at://did:plc:abc/app.bsky.feed.post/123", limit: 0 }).success).toBe(false); // below minimum

    // Test output validator
    expect(v.safeParse(main.output, { items: ["a", "b"] }).success).toBe(true);
    expect(v.safeParse(main.output, { items: [], cursor: "abc" }).success).toBe(true);
    expect(v.safeParse(main.output, {}).success).toBe(false); // missing required items
  });

  it("handles query with no parameters", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.queryNoParams",
      defs: {
        main: {
          type: "query",
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    expect(v.safeParse(main.parameters, {}).success).toBe(true);
    expect(v.safeParse(main.output, { data: "hello" }).success).toBe(true);
  });
});

describe("XRPC Procedure", () => {
  it("converts procedure with input and output", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.procedure",
      defs: {
        main: {
          type: "procedure",
          input: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["repo", "collection", "record"],
              properties: {
                repo: { type: "string", format: "did" },
                collection: { type: "string", format: "nsid" },
                record: { type: "unknown" },
              },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["uri", "cid"],
              properties: {
                uri: { type: "string", format: "at-uri" },
                cid: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    // Test input validator
    expect(
      v.safeParse(main.input, {
        repo: "did:plc:abc123",
        collection: "app.bsky.feed.post",
        record: { text: "Hello" },
      }).success
    ).toBe(true);
    expect(v.safeParse(main.input, { repo: "did:plc:abc" }).success).toBe(false); // missing required fields

    // Test output validator
    expect(
      v.safeParse(main.output, {
        uri: "at://did:plc:abc/app.bsky.feed.post/123",
        cid: "bafyreiabc",
      }).success
    ).toBe(true);
  });

  it("handles procedure with parameters", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.procedureWithParams",
      defs: {
        main: {
          type: "procedure",
          parameters: {
            type: "params",
            required: ["id"],
            properties: {
              id: { type: "string" },
            },
          },
          input: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["value"],
              properties: {
                value: { type: "integer" },
              },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["success"],
              properties: {
                success: { type: "boolean" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    expect(v.safeParse(main.parameters, { id: "123" }).success).toBe(true);
    expect(v.safeParse(main.input, { value: 42 }).success).toBe(true);
    expect(v.safeParse(main.output, { success: true }).success).toBe(true);
  });
});

describe("XRPC Subscription", () => {
  it("converts subscription with message schema", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.subscription",
      defs: {
        main: {
          type: "subscription",
          parameters: {
            type: "params",
            properties: {
              cursor: { type: "integer" },
            },
          },
          message: {
            schema: {
              type: "object",
              required: ["seq", "event"],
              properties: {
                seq: { type: "integer" },
                event: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    expect(v.safeParse(main.parameters, {}).success).toBe(true);
    expect(v.safeParse(main.parameters, { cursor: 100 }).success).toBe(true);
    expect(v.safeParse(main.message, { seq: 1, event: "commit" }).success).toBe(true);
    expect(v.safeParse(main.message, { seq: 1 }).success).toBe(false); // missing event
  });
});

describe("XRPC type inference", () => {
  it("infers query types correctly", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.queryTypes",
      defs: {
        main: {
          type: "query",
          parameters: {
            type: "params",
            required: ["id"],
            properties: {
              id: { type: "string" },
              limit: { type: "integer" },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    type Params = v.InferOutput<typeof main.parameters>;
    type Output = v.InferOutput<typeof main.output>;

    expectTypeOf<Params>().toMatchTypeOf<{ id: string; limit?: number }>();
    expectTypeOf<Output>().toMatchTypeOf<{ name: string }>();
  });

  it("infers procedure types correctly", () => {
    const lexicon = {
      lexicon: 1,
      id: "test.procedureTypes",
      defs: {
        main: {
          type: "procedure",
          input: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["text"],
              properties: {
                text: { type: "string" },
              },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["id"],
              properties: {
                id: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const { main } = xrpcToValibot(lexicon);

    type Input = v.InferOutput<typeof main.input>;
    type Output = v.InferOutput<typeof main.output>;

    expectTypeOf<Input>().toMatchTypeOf<{ text: string }>();
    expectTypeOf<Output>().toMatchTypeOf<{ id: string }>();
  });
});
