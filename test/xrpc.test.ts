import * as v from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createLookup, xrpcToValibot } from "../src/index.js";

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
    expect(
      v.safeParse(main.parameters, {
        uri: "at://did:plc:abc/app.bsky.feed.post/123",
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(main.parameters, {
        uri: "at://did:plc:abc/app.bsky.feed.post/123",
        limit: 50,
      }).success,
    ).toBe(true);
    expect(v.safeParse(main.parameters, {}).success).toBe(false); // missing required uri
    expect(
      v.safeParse(main.parameters, {
        uri: "at://did:plc:abc/app.bsky.feed.post/123",
        limit: 0,
      }).success,
    ).toBe(false); // below minimum

    // Test output validator
    expect(v.safeParse(main.output, { items: ["a", "b"] }).success).toBe(true);
    expect(v.safeParse(main.output, { items: [], cursor: "abc" }).success).toBe(
      true,
    );
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
      }).success,
    ).toBe(true);
    expect(v.safeParse(main.input, { repo: "did:plc:abc" }).success).toBe(
      false,
    ); // missing required fields

    // Test output validator
    expect(
      v.safeParse(main.output, {
        uri: "at://did:plc:abc/app.bsky.feed.post/123",
        cid: "bafyreiabc",
      }).success,
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
    expect(v.safeParse(main.message, { seq: 1, event: "commit" }).success).toBe(
      true,
    );
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

describe("XRPC with createLookup", () => {
  it("resolves cross-lexicon refs in query output", () => {
    const authorLexicon = {
      lexicon: 1,
      id: "com.example.author",
      defs: {
        main: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            bio: { type: "string" },
          },
        },
      },
    } as const;

    const getAuthorLexicon = {
      lexicon: 1,
      id: "com.example.getAuthor",
      defs: {
        main: {
          type: "query",
          parameters: {
            type: "params",
            required: ["id"],
            properties: {
              id: { type: "string" },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "ref",
              ref: "com.example.author",
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(authorLexicon, getAuthorLexicon);
    const { main } = xrpcToValibot(getAuthorLexicon, { lookup });

    expect(v.safeParse(main.parameters, { id: "123" }).success).toBe(true);
    expect(v.safeParse(main.output, { name: "John" }).success).toBe(true);
    expect(v.safeParse(main.output, { name: "Jane", bio: "Dev" }).success).toBe(
      true,
    );
    expect(v.safeParse(main.output, {}).success).toBe(false);
  });

  it("resolves cross-lexicon refs in procedure input/output", () => {
    const postLexicon = {
      lexicon: 1,
      id: "com.example.post",
      defs: {
        main: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
    } as const;

    const postResponseLexicon = {
      lexicon: 1,
      id: "com.example.postResponse",
      defs: {
        main: {
          type: "object",
          required: ["uri", "cid"],
          properties: {
            uri: { type: "string", format: "at-uri" },
            cid: { type: "string" },
          },
        },
      },
    } as const;

    const createPostLexicon = {
      lexicon: 1,
      id: "com.example.createPost",
      defs: {
        main: {
          type: "procedure",
          input: {
            encoding: "application/json",
            schema: {
              type: "ref",
              ref: "com.example.post",
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "ref",
              ref: "com.example.postResponse",
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(
      postLexicon,
      postResponseLexicon,
      createPostLexicon,
    );
    const { main } = xrpcToValibot(createPostLexicon, { lookup });

    expect(v.safeParse(main.input, { text: "Hello world" }).success).toBe(true);
    expect(
      v.safeParse(main.input, { text: "Hello", tags: ["news"] }).success,
    ).toBe(true);
    expect(v.safeParse(main.input, {}).success).toBe(false);

    expect(
      v.safeParse(main.output, {
        uri: "at://did:plc:abc/com.example.post/123",
        cid: "bafyreiabc",
      }).success,
    ).toBe(true);
  });

  it("resolves cross-lexicon refs in subscription message", () => {
    const eventLexicon = {
      lexicon: 1,
      id: "com.example.event",
      defs: {
        main: {
          type: "object",
          required: ["type", "timestamp"],
          properties: {
            type: { type: "string" },
            timestamp: { type: "string", format: "datetime" },
            payload: { type: "unknown" },
          },
        },
      },
    } as const;

    const streamLexicon = {
      lexicon: 1,
      id: "com.example.stream",
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
              type: "ref",
              ref: "com.example.event",
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(eventLexicon, streamLexicon);
    const { main } = xrpcToValibot(streamLexicon, { lookup });

    expect(v.safeParse(main.parameters, {}).success).toBe(true);
    expect(v.safeParse(main.parameters, { cursor: 100 }).success).toBe(true);
    expect(
      v.safeParse(main.message, {
        type: "commit",
        timestamp: "2024-01-15T10:30:00Z",
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(main.message, {
        type: "commit",
        timestamp: "2024-01-15T10:30:00Z",
        payload: { data: "test" },
      }).success,
    ).toBe(true);
    expect(v.safeParse(main.message, { type: "commit" }).success).toBe(false);
  });

  it("resolves union refs across lexicons in query output", () => {
    const textPostLexicon = {
      lexicon: 1,
      id: "com.example.textPost",
      defs: {
        main: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string" },
          },
        },
      },
    } as const;

    const imagePostLexicon = {
      lexicon: 1,
      id: "com.example.imagePost",
      defs: {
        main: {
          type: "object",
          required: ["imageUrl"],
          properties: {
            imageUrl: { type: "string", format: "uri" },
            alt: { type: "string" },
          },
        },
      },
    } as const;

    const getFeedLexicon = {
      lexicon: 1,
      id: "com.example.getFeed",
      defs: {
        main: {
          type: "query",
          parameters: {
            type: "params",
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 100 },
            },
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["posts"],
              properties: {
                posts: {
                  type: "array",
                  items: {
                    type: "union",
                    refs: ["com.example.textPost", "com.example.imagePost"],
                  },
                },
                cursor: { type: "string" },
              },
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(
      textPostLexicon,
      imagePostLexicon,
      getFeedLexicon,
    );
    const { main } = xrpcToValibot(getFeedLexicon, { lookup });

    expect(
      v.safeParse(main.output, {
        posts: [{ text: "Hello" }, { imageUrl: "https://example.com/img.jpg" }],
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(main.output, {
        posts: [
          { imageUrl: "https://example.com/img.jpg", alt: "A nice picture" },
        ],
        cursor: "abc123",
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(main.output, {
        posts: [{ other: "field" }],
      }).success,
    ).toBe(false);
  });

  it("shares cache across multiple xrpc conversions", () => {
    const sharedTypeLexicon = {
      lexicon: 1,
      id: "com.example.sharedType",
      defs: {
        main: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            metadata: { type: "unknown" },
          },
        },
      },
    } as const;

    const queryALexicon = {
      lexicon: 1,
      id: "com.example.queryA",
      defs: {
        main: {
          type: "query",
          output: {
            encoding: "application/json",
            schema: {
              type: "ref",
              ref: "com.example.sharedType",
            },
          },
        },
      },
    } as const;

    const queryBLexicon = {
      lexicon: 1,
      id: "com.example.queryB",
      defs: {
        main: {
          type: "query",
          output: {
            encoding: "application/json",
            schema: {
              type: "ref",
              ref: "com.example.sharedType",
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(sharedTypeLexicon, queryALexicon, queryBLexicon);
    const queryA = xrpcToValibot(queryALexicon, { lookup });
    const queryB = xrpcToValibot(queryBLexicon, { lookup });

    expect(v.safeParse(queryA.main.output, { id: "123" }).success).toBe(true);
    expect(v.safeParse(queryB.main.output, { id: "456" }).success).toBe(true);

    expect(
      v.safeParse(queryA.main.output, { id: "123", metadata: { extra: true } })
        .success,
    ).toBe(true);
    expect(v.safeParse(queryA.main.output, {}).success).toBe(false);
    expect(v.safeParse(queryB.main.output, {}).success).toBe(false);
  });
});
