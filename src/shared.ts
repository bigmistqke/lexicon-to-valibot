import * as v from "valibot";
import { convertType } from "./converters/convert-type";
import { DefLookupResult, LexiconFormat } from "./lexicon.ts";
import { ConverterContext } from "./types.ts";

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
export function makeRefResolver(
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
      resolveRef: makeRefResolver(targetLexiconId, config),
      blobFormat,
    };

    // Convert and cache
    const schema = convertType(lookup.def, ctx);
    cache.set(resolvedRef, schema);
    return schema;
  };
}
