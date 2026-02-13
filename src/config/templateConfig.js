/**
 * Creates a blank template config for a newly uploaded PDF.
 */
export function createBlankConfig(id, name, numPages, dims) {
  return {
    id,
    name,
    pdfStorageKey: id,
    pageDimensions: { width: dims.width, height: dims.height },
    pages: Array.from({ length: numPages }, (_, i) => ({
      pageIndex: i,
      label: `Page ${i + 1}`,
      type: 'other',
    })),
    style: {
      backgroundFill: { r: 255, g: 253, b: 245 },
      badgeBlue: { r: 43, g: 58, b: 103 },
      badgeGray: { r: 235, g: 235, b: 235 },
    },
  };
}

/**
 * Produces a config object that matches the original hardcoded template behavior.
 * Used for seeding the default template on first launch.
 */
export function migrateHardcodedConfig() {
  return {
    id: 'default-template',
    name: '123 Main St',
    pdfStorageKey: 'default-template',
    pageDimensions: { width: 540, height: 779 },
    pages: [
      {
        pageIndex: 0,
        label: '4th Floor Overview',
        type: 'overview',
        overviewConfig: {
          suitePageIndices: [1, 2, 3, 4],
        },
      },
      {
        pageIndex: 1,
        label: 'Suite 404 - 8 desks',
        type: 'suite',
        suiteConfig: {
          overviewPageIndex: 0,
          deskCount: 8,
          listPrice: '$9,625',
          foundingMemberPrice: '$8,750',
          highlightRects: [{ x: 75, y: 332, width: 47, height: 85 }],
          priceRedaction: {
            listPrice: { x: 52, y: 152, width: 440, height: 32 },
            foundingPrice: { x: 52, y: 118, width: 440, height: 32 },
          },
        },
      },
      {
        pageIndex: 2,
        label: 'Suite 411 - 4 desks',
        type: 'suite',
        suiteConfig: {
          overviewPageIndex: 0,
          deskCount: 4,
          listPrice: '$4,500',
          foundingMemberPrice: null,
          highlightRects: [{ x: 412, y: 383, width: 38, height: 47 }],
          priceRedaction: {
            listPrice: { x: 52, y: 152, width: 440, height: 32 },
            foundingPrice: { x: 52, y: 118, width: 440, height: 32 },
          },
        },
      },
      {
        pageIndex: 3,
        label: 'Suite 416 - 5 desks',
        type: 'suite',
        suiteConfig: {
          overviewPageIndex: 0,
          deskCount: 5,
          listPrice: '$4,000',
          foundingMemberPrice: null,
          highlightRects: [{ x: 338, y: 389, width: 56, height: 41 }],
          priceRedaction: {
            listPrice: { x: 52, y: 152, width: 440, height: 32 },
            foundingPrice: { x: 52, y: 118, width: 440, height: 32 },
          },
        },
      },
      {
        pageIndex: 4,
        label: 'Suite 420 - 4 desks',
        type: 'suite',
        suiteConfig: {
          overviewPageIndex: 0,
          deskCount: 4,
          listPrice: '$2,750',
          foundingMemberPrice: null,
          highlightRects: [{ x: 142, y: 467, width: 40, height: 44 }],
          priceRedaction: {
            listPrice: { x: 52, y: 152, width: 440, height: 32 },
            foundingPrice: { x: 52, y: 118, width: 440, height: 32 },
          },
        },
      },
      {
        pageIndex: 5,
        label: '5th Floor Overview',
        type: 'overview',
        overviewConfig: {
          suitePageIndices: [6, 7],
        },
      },
      {
        pageIndex: 6,
        label: 'Suite 506 - 4 desks',
        type: 'suite',
        suiteConfig: {
          overviewPageIndex: 5,
          deskCount: 4,
          listPrice: '$3,800',
          foundingMemberPrice: '$3,450',
          highlightRects: [{ x: 322, y: 306, width: 73, height: 39 }],
          priceRedaction: {
            listPrice: { x: 52, y: 152, width: 440, height: 32 },
            foundingPrice: { x: 52, y: 118, width: 440, height: 32 },
          },
        },
      },
      {
        pageIndex: 7,
        label: 'Suite 509 - 6 desks',
        type: 'suite',
        suiteConfig: {
          overviewPageIndex: 5,
          deskCount: 6,
          listPrice: '$8,100',
          foundingMemberPrice: null,
          highlightRects: [{ x: 393, y: 439, width: 77, height: 49 }],
          priceRedaction: {
            listPrice: { x: 52, y: 152, width: 440, height: 32 },
            foundingPrice: { x: 52, y: 118, width: 440, height: 32 },
          },
        },
      },
      {
        pageIndex: 8,
        label: 'Conference Rooms',
        type: 'other',
      },
      {
        pageIndex: 9,
        label: 'Common Areas',
        type: 'other',
      },
      {
        pageIndex: 10,
        label: 'Membership Benefits',
        type: 'other',
      },
    ],
    style: {
      backgroundFill: { r: 255, g: 253, b: 245 },
      badgeBlue: { r: 43, g: 58, b: 103 },
      badgeGray: { r: 235, g: 235, b: 235 },
    },
  };
}
