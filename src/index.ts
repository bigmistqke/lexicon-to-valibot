import * as v from "valibot";
import type {
  LexiconDoc,
  LexUserType,
  LexBoolean,
  LexInteger,
  LexString,
  LexUnknown,
  LexBytes,
  LexBlob,
  LexCidLink,
  LexToken,
  LexArray,
  LexObject,
  LexRef,
  LexRefUnion,
  LexRecord,
  LexXrpcQuery,
  LexXrpcProcedure,
  LexXrpcSubscription,
  ConverterContext,
} from "./types.js";

// Flexible input type that accepts both LexiconDoc and const objects
export interface LexiconInput {
  lexicon: 1;
  id: string;
  defs: Record<string, unknown>;
  description?: string;
  revision?: number;
}
import {
  convertBoolean,
  convertInteger,
  convertString,
  convertUnknown,
  convertBytes,
} from "./converters/primitives.js";
import { convertBlob, convertCidLink, convertToken } from "./converters/atproto.js";
import { convertArray, convertObject, convertRef, convertUnion } from "./converters/complex.js";
import {
  convertQuery,
  convertProcedure,
  convertSubscription,
  type QueryValidators,
  type ProcedureValidators,
  type SubscriptionValidators,
} from "./converters/xrpc.js";

export type { QueryValidators, ProcedureValidators, SubscriptionValidators };

type DefResult = v.GenericSchema | QueryValidators | ProcedureValidators | SubscriptionValidators;

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
      return convertBlob(schema as LexBlob);
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

// Convert a def - returns either a schema or XRPC validators object
function convertDef(schema: unknown, ctx: ConverterContext): DefResult {
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
      return convertType(schema, ctx);
  }
}

function createRefResolver(
  lexiconId: string,
  defs: Record<string, LexUserType>,
  cache: Map<string, v.GenericSchema>
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

    // Parse the full ref
    const [nsid, defName] = resolvedRef.includes("#")
      ? resolvedRef.split("#")
      : [resolvedRef, "main"];

    // Only handle local refs for now
    if (nsid !== lexiconId) {
      // For external refs, return a placeholder that validates anything
      // Users should provide an external resolver for cross-lexicon refs
      console.warn(`External ref not resolved: ${ref}`);
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
      resolveRef: createRefResolver(lexiconId, defs, cache),
    };

    // Convert and cache
    const schema = convertType(def, ctx);
    cache.set(resolvedRef, schema);
    return schema;
  };
}

import type { InferLexiconValidators } from "./infer.js";

export function lexiconToValibot<T extends LexiconInput>(
  lexicon: T
): InferLexiconValidators<T> {
  const cache = new Map<string, v.GenericSchema>();
  const resolveRef = createRefResolver(
    lexicon.id,
    lexicon.defs as Record<string, LexUserType>,
    cache
  );

  const ctx: ConverterContext = {
    lexiconId: lexicon.id,
    defs: lexicon.defs,
    resolveRef,
  };

  const result: Record<string, DefResult> = {};

  for (const [defName, def] of Object.entries(lexicon.defs)) {
    result[defName] = convertDef(def, ctx);
  }

  return result as InferLexiconValidators<T>;
}

// Re-export valibot's InferOutput for convenience
export type { InferOutput } from "valibot";

// Re-export types
export type { LexiconDoc, LexUserType } from "./types.js";

// Re-export inference types
export type { InferLexiconValidators, InferLexiconOutput, InferLexType } from "./infer.js";
