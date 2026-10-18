import { describe, expect, test } from 'vitest'
import { jsPDF } from 'jspdf'
import { drawReportPdf, type PdfInput } from '../app/utils/report-pdf'

const input = (rows: number): PdfInput => ({
  title: 'Laporan RW',
  meta: 'Dibuat: 18 Oktober 2026 · Wilayah: RW 05',
  masthead: ['BANK SAMPAH RW DIGITAL', 'Wilayah: RW 05'],
  kpi: ['Total Sampah Terkumpul: 463 kg', 'Transaksi: 58'],
  sections: [
    {
      heading: 'Per kategori',
      head: ['Kategori', 'Berat'],
      rows: Array.from({ length: rows }, (_, i) => [`Kategori ${i + 1}`, `${i + 1} kg`]),
    },
    {
      heading: 'Per RT',
      head: ['RW · RT', 'Berat'],
      rows: [['RW 05 · RT 01', '155 kg']],
    },
  ],
})

describe('drawReportPdf', () => {
  test('draws a one-page recap without throwing', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    drawReportPdf(doc, input(6))
    expect(doc.getNumberOfPages()).toBe(1)
    expect(doc.output('datauristring').length).toBeGreaterThan(1000)
  })

  test('paginates instead of writing past the page bottom', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    drawReportPdf(doc, input(200))
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })
})
