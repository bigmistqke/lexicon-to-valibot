import * as v from "valibot";
import type { LexBlob, LexCidLink, LexToken } from "../types.js";

// Blob reference types for AT Protocol
// The SDK deserializes blobs as BlobRef class instances, so we use duck typing
// to accept both plain objects and class instances with the required properties.

type TypedBlobRef = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

type UntypedBlobRef = {
  cid: string;
  mimeType: string;
};

type BlobRef = TypedBlobRef | UntypedBlobRef;

// Check for SDK BlobRef class: { ref: CID, mimeType: string, size: number }
// The SDK's _BlobRef has ref as a _CID object, not { $link: string }
function isTypedBlobRef(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.ref === "object" &&
    obj.ref !== null &&
    typeof obj.mimeType === "string" &&
    typeof obj.size === "number"
  );
}

function isUntypedBlobRef(value: unknown): value is UntypedBlobRef {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.cid === "string" && typeof obj.mimeType === "string";
}

function isBlobRef(value: unknown): value is BlobRef {
  return isTypedBlobRef(value) || isUntypedBlobRef(value);
}

// Custom schema that accepts both plain objects and BlobRef class instances
const blobRefSchema = v.custom<BlobRef>(isBlobRef, "Expected BlobRef");

export function convertBlob(schema: LexBlob): v.GenericSchema {
  // For now, we validate the structure but don't enforce accept/maxSize at runtime
  // Those would require access to the actual blob data
  return blobRefSchema;
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
