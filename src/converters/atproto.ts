import { BlobRef } from "@atproto/lexicon";
import * as v from "valibot";
import type { BlobFormat, LexBlob, LexCidLink, LexToken } from "../types.js";

// Blob reference types for AT Protocol

// Wire format: what gets sent to/from PDS
type WireBlobRef = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

// Untyped/legacy format
type UntypedBlobRef = {
  cid: string;
  mimeType: string;
};

// Check for wire format: { $type: "blob", ref: { $link: string }, ... }
function isWireBlobRef(value: unknown): value is WireBlobRef {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.$type === "blob" &&
    typeof obj.ref === "object" &&
    obj.ref !== null &&
    typeof (obj.ref as Record<string, unknown>).$link === "string" &&
    typeof obj.mimeType === "string" &&
    typeof obj.size === "number"
  );
}

// Check for SDK BlobRef class instance
function isSdkBlobRef(value: unknown): value is BlobRef {
  return value instanceof BlobRef;
}

function isUntypedBlobRef(value: unknown): value is UntypedBlobRef {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.cid === "string" && typeof obj.mimeType === "string";
}

// Validator for SDK format (incoming from PDS via SDK)
const blobSdkSchema = v.custom<BlobRef | UntypedBlobRef>(
  (value) => isSdkBlobRef(value) || isUntypedBlobRef(value),
  "Expected BlobRef (SDK format)"
);

// Validator for wire format (outgoing to PDS)
const blobWireSchema = v.custom<WireBlobRef | UntypedBlobRef>(
  (value) => isWireBlobRef(value) || isUntypedBlobRef(value),
  "Expected BlobRef (wire format)"
);

export function convertBlob(schema: LexBlob, format: BlobFormat): v.GenericSchema {
  // For now, we validate the structure but don't enforce accept/maxSize at runtime
  // Those would require access to the actual blob data
  return format === 'sdk' ? blobSdkSchema : blobWireSchema;
}

// CID link is represented as an object with $link property containing the CID string
const cidLinkSchema = v.object({
  $link: v.string(),
});

export function convertCidLink(_schema: LexCidLink): v.GenericSchema {
  return cidLinkSchema;
}

export function convertToken(schema: LexToken): v.GenericSchema {
  // Token is essentially a string literal representing a constant identifier
  // The value should be the full NSID#name reference
  return v.string();
}
