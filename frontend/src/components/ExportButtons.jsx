import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, FileText, Loader2 } from 'lucide-react'
import { exportToPDF } from '../utils/exportUtils'
import toast from 'react-hot-toast'

export default function ExportButtons({
  title = 'Official Election Report',
  subtitle = '',
  electionName = 'College Union Election 2024',
  boothDetails = null, // { name, code, location }
  printedBy = 'VoteFlow System',
  columns = [],
  data = [],
  fileName = 'Election_Report.pdf',
  orientation = 'auto',
  hidePDF = false,
  printLabel = 'Print',
  className = '',
}) {
  const [exportingPDF, setExportingPDF] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [instanceId] = useState(() => 'print-inst-' + Math.random().toString(36).substring(2, 9))

  const isLandscape = orientation === 'landscape' || (orientation === 'auto' && columns.length > 5)

  const handlePrint = () => {
    setIsPrinting(true)
    document.body.setAttribute('data-print-active-id', instanceId)

    setTimeout(() => {
      window.print()
      setTimeout(() => {
        document.body.removeAttribute('data-print-active-id')
        setIsPrinting(false)
      }, 1000)
    }, 50)
  }

  const handleExportPDF = async () => {
    setExportingPDF(true)
    try {
      await exportToPDF({
        title,
        subtitle,
        electionName,
        boothDetails,
        printedBy,
        columns,
        data,
        fileName,
        orientation,
      })
      toast.success('PDF report downloaded successfully')
    } catch (err) {
      console.error('PDF export error:', err)
      toast.error('Failed to generate PDF')
    } finally {
      setExportingPDF(false)
    }
  }

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

  // Render printable report via React Portal directly into document.body
  const printTemplate = (
    <div
      className={`print-only ${isPrinting ? 'active-print-target' : ''}`}
      data-print-id={instanceId}
    >
      {/* Official Centered Government / Institution Header */}
      <div className="print-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
        {/* Crest Logo Emblem */}
        <div
          style={{
            width: '36px',
            height: '36px',
            backgroundColor: '#0f172a',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: '900',
            fontSize: '18px',
            margin: '0 auto 8px auto',
            border: '2px solid #3b82f6',
          }}
        >
          V
        </div>

        {/* Organization / Election Name (18px Bold) */}
        <h1
          style={{
            margin: '0 0 6px 0',
            fontSize: '18px',
            fontWeight: '900',
            color: '#0f172a',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
          }}
        >
          {electionName}
        </h1>

        {/* Report Title (15px Bold) */}
        <h2
          style={{
            margin: '6px 0 14px 0',
            fontSize: '15px',
            fontWeight: '800',
            color: '#1e3a8a',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h2>

        {/* Minimal Two-Column Information Box (11px) */}
        {boothDetails ? (
          <div
            style={{
              borderTop: '1.5px solid #0f172a',
              borderBottom: '1px solid #cbd5e1',
              padding: '10px 4px',
              marginTop: '10px',
              fontSize: '11px',
              color: '#0f172a',
              lineHeight: '1.6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* Left Column */}
              <div style={{ textAlign: 'left' }}>
                <div>
                  <span style={{ fontWeight: '800' }}>Booth Name : </span>
                  <span>{boothDetails.name || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '800' }}>Booth Code : </span>
                  <span>{boothDetails.code || 'N/A'}</span>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ textAlign: 'right' }}>
                <div>
                  <span style={{ fontWeight: '800' }}>Location : </span>
                  <span>{boothDetails.location || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '800' }}>Total Students : </span>
                  <span>{data.length}</span>
                </div>
              </div>
            </div>
          </div>
        ) : subtitle ? (
          <div
            style={{
              borderTop: '1.5px solid #0f172a',
              borderBottom: '1px solid #cbd5e1',
              padding: '8px 4px',
              marginTop: '8px',
              fontSize: '11px',
              color: '#334155',
              fontWeight: '700',
            }}
          >
            <span>{subtitle}</span>
          </div>
        ) : (
          <div style={{ borderTop: '1.5px solid #0f172a', marginTop: '8px' }} />
        )}
      </div>

      {/* Dedicated Printable Table (Full 100% Width) */}
      <table className="print-table" style={{ marginTop: '16px' }}>
        <thead>
          <tr>
            <th style={{ width: '38px', textAlign: 'center', fontSize: '11px', fontWeight: '800' }}>#</th>
            {columns.map((col, idx) => (
              <th key={idx} style={{ fontSize: '11px', fontWeight: '800' }}>
                {typeof col === 'string' ? col : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, rowIdx) => (
              <tr key={row._id || rowIdx}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#334155', fontSize: '10px' }}>
                  {rowIdx + 1}
                </td>
                {columns.map((col, colIdx) => {
                  const key = typeof col === 'string' ? col : col.dataKey
                  let val = ''
                  if (typeof col.cell === 'function') {
                    val = col.cell(row, rowIdx)
                  } else {
                    val = row[key] !== undefined && row[key] !== null ? String(row[key]) : ''
                  }
                  return <td key={colIdx} style={{ fontSize: '10px' }}>{val}</td>
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + 1}
                style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontWeight: 'bold', fontSize: '10px' }}
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer with Printed Timestamp on Left & Page Info on Right */}
      <div className="print-footer">
        <span>Printed on: {formattedFooterDate}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  )

  return (
    <>
      {/* Dynamic A4 Print Orientation & Page Margins */}
      <style>{`
        @media print {
          @page {
            size: A4 ${isLandscape ? 'landscape' : 'portrait'};
            margin: 6mm 8mm;
          }
        }
      `}</style>

      {/* On-screen Export Buttons (Hidden during Print) */}
      <div className={`flex items-center gap-2 no-print ${className}`}>
        <button
          type="button"
          onClick={handlePrint}
          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hover:border-white/20 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
          title="Print Official Report"
        >
          <Printer size={15} className="text-primary-400" />
          <span>{printLabel}</span>
        </button>

        {!hidePDF && (
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="px-3.5 py-2 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 hover:text-white border border-primary-500/30 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
            title="Download PDF Report"
          >
            {exportingPDF ? (
              <Loader2 size={15} className="animate-spin text-primary-400" />
            ) : (
              <FileText size={15} className="text-primary-400" />
            )}
            <span>{exportingPDF ? 'Generating...' : 'Export PDF'}</span>
          </button>
        )}
      </div>

      {/* Portal to document.body */}
      {createPortal(printTemplate, document.body)}
    </>
  )
}
