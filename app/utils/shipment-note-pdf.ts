import type { jsPDF } from 'jspdf'

export interface ShipmentNoteItem {
  name: string
  weightKg: number
  price: number
  value: number
}

export interface ShipmentNoteInput {
  noteNumber: string
  shippedAt: string
  collector: string
  operator: string
  status: string
  totalWeight: string
  totalValue: string
  items: ShipmentNoteItem[]
  formatValue?: (value: number) => string
  formatWeight?: (value: number) => string
  masthead: string[]
  title: string
  collectorLabel?: string
  operatorLabel?: string
  dateLabel?: string
  statusLabel?: string
  itemsLabel?: string
  totalLabel?: string
  signatures?: { leftLabel: string, rightLabel: string, leftName: string, rightName: string }
}

const MARGIN = 14
const LINE = 6
const BOTTOM = 282

function ensureRoom(doc: jsPDF, y: number, need = LINE): number {
  if (y + need <= BOTTOM) return y
  doc.addPage()
  return 20
}

/**
 * Draws a single shipment handover note (SJ-xxxx) as plain jsPDF text.
 *
 * ponytail: same text-only approach as report-pdf — no canvas, no screenshots,
 * so it renders identically on any phone browser. Snapshot names and prices
 * come from the shipment's own lines, never from the master tables.
 */
export function drawShipmentNotePdf(doc: jsPDF, input: ShipmentNoteInput): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const right = pageWidth - MARGIN
  const center = pageWidth / 2
  let y = 18

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
  doc.setFontSize(11)
  doc.text(`${input.noteNumber}`, MARGIN, y)
  y += LINE
  const meta: string[] = []
  if (input.dateLabel) meta.push(`${input.dateLabel}: ${input.shippedAt}`)
  if (input.collectorLabel) meta.push(`${input.collectorLabel}: ${input.collector}`)
  if (input.operatorLabel) meta.push(`${input.operatorLabel}: ${input.operator}`)
  if (input.statusLabel) meta.push(`${input.statusLabel}: ${input.status}`)
  for (const line of meta) {
    y = ensureRoom(doc, y)
    for (const wrapped of doc.splitTextToSize(line, right - MARGIN)) {
      y = ensureRoom(doc, y)
      doc.text(wrapped, MARGIN, y)
      y += LINE
    }
  }
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  y = ensureRoom(doc, y, LINE * 3)
  doc.text(input.itemsLabel ?? 'Items', MARGIN, y)
  y += LINE + 1

  doc.setFontSize(10)
  doc.text('Kategori', MARGIN, y)
  doc.text('Berat', right - 55, y, { align: 'right' })
  doc.text('Nilai', right, y, { align: 'right' })
  y += 2
  doc.line(MARGIN, y, right, y)
  y += LINE - 1

  doc.setFont('helvetica', 'normal')
  const fmtWeight = input.formatWeight ?? ((v: number) => `${v} kg`)
  const fmtValue = input.formatValue ?? ((v: number) => `${v}`)
  for (const item of input.items) {
    const nameLines = doc.splitTextToSize(item.name, right - MARGIN - 90)
    for (const text of nameLines) {
      y = ensureRoom(doc, y)
      doc.text(text, MARGIN, y)
      y += LINE
    }
    doc.text(fmtWeight(item.weightKg), right - 55, y - LINE, { align: 'right' })
    doc.text(fmtValue(item.value), right, y - LINE, { align: 'right' })
  }

  y += 2
  doc.line(MARGIN, y, right, y)
  y += LINE
  doc.setFont('helvetica', 'bold')
  doc.text(input.totalLabel ?? 'Total', MARGIN, y)
  doc.text(input.totalWeight, right - 55, y, { align: 'right' })
  doc.text(input.totalValue, right, y, { align: 'right' })
  y += LINE + 8

  if (input.signatures) {
    y = ensureRoom(doc, y, LINE * 4)
    const mid = (MARGIN + right) / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(input.signatures.leftLabel, MARGIN, y)
    doc.text(input.signatures.rightLabel, mid + 10, y)
    y += 22
    doc.line(MARGIN, y, mid - 10, y)
    doc.line(mid + 10, y, right, y)
    y += LINE
    doc.text(input.signatures.leftName, MARGIN, y)
    doc.text(input.signatures.rightName, mid + 10, y)
  }
}
