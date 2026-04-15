// OCR utility for extracting text from image-based PDFs
const Tesseract = require('tesseract.js');
const pdfjsLib = require('pdfjs-dist/build/pdf.js');

async function extractTextFromPDFWithOCR(buffer) {
  // Load PDF
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const ops = await page.getOperatorList();
    const hasText = ops.fnArray.includes(pdfjsLib.OPS.showText);
    if (hasText) {
      // Try to extract text normally
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ');
    } else {
      // Render page to image and OCR
      const viewport = page.getViewport({ scale: 2.0 });
      const canvasFactory = new pdfjsLib.NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      await page.render({ canvasContext: canvasAndContext.context, viewport, canvasFactory }).promise;
      const image = canvasAndContext.canvas.toBuffer();
      const { data: { text } } = await Tesseract.recognize(image, 'eng');
      fullText += text;
    }
  }
  return fullText;
}

module.exports = { extractTextFromPDFWithOCR };