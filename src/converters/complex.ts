import * as v from "valibot";
import type { LexArray, LexObject, LexRef, LexRefUnion, ConverterContext } from "../types.js";

export function convertArray(
  schema: LexArray,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): v.GenericSchema {
  const itemsSchema = convertType(schema.items, ctx);

  const checks: v.PipeItem<unknown[], unknown[], v.BaseIssue<unknown>>[] = [];

  if (schema.minLength !== undefined) {
    checks.push(v.minLength(schema.minLength));
  }
  if (schema.maxLength !== undefined) {
    checks.push(v.maxLength(schema.maxLength));
  }

  if (checks.length === 0) {
    return v.array(itemsSchema);
  }

  return v.pipe(v.array(itemsSchema), ...checks);
}

export function convertObject(
  schema: LexObject,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): v.GenericSchema {
  const properties: Record<string, v.GenericSchema> = {};
  const requiredSet = new Set(schema.required ?? []);
  const nullableSet = new Set(schema.nullable ?? []);

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      let propSchema = convertType(prop, ctx);

      // Handle nullable
      if (nullableSet.has(key)) {
        propSchema = v.nullable(propSchema);
      }

      // Handle optional (not in required list)
      if (!requiredSet.has(key)) {
        propSchema = v.optional(propSchema);
      }

      properties[key] = propSchema;
    }
  }

  return v.object(properties);
}

export function convertRef(schema: LexRef, ctx: ConverterContext): v.GenericSchema {
  return v.lazy(() => ctx.resolveRef(schema.ref));
}

export function convertUnion(
  schema: LexRefUnion,
  ctx: ConverterContext
): v.GenericSchema {
  if (schema.refs.length === 0) {
    return v.never();
  }

  if (schema.refs.length === 1) {
    return v.lazy(() => ctx.resolveRef(schema.refs[0]));
  }

  // Create a union of lazy refs - we know there are at least 2 refs from the check above
  const [first, second, ...rest] = schema.refs.map((ref) =>
    v.lazy(() => ctx.resolveRef(ref))
  );

  return v.union([first, second, ...rest]);
}
