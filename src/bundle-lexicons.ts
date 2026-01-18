import { LexUserType } from "@atproto/lexicon";
import * as v from "valibot";
import {
  convertType,
  isRecordDef,
  isXrpcDef,
  LexiconFormat,
  LexiconInput,
} from "./core";
import { ConverterContext, InferLexiconValidators, Mutable } from "./types";

/**
 * Options for createLexiconBundle
 */
export interface LexiconBundleOptions {
  /** External ref schemas (e.g., atprotoRefs for com.atproto.* types) */
  externalRefs?: Record<string, v.GenericSchema>;
  /** Format for blob validation: 'sdk' for parsing fetched records, 'wire' for outgoing. Default: 'sdk' */
  format?: LexiconFormat;
}

/**
 * A bundle of lexicons that can reference each other.
 * Provides validators for each lexicon with cross-references automatically resolved.
 */
export interface LexiconBundle<
  TInputs extends readonly LexiconInput[],
  TExtRefs extends Record<string, any> = Record<string, any>,
> {
  sdk: LexiconBundleKind<TInputs, TExtRefs, "sdk">;
  wire: LexiconBundleKind<TInputs, TExtRefs, "wire">;
}

export type LexiconBundleKind<
  TInputs extends readonly LexiconInput[],
  TExtRefs extends Record<string, any> = Record<string, any>,
  TType extends LexiconFormat = LexiconFormat,
> = {
  [K in TInputs[number] as K["id"]]: InferLexiconValidators<
    Mutable<K>,
    TExtRefs,
    TType
  >;
};

/**
 * Create a bundle of lexicons that can reference each other.
 * Cross-lexicon references are automatically resolved.
 *
 * @example
 * ```ts
 * const bundle = createLexiconBundle([
 *   projectLexicon,
 *   audioEffectLexicon,
 *   visualEffectLexicon,
 * ], { externalRefs: atprotoRefs })
 *
 * // Get validators for a specific lexicon
 * const projectValidators = bundle.validators(projectLexicon)
 *
 * // Or access by ID
 * const audioValidators = bundle.byId['app.eddy.audioEffect']
 * ```
 */
export function bundleLexicons<const T extends readonly LexiconInput[]>(
  lexicons: T,
  options: LexiconBundleOptions = {},
): LexiconBundle<T> {
  const baseExternalRefs = options.externalRefs ?? {};

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

  // Shared cache for all lexicons (keyed by fully-qualified ref like "app.eddy.project#staticValue")
  const sdkCache = new Map<string, v.GenericSchema>();
  const wireCache = new Map<string, v.GenericSchema>();

  // Create a resolver that can resolve refs across all lexicons in the bundle
  function createBundleRefResolver(
    currentLexiconId: string,
    blobFormat: LexiconFormat,
  ): (ref: string) => v.GenericSchema {
    const cache = blobFormat === "sdk" ? sdkCache : wireCache;

    return function resolveRef(ref: string): v.GenericSchema {
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

      // Check base external refs (e.g., atprotoRefs)
      if (baseExternalRefs[ref]) {
        cache.set(resolvedRef, baseExternalRefs[ref]);
        return baseExternalRefs[ref];
      }
      if (baseExternalRefs[resolvedRef]) {
        cache.set(resolvedRef, baseExternalRefs[resolvedRef]);
        return baseExternalRefs[resolvedRef];
      }

      // Look up the lexicon in our bundle
      const lexicon = lexiconMap.get(targetLexiconId);
      if (!lexicon) {
        console.warn(
          `Lexicon not found in bundle: ${targetLexiconId} (ref: ${ref})`,
        );
        return v.unknown();
      }

      const def = lexicon.defs[defName];
      if (!def) {
        throw new Error(
          `Def not found: ${defName} in ${targetLexiconId} (ref: ${ref})`,
        );
      }

      // Create context for conversion (using the target lexicon's context)
      const ctx: ConverterContext = {
        lexiconId: targetLexiconId,
        defs: lexicon.defs,
        resolveRef: createBundleRefResolver(targetLexiconId, blobFormat),
        blobFormat,
      };

      // Convert and cache
      const schema = convertType(def, ctx);
      cache.set(resolvedRef, schema);
      return schema;
    };
  }

  // Build validators for each lexicon
  function buildValidators(
    lexicon: LexiconInput,
    blobFormat: LexiconFormat,
  ): Record<string, v.GenericSchema> {
    const cache = blobFormat === "sdk" ? sdkCache : wireCache;
    const resolveRef = createBundleRefResolver(lexicon.id, blobFormat);

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

  const template = Object.fromEntries(
    lexicons.map((lexicon) => [lexicon.id, lexicon]),
  );

  return {
    wire: new Proxy({} as LexiconBundle<T, {}>["wire"], {
      get(_, lexicon: any) {
        return buildValidators(template[lexicon], "wire");
      },
    }),
    sdk: new Proxy({} as LexiconBundle<T, {}>["sdk"], {
      get(_, lexicon: any) {
        return buildValidators(template[lexicon], "sdk");
      },
    }),
  };
}
