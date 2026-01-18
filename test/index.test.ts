import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createLookup, lexiconToValibot } from "../src/index.js";

describe("lexiconToValibot", () => {
  it("converts a simple record lexicon", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.simpleRecord",
      defs: {
        main: {
          type: "record",
          record: {
            type: "object",
            required: ["text"],
            properties: {
              text: { type: "string", maxLength: 300 },
              count: { type: "integer", minimum: 0 },
            },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    expect(v.safeParse(validators.main, { text: "Hello" }).success).toBe(true);
    expect(
      v.safeParse(validators.main, { text: "Hello", count: 5 }).success,
    ).toBe(true);
    expect(v.safeParse(validators.main, {}).success).toBe(false);
    expect(
      v.safeParse(validators.main, { text: "a".repeat(301) }).success,
    ).toBe(false);
    expect(
      v.safeParse(validators.main, { text: "Hi", count: -1 }).success,
    ).toBe(false);
  });

  it("converts multiple defs", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.multiDef",
      defs: {
        main: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
          },
        },
        secondary: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "integer" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    expect(v.safeParse(validators.main, { name: "Test" }).success).toBe(true);
    expect(v.safeParse(validators.secondary, { value: 42 }).success).toBe(true);
    expect(v.safeParse(validators.main, { value: 42 }).success).toBe(false);
    expect(v.safeParse(validators.secondary, { name: "Test" }).success).toBe(
      false,
    );
  });

  it("handles local refs between defs", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.localRef",
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
            bio: { type: "string" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        author: { name: "John Doe" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        author: { name: "Jane", bio: "Developer" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        author: {},
      }).success,
    ).toBe(false);
  });

  it("handles arrays of objects", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.arrayTest",
      defs: {
        main: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["id"],
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                },
              },
              maxLength: 10,
            },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        items: [{ id: "1" }, { id: "2", label: "Second" }],
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        items: [],
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        items: [{}],
      }).success,
    ).toBe(false);

    // Too many items
    expect(
      v.safeParse(validators.main, {
        items: Array(11).fill({ id: "x" }),
      }).success,
    ).toBe(false);
  });

  it("handles union types", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.unionTest",
      defs: {
        main: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "union",
              refs: ["#textContent", "#imageContent"],
            },
          },
        },
        textContent: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string" },
          },
        },
        imageContent: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        content: { text: "Hello" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        content: { url: "https://example.com/image.jpg" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        content: { other: "field" },
      }).success,
    ).toBe(false);
  });

  it("handles blob types (wire format)", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.blobTest",
      defs: {
        main: {
          type: "object",
          properties: {
            avatar: { type: "blob", accept: ["image/*"], maxSize: 1000000 },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon, { format: "wire" });

    expect(
      v.safeParse(validators.main, {
        avatar: {
          $type: "blob",
          ref: { $link: "bafkreiexample" },
          mimeType: "image/png",
          size: 5000,
        },
      }).success,
    ).toBe(true);

    expect(v.safeParse(validators.main, {}).success).toBe(true);
  });

  it("handles nullable and optional properties", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.nullableTest",
      defs: {
        main: {
          type: "object",
          required: ["requiredField", "nullableRequired"],
          nullable: ["nullableRequired", "nullableOptional"],
          properties: {
            requiredField: { type: "string" },
            optionalField: { type: "string" },
            nullableRequired: { type: "string" },
            nullableOptional: { type: "string" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    // All fields provided
    expect(
      v.safeParse(validators.main, {
        requiredField: "value",
        optionalField: "value",
        nullableRequired: "value",
        nullableOptional: "value",
      }).success,
    ).toBe(true);

    // Only required fields
    expect(
      v.safeParse(validators.main, {
        requiredField: "value",
        nullableRequired: "value",
      }).success,
    ).toBe(true);

    // Nullable fields can be null
    expect(
      v.safeParse(validators.main, {
        requiredField: "value",
        nullableRequired: null,
        nullableOptional: null,
      }).success,
    ).toBe(true);

    // Missing required field
    expect(
      v.safeParse(validators.main, {
        nullableRequired: "value",
      }).success,
    ).toBe(false);

    // Non-nullable field cannot be null
    expect(
      v.safeParse(validators.main, {
        requiredField: null,
        nullableRequired: "value",
      }).success,
    ).toBe(false);
  });

  it("handles string formats", () => {
    const lexicon = {
      lexicon: 1,
      id: "com.example.formatTest",
      defs: {
        main: {
          type: "object",
          required: ["createdAt", "did", "handle"],
          properties: {
            createdAt: { type: "string", format: "datetime" },
            did: { type: "string", format: "did" },
            handle: { type: "string", format: "handle" },
          },
        },
      },
    } as const;

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        createdAt: "2024-01-01T12:00:00Z",
        did: "did:plc:abc123",
        handle: "user.bsky.social",
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        createdAt: "not-a-date",
        did: "did:plc:abc123",
        handle: "user.bsky.social",
      }).success,
    ).toBe(false);
  });
});

describe("createLookup", () => {
  it("resolves cross-lexicon references", () => {
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

    const postLexicon = {
      lexicon: 1,
      id: "com.example.post",
      defs: {
        main: {
          type: "object",
          required: ["text", "author"],
          properties: {
            text: { type: "string" },
            author: { type: "ref", ref: "com.example.author" },
          },
        },
      },
    } as const;

    const lookup = createLookup(authorLexicon, postLexicon);
    const postValidators = lexiconToValibot(postLexicon, { lookup });

    expect(
      v.safeParse(postValidators.main, {
        text: "Hello world",
        author: { name: "John" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(postValidators.main, {
        text: "Hello world",
        author: { name: "Jane", bio: "Developer" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(postValidators.main, {
        text: "Hello world",
        author: {},
      }).success,
    ).toBe(false);
  });

  it("resolves cross-lexicon refs with def name", () => {
    const defsLexicon = {
      lexicon: 1,
      id: "com.example.defs",
      defs: {
        tag: {
          type: "object",
          required: ["label"],
          properties: {
            label: { type: "string" },
            color: { type: "string" },
          },
        },
      },
    } as const;

    const itemLexicon = {
      lexicon: 1,
      id: "com.example.item",
      defs: {
        main: {
          type: "object",
          required: ["name", "tags"],
          properties: {
            name: { type: "string" },
            tags: {
              type: "array",
              items: { type: "ref", ref: "com.example.defs#tag" },
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(defsLexicon, itemLexicon);
    const itemValidators = lexiconToValibot(itemLexicon, { lookup });

    expect(
      v.safeParse(itemValidators.main, {
        name: "My Item",
        tags: [{ label: "important" }, { label: "urgent", color: "red" }],
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(itemValidators.main, {
        name: "My Item",
        tags: [{}],
      }).success,
    ).toBe(false);
  });

  it("shares cache across multiple conversions", () => {
    const sharedLexicon = {
      lexicon: 1,
      id: "com.example.shared",
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

    const lexiconA = {
      lexicon: 1,
      id: "com.example.a",
      defs: {
        main: {
          type: "object",
          required: ["shared"],
          properties: {
            shared: { type: "ref", ref: "com.example.shared" },
          },
        },
      },
    } as const;

    const lexiconB = {
      lexicon: 1,
      id: "com.example.b",
      defs: {
        main: {
          type: "object",
          required: ["shared"],
          properties: {
            shared: { type: "ref", ref: "com.example.shared" },
          },
        },
      },
    } as const;

    const lookup = createLookup(sharedLexicon, lexiconA, lexiconB);
    const validatorsA = lexiconToValibot(lexiconA, { lookup });
    const validatorsB = lexiconToValibot(lexiconB, { lookup });

    // Both should work with the same shared type
    expect(
      v.safeParse(validatorsA.main, { shared: { id: "123" } }).success,
    ).toBe(true);
    expect(
      v.safeParse(validatorsB.main, { shared: { id: "456" } }).success,
    ).toBe(true);

    // Invalid shared type should fail for both
    expect(v.safeParse(validatorsA.main, { shared: {} }).success).toBe(false);
    expect(v.safeParse(validatorsB.main, { shared: {} }).success).toBe(false);
  });

  it("works with union refs across lexicons", () => {
    const textContent = {
      lexicon: 1,
      id: "com.example.textContent",
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

    const imageContent = {
      lexicon: 1,
      id: "com.example.imageContent",
      defs: {
        main: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
          },
        },
      },
    } as const;

    const postLexicon = {
      lexicon: 1,
      id: "com.example.post",
      defs: {
        main: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "union",
              refs: ["com.example.textContent", "com.example.imageContent"],
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(textContent, imageContent, postLexicon);
    const postValidators = lexiconToValibot(postLexicon, { lookup });

    expect(
      v.safeParse(postValidators.main, {
        content: { text: "Hello" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(postValidators.main, {
        content: { url: "https://example.com/img.jpg" },
      }).success,
    ).toBe(true);

    expect(
      v.safeParse(postValidators.main, {
        content: { other: "field" },
      }).success,
    ).toBe(false);
  });
});
