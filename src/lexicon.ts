import * as v from "valibot";
import { convertType } from "./converters/convert-type.ts";
import { isRecordDef, isXrpcDef, makeRefResolver } from "./shared.ts";
import type {
  ConverterContext,
  InferLexiconValidators,
  LexiconInput,
  LexiconMap,
  LexUserType,
  Mutable,
} from "./types.ts";

/**
 * Result of looking up a def in a lexicon
 */
export interface DefLookupResult {
  defs: Record<string, LexUserType>;
  def: LexUserType;
}

export type LexiconFormat = "sdk" | "wire";

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
): InferLexiconValidators<Mutable<T>, LexiconMap<Lexicons>, Format> {
  const blobFormat = (options.format ?? "sdk") as Format;
  const defs = lexicon.defs as Record<string, LexUserType>;

  // Use lookup's cache and lexicon map, or create local ones
  const cache =
    options.lookup?._caches[blobFormat] ?? new Map<string, v.GenericSchema>();
  const lexiconMap = options.lookup?._lexiconMap ?? new Map();

  // Ensure current lexicon is in the map for local ref resolution
  if (!lexiconMap.has(lexicon.id)) {
    lexiconMap.set(lexicon.id, { id: lexicon.id, defs });
  }

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
    LexiconMap<Lexicons>,
    Format
  >;
}
