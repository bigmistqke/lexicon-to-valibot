import { LexUserType } from "@atproto/lexicon";
import * as v from "valibot";
import {
  convertType,
  createRefResolver,
  isRecordDef,
  isXrpcDef,
  LexiconFormat,
  LexiconInput,
  RefResolverConfig,
} from "./core";
import { ConverterContext, InferLexiconValidators, Mutable } from "./types";

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
  [K in TInputs[number] as K["id"]]: InferLexiconValidators<Mutable<K>, {}, TType>;
};

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
): LexiconValidators<T, typeof options.format extends LexiconFormat ? typeof options.format : "sdk"> {
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

  return result as LexiconValidators<T, typeof options.format extends LexiconFormat ? typeof options.format : "sdk">;
}
