const IDPF_OBFUSCATION_BYTES = 1040;

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

export function sha1Bytes(input: Uint8Array): Uint8Array {
  const bitLength = input.byteLength * 8;
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.byteLength] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft(
        words[index - 3]! ^
          words[index - 8]! ^
          words[index - 14]! ^
          words[index - 16]!,
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      const [f, k] =
        index < 20
          ? [(b & c) | (~b & d), 0x5a827999]
          : index < 40
            ? [b ^ c ^ d, 0x6ed9eba1]
            : index < 60
              ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
              : [b ^ c ^ d, 0xca62c1d6];
      const temp = (rotateLeft(a, 5) + f + e + k + words[index]!) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const digestView = new DataView(digest.buffer);
  [h0, h1, h2, h3, h4].forEach((value, index) => {
    digestView.setUint32(index * 4, value);
  });
  return digest;
}

export function removeXmlWhitespace(value: string): string {
  return value
    .replaceAll(" ", "")
    .replaceAll("\t", "")
    .replaceAll("\r", "")
    .replaceAll("\n", "");
}

export function idpfFontObfuscationKey(identifier: string): Uint8Array {
  return sha1Bytes(new TextEncoder().encode(removeXmlWhitespace(identifier)));
}

export function deobfuscateIdpfFont(
  bytes: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  const output = Uint8Array.from(bytes);
  const length = Math.min(IDPF_OBFUSCATION_BYTES, output.byteLength);
  for (let index = 0; index < length; index += 1) {
    output[index] = output[index]! ^ key[index % key.byteLength]!;
  }
  return output;
}

export const IDPF_FONT_OBFUSCATION_ALGORITHM =
  "http://www.idpf.org/2008/embedding";
