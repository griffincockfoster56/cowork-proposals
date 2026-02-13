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
 * @param {object} [customConferenceText] - map of pageNum → conference text string
 */
export async function exportSelectedPages(pdfSource, selectedPageNumbers, customPrices = {}, config, customConferenceText = {}) {
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

    // Conference text redaction
    if (config) {
      const pageConfig = config.pages[originalPageNum - 1];
      if (pageConfig?.type === 'conference' && pageConfig.conferenceConfig?.textRedaction) {
        const conferenceText = customConferenceText[originalPageNum] || pageConfig.conferenceConfig.defaultText;
        if (conferenceText) {
          const rect = pageConfig.conferenceConfig.textRedaction;
          // Cover original text
          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: CREAM_COLOR,
          });
          // Draw replacement text centered in the rect
          const fontSize = 12;
          const textWidth = font.widthOfTextAtSize(conferenceText, fontSize);
          const textX = rect.x + (rect.width - textWidth) / 2;
          const textY = rect.y + (rect.height - fontSize) / 2 + 1;
          page.drawText(conferenceText, {
            x: textX,
            y: textY,
            size: fontSize,
            font: font,
            color: rgb(0.1, 0.1, 0.1),
          });
        }
      }
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

  // Insert summary page after the first overview page
  if (config) {
    const selectedSuites = [];
    for (const pageNum of selectedPageNumbers) {
      const pageConfig = config.pages[pageNum - 1];
      if (pageConfig?.type === 'suite') {
        const suiteName = pageConfig.label.split(' - ')[0] || pageConfig.label;
        const deskCount = pageConfig.suiteConfig?.deskCount || null;
        selectedSuites.push({
          label: suiteName,
          price: customPrices[pageNum] || pageConfig.suiteConfig?.listPrice || '',
          desks: deskCount,
        });
      }
    }

    if (selectedSuites.length > 0) {
      // Find position of first overview page in output order
      let insertIndex = 0;
      for (let i = 0; i < selectedPageNumbers.length; i++) {
        const pageConfig = config.pages[selectedPageNumbers[i] - 1];
        if (pageConfig?.type === 'overview') {
          insertIndex = i + 1;
          break;
        }
      }

      const dims = config.pageDimensions || { width: 540, height: 779 };
      const summaryPage = newPdf.insertPage(insertIndex, [dims.width, dims.height]);
      drawSummaryPage(summaryPage, fontBold, font, selectedSuites, dims, BADGE_BLUE, BADGE_GRAY, CREAM_COLOR);
    }
  }

  const pdfBytes = await newPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `proposal-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function drawSummaryPage(page, fontBold, font, suites, dims, BADGE_BLUE, BADGE_GRAY, CREAM_COLOR) {
  const { width, height } = dims;

  // Cream background
  page.drawRectangle({ x: 0, y: 0, width, height, color: CREAM_COLOR });

  // Title
  const titleSize = 22;
  const titleText = 'Proposal Summary';
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 80,
    size: titleSize,
    font: fontBold,
    color: BADGE_BLUE,
  });

  // Suite rows — 3 columns: name (blue), price (gray), desks (blue)
  const rowHeight = 30;
  const rowSpacing = 10;
  const margin = 50;
  const rowWidth = width - margin * 2;
  const startX = margin;
  let currentY = height - 130;
  const fontSize = 12;
  const colWidth = rowWidth / 3;

  for (const suite of suites) {
    const textY = currentY + (rowHeight - fontSize) / 2 + 1;

    // Col 1: blue background with suite name in white
    page.drawRectangle({
      x: startX,
      y: currentY,
      width: colWidth,
      height: rowHeight,
      color: BADGE_BLUE,
    });
    const labelWidth = fontBold.widthOfTextAtSize(suite.label, fontSize);
    page.drawText(suite.label, {
      x: startX + (colWidth - labelWidth) / 2,
      y: textY,
      size: fontSize,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Col 2: gray background with price in blue
    page.drawRectangle({
      x: startX + colWidth,
      y: currentY,
      width: colWidth,
      height: rowHeight,
      color: BADGE_GRAY,
    });
    if (suite.price) {
      const priceWidth = font.widthOfTextAtSize(suite.price, fontSize);
      page.drawText(suite.price, {
        x: startX + colWidth + (colWidth - priceWidth) / 2,
        y: textY,
        size: fontSize,
        font: font,
        color: BADGE_BLUE,
      });
    }

    // Col 3: blue background with desk count in white
    page.drawRectangle({
      x: startX + colWidth * 2,
      y: currentY,
      width: colWidth,
      height: rowHeight,
      color: BADGE_BLUE,
    });
    if (suite.desks) {
      const desksText = `up to ${suite.desks} desks`;
      const desksWidth = fontBold.widthOfTextAtSize(desksText, fontSize);
      page.drawText(desksText, {
        x: startX + colWidth * 2 + (colWidth - desksWidth) / 2,
        y: textY,
        size: fontSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    }

    currentY -= (rowHeight + rowSpacing);
  }
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
