import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { convertBlob, convertCidLink, convertToken } from "./atproto.js";

describe("convertBlob", () => {
  it("validates typed blob reference", () => {
    const schema = convertBlob({ type: "blob" });

    const typedBlob = {
      $type: "blob",
      ref: { $link: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku" },
      mimeType: "image/jpeg",
      size: 12345,
    };

    expect(v.safeParse(schema, typedBlob).success).toBe(true);
  });

  it("validates untyped blob reference (legacy format)", () => {
    const schema = convertBlob({ type: "blob" });

    const untypedBlob = {
      cid: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
      mimeType: "image/jpeg",
    };

    expect(v.safeParse(schema, untypedBlob).success).toBe(true);
  });

  it("rejects invalid blob structure", () => {
    const schema = convertBlob({ type: "blob" });

    expect(v.safeParse(schema, { mimeType: "image/jpeg" }).success).toBe(false);
    expect(v.safeParse(schema, "blob-string").success).toBe(false);
    expect(v.safeParse(schema, null).success).toBe(false);
  });
});

describe("convertCidLink", () => {
  it("validates CID link structure", () => {
    const schema = convertCidLink({ type: "cid-link" });

    const cidLink = {
      $link: "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
    };

    expect(v.safeParse(schema, cidLink).success).toBe(true);
  });

  it("rejects invalid CID link", () => {
    const schema = convertCidLink({ type: "cid-link" });

    expect(v.safeParse(schema, { link: "wrong-key" }).success).toBe(false);
    expect(v.safeParse(schema, "just-a-string").success).toBe(false);
    expect(v.safeParse(schema, null).success).toBe(false);
  });
});

describe("convertToken", () => {
  it("validates token as string", () => {
    const schema = convertToken({ type: "token" });

    expect(v.safeParse(schema, "app.bsky.feed.post#mention").success).toBe(true);
    expect(v.safeParse(schema, "any-token-value").success).toBe(true);
  });

  it("rejects non-string values", () => {
    const schema = convertToken({ type: "token" });

    expect(v.safeParse(schema, 123).success).toBe(false);
    expect(v.safeParse(schema, null).success).toBe(false);
    expect(v.safeParse(schema, {}).success).toBe(false);
  });
});
