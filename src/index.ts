import * as v from "valibot";
import { convertBlob, convertCidLink, convertToken } from "./converters/atproto.js";
import { convertArray, convertObject, convertRef, convertUnion } from "./converters/complex.js";
import {
  convertBoolean,
  convertBytes,
  convertInteger,
  convertString,
  convertUnknown,
} from "./converters/primitives.js";
import {
  convertProcedure,
  convertQuery,
  convertSubscription,
  type ProcedureValidators,
  type QueryValidators,
  type SubscriptionValidators,
} from "./converters/xrpc.js";
import type {
  ConverterContext,
  LexArray,
  LexBlob,
  LexBoolean,
  LexBytes,
  LexCidLink,
  LexInteger,
  LexObject,
  LexRecord,
  LexRef,
  LexRefUnion,
  LexString,
  LexToken,
  LexUnknown,
  LexUserType,
  LexXrpcProcedure,
  LexXrpcQuery,
  LexXrpcSubscription
} from "./types.js";

// Flexible input type that accepts both LexiconDoc and const objects
export interface LexiconInput {
  lexicon: 1;
  id: string;
  defs: Record<string, unknown>;
  description?: string;
  revision?: number;
}

// Options for lexiconToValibot
export interface LexiconToValibotOptions {
  /** External ref schemas (e.g., com.atproto.repo.strongRef) */
  externalRefs?: Record<string, v.GenericSchema>;
  /** Format for blob validation: 'sdk' for parsing fetched records, 'wire' for outgoing. Default: 'sdk' */
  format?: 'sdk' | 'wire';
}

export type { ProcedureValidators, QueryValidators, SubscriptionValidators };

type XrpcResult = QueryValidators | ProcedureValidators | SubscriptionValidators;

function convertType(schema: unknown, ctx: ConverterContext): v.GenericSchema {
  if (typeof schema !== "object" || schema === null) {
    throw new Error(`Invalid schema: expected object, got ${typeof schema}`);
  }

  const schemaObj = schema as { type?: string };

  switch (schemaObj.type) {
    // Primitives
    case "boolean":
      return convertBoolean(schema as LexBoolean);
    case "integer":
      return convertInteger(schema as LexInteger);
    case "string":
      return convertString(schema as LexString);
    case "unknown":
      return convertUnknown(schema as LexUnknown);

    // IPLD types
    case "bytes":
      return convertBytes(schema as LexBytes);
    case "cid-link":
      return convertCidLink(schema as LexCidLink);

    // AT Protocol types
    case "blob":
      return convertBlob(schema as LexBlob, ctx.blobFormat);
    case "token":
      return convertToken(schema as LexToken);

    // Complex types
    case "array":
      return convertArray(schema as LexArray, ctx, convertType);
    case "object":
      return convertObject(schema as LexObject, ctx, convertType);
    case "ref":
      return convertRef(schema as LexRef, ctx);
    case "union":
      return convertUnion(schema as LexRefUnion, ctx);

    // Record type
    case "record":
      return convertObject((schema as LexRecord).record, ctx, convertType);

    default:
      throw new Error(`Unknown schema type: ${schemaObj.type}`);
  }
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
      return convertSubscription(schema as LexXrpcSubscription, ctx, convertType);
    default:
      throw new Error(`Not an XRPC type: ${schemaObj.type}`);
  }
}

// Check if a def is an XRPC type
function isXrpcDef(schema: unknown): boolean {
  if (typeof schema !== "object" || schema === null) return false;
  const type = (schema as { type?: string }).type;
  return type === "query" || type === "procedure" || type === "subscription";
}

// Check if a def is a record type
function isRecordDef(schema: unknown): boolean {
  if (typeof schema !== "object" || schema === null) return false;
  return (schema as { type?: string }).type === "record";
}

function createRefResolver(
  lexiconId: string,
  defs: Record<string, LexUserType>,
  cache: Map<string, v.GenericSchema>,
  externalRefs: Record<string, v.GenericSchema> = {},
  blobFormat: 'sdk' | 'wire' = 'sdk'
): (ref: string) => v.GenericSchema {
  return (ref: string) => {
    // Parse the ref - could be:
    // - "#defName" (local ref)
    // - "com.example.lexicon#defName" (external ref)
    // - "com.example.lexicon" (main def of external lexicon)

    let resolvedRef = ref;

    if (ref.startsWith("#")) {
      // Local ref
      resolvedRef = `${lexiconId}${ref}`;
    } else if (!ref.includes("#")) {
      // External ref to main def
      resolvedRef = `${ref}#main`;
    }

    // Check cache first
    if (cache.has(resolvedRef)) {
      return cache.get(resolvedRef)!;
    }

    // Check external refs (try both original and resolved)
    if (externalRefs[ref]) {
      cache.set(resolvedRef, externalRefs[ref]);
      return externalRefs[ref];
    }
    if (externalRefs[resolvedRef]) {
      cache.set(resolvedRef, externalRefs[resolvedRef]);
      return externalRefs[resolvedRef];
    }

    // Parse the full ref
    const [nsid, defName] = resolvedRef.includes("#")
      ? resolvedRef.split("#")
      : [resolvedRef, "main"];

    // Only handle local refs
    if (nsid !== lexiconId) {
      // External ref not found in externalRefs
      console.warn(`External ref not resolved: ${ref} - provide it in externalRefs option`);
      return v.unknown();
    }

    const def = defs[defName];
    if (!def) {
      throw new Error(`Ref not found: ${ref} (resolved to ${resolvedRef})`);
    }

    // Create context for conversion
    const ctx: ConverterContext = {
      lexiconId,
      defs,
      resolveRef: createRefResolver(lexiconId, defs, cache, externalRefs, blobFormat),
      blobFormat,
    };

    // Convert and cache
    const schema = convertType(def, ctx);
    cache.set(resolvedRef, schema);
    return schema;
  };
}

import type { InferLexiconValidators, InferXrpcValidators } from "./infer.js";

// Helper type to convert schema map to output type map
type InferSchemaOutputs<T extends Record<string, v.GenericSchema>> = {
  [K in keyof T]: v.InferOutput<T[K]>;
};

/**
 * Convert a lexicon to valibot schemas for records and objects.
 * Skips XRPC types (query, procedure, subscription) - use xrpcToValibot for those.
 */
export function lexiconToValibot<
  T extends LexiconInput,
  ExtRefs extends Record<string, v.GenericSchema> = {}
>(
  lexicon: T,
  options: { externalRefs?: ExtRefs; format?: 'sdk' | 'wire' } = {}
): InferLexiconValidators<T, InferSchemaOutputs<ExtRefs>> {
  const blobFormat = options.format ?? 'sdk';
  const cache = new Map<string, v.GenericSchema>();
  const resolveRef = createRefResolver(
    lexicon.id,
    lexicon.defs as Record<string, LexUserType>,
    cache,
    options.externalRefs ?? {},
    blobFormat
  );

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

    let schema = convertType(def, ctx);

    // For wire format, wrap record types with $type
    if (blobFormat === 'wire' && isRecordDef(def)) {
      const $type = defName === 'main' ? lexicon.id : `${lexicon.id}#${defName}`;
      schema = v.object({
        $type: v.literal($type),
        ...('entries' in schema ? (schema as v.ObjectSchema<v.ObjectEntries, undefined>).entries : {}),
      });
    }

    result[defName] = schema;
  }

  return result as InferLexiconValidators<T, InferSchemaOutputs<ExtRefs>>;
}

/**
 * Convert a lexicon to valibot validators for XRPC endpoints.
 * Only handles query, procedure, and subscription types.
 */
export function xrpcToValibot<
  T extends LexiconInput,
  ExtRefs extends Record<string, v.GenericSchema> = {}
>(
  lexicon: T,
  options: { externalRefs?: ExtRefs; format?: 'sdk' | 'wire' } = {}
): InferXrpcValidators<T, InferSchemaOutputs<ExtRefs>> {
  const blobFormat = options.format ?? 'sdk';
  const cache = new Map<string, v.GenericSchema>();
  const resolveRef = createRefResolver(
    lexicon.id,
    lexicon.defs as Record<string, LexUserType>,
    cache,
    options.externalRefs ?? {},
    blobFormat
  );

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

  return result as InferXrpcValidators<T, InferSchemaOutputs<ExtRefs>>;
}

// Re-export valibot's InferOutput for convenience
export type { InferOutput } from "valibot";
// Re-export built-in AT Protocol refs
export { atprotoRefs, type AtprotoRefs } from "./atproto-refs.js";

// Re-export inference types
export type { InferLexiconOutput, InferLexiconValidators, InferLexType } from "./infer.js";
// Re-export types
export type { LexiconDoc, LexUserType } from "./types.js";
