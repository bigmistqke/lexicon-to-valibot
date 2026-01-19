import {
  LexUserType,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
} from "@atproto/lexicon";
import * as v from "valibot";
import { convertType } from "./converters/convert-type.ts";
import {
  convertProcedure,
  convertQuery,
  convertSubscription,
  ProcedureValidators,
  QueryValidators,
  SubscriptionValidators,
} from "./converters/xrpc.ts";
import { LexiconFormat, Lookup } from "./lexicon.ts";
import { isXrpcDef, makeRefResolver } from "./shared.ts";
import {
  BlobFormat,
  ConverterContext,
  InferXrpcValidators,
  LexiconInput,
  LexiconMap,
  Mutable,
} from "./types.ts";

type XrpcResult =
  | QueryValidators
  | ProcedureValidators
  | SubscriptionValidators;

// Convert XRPC def - returns validators object
function convertXrpcDef(schema: unknown, ctx: ConverterContext): XrpcResult {
  if (typeof schema !== "object" || schema === null) {
    throw new Error(`Invalid schema: expected object, got ${typeof schema}`);
  }

  const schemaObj = schema as { type?: string };

  switch (schemaObj.type) {
    case "query":
      return convertQuery(schema as LexXrpcQuery, ctx, convertType);
    case "procedure":
      return convertProcedure(schema as LexXrpcProcedure, ctx, convertType);
    case "subscription":
      return convertSubscription(
        schema as LexXrpcSubscription,
        ctx,
        convertType,
      );
    default:
      throw new Error(`Not an XRPC type: ${schemaObj.type}`);
  }
}

/**
 * Options for xrpcToValibot
 */
export interface XrpcToValibotOptions<
  Lexicons extends readonly LexiconInput[] = readonly LexiconInput[],
> {
  /** Lookup for resolving cross-lexicon references */
  lookup?: Lookup<Lexicons>;
  /** Format for blob validation: 'sdk' for parsing fetched records, 'wire' for outgoing. Default: 'sdk' */
  format?: LexiconFormat;
}

/**
 * Convert a lexicon to valibot validators for XRPC endpoints.
 * Only handles query, procedure, and subscription types.
 * Use `lookup` option for cross-lexicon reference resolution.
 *
 * @example
 * ```ts
 * const lookup = createLookup(strongRef, postLexicon)
 * const timeline = xrpcToValibot(timelineLexicon, { lookup })
 *
 * // Access validators
 * timeline.main.params
 * timeline.main.output
 * ```
 */
export function xrpcToValibot<
  T extends Mutable<LexiconInput>,
  Lexicons extends readonly LexiconInput[] = readonly LexiconInput[],
  Format extends BlobFormat = "sdk",
>(
  lexicon: T,
  options: XrpcToValibotOptions<Lexicons> = {},
): InferXrpcValidators<Mutable<T>, LexiconMap<Lexicons>, Format> {
  const blobFormat = (options.format ?? "sdk") as LexiconFormat;
  const defs = lexicon.defs as Record<string, LexUserType>;

  // Use lookup's cache and lexicon map, or create local ones
  const cache =
    options.lookup?._caches[blobFormat] ?? new Map<string, v.GenericSchema>();
  const lexiconMap = options.lookup?._lexiconMap ?? new Map();

  // Ensure current lexicon is in the map for local ref resolution
  if (!lexiconMap.has(lexicon.id)) {
    lexiconMap.set(lexicon.id, { id: lexicon.id, defs });
  }

  // Create resolver config
  const resolveRef = makeRefResolver(lexicon.id, {
    lookupDef(lexiconId, defName) {
      const lex = lexiconMap.get(lexiconId);
      if (!lex) return null;
      const def = lex.defs[defName];
      if (!def) return null;
      return { defs: lex.defs, def };
    },
    cache,
    blobFormat,
  });

  const ctx: ConverterContext = {
    lexiconId: lexicon.id,
    defs: lexicon.defs,
    resolveRef,
    blobFormat,
  };

  const result: Record<string, XrpcResult> = {};

  for (const [defName, def] of Object.entries(lexicon.defs)) {
    // Only handle XRPC types
    if (!isXrpcDef(def)) continue;
    result[defName] = convertXrpcDef(def, ctx);
  }

  return result as InferXrpcValidators<
    Mutable<T>,
    LexiconMap<Lexicons>,
    Format
  >;
}
