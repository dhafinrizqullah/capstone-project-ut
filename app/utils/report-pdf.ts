import type { jsPDF } from 'jspdf'

export interface PdfSection {
  heading: string
  head: string[]
  rows: (string | number)[][]
}

export interface PdfInput {
  title: string
  meta: string
  kpi: string[]
  sections: PdfSection[]
  /** letterhead lines, centered above the rule: e.g. org name + scope */
  masthead: string[]
}

const MARGIN = 14
const LINE = 6
const BOTTOM = 282

function ensureRoom(doc: jsPDF, y: number, need = LINE): number {
  if (y + need <= BOTTOM) return y
  doc.addPage()
  return 20
}

// ponytail: plain text tables, no canvas — renders identically on every phone browser
export function drawReportPdf(doc: jsPDF, input: PdfInput): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const right = pageWidth - MARGIN
  const center = pageWidth / 2
  let y = 18

  // official letterhead: org name + scope, centered, under a double rule
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const [org, ...rest] = input.masthead
  if (org) {
    y = ensureRoom(doc, y)
    doc.text(org, center, y, { align: 'center' })
    y += 7
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  for (const line of rest) {
    y = ensureRoom(doc, y)
    doc.text(line, center, y, { align: 'center' })
    y += LINE
  }
  y += 2
  doc.setLineWidth(0.8)
  doc.line(MARGIN, y, right, y)
  y += 2
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, right, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(input.title, MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const line of doc.splitTextToSize(input.meta, right - MARGIN)) {
    y = ensureRoom(doc, y)
    doc.text(line, MARGIN, y)
    y += LINE
  }
  y += 2

  doc.setFontSize(11)
  for (const kpi of input.kpi) {
    y = ensureRoom(doc, y)
    doc.text(`• ${kpi}`, MARGIN, y)
    y += LINE
  }
  y += 4

  for (const section of input.sections) {
    y = ensureRoom(doc, y, LINE * 3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(section.heading, MARGIN, y)
    y += LINE + 1

    doc.setFontSize(10)
    const colW = right - MARGIN - 40
    doc.text(section.head[0] ?? '', MARGIN, y)
    doc.text(section.head[1] ?? '', right, y, { align: 'right' })
    y += 2
    doc.line(MARGIN, y, right, y)
    y += LINE - 1

    doc.setFont('helvetica', 'normal')
    for (const row of section.rows) {
      y = ensureRoom(doc, y)
      const cells = row.map(String)
      for (const line of doc.splitTextToSize(cells[0] ?? '', colW)) {
        y = ensureRoom(doc, y)
        doc.text(line, MARGIN, y)
        y += LINE
      }
      // ponytail: value shares the row's last line, right-aligned
      doc.text(cells[1] ?? '', right, y - LINE, { align: 'right' })
    }
    y += 4
    doc.setFont('helvetica', 'bold')
  }
}
