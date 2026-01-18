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
  ConverterContext,
  InferLexiconValidators,
  InferXrpcValidators,
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

// Flexible input type that accepts both LexiconDoc and const objects
export interface LexiconInput {
  lexicon: 1;
  id: string;
  defs: Record<string, unknown>;
  description?: string;
  revision?: number;
}

type XrpcResult =
  | QueryValidators
  | ProcedureValidators
  | SubscriptionValidators;

/**
 * Options for lexiconToValibot
 */
export interface LexiconToValibotOptions {
  /** Format for blob validation: 'sdk' for parsing fetched records, 'wire' for outgoing. Default: 'sdk' */
  format?: LexiconFormat;
}

/**
 * Result of lexiconToValibot - validators for each lexicon keyed by ID.
 */
export type LexiconValidators<
  TInputs extends readonly LexiconInput[],
  TType extends LexiconFormat = LexiconFormat,
> = {
  [K in TInputs[number] as K["id"]]: InferLexiconValidators<
    Mutable<K>,
    {},
    TType
  >;
};

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
 * Convert lexicons to valibot validators.
 * Cross-lexicon references are automatically resolved.
 *
 * @example
 * ```ts
 * const validators = lexiconToValibot([
 *   projectLexicon,
 *   audioEffectLexicon,
 *   visualEffectLexicon,
 * ], { format: 'sdk' })
 *
 * // Access validators by lexicon ID
 * const project = validators['app.example.project']
 * ```
 */
export function lexiconToValibot<const T extends readonly LexiconInput[]>(
  lexicons: T,
  options: LexiconToValibotOptions = {},
): LexiconValidators<
  T,
  typeof options.format extends LexiconFormat ? typeof options.format : "sdk"
> {
  const blobFormat = options.format ?? "sdk";

  // Build a map of lexiconId -> { defs } for quick lookup
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

  // Shared cache for all lexicons
  const cache = new Map<string, v.GenericSchema>();

  // Create resolver config for bundle-wide lookup
  const config: RefResolverConfig = {
    lookupDef: (lexiconId, defName) => {
      const lexicon = lexiconMap.get(lexiconId);
      if (!lexicon) return null;
      const def = lexicon.defs[defName];
      if (!def) return null;
      return { defs: lexicon.defs, def };
    },
    cache,
    blobFormat,
  };

  // Build validators for each lexicon
  function buildValidators(
    lexicon: LexiconInput,
  ): Record<string, v.GenericSchema> {
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

    return result;
  }

  // Build result with validators for each lexicon keyed by ID
  const result: Record<string, Record<string, v.GenericSchema>> = {};
  for (const lexicon of lexicons) {
    result[lexicon.id] = buildValidators(lexicon);
  }

  return result as LexiconValidators<
    T,
    typeof options.format extends LexiconFormat ? typeof options.format : "sdk"
  >;
}

/**
 * Convert a lexicon to valibot validators for XRPC endpoints.
 * Only handles query, procedure, and subscription types.
 */
export function xrpcToValibot<
  T extends Mutable<LexiconInput>,
  Format extends BlobFormat = "sdk",
>(
  lexicon: T,
  options: { format?: Format } = {},
): InferXrpcValidators<Mutable<T>, {}, Format> {
  const blobFormat = options.format ?? "sdk";
  const defs = lexicon.defs as Record<string, LexUserType>;

  // Single-lexicon lookup: only resolves local refs
  const config: RefResolverConfig = {
    lookupDef: (lexiconId, defName) => {
      if (lexiconId !== lexicon.id) return null;
      const def = defs[defName];
      if (!def) return null;
      return { defs, def };
    },
    cache: new Map<string, v.GenericSchema>(),
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

  return result as InferXrpcValidators<Mutable<T>, {}, Format>;
}
