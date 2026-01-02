import type * as v from "valibot";

export type {
  LexiconDoc,
  LexUserType,
  LexBoolean,
  LexInteger,
  LexString,
  LexUnknown,
  LexPrimitive,
  LexBytes,
  LexCidLink,
  LexBlob,
  LexArray,
  LexToken,
  LexObject,
  LexRef,
  LexRefUnion,
  LexRefVariant,
  LexRecord,
  LexXrpcQuery,
  LexXrpcProcedure,
  LexXrpcSubscription,
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
