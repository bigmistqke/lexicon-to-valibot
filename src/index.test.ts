import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { lexiconToValibot, type LexiconInput } from "./index.js";

describe("lexiconToValibot", () => {
  it("converts a simple record lexicon", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(v.safeParse(validators.main, { text: "Hello" }).success).toBe(true);
    expect(v.safeParse(validators.main, { text: "Hello", count: 5 }).success).toBe(true);
    expect(v.safeParse(validators.main, {}).success).toBe(false);
    expect(v.safeParse(validators.main, { text: "a".repeat(301) }).success).toBe(false);
    expect(v.safeParse(validators.main, { text: "Hi", count: -1 }).success).toBe(false);
  });

  it("converts multiple defs", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(v.safeParse(validators.main, { name: "Test" }).success).toBe(true);
    expect(v.safeParse(validators.secondary, { value: 42 }).success).toBe(true);
    expect(v.safeParse(validators.main, { value: 42 }).success).toBe(false);
    expect(v.safeParse(validators.secondary, { name: "Test" }).success).toBe(false);
  });

  it("handles local refs between defs", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        author: { name: "John Doe" },
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        author: { name: "Jane", bio: "Developer" },
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        author: {},
      }).success
    ).toBe(false);
  });

  it("handles arrays of objects", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        items: [{ id: "1" }, { id: "2", label: "Second" }],
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        items: [],
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        items: [{}],
      }).success
    ).toBe(false);

    // Too many items
    expect(
      v.safeParse(validators.main, {
        items: Array(11).fill({ id: "x" }),
      }).success
    ).toBe(false);
  });

  it("handles union types", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        content: { text: "Hello" },
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        content: { url: "https://example.com/image.jpg" },
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        content: { other: "field" },
      }).success
    ).toBe(false);
  });

  it("handles blob types", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        avatar: {
          $type: "blob",
          ref: { $link: "bafkreiexample" },
          mimeType: "image/png",
          size: 5000,
        },
      }).success
    ).toBe(true);

    expect(v.safeParse(validators.main, {}).success).toBe(true);
  });

  it("handles nullable and optional properties", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    // All fields provided
    expect(
      v.safeParse(validators.main, {
        requiredField: "value",
        optionalField: "value",
        nullableRequired: "value",
        nullableOptional: "value",
      }).success
    ).toBe(true);

    // Only required fields
    expect(
      v.safeParse(validators.main, {
        requiredField: "value",
        nullableRequired: "value",
      }).success
    ).toBe(true);

    // Nullable fields can be null
    expect(
      v.safeParse(validators.main, {
        requiredField: "value",
        nullableRequired: null,
        nullableOptional: null,
      }).success
    ).toBe(true);

    // Missing required field
    expect(
      v.safeParse(validators.main, {
        nullableRequired: "value",
      }).success
    ).toBe(false);

    // Non-nullable field cannot be null
    expect(
      v.safeParse(validators.main, {
        requiredField: null,
        nullableRequired: "value",
      }).success
    ).toBe(false);
  });

  it("handles string formats", () => {
    const lexicon: LexiconInput = {
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
    };

    const validators = lexiconToValibot(lexicon);

    expect(
      v.safeParse(validators.main, {
        createdAt: "2024-01-01T12:00:00Z",
        did: "did:plc:abc123",
        handle: "user.bsky.social",
      }).success
    ).toBe(true);

    expect(
      v.safeParse(validators.main, {
        createdAt: "not-a-date",
        did: "did:plc:abc123",
        handle: "user.bsky.social",
      }).success
    ).toBe(false);
  });
});
