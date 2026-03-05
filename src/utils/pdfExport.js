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

  // Load and embed summary border image
  let embeddedBorderImage = null;
  try {
    const borderBytes = await fetch('/summary-border.png').then(res => res.arrayBuffer());
    embeddedBorderImage = await newPdf.embedPng(borderBytes);
  } catch (e) {
    console.warn('Could not load summary border image:', e);
  }
  const fontBold = await newPdf.embedFont(StandardFonts.HelveticaBold);
  const font = await newPdf.embedFont(StandardFonts.Helvetica);

  // Load Work Sans Bold for summary title
  let workSansBold = fontBold; // fallback
  try {
    const workSansBytes = await fetch('/WorkSans-Bold.ttf').then(res => res.arrayBuffer());
    workSansBold = await newPdf.embedFont(workSansBytes);
  } catch (e) {
    console.warn('Could not load Work Sans Bold font:', e);
  }

  // Resolve style from config or use defaults
  const style = config?.style || {
    backgroundFill: { r: 254, g: 247, b: 237 },
    badgeBlue: { r: 15, g: 46, b: 73 },
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
        const availability = pageConfig.suiteConfig?.availability || (pageConfig.suiteConfig?.rented ? 'rented' : 'available');
        let available = '';
        if (availability === 'available_date' && pageConfig.suiteConfig?.availableDate) {
          const d = new Date(pageConfig.suiteConfig.availableDate + 'T00:00:00');
          available = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        } else if (availability === 'available') {
          available = 'Today';
        }
        selectedSuites.push({
          label: suiteName,
          price: customPrices[pageNum] || pageConfig.suiteConfig?.foundingMemberPrice || pageConfig.suiteConfig?.listPrice || '',
          desks: deskCount,
          available,
        });
      }
    }

    if (selectedSuites.length > 0) {
      const dims = config.pageDimensions || { width: 540, height: 779 };
      const summaryPage = newPdf.insertPage(0, [dims.width, dims.height]);
      drawSummaryPage(summaryPage, fontBold, font, selectedSuites, dims, BADGE_BLUE, BADGE_GRAY, CREAM_COLOR, embeddedBorderImage, workSansBold);
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

function drawSummaryPage(page, fontBold, font, suites, dims, BADGE_BLUE, BADGE_GRAY, CREAM_COLOR, embeddedBorderImage, workSansBold) {
  const { width, height } = dims;

  // Cream background
  page.drawRectangle({ x: 0, y: 0, width, height, color: CREAM_COLOR });

  // Draw border image as background overlay (scaled to fit page dimensions)
  if (embeddedBorderImage) {
    page.drawImage(embeddedBorderImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  // Cover "WORKPLACE FOR BRAND BUILDERS" text from the border image
  // Use exact background color sampled from the border image PNG
  const BORDER_BG = rgb(254 / 255, 247 / 255, 237 / 255);
  page.drawRectangle({
    x: width * 0.25,
    y: height - height * 0.195,
    width: width * 0.5,
    height: height * 0.01,
    color: BORDER_BG,
  });

  // Title
  const titleFont = workSansBold || fontBold;
  const titleSize = 16;
  const titleText = 'Proposal Summary';
  const titleWidth = titleFont.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y: height - 230,
    size: titleSize,
    font: titleFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Suite rows — 4 columns: name (blue), price (gray), desks (blue), available (gray)
  const rowHeight = 30;
  const rowSpacing = 10;
  const margin = 50;
  const rowWidth = width - margin * 2;
  const startX = margin;
  let currentY = height - 280;
  const fontSize = 12;
  const colWidth = rowWidth / 4;

  // Header row
  const headerY = currentY;
  const headerTextY = headerY + (rowHeight - fontSize) / 2 + 1;

  // Header Col 1: blue bg, white text
  page.drawRectangle({ x: startX, y: headerY, width: colWidth, height: rowHeight, color: BADGE_BLUE });
  const h1 = 'Suite Number';
  page.drawText(h1, { x: startX + (colWidth - fontBold.widthOfTextAtSize(h1, fontSize)) / 2, y: headerTextY, size: fontSize, font: fontBold, color: rgb(1, 1, 1) });

  // Header Col 2: gray bg, blue text
  page.drawRectangle({ x: startX + colWidth, y: headerY, width: colWidth, height: rowHeight, color: BADGE_GRAY });
  const h2 = 'Price';
  page.drawText(h2, { x: startX + colWidth + (colWidth - fontBold.widthOfTextAtSize(h2, fontSize)) / 2, y: headerTextY, size: fontSize, font: fontBold, color: BADGE_BLUE });

  // Header Col 3: blue bg, white text
  page.drawRectangle({ x: startX + colWidth * 2, y: headerY, width: colWidth, height: rowHeight, color: BADGE_BLUE });
  const h3 = 'Number of Desks';
  page.drawText(h3, { x: startX + colWidth * 2 + (colWidth - fontBold.widthOfTextAtSize(h3, fontSize)) / 2, y: headerTextY, size: fontSize, font: fontBold, color: rgb(1, 1, 1) });

  // Header Col 4: gray bg, blue text
  page.drawRectangle({ x: startX + colWidth * 3, y: headerY, width: colWidth, height: rowHeight, color: BADGE_GRAY });
  const h4 = 'Available';
  page.drawText(h4, { x: startX + colWidth * 3 + (colWidth - fontBold.widthOfTextAtSize(h4, fontSize)) / 2, y: headerTextY, size: fontSize, font: fontBold, color: BADGE_BLUE });

  currentY -= (rowHeight + rowSpacing);

  for (const suite of suites) {
    const textY = currentY + (rowHeight - fontSize) / 2 + 1;

    // Col 1: blue background with suite name in white
    page.drawRectangle({ x: startX, y: currentY, width: colWidth, height: rowHeight, color: BADGE_BLUE });
    const labelWidth = fontBold.widthOfTextAtSize(suite.label, fontSize);
    page.drawText(suite.label, { x: startX + (colWidth - labelWidth) / 2, y: textY, size: fontSize, font: fontBold, color: rgb(1, 1, 1) });

    // Col 2: gray background with price in blue
    page.drawRectangle({ x: startX + colWidth, y: currentY, width: colWidth, height: rowHeight, color: BADGE_GRAY });
    if (suite.price) {
      const priceWidth = font.widthOfTextAtSize(suite.price, fontSize);
      page.drawText(suite.price, { x: startX + colWidth + (colWidth - priceWidth) / 2, y: textY, size: fontSize, font: font, color: BADGE_BLUE });
    }

    // Col 3: blue background with desk count in white
    page.drawRectangle({ x: startX + colWidth * 2, y: currentY, width: colWidth, height: rowHeight, color: BADGE_BLUE });
    if (suite.desks) {
      const desksText = `up to ${suite.desks} desks`;
      const desksWidth = fontBold.widthOfTextAtSize(desksText, fontSize);
      page.drawText(desksText, { x: startX + colWidth * 2 + (colWidth - desksWidth) / 2, y: textY, size: fontSize, font: fontBold, color: rgb(1, 1, 1) });
    }

    // Col 4: gray background with available date in blue
    page.drawRectangle({ x: startX + colWidth * 3, y: currentY, width: colWidth, height: rowHeight, color: BADGE_GRAY });
    if (suite.available) {
      const availWidth = font.widthOfTextAtSize(suite.available, fontSize);
      page.drawText(suite.available, { x: startX + colWidth * 3 + (colWidth - availWidth) / 2, y: textY, size: fontSize, font: font, color: BADGE_BLUE });
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
