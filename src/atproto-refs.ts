// Built-in AT Protocol type validators
// Users can spread these into externalRefs option

import * as v from "valibot";

// com.atproto.repo.strongRef - reference to another record
const strongRef = v.object({
  uri: v.string(),
  cid: v.string(),
});

// com.atproto.label.selfLabel
const selfLabel = v.object({
  val: v.string(),
});

// com.atproto.label.selfLabels
const selfLabels = v.object({
  values: v.array(selfLabel),
});

export const atprotoRefs = {
  "com.atproto.repo.strongRef": strongRef,
  "com.atproto.repo.strongRef#main": strongRef,
  "com.atproto.label.defs#selfLabel": selfLabel,
  "com.atproto.label.defs#selfLabels": selfLabels,
} as const;

export type AtprotoRefs = typeof atprotoRefs;