import { describe, expect, test } from 'vitest'
import { jsPDF } from 'jspdf'
import { drawShipmentNotePdf, type ShipmentNoteInput } from '../app/utils/shipment-note-pdf'

const input = (rows: number): ShipmentNoteInput => ({
  title: 'Nota Serah Terima',
  masthead: ['BANK SAMPAH RW DIGITAL', 'Pengepul'],
  noteNumber: 'No. nota SJ-000001',
  shippedAt: '18 Oktober 2026, 14.00',
  collector: 'Budi Pengepul',
  operator: 'Sari Petugas',
  status: 'Dikirim',
  totalWeight: '12,5 kg',
  totalValue: 'Rp 125.000',
  items: Array.from({ length: rows }, (_, i) => ({
    name: `Kategori ${i + 1}`,
    weightKg: i + 1,
    price: 10000,
    value: (i + 1) * 10000,
  })),
  collectorLabel: 'Pengepul',
  operatorLabel: 'Petugas',
  dateLabel: 'Tanggal kirim',
  statusLabel: 'Status',
  itemsLabel: 'Rincian muatan',
  totalLabel: 'Nilai timbulan',
  signatures: {
    leftLabel: 'Petugas',
    rightLabel: 'Pengepul',
    leftName: 'Sari Petugas',
    rightName: 'Budi Pengepul',
  },
})

describe('drawShipmentNotePdf', () => {
  test('draws a one-page note without throwing', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    drawShipmentNotePdf(doc, input(3))
    expect(doc.getNumberOfPages()).toBe(1)
    expect(doc.output('datauristring').length).toBeGreaterThan(1000)
  })

  test('paginates instead of writing past the page bottom', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    drawShipmentNotePdf(doc, input(100))
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })
})
