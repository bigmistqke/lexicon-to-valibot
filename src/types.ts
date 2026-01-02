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
export type Mutable<T> = T extends object
  ? T extends readonly (infer U)[]
  ? Mutable<U>[]
  : { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;