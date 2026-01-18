import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import {
  createLookup,
  type InferLexiconOutput,
  lexiconToValibot,
  xrpcToValibot,
} from "../src/index.js";

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

describe("Cross-lexicon type inference with createLookup", () => {
  it("infers cross-lexicon refs with lookup", () => {
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
    const post = lexiconToValibot(postLexicon, { lookup });

    type PostOutput = v.InferOutput<typeof post.main>;

    // Author should be properly typed, not unknown
    expectTypeOf<PostOutput>().toMatchTypeOf<{
      text: string;
      author: { name: string; bio?: string };
    }>();
  });

  it("infers cross-lexicon refs with def name", () => {
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
    const item = lexiconToValibot(itemLexicon, { lookup });

    type ItemOutput = v.InferOutput<typeof item.main>;

    expectTypeOf<ItemOutput>().toMatchTypeOf<{
      name: string;
      tags: Array<{ label: string; color?: string }>;
    }>();
  });

  it("infers union refs across lexicons", () => {
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
            url: { type: "string" },
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
    const post = lexiconToValibot(postLexicon, { lookup });

    type PostOutput = v.InferOutput<typeof post.main>;

    expectTypeOf<PostOutput>().toMatchTypeOf<{
      content: { text: string } | { url: string };
    }>();
  });

  it("infers xrpc cross-lexicon refs in output", () => {
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
    const getAuthor = xrpcToValibot(getAuthorLexicon, { lookup });

    type OutputType = v.InferOutput<typeof getAuthor.main.output>;

    expectTypeOf<OutputType>().toMatchTypeOf<{
      name: string;
      bio?: string;
    }>();
  });

  it("infers xrpc cross-lexicon refs in procedure input/output", () => {
    const postLexicon = {
      lexicon: 1,
      id: "com.example.post",
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

    const responseLexicon = {
      lexicon: 1,
      id: "com.example.response",
      defs: {
        main: {
          type: "object",
          required: ["uri"],
          properties: {
            uri: { type: "string" },
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
              ref: "com.example.response",
            },
          },
        },
      },
    } as const;

    const lookup = createLookup(postLexicon, responseLexicon, createPostLexicon);
    const createPost = xrpcToValibot(createPostLexicon, { lookup });

    type InputType = v.InferOutput<typeof createPost.main.input>;
    type OutputType = v.InferOutput<typeof createPost.main.output>;

    expectTypeOf<InputType>().toMatchTypeOf<{ text: string }>();
    expectTypeOf<OutputType>().toMatchTypeOf<{ uri: string }>();
  });
});
