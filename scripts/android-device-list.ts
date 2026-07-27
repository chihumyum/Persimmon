export function connectedAndroidDeviceSerials(output: string): string[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [serial, state] = line.trim().split(/\s+/);
      return serial && state === "device" ? [serial] : [];
    });
}
