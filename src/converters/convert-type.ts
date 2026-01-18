import {
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
} from "@atproto/lexicon";
import { ConverterContext } from "../types";
import { convertBlob, convertCidLink, convertToken } from "./atproto";
import {
  convertArray,
  convertObject,
  convertRef,
  convertUnion,
} from "./complex";
import {
  convertBoolean,
  convertBytes,
  convertInteger,
  convertString,
  convertUnknown,
} from "./primitives";

export function convertType(
  schema: unknown,
  ctx: ConverterContext,
): v.GenericSchema {
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
