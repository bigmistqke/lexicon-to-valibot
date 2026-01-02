import type * as v from "valibot";

// Type-level Lexicon to Valibot type inference
// This maps Lexicon schema definitions to their inferred output types

// Utility to flatten intersection types into a clean object
type Prettify<T> = { [K in keyof T]: T[K] } & {};

// Blob reference types
type TypedBlobRef = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

type UntypedBlobRef = {
  cid: string;
  mimeType: string;
};

type BlobRef = TypedBlobRef | UntypedBlobRef;

type CidLink = { $link: string };

// Infer the output type from a Lexicon type definition
export type InferLexType<T, Defs = {}> = T extends { type: "boolean" }
  ? T extends { const: infer C extends boolean }
    ? C
    : boolean
  : T extends { type: "integer" }
    ? T extends { const: infer C extends number }
      ? C
      : T extends { enum: infer E extends readonly number[] }
        ? E[number]
        : number
    : T extends { type: "string" }
      ? T extends { const: infer C extends string }
        ? C
        : T extends { enum: infer E extends readonly string[] }
          ? E[number]
          : string
      : T extends { type: "unknown" }
        ? unknown
        : T extends { type: "bytes" }
          ? Uint8Array
          : T extends { type: "blob" }
            ? BlobRef
            : T extends { type: "cid-link" }
              ? CidLink
              : T extends { type: "token" }
                ? string
                : T extends { type: "array"; items: infer Items }
                  ? InferLexType<Items, Defs>[]
                  : T extends { type: "object"; properties?: infer Props }
                    ? InferLexObject<Props, T, Defs>
                    : T extends { type: "ref"; ref: infer R extends string }
                      ? InferLexRef<R, Defs>
                      : T extends { type: "union"; refs: infer Refs extends readonly string[] }
                        ? InferLexUnion<Refs, Defs>
                        : T extends { type: "record"; record: infer Rec }
                          ? InferLexType<Rec, Defs>
                          : unknown;

// Infer object properties with required/nullable handling
type InferLexObject<
  Props,
  Schema,
  Defs
> = Props extends Record<string, unknown>
  ? Prettify<
      {
        // Required non-nullable properties
        [K in keyof Props as K extends RequiredKeys<Schema>
          ? K extends NullableKeys<Schema>
            ? never
            : K
          : never]: InferLexType<Props[K], Defs>;
      } & {
        // Required nullable properties
        [K in keyof Props as K extends RequiredKeys<Schema>
          ? K extends NullableKeys<Schema>
            ? K
            : never
          : never]: InferLexType<Props[K], Defs> | null;
      } & {
        // Optional non-nullable properties
        [K in keyof Props as K extends RequiredKeys<Schema>
          ? never
          : K extends NullableKeys<Schema>
            ? never
            : K]?: InferLexType<Props[K], Defs>;
      } & {
        // Optional nullable properties
        [K in keyof Props as K extends RequiredKeys<Schema>
          ? never
          : K extends NullableKeys<Schema>
            ? K
            : never]?: InferLexType<Props[K], Defs> | null;
      }
    >
  : {};

// Extract required keys from schema
type RequiredKeys<T> = T extends { required: infer R extends readonly string[] }
  ? R[number]
  : never;

// Extract nullable keys from schema
type NullableKeys<T> = T extends { nullable: infer N extends readonly string[] }
  ? N[number]
  : never;

// Resolve a local ref (e.g., "#author" -> look up in Defs)
type InferLexRef<R extends string, Defs> = R extends `#${infer DefName}`
  ? DefName extends keyof Defs
    ? InferLexType<Defs[DefName], Defs>
    : unknown
  : unknown;

// Resolve union of refs
type InferLexUnion<Refs extends readonly string[], Defs> = Refs extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[]
]
  ? InferLexRef<First, Defs> | InferLexUnion<Rest, Defs>
  : never;

// XRPC params inference
type InferLexParams<T, Defs> = T extends {
  type: "params";
  properties?: infer Props;
  required?: infer R extends readonly string[];
}
  ? Props extends Record<string, unknown>
    ? Prettify<
        {
          [K in keyof Props as K extends R[number] ? K : never]: InferLexType<Props[K], Defs>;
        } & {
          [K in keyof Props as K extends R[number] ? never : K]?: InferLexType<Props[K], Defs>;
        }
      >
    : {}
  : {};

// XRPC body (input/output/message) inference
type InferLexBody<T, Defs> = T extends { schema: infer S }
  ? InferLexType<S, Defs>
  : unknown;

// XRPC Query validators type
type InferQueryValidators<T, Defs> = T extends { type: "query" }
  ? {
      parameters: v.GenericSchema<InferLexParams<T extends { parameters: infer P } ? P : never, Defs>>;
      output: v.GenericSchema<InferLexBody<T extends { output: infer O } ? O : never, Defs>>;
    }
  : never;

// XRPC Procedure validators type
type InferProcedureValidators<T, Defs> = T extends { type: "procedure" }
  ? {
      parameters: v.GenericSchema<InferLexParams<T extends { parameters: infer P } ? P : never, Defs>>;
      input: v.GenericSchema<InferLexBody<T extends { input: infer I } ? I : never, Defs>>;
      output: v.GenericSchema<InferLexBody<T extends { output: infer O } ? O : never, Defs>>;
    }
  : never;

// XRPC Subscription validators type
type InferSubscriptionValidators<T, Defs> = T extends { type: "subscription" }
  ? {
      parameters: v.GenericSchema<InferLexParams<T extends { parameters: infer P } ? P : never, Defs>>;
      message: v.GenericSchema<InferLexBody<T extends { message: infer M } ? M : never, Defs>>;
    }
  : never;

// Infer the validator(s) for a def - XRPC types return objects, others return schemas
type InferDefValidator<T, Defs> = T extends { type: "query" }
  ? InferQueryValidators<T, Defs>
  : T extends { type: "procedure" }
    ? InferProcedureValidators<T, Defs>
    : T extends { type: "subscription" }
      ? InferSubscriptionValidators<T, Defs>
      : v.GenericSchema<InferLexType<T, Defs>>;

// Main type for inferring all validators from a LexiconDoc
export type InferLexiconValidators<T extends { defs: Record<string, unknown> }> = {
  [K in keyof T["defs"]]: InferDefValidator<T["defs"][K], T["defs"]>;
};

// Helper to get the output type from a lexicon's def
export type InferLexiconOutput<
  T extends { defs: Record<string, unknown> },
  K extends keyof T["defs"]
> = InferLexType<T["defs"][K], T["defs"]>;
