import { describe, expect, it } from "vitest";

import {
  deobfuscateIdpfFont,
  idpfFontObfuscationKey,
  sha1Bytes,
} from "./font-obfuscation";

function hex(bytes: Uint8Array): string {
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

describe("EPUB IDPF font obfuscation", () => {
  it("implements SHA-1 and removes identifier whitespace", () => {
    expect(hex(sha1Bytes(new TextEncoder().encode("abc")))).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
    expect(hex(idpfFontObfuscationKey(" urn:uuid: 123 "))).toBe(
      hex(idpfFontObfuscationKey("urn:uuid:123")),
    );
    expect(hex(idpfFontObfuscationKey("urn:uuid:\u00a0123"))).not.toBe(
      hex(idpfFontObfuscationKey("urn:uuid:123")),
    );
  });

  it("is symmetric and only touches the first 1040 bytes", () => {
    const original = Uint8Array.from(
      { length: 1200 },
      (_, index) => index % 251,
    );
    const key = idpfFontObfuscationKey("book-id");
    const obfuscated = deobfuscateIdpfFont(original, key);
    expect(obfuscated.subarray(1040)).toEqual(original.subarray(1040));
    expect(deobfuscateIdpfFont(obfuscated, key)).toEqual(original);
  });
});
