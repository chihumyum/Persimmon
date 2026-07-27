import { describe, expect, it } from "vitest";

import { connectedAndroidDeviceSerials } from "./android-device-list";

describe("connectedAndroidDeviceSerials", () => {
  it("accepts adb device rows separated by spaces", () => {
    expect(
      connectedAndroidDeviceSerials(`List of devices attached
3B164H00E6600000       device usb:2-2 product:PMA110 model:PMA110 device:OP61BDL1 transport_id:29
`),
    ).toEqual(["3B164H00E6600000"]);
  });

  it("accepts tabs and ignores unavailable devices", () => {
    expect(
      connectedAndroidDeviceSerials(`List of devices attached
emulator-5554\tdevice product:sdk_gphone64_arm64
offline-device\toffline
unauthorized-device\tunauthorized
`),
    ).toEqual(["emulator-5554"]);
  });
});
