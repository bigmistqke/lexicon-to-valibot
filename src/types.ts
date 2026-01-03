import type * as v from "valibot";

export type {
  LexArray,
  LexBlob,
  LexBoolean,
  LexBytes,
  LexCidLink, LexiconDoc, LexInteger, LexObject,
  LexPrimitive,
  LexRecord,
  LexRef,
  LexRefUnion,
  LexRefVariant,
  LexString,
  LexToken,
  LexUnknown,
  LexUserType,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription
} from "@atproto/lexicon";

export type RefResolver = (ref: string) => v.GenericSchema;

/** Format for blob validation */
export type BlobFormat = 'sdk' | 'wire';

export interface ConverterContext {
  lexiconId: string;
  defs: Record<string, unknown>;
  resolveRef: RefResolver;
  /** Format for blob validation: 'sdk' for parsing fetched records, 'wire' for outgoing */
  blobFormat: BlobFormat;
}

// Utility to strip readonly for SolidJS store compatibility
// Preserves tuple structure and literal types (important for lexicon refs)
export type Mutable<T> = T extends object
  ? T extends readonly any[]
    ? MutableArray<T>
    : { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;

// Helper: preserve tuples (literal length), convert regular arrays (number length)
type MutableArray<T extends readonly any[]> =
  number extends T["length"]
    ? T extends readonly (infer U)[] ? Mutable<U>[] : never
    : { -readonly [K in keyof T]: Mutable<T[K]> };