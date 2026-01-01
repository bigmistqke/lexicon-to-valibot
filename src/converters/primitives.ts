import * as v from "valibot";
import type { LexBoolean, LexInteger, LexString, LexUnknown, LexBytes } from "../types.js";

export function convertBoolean(schema: LexBoolean): v.GenericSchema {
  if (schema.const !== undefined) {
    return v.literal(schema.const);
  }
  return v.boolean();
}

export function convertInteger(schema: LexInteger): v.GenericSchema {
  const checks: v.PipeItem<number, number, v.BaseIssue<unknown>>[] = [v.integer()];

  if (schema.minimum !== undefined) {
    checks.push(v.minValue(schema.minimum));
  }
  if (schema.maximum !== undefined) {
    checks.push(v.maxValue(schema.maximum));
  }

  if (schema.enum !== undefined && schema.enum.length > 0) {
    return v.picklist(schema.enum);
  }

  if (schema.const !== undefined) {
    return v.literal(schema.const);
  }

  return v.pipe(v.number(), ...checks);
}

export function convertString(schema: LexString): v.GenericSchema {
  const checks: v.PipeItem<string, string, v.BaseIssue<unknown>>[] = [];

  if (schema.minLength !== undefined) {
    checks.push(v.minLength(schema.minLength));
  }
  if (schema.maxLength !== undefined) {
    checks.push(v.maxLength(schema.maxLength));
  }

  if (schema.enum !== undefined && schema.enum.length > 0) {
    return v.picklist(schema.enum);
  }

  if (schema.const !== undefined) {
    return v.literal(schema.const);
  }

  if (schema.format !== undefined) {
    switch (schema.format) {
      case "datetime":
        checks.push(v.isoTimestamp());
        break;
      case "uri":
        checks.push(v.url());
        break;
      case "at-uri":
        checks.push(v.regex(/^at:\/\/[a-zA-Z0-9._:%-]+\/[a-zA-Z0-9.]+\/[a-zA-Z0-9._~:@!$&')(*+,;=-]+$/));
        break;
      case "did":
        checks.push(v.regex(/^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/));
        break;
      case "handle":
        checks.push(v.regex(/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/));
        break;
      case "nsid":
        checks.push(v.regex(/^[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(\.[a-zA-Z]([a-zA-Z]{0,61}[a-zA-Z])?)$/));
        break;
      case "cid":
        checks.push(v.regex(/^[a-zA-Z0-9+/=]+$/));
        break;
      case "tid":
        checks.push(v.regex(/^[234567abcdefghijklmnopqrstuvwxyz]{13}$/));
        break;
      case "record-key":
        checks.push(v.regex(/^[a-zA-Z0-9._:~-]+$/));
        break;
      case "language":
        checks.push(v.regex(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/));
        break;
      case "at-identifier":
        // at-identifier can be a handle or a DID
        checks.push(v.regex(/^(did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]|([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)$/));
        break;
    }
  }

  if (checks.length === 0) {
    return v.string();
  }

  return v.pipe(v.string(), ...checks);
}

export function convertUnknown(_schema: LexUnknown): v.GenericSchema {
  return v.unknown();
}

export function convertBytes(schema: LexBytes): v.GenericSchema {
  const baseSchema = v.instance(Uint8Array);

  if (schema.minLength === undefined && schema.maxLength === undefined) {
    return baseSchema;
  }

  return v.pipe(
    baseSchema,
    v.check((value) => {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return false;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return false;
      }
      return true;
    }, `Bytes length must be between ${schema.minLength ?? 0} and ${schema.maxLength ?? "∞"}`)
  );
}
