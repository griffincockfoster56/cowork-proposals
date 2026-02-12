import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getHighlightsForOverviewPage } from '../config/suiteHighlights';

// Legacy hardcoded coords — used when no config is provided
const LEGACY_PRICE_REDACTION_COORDS = {
  2: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } },
  3: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } },
  4: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } },
  5: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } },
  7: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } },
  8: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } },
};

/**
 * @param {string|ArrayBuffer} pdfSource - URL string or ArrayBuffer of the template PDF
 * @param {number[]} selectedPageNumbers - 1-indexed page numbers to include
 * @param {object} customPrices - map of pageNum → price string
 * @param {object} [config] - optional template config
 */
export async function exportSelectedPages(pdfSource, selectedPageNumbers, customPrices = {}, config) {
  // Load template from URL or ArrayBuffer
  let templateBytes;
  if (typeof pdfSource === 'string') {
    templateBytes = await fetch(pdfSource).then(res => res.arrayBuffer());
  } else {
    templateBytes = pdfSource;
  }
  const templatePdf = await PDFDocument.load(templateBytes);

  const newPdf = await PDFDocument.create();
  const fontBold = await newPdf.embedFont(StandardFonts.HelveticaBold);
  const font = await newPdf.embedFont(StandardFonts.Helvetica);

  // Resolve style from config or use defaults
  const style = config?.style || {
    backgroundFill: { r: 255, g: 253, b: 245 },
    badgeBlue: { r: 43, g: 58, b: 103 },
    badgeGray: { r: 235, g: 235, b: 235 },
  };
  const CREAM_COLOR = rgb(style.backgroundFill.r / 255, style.backgroundFill.g / 255, style.backgroundFill.b / 255);
  const BADGE_BLUE = rgb(style.badgeBlue.r / 255, style.badgeBlue.g / 255, style.badgeBlue.b / 255);
  const BADGE_GRAY = rgb(style.badgeGray.r / 255, style.badgeGray.g / 255, style.badgeGray.b / 255);

  const pageIndices = selectedPageNumbers.map(num => num - 1);
  const copiedPages = await newPdf.copyPages(templatePdf, pageIndices);

  copiedPages.forEach((page, index) => {
    const originalPageNum = selectedPageNumbers[index];
    const customPrice = customPrices[originalPageNum];

    // Get redaction coords from config or legacy
    const redactionCoords = getRedactionCoords(originalPageNum, config);

    if (redactionCoords && customPrice) {
      const rowX = redactionCoords.foundingPrice.x;
      const rowWidth = redactionCoords.foundingPrice.width;
      const badgeHeight = 24;
      const areaBottom = redactionCoords.foundingPrice.y;
      const areaTop = redactionCoords.listPrice.y + redactionCoords.listPrice.height;
      const badgeY = (areaBottom + areaTop) / 2 - badgeHeight / 2;

      // Cover original price rows
      page.drawRectangle({
        x: redactionCoords.listPrice.x,
        y: redactionCoords.listPrice.y,
        width: redactionCoords.listPrice.width,
        height: redactionCoords.listPrice.height,
        color: CREAM_COLOR,
      });
      page.drawRectangle({
        x: redactionCoords.foundingPrice.x,
        y: redactionCoords.foundingPrice.y,
        width: redactionCoords.foundingPrice.width,
        height: redactionCoords.foundingPrice.height,
        color: CREAM_COLOR,
      });

      const halfWidth = rowWidth / 2;
      const fontSize = 12;
      const textY = badgeY + (badgeHeight - fontSize) / 2 + 1;

      // Left: blue "Price" label
      page.drawRectangle({
        x: rowX,
        y: badgeY,
        width: halfWidth,
        height: badgeHeight,
        color: BADGE_BLUE,
      });
      const labelText = 'Price';
      const labelTextWidth = fontBold.widthOfTextAtSize(labelText, fontSize);
      page.drawText(labelText, {
        x: rowX + (halfWidth - labelTextWidth) / 2,
        y: textY,
        size: fontSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      // Right: gray price value
      page.drawRectangle({
        x: rowX + halfWidth,
        y: badgeY,
        width: halfWidth,
        height: badgeHeight,
        color: BADGE_GRAY,
      });
      const priceTextWidth = font.widthOfTextAtSize(customPrice, fontSize);
      page.drawText(customPrice, {
        x: rowX + halfWidth + (halfWidth - priceTextWidth) / 2,
        y: textY,
        size: fontSize,
        font: font,
        color: BADGE_BLUE,
      });
    }

    // Draw highlights on overview pages
    const highlights = getHighlightsForOverviewPage(originalPageNum, new Set(selectedPageNumbers), config);
    for (const rect of highlights) {
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        borderColor: rgb(1, 0, 0),
        borderWidth: 2,
      });
    }

    newPdf.addPage(page);
  });

  const pdfBytes = await newPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proposal-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function getRedactionCoords(pageNum, config) {
  if (config) {
    const pageIndex = pageNum - 1;
    const pageConfig = config.pages[pageIndex];
    if (pageConfig?.type === 'suite' && pageConfig.suiteConfig?.priceRedaction) {
      return pageConfig.suiteConfig.priceRedaction;
    }
    return null;
  }
  return LEGACY_PRICE_REDACTION_COORDS[pageNum] || null;
}
