import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generates and downloads an official PDF election report.
 */
export const exportToPDF = async ({
  title = 'Official Election Report',
  subtitle = '',
  electionName = 'College Union Election 2024',
  boothDetails = null, // { name, code, location }
  printedBy = 'VoteFlow System',
  columns = [],
  data = [],
  fileName = 'Election_Report.pdf',
  orientation = 'auto',
}) => {
  const isLandscape = orientation === 'landscape' || (orientation === 'auto' && columns.length > 5)
  const finalOrientation = isLandscape ? 'landscape' : 'portrait'

  const doc = new jsPDF({
    orientation: finalOrientation,
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const centerX = pageWidth / 2

  // Format date as: 24 Jul 2026 • 10:20 PM
  const getFormattedFooterDate = () => {
    const d = new Date()
    const day = d.getDate()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[d.getMonth()]
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`
  }

  const formattedFooterDate = getFormattedFooterDate()

  // ── HEADER ──────────────────────────────────────────
  // Centered Badge Logo Box
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(centerX - 6, 10, 12, 8, 1.5, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('V', centerX, 15.5, { align: 'center' })

  // Organization / Election Name (18px / ~13.5pt Bold)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(15, 23, 42)
  doc.text(electionName.toUpperCase(), centerX, 24, { align: 'center' })

  // Report Title (15px / ~11.5pt Bold)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(30, 58, 138)
  doc.text(title.toUpperCase(), centerX, 31, { align: 'center' })

  let startYPosition = 35

  // ── METADATA BOX ─────────────────────────────────────
  if (boothDetails) {
    // Clean Minimal 2-Column Booth Info Box (11px / ~8.5pt)
    const metaHeight = 14
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(203, 213, 225)
    doc.roundedRect(14, startYPosition, pageWidth - 28, metaHeight, 1, 1, 'FD')

    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)

    // Left Column
    doc.setFont('helvetica', 'bold')
    doc.text('Booth Name :', 18, startYPosition + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(String(boothDetails.name || 'N/A'), 40, startYPosition + 5)

    doc.setFont('helvetica', 'bold')
    doc.text('Booth Code :', 18, startYPosition + 10)
    doc.setFont('helvetica', 'normal')
    doc.text(String(boothDetails.code || 'N/A'), 40, startYPosition + 10)

    // Right Column
    doc.setFont('helvetica', 'bold')
    doc.text('Location :', pageWidth - 65, startYPosition + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(String(boothDetails.location || 'N/A'), pageWidth - 42, startYPosition + 5)

    doc.setFont('helvetica', 'bold')
    doc.text('Total Students :', pageWidth - 65, startYPosition + 10)
    doc.setFont('helvetica', 'normal')
    doc.text(String(data.length), pageWidth - 42, startYPosition + 10)

    startYPosition += metaHeight + 5
  } else if (subtitle) {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text(subtitle, centerX, startYPosition + 2, { align: 'center' })
    startYPosition += 7
  } else {
    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(0.5)
    doc.line(14, startYPosition, pageWidth - 14, startYPosition)
    startYPosition += 4
  }

  // ── TABLE GENERATION ────────────────────────────────
  const tableHeaders = columns.map((col) => (typeof col === 'string' ? col : col.header))
  const tableRows = data.map((row, rowIndex) => {
    if (Array.isArray(row)) return row
    return columns.map((col) => {
      const key = typeof col === 'string' ? col : col.dataKey
      if (typeof col.cell === 'function') {
        return col.cell(row, rowIndex)
      }
      return row[key] !== undefined && row[key] !== null ? String(row[key]) : ''
    })
  })

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: startYPosition,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5, // ~11px
      halign: 'left',
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 7.5, // ~10px
      textColor: [30, 41, 59],
      cellPadding: 3,
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    gridLineColor: [203, 213, 225],
    gridLineWidth: 0.3,
    margin: { top: 30, bottom: 18, left: 14, right: 14 },
    didDrawPage: (dataArg) => {
      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.3)
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12)

      doc.text(`Printed on: ${formattedFooterDate}`, 14, pageHeight - 7)
      doc.text(`Page ${dataArg.pageNumber} of ${pageCount}`, pageWidth - 14, pageHeight - 7, {
        align: 'right',
      })
    },
  })

  doc.save(fileName)
}
