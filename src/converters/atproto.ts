import * as v from "valibot";
import type { LexBlob, LexCidLink, LexToken } from "../types.js";

// Blob reference structure used by AT Protocol
// Can be either typed (with $type: "blob") or untyped (legacy format)
const typedBlobRef = v.object({
  $type: v.literal("blob"),
  ref: v.object({ $link: v.string() }),
  mimeType: v.string(),
  size: v.number(),
});

const untypedBlobRef = v.object({
  cid: v.string(),
  mimeType: v.string(),
});

const blobRefSchema = v.union([typedBlobRef, untypedBlobRef]);

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
