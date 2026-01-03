import type { BlobRef as AtprotoBlobRef } from "@atproto/lexicon";
import type * as v from "valibot";

// Type-level Lexicon to Valibot type inference
// This maps Lexicon schema definitions to their inferred output types

// Utility to flatten intersection types into a clean object
type Prettify<T> = { [K in keyof T]: T[K] } & {};

// Blob format type for inference
export type BlobFormat = 'sdk' | 'wire';

// Wire format blob types (what gets sent to/from PDS in JSON)
type WireBlobRef = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

type UntypedBlobRef = {
  cid: string;
  mimeType: string;
};

// SDK format uses the actual BlobRef class from @atproto/lexicon
type SdkBlobRef = AtprotoBlobRef | UntypedBlobRef;

// Wire format is the JSON representation
type WireBlobRefUnion = WireBlobRef | UntypedBlobRef;

// Format-aware blob ref type
type InferBlobRef<Format extends BlobFormat> = Format extends 'sdk' ? SdkBlobRef : WireBlobRefUnion;

type CidLink = { $link: string };

// External refs map type - maps ref strings to their inferred output types
type ExternalRefsMap = Record<string, unknown>;

// Infer the output type from a Lexicon type definition
// Defs = local defs from this lexicon
// ExtRefs = external refs map (string -> inferred type)
// Format = 'sdk' | 'wire' for blob type inference
export type InferLexType<T, Defs = {}, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends { type: "boolean" }
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
  ? InferBlobRef<Format>
  : T extends { type: "cid-link" }
  ? CidLink
  : T extends { type: "token" }
  ? string
  : T extends { type: "array"; items: infer Items }
  ? InferLexType<Items, Defs, ExtRefs, Format>[]
  : T extends { type: "object"; properties?: infer Props }
  ? InferLexObject<Props, T, Defs, ExtRefs, Format>
  : T extends { type: "ref"; ref: infer R extends string }
  ? InferLexRef<R, Defs, ExtRefs, Format>
  : T extends { type: "union"; refs: infer Refs extends readonly string[] }
  ? InferLexUnion<Refs, Defs, ExtRefs, Format>
  : T extends { type: "record"; record: infer Rec }
  ? InferLexType<Rec, Defs, ExtRefs, Format>
  : unknown;

// Infer object properties with required/nullable handling
type InferLexObject<
  Props,
  Schema,
  Defs,
  ExtRefs extends ExternalRefsMap = {},
  Format extends BlobFormat = 'sdk'
> = Props extends Record<string, unknown>
  ? Prettify<
    {
      // Required non-nullable properties
      [K in keyof Props as K extends RequiredKeys<Schema>
      ? K extends NullableKeys<Schema>
      ? never
      : K
      : never]: InferLexType<Props[K], Defs, ExtRefs, Format>;
    } & {
      // Required nullable properties
      [K in keyof Props as K extends RequiredKeys<Schema>
      ? K extends NullableKeys<Schema>
      ? K
      : never
      : never]: InferLexType<Props[K], Defs, ExtRefs, Format> | null;
    } & {
      // Optional non-nullable properties
      [K in keyof Props as K extends RequiredKeys<Schema>
      ? never
      : K extends NullableKeys<Schema>
      ? never
      : K]?: InferLexType<Props[K], Defs, ExtRefs, Format>;
    } & {
      // Optional nullable properties
      [K in keyof Props as K extends RequiredKeys<Schema>
      ? never
      : K extends NullableKeys<Schema>
      ? K
      : never]?: InferLexType<Props[K], Defs, ExtRefs, Format> | null;
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

// Resolve a ref - local (#name) or external (com.example.type)
type InferLexRef<R extends string, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> =
  // Local ref: #defName
  R extends `#${infer DefName}`
  ? DefName extends keyof Defs
  ? InferLexType<Defs[DefName], Defs, ExtRefs, Format>
  : unknown
  // External ref: check ExtRefs with both original and #main variants
  : R extends keyof ExtRefs
  ? ExtRefs[R]
  : `${R}#main` extends keyof ExtRefs
  ? ExtRefs[`${R}#main`]
  : unknown;

// Resolve union of refs
type InferLexUnion<Refs extends readonly string[], Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = Refs extends readonly [
  infer First extends string,
  ...infer Rest extends readonly string[]
]
  ? InferLexRef<First, Defs, ExtRefs, Format> | InferLexUnion<Rest, Defs, ExtRefs, Format>
  : never;

// XRPC params inference
type InferLexParams<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends {
  type: "params";
  properties?: infer Props;
  required?: infer R extends readonly string[];
}
  ? Props extends Record<string, unknown>
  ? Prettify<
    {
      [K in keyof Props as K extends R[number] ? K : never]: InferLexType<Props[K], Defs, ExtRefs, Format>;
    } & {
      [K in keyof Props as K extends R[number] ? never : K]?: InferLexType<Props[K], Defs, ExtRefs, Format>;
    }
  >
  : {}
  : {};

// XRPC body (input/output/message) inference
type InferLexBody<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends { schema: infer S }
  ? InferLexType<S, Defs, ExtRefs, Format>
  : unknown;

// XRPC Query validators type
type InferQueryValidators<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends { type: "query" }
  ? {
    parameters: v.GenericSchema<InferLexParams<T extends { parameters: infer P } ? P : never, Defs, ExtRefs, Format>>;
    output: v.GenericSchema<InferLexBody<T extends { output: infer O } ? O : never, Defs, ExtRefs, Format>>;
  }
  : never;

// XRPC Procedure validators type
type InferProcedureValidators<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends { type: "procedure" }
  ? {
    parameters: v.GenericSchema<InferLexParams<T extends { parameters: infer P } ? P : never, Defs, ExtRefs, Format>>;
    input: v.GenericSchema<InferLexBody<T extends { input: infer I } ? I : never, Defs, ExtRefs, Format>>;
    output: v.GenericSchema<InferLexBody<T extends { output: infer O } ? O : never, Defs, ExtRefs, Format>>;
  }
  : never;

// XRPC Subscription validators type
type InferSubscriptionValidators<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends { type: "subscription" }
  ? {
    parameters: v.GenericSchema<InferLexParams<T extends { parameters: infer P } ? P : never, Defs, ExtRefs, Format>>;
    message: v.GenericSchema<InferLexBody<T extends { message: infer M } ? M : never, Defs, ExtRefs, Format>>;
  }
  : never;

// Check if a def is an XRPC type
type IsXrpcType<T> = T extends { type: "query" | "procedure" | "subscription" } ? true : false;

// Infer schema for non-XRPC def
type InferSchemaValidator<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> =
  v.GenericSchema<InferLexType<T, Defs, ExtRefs, Format>>;

// Infer validators for XRPC def
type InferXrpcValidator<T, Defs, ExtRefs extends ExternalRefsMap = {}, Format extends BlobFormat = 'sdk'> = T extends { type: "query" }
  ? InferQueryValidators<T, Defs, ExtRefs, Format>
  : T extends { type: "procedure" }
  ? InferProcedureValidators<T, Defs, ExtRefs, Format>
  : T extends { type: "subscription" }
  ? InferSubscriptionValidators<T, Defs, ExtRefs, Format>
  : never;

// Main type for inferring schema validators from a LexiconDoc (excludes XRPC)
export type InferLexiconValidators<
  T extends { defs: Record<string, unknown> },
  ExtRefs extends ExternalRefsMap = {},
  Format extends BlobFormat = 'sdk'
> = {
    [K in keyof T["defs"]as IsXrpcType<T["defs"][K]> extends true ? never : K]: InferSchemaValidator<T["defs"][K], T["defs"], ExtRefs, Format>;
  };

// Type for inferring XRPC validators from a LexiconDoc (only XRPC types)
export type InferXrpcValidators<
  T extends { defs: Record<string, unknown> },
  ExtRefs extends ExternalRefsMap = {},
  Format extends BlobFormat = 'sdk'
> = {
    [K in keyof T["defs"]as IsXrpcType<T["defs"][K]> extends true ? K : never]: InferXrpcValidator<T["defs"][K], T["defs"], ExtRefs, Format>;
  };

// Helper to get the output type from a lexicon's def
export type InferLexiconOutput<
  T extends { defs: Record<string, unknown> },
  K extends keyof T["defs"],
  ExtRefs extends ExternalRefsMap = {},
  Format extends BlobFormat = 'sdk'
> = InferLexType<T["defs"][K], T["defs"], ExtRefs, Format>;
