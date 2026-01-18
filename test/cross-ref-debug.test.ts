import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { createLookup, lexiconToValibot } from "../src/index.js";
import type { BuildExtRefs } from "../src/types.js";

describe("BuildExtRefs debug", () => {
  it("builds correct keys for cross-lexicon refs", () => {
    const projectLexicon = {
      lexicon: 1,
      id: "app.eddy.project",
      defs: {
        staticValue: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "integer" },
          },
        },
      },
    } as const;

    const audioEffectLexicon = {
      lexicon: 1,
      id: "app.eddy.audioEffect",
      defs: {
        gain: {
          type: "object",
          required: ["type", "params"],
          properties: {
            type: { type: "string", const: "audio.gain" },
            enabled: { type: "ref", ref: "app.eddy.project#staticValue" },
          },
        },
      },
    } as const;

    type Lexicons = readonly [typeof projectLexicon, typeof audioEffectLexicon];
    type ExtRefs = BuildExtRefs<Lexicons, "sdk">;

    // Check if the key exists - this should be { value: number }, not unknown
    type StaticValueType = ExtRefs["app.eddy.project#staticValue"];

    expectTypeOf<StaticValueType>().toMatchTypeOf<{ value: number }>();
  });

  it("handles circular refs between lexicons", () => {
    const projectLexicon = {
      lexicon: 1,
      id: "app.eddy.project",
      defs: {
        staticValue: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "integer" },
          },
        },
        track: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            // Circular: project refs audioEffect
            audioPipeline: {
              type: "array",
              items: {
                type: "union",
                refs: ["app.eddy.audioEffect#gain"],
              },
            },
          },
        },
      },
    } as const;

    const audioEffectLexicon = {
      lexicon: 1,
      id: "app.eddy.audioEffect",
      defs: {
        "gain.params": {
          type: "object",
          required: ["value"],
          properties: {
            // Circular: audioEffect refs project
            value: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
          },
        },
        gain: {
          type: "object",
          required: ["type", "params"],
          properties: {
            type: { type: "string", const: "audio.gain" },
            enabled: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
            params: { type: "ref", ref: "#gain.params" },
          },
        },
      },
    } as const;

    const lookup = createLookup(projectLexicon, audioEffectLexicon);
    const audioEffectValidators = lexiconToValibot(audioEffectLexicon, { lookup });

    type GainOutput = v.InferOutput<typeof audioEffectValidators.gain>;
    type GainParamsOutput = v.InferOutput<
      typeof audioEffectValidators["gain.params"]
    >;

    // enabled should be { value: number }, not unknown
    expectTypeOf<GainOutput>().toMatchTypeOf<{
      type: "audio.gain";
      enabled?: { value: number };
      params: { value: { value: number } };
    }>();

    expectTypeOf<GainParamsOutput>().toMatchTypeOf<{
      value: { value: number };
    }>();
  });

  it("handles 5 lexicons with complex circular refs (eddy-like)", () => {
    const projectLexicon = {
      lexicon: 1,
      id: "app.eddy.project",
      defs: {
        staticValue: {
          type: "object",
          required: ["value"],
          properties: {
            value: { type: "integer" },
            min: { type: "integer" },
            max: { type: "integer" },
          },
        },
        track: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            audioPipeline: {
              type: "array",
              items: {
                type: "union",
                refs: [
                  "app.eddy.audioEffect#pan",
                  "app.eddy.audioEffect#gain",
                ],
              },
            },
            videoPipeline: {
              type: "array",
              items: {
                type: "union",
                refs: [
                  "app.eddy.visualEffect#transform",
                  "app.eddy.visualEffect#opacity",
                ],
              },
            },
          },
        },
      },
    } as const;

    const audioEffectLexicon = {
      lexicon: 1,
      id: "app.eddy.audioEffect",
      defs: {
        "pan.params": {
          type: "object",
          required: ["value"],
          properties: {
            value: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
          },
        },
        pan: {
          type: "object",
          required: ["type", "params"],
          properties: {
            type: { type: "string", const: "audio.pan" },
            enabled: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
            params: { type: "ref", ref: "#pan.params" },
          },
        },
        "gain.params": {
          type: "object",
          required: ["value"],
          properties: {
            value: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
          },
        },
        gain: {
          type: "object",
          required: ["type", "params"],
          properties: {
            type: { type: "string", const: "audio.gain" },
            enabled: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
            params: { type: "ref", ref: "#gain.params" },
          },
        },
      },
    } as const;

    const visualEffectLexicon = {
      lexicon: 1,
      id: "app.eddy.visualEffect",
      defs: {
        "transform.params": {
          type: "object",
          properties: {
            x: { type: "union", refs: ["app.eddy.project#staticValue"] },
            y: { type: "union", refs: ["app.eddy.project#staticValue"] },
          },
        },
        transform: {
          type: "object",
          required: ["type", "params"],
          properties: {
            type: { type: "string", const: "visual.transform" },
            enabled: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
            params: { type: "ref", ref: "#transform.params" },
          },
        },
        "opacity.params": {
          type: "object",
          required: ["value"],
          properties: {
            value: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
          },
        },
        opacity: {
          type: "object",
          required: ["type", "params"],
          properties: {
            type: { type: "string", const: "visual.opacity" },
            enabled: {
              type: "union",
              refs: ["app.eddy.project#staticValue"],
            },
            params: { type: "ref", ref: "#opacity.params" },
          },
        },
      },
    } as const;

    const stemLexicon = {
      lexicon: 1,
      id: "app.eddy.stem",
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

    const strongRefLexicon = {
      lexicon: 1,
      id: "com.atproto.repo.strongRef",
      defs: {
        main: {
          type: "object",
          required: ["uri", "cid"],
          properties: {
            uri: { type: "string" },
            cid: { type: "string" },
          },
        },
      },
    } as const;

    const lookup = createLookup(
      projectLexicon,
      audioEffectLexicon,
      visualEffectLexicon,
      stemLexicon,
      strongRefLexicon,
    );

    const projectValidators = lexiconToValibot(projectLexicon, { lookup });
    const audioEffectValidators = lexiconToValibot(audioEffectLexicon, { lookup });
    const visualEffectValidators = lexiconToValibot(visualEffectLexicon, { lookup });

    type Track = v.InferOutput<typeof projectValidators.track>;
    type AudioPan = v.InferOutput<typeof audioEffectValidators.pan>;
    type VisualTransform = v.InferOutput<typeof visualEffectValidators.transform>;

    // These should NOT be unknown
    expectTypeOf<AudioPan["enabled"]>().toMatchTypeOf<
      { value: number; min?: number; max?: number } | undefined
    >();

    expectTypeOf<AudioPan["params"]["value"]>().toMatchTypeOf<{
      value: number;
      min?: number;
      max?: number;
    }>();

    expectTypeOf<VisualTransform["enabled"]>().toMatchTypeOf<
      { value: number; min?: number; max?: number } | undefined
    >();

    // Track's audioPipeline should have properly typed effects
    type AudioEffect = NonNullable<Track["audioPipeline"]>[number];
    expectTypeOf<AudioEffect>().toMatchTypeOf<
      | { type: "audio.pan"; params: { value: { value: number } } }
      | { type: "audio.gain"; params: { value: { value: number } } }
    >();
  });
});
