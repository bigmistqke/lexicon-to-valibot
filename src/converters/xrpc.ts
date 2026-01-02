import * as v from "valibot";
import type { LexXrpcQuery, LexXrpcProcedure, LexXrpcSubscription, ConverterContext } from "../types.js";

export interface QueryValidators {
  parameters: v.GenericSchema;
  output: v.GenericSchema;
}

export interface ProcedureValidators {
  parameters: v.GenericSchema;
  input: v.GenericSchema;
  output: v.GenericSchema;
}

export interface SubscriptionValidators {
  parameters: v.GenericSchema;
  message: v.GenericSchema;
}

// Convert params object to valibot schema
function convertParams(
  params: { type: "params"; required?: string[]; properties?: Record<string, unknown> } | undefined,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): v.GenericSchema {
  if (!params?.properties) {
    return v.object({});
  }

  const properties: Record<string, v.GenericSchema> = {};
  const requiredSet = new Set(params.required ?? []);

  for (const [key, prop] of Object.entries(params.properties)) {
    let propSchema = convertType(prop, ctx);

    if (!requiredSet.has(key)) {
      propSchema = v.optional(propSchema);
    }

    properties[key] = propSchema;
  }

  return v.object(properties);
}

// Convert body (input/output/message) to valibot schema
function convertBody(
  body: { schema?: unknown } | undefined,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): v.GenericSchema {
  if (!body?.schema) {
    return v.unknown();
  }
  return convertType(body.schema, ctx);
}

export function convertQuery(
  schema: LexXrpcQuery,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): QueryValidators {
  return {
    parameters: convertParams(schema.parameters, ctx, convertType),
    output: convertBody(schema.output, ctx, convertType),
  };
}

export function convertProcedure(
  schema: LexXrpcProcedure,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): ProcedureValidators {
  return {
    parameters: convertParams(schema.parameters, ctx, convertType),
    input: convertBody(schema.input, ctx, convertType),
    output: convertBody(schema.output, ctx, convertType),
  };
}

export function convertSubscription(
  schema: LexXrpcSubscription,
  ctx: ConverterContext,
  convertType: (type: unknown, ctx: ConverterContext) => v.GenericSchema
): SubscriptionValidators {
  return {
    parameters: convertParams(schema.parameters, ctx, convertType),
    message: convertBody(schema.message, ctx, convertType),
  };
}
