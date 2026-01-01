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

export interface ConverterContext {
  lexiconId: string;
  defs: Record<string, unknown>;
  resolveRef: RefResolver;
}
