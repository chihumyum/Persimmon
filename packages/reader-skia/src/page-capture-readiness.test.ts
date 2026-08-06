import type { PageScene } from "@persimmon/layout";
import { describe, expect, it, vi } from "vitest";

import type { DecodedImageStatus } from "./image-cache";
import { pageImagesSettledForCapture } from "./page-capture";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@shopify/react-native-skia", () => ({
  ClipOp: { Intersect: 0 },
  Skia: {},
}));

const page = {
  items: [
    {
      kind: "image",
      assetId: "cover",
    },
  ],
} as unknown as Pick<PageScene, "items">;

describe("page capture image readiness", () => {
  it.each<DecodedImageStatus>(["unrequested", "loading"])(
    "waits while an image is %s",
    (status) => {
      expect(
        pageImagesSettledForCapture(page, {
          getStatus: () => status,
        }),
      ).toBe(false);
    },
  );

  it("allows a stable placeholder when no resource loader exists", () => {
    expect(
      pageImagesSettledForCapture(
        page,
        {
          getStatus: () => "unrequested",
        },
        true,
      ),
    ).toBe(true);
    expect(
      pageImagesSettledForCapture(
        page,
        {
          getStatus: () => "loading",
        },
        true,
      ),
    ).toBe(false);
  });

  it.each<DecodedImageStatus>(["ready", "unavailable"])(
    "captures after an image is %s",
    (status) => {
      expect(
        pageImagesSettledForCapture(page, {
          getStatus: () => status,
        }),
      ).toBe(true);
    },
  );
});
