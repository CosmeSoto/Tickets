/**
 * Carga PDFKit de forma que Turbopack no pueda analizar estáticamente.
 * Esto evita el error de fontkit/applyDecoratedDescriptor con @swc/helpers.
 */
let _PDFDocument: any = null

export function loadPDFKit(): any {
  if (!_PDFDocument) {
    // Indirección para evitar análisis estático de Turbopack
    const mod = 'pdfkit'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _PDFDocument = require(mod)
  }
  return _PDFDocument
}
