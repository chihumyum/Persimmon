export interface AndroidUiBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface AndroidUiNode {
  readonly description: string;
  readonly text: string;
  readonly checked: boolean;
  readonly enabled: boolean;
  readonly bounds: AndroidUiBounds;
}

function decodeXmlAttribute(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function parseBounds(value: string): AndroidUiBounds | undefined {
  const match = /^\[(\d+),(\d+)]\[(\d+),(\d+)]$/.exec(value);
  if (!match) {
    return undefined;
  }
  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4]),
  };
}

export function parseAndroidUiNodes(xml: string): AndroidUiNode[] {
  return [...xml.matchAll(/<node\b[^>]*>/g)].flatMap((match) => {
    const attributes = new Map<string, string>();
    for (const attribute of match[0].matchAll(/([\w-]+)="([^"]*)"/g)) {
      attributes.set(attribute[1]!, decodeXmlAttribute(attribute[2]!));
    }
    const bounds = parseBounds(attributes.get("bounds") ?? "");
    if (!bounds) {
      return [];
    }
    return [
      {
        description: attributes.get("content-desc") ?? "",
        text: attributes.get("text") ?? "",
        checked: attributes.get("checked") === "true",
        enabled: attributes.get("enabled") !== "false",
        bounds,
      },
    ];
  });
}

export function findAndroidUiNode(
  nodes: readonly AndroidUiNode[],
  description: string,
): AndroidUiNode | undefined {
  return nodes.find((node) => node.description === description);
}

export function androidUiNodeCenter(node: AndroidUiNode): {
  readonly x: number;
  readonly y: number;
} {
  return {
    x: Math.round((node.bounds.left + node.bounds.right) * 0.5),
    y: Math.round((node.bounds.top + node.bounds.bottom) * 0.5),
  };
}

export function readerPageNumber(
  nodes: readonly AndroidUiNode[],
): number | undefined {
  for (const node of nodes) {
    const match = /^全书第\s*(\d+)\s*页$/.exec(node.description);
    if (match) {
      return Number(match[1]);
    }
  }
  return undefined;
}

export function parseAndroidScreenSize(output: string): {
  readonly width: number;
  readonly height: number;
} {
  const override = /Override size:\s*(\d+)x(\d+)/.exec(output);
  const physical = /Physical size:\s*(\d+)x(\d+)/.exec(output);
  const match = override ?? physical;
  if (!match) {
    throw new Error(`Unable to parse Android screen size from: ${output}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}
