import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const requireFromHere = createRequire(import.meta.url);
const imageSizePath = requireFromHere.resolve("image-size");

const vulnerableTypes = ["heif", "icns", "jxl", "jxl-stream"];

function runImageSize(input: Uint8Array) {
  const script = `
    const imageSize = require(${JSON.stringify(imageSizePath)});
    const input = Buffer.from(process.argv[1], "base64");
    try {
      imageSize(input);
      process.exitCode = 2;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("unsupported file type")) {
        process.exitCode = 0;
      } else {
        console.error(error);
        process.exitCode = 1;
      }
    }
  `;

  return spawnSync(
    process.execPath,
    ["--eval", script, Buffer.from(input).toString("base64")],
    {
      encoding: "utf8",
      timeout: 1_000,
    },
  );
}

function createIcnsWithZeroLengthEntry() {
  const input = Buffer.alloc(16);
  input.write("icns", 0, "ascii");
  input.writeUInt32BE(input.length, 4);
  input.write("ic10", 8, "ascii");
  input.writeUInt32BE(0, 12);
  return input;
}

function createJxlWithZeroLengthPartialStream() {
  const input = Buffer.alloc(32);
  input.writeUInt32BE(12, 0);
  input.write("JXL ", 4, "ascii");
  input.writeUInt32BE(12, 12);
  input.write("ftyp", 16, "ascii");
  input.write("jxl ", 20, "ascii");
  input.writeUInt32BE(0, 24);
  input.write("jxlp", 28, "ascii");
  return input;
}

function createHeifFileTypeBox() {
  const input = Buffer.alloc(16);
  input.writeUInt32BE(input.length, 0);
  input.write("ftyp", 4, "ascii");
  input.write("heic", 8, "ascii");
  return input;
}

describe("image-size security patch", () => {
  it("does not register the vulnerable decoders", () => {
    const imageSize = requireFromHere("image-size") as {
      types: string[];
    };

    expect(imageSize.types).not.toEqual(
      expect.arrayContaining(vulnerableTypes),
    );
  });

  it.each([
    ["ICNS", createIcnsWithZeroLengthEntry()],
    ["JXL", createJxlWithZeroLengthPartialStream()],
    ["HEIF", createHeifFileTypeBox()],
  ])("rejects crafted %s input without hanging", (_type, input) => {
    const result = runImageSize(input);

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  });
});
