import * as v from "valibot";
import { convertType } from "./converters/convert-type.js";
import {
  convertProcedure,
  convertQuery,
  convertSubscription,
  type ProcedureValidators,
  type QueryValidators,
  type SubscriptionValidators,
} from "./converters/xrpc.js";
import type {
  BlobFormat,
  BuildExtRefs,
  ConverterContext,
  InferLexiconValidators,
  InferXrpcValidators,
  LexiconInput,
  LexUserType,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription,
  Mutable,
} from "./types.js";

/**
 * Result of looking up a def in a lexicon
 */
export interface DefLookupResult {
  defs: Record<string, LexUserType>;
  def: LexUserType;
}

/**
 * Configuration for the ref resolver
 */
export interface RefResolverConfig {
  /** Function to look up a def by lexicon ID and def name */
  lookupDef: (lexiconId: string, defName: string) => DefLookupResult | null;
  /** Cache for resolved schemas */
  cache: Map<string, v.GenericSchema>;
  /** Format for blob validation */
  blobFormat: LexiconFormat;
}

export type LexiconFormat = "sdk" | "wire";

type XrpcResult =
  | QueryValidators
  | ProcedureValidators
  | SubscriptionValidators;

/** Symbol for phantom type to preserve lexicon types */
const LexiconsType = Symbol("LexiconsType");

/**
 * A lookup object that holds lexicons for cross-reference resolution and caches results.
 * The generic parameter preserves type information about the lexicons for proper type inference.
 */
export interface Lookup<
  Lexicons extends readonly LexiconInput[] = readonly LexiconInput[],
> {
  /** @internal */
  _lexiconMap: Map<string, { id: string; defs: Record<string, LexUserType> }>;
  /** @internal - cache keyed by format */
  _caches: {
    sdk: Map<string, v.GenericSchema>;
    wire: Map<string, v.GenericSchema>;
  };
  /** @internal - phantom type to preserve lexicon types */
  [LexiconsType]?: Lexicons;
}

/**
 * Create a lookup for resolving cross-lexicon references.
 * The lookup caches converted schemas for reuse and preserves type information.
 *
 * @example
 * ```ts
 * const lookup = createLookup(strongRef, postLexicon, likeLexicon)
 *
 * const post = lexiconToValibot(postLexicon, { lookup })
 * const like = lexiconToValibot(likeLexicon, { lookup })
 * ```
 */
export function createLookup<const Lexicons extends readonly LexiconInput[]>(
  ...lexicons: Lexicons
): Lookup<Lexicons> {
  const lexiconMap = new Map<
    string,
    { id: string; defs: Record<string, LexUserType> }
  >();

  for (const lexicon of lexicons) {
    lexiconMap.set(lexicon.id, {
      id: lexicon.id,
      defs: lexicon.defs as Record<string, LexUserType>,
    });
  }

  return {
    _lexiconMap: lexiconMap,
    _caches: {
      sdk: new Map<string, v.GenericSchema>(),
      wire: new Map<string, v.GenericSchema>(),
    },
  };
}

/**
 * Options for lexiconToValibot
 */
export interface LexiconToValibotOptions<
  Lexicons extends readonly LexiconInput[] = readonly LexiconInput[],
> {
  /** Lookup for resolving cross-lexicon references */
  lookup?: Lookup<Lexicons>;
  /** Format for blob validation: 'sdk' for parsing fetched records, 'wire' for outgoing. Default: 'sdk' */
  format?: LexiconFormat;
}

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

// Check if a def is an XRPC type
export function isXrpcDef(schema: unknown): boolean {
  if (typeof schema !== "object" || schema === null) return false;
  const type = (schema as { type?: string }).type;
  return type === "query" || type === "procedure" || type === "subscription";
}

// Check if a def is a record type
export function isRecordDef(schema: unknown): boolean {
  if (typeof schema !== "object" || schema === null) return false;
  return (schema as { type?: string }).type === "record";
}

/**
 * Create a ref resolver with a configurable lookup strategy.
 * This allows both single-lexicon and bundle-wide resolution.
 */
export function createRefResolver(
  currentLexiconId: string,
  config: RefResolverConfig,
): (ref: string) => v.GenericSchema {
  const { lookupDef, cache, blobFormat } = config;

  return (ref: string): v.GenericSchema => {
    // Parse the ref - could be:
    // - "#defName" (local ref)
    // - "com.example.lexicon#defName" (external ref)
    // - "com.example.lexicon" (main def of external lexicon)

    let resolvedRef = ref;
    let targetLexiconId = currentLexiconId;
    let defName = "";

    if (ref.startsWith("#")) {
      // Local ref
      resolvedRef = `${currentLexiconId}${ref}`;
      defName = ref.slice(1);
    } else if (ref.includes("#")) {
      // External ref with def name
      const [nsid, name] = ref.split("#");
      targetLexiconId = nsid;
      defName = name;
      resolvedRef = ref;
    } else {
      // External ref to main def
      targetLexiconId = ref;
      defName = "main";
      resolvedRef = `${ref}#main`;
    }

    // Check cache first
    if (cache.has(resolvedRef)) {
      return cache.get(resolvedRef)!;
    }

    // Look up the def using the provided lookup function
    const lookup = lookupDef(targetLexiconId, defName);
    if (!lookup) {
      console.warn(
        `Ref not resolved: ${ref} - include the lexicon in the bundle`,
      );
      return v.unknown();
    }

    // Create context for conversion (using the target lexicon's context)
    const ctx: ConverterContext = {
      lexiconId: targetLexiconId,
      defs: lookup.defs,
      resolveRef: createRefResolver(targetLexiconId, config),
      blobFormat,
    };

    // Convert and cache
    const schema = convertType(lookup.def, ctx);
    cache.set(resolvedRef, schema);
    return schema;
  };
}

/**
 * Convert a lexicon to valibot validators.
 * Use `lookup` option for cross-lexicon reference resolution.
 *
 * @example
 * ```ts
 * // Simple usage (single lexicon, local refs only)
 * const validators = lexiconToValibot(myLexicon)
 *
 * // With cross-lexicon references
 * const lookup = createLookup(strongRef, postLexicon, likeLexicon)
 * const post = lexiconToValibot(postLexicon, { lookup })
 * const like = lexiconToValibot(likeLexicon, { lookup })
 *
 * // Access validators directly
 * post.main
 * like.main
 * ```
 */
export function lexiconToValibot<
  T extends LexiconInput,
  Lexicons extends readonly LexiconInput[] = readonly LexiconInput[],
  Format extends LexiconFormat = "sdk",
>(
  lexicon: T,
  options: LexiconToValibotOptions<Lexicons> = {},
): InferLexiconValidators<Mutable<T>, BuildExtRefs<Lexicons, Format>, Format> {
  const blobFormat = (options.format ?? "sdk") as Format;
  const defs = lexicon.defs as Record<string, LexUserType>;

  // Use lookup's cache and lexicon map, or create local ones
  const cache = options.lookup?._caches[blobFormat] ?? new Map<string, v.GenericSchema>();
  const lexiconMap = options.lookup?._lexiconMap ?? new Map();

  // Ensure current lexicon is in the map for local ref resolution
  if (!lexiconMap.has(lexicon.id)) {
    lexiconMap.set(lexicon.id, { id: lexicon.id, defs });
  }

  // Create resolver config
  const config: RefResolverConfig = {
    lookupDef: (lexiconId, defName) => {
      const lex = lexiconMap.get(lexiconId);
      if (!lex) return null;
      const def = lex.defs[defName];
      if (!def) return null;
      return { defs: lex.defs, def };
    },
    cache,
    blobFormat,
  };

  const resolveRef = createRefResolver(lexicon.id, config);

  const ctx: ConverterContext = {
    lexiconId: lexicon.id,
    defs: lexicon.defs,
    resolveRef,
    blobFormat,
  };

  const result: Record<string, v.GenericSchema> = {};

  for (const [defName, def] of Object.entries(lexicon.defs)) {
    // Skip XRPC types
    if (isXrpcDef(def)) continue;

    const fullRef = `${lexicon.id}#${defName}`;

    // Check cache first
    if (cache.has(fullRef)) {
      result[defName] = cache.get(fullRef)!;
      continue;
    }

    let schema = convertType(def, ctx);

    // For wire format, wrap record types with $type
    if (blobFormat === "wire" && isRecordDef(def)) {
      const $type =
        defName === "main" ? lexicon.id : `${lexicon.id}#${defName}`;
      schema = v.object({
        $type: v.literal($type),
        ...("entries" in schema
          ? (schema as v.ObjectSchema<v.ObjectEntries, undefined>).entries
          : {}),
      });
    }

    cache.set(fullRef, schema);
    result[defName] = schema;
  }

  return result as InferLexiconValidators<
    Mutable<T>,
    BuildExtRefs<Lexicons, Format>,
    Format
  >;
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
): InferXrpcValidators<Mutable<T>, BuildExtRefs<Lexicons, Format>, Format> {
  const blobFormat = (options.format ?? "sdk") as LexiconFormat;
  const defs = lexicon.defs as Record<string, LexUserType>;

  // Use lookup's cache and lexicon map, or create local ones
  const cache = options.lookup?._caches[blobFormat] ?? new Map<string, v.GenericSchema>();
  const lexiconMap = options.lookup?._lexiconMap ?? new Map();

  // Ensure current lexicon is in the map for local ref resolution
  if (!lexiconMap.has(lexicon.id)) {
    lexiconMap.set(lexicon.id, { id: lexicon.id, defs });
  }

  // Create resolver config
  const config: RefResolverConfig = {
    lookupDef: (lexiconId, defName) => {
      const lex = lexiconMap.get(lexiconId);
      if (!lex) return null;
      const def = lex.defs[defName];
      if (!def) return null;
      return { defs: lex.defs, def };
    },
    cache,
    blobFormat,
  };

  const resolveRef = createRefResolver(lexicon.id, config);

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
    BuildExtRefs<Lexicons, Format>,
    Format
  >;
}
