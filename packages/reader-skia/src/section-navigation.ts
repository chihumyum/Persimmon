export interface PageAddress {
  readonly sectionIndex: number;
  readonly pageIndex: number;
}

export type PageCountForSection = (sectionIndex: number) => number;

export function comparePageAddresses(
  left: PageAddress,
  right: PageAddress,
): number {
  return (
    left.sectionIndex - right.sectionIndex || left.pageIndex - right.pageIndex
  );
}

export function samePageAddress(
  left: PageAddress,
  right: PageAddress,
): boolean {
  return comparePageAddresses(left, right) === 0;
}

export function adjacentPageAddress(
  address: PageAddress,
  direction: 1 | -1,
  sectionCount: number,
  pageCountForSection: PageCountForSection,
): PageAddress {
  if (direction === 1) {
    const currentPageCount = pageCountForSection(address.sectionIndex);
    if (address.pageIndex + 1 < currentPageCount) {
      return { ...address, pageIndex: address.pageIndex + 1 };
    }
    if (address.sectionIndex + 1 < sectionCount) {
      return { sectionIndex: address.sectionIndex + 1, pageIndex: 0 };
    }
    return address;
  }

  if (address.pageIndex > 0) {
    return { ...address, pageIndex: address.pageIndex - 1 };
  }
  if (address.sectionIndex > 0) {
    const previousSection = address.sectionIndex - 1;
    return {
      sectionIndex: previousSection,
      pageIndex: pageCountForSection(previousSection) - 1,
    };
  }
  return address;
}

export function pageAddressesFrom(
  start: PageAddress,
  count: number,
  sectionCount: number,
  pageCountForSection: PageCountForSection,
): PageAddress[] {
  const addresses = [start];
  let current = start;
  for (let index = 1; index < Math.max(1, count); index += 1) {
    const next = adjacentPageAddress(
      current,
      1,
      sectionCount,
      pageCountForSection,
    );
    if (samePageAddress(next, current)) {
      break;
    }
    addresses.push(next);
    current = next;
  }
  return addresses;
}

/**
 * Advances one complete reader view. A spread only advances when two new
 * physical pages exist, preventing a final page that is already visible on
 * the right from being shown again as a redundant one-page spread.
 */
export function adjacentViewAddress(
  address: PageAddress,
  direction: 1 | -1,
  pagesPerView: number,
  sectionCount: number,
  pageCountForSection: PageCountForSection,
): PageAddress {
  let current = address;
  const steps = Math.max(1, Math.round(pagesPerView));
  for (let index = 0; index < steps; index += 1) {
    const next = adjacentPageAddress(
      current,
      direction,
      sectionCount,
      pageCountForSection,
    );
    if (samePageAddress(next, current)) {
      return address;
    }
    current = next;
  }
  return current;
}
