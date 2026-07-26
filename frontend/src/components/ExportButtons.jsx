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
  groupedData = null,
  summaryData = null,
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
        groupedData,
        summaryData,
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

      {/* Top Winners Summary Section (Page 1 Executive Summary) */}
      {summaryData && summaryData.length > 0 && (
        <div
          style={{
            marginTop: '14px',
            marginBottom: '20px',
            pageBreakAfter: 'always',
            breakAfter: 'page',
          }}
        >
          {/* Section Header */}
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: '900',
              letterSpacing: '1px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              marginBottom: '12px',
              textAlign: 'center',
              borderBottom: '2px solid #3b82f6',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
              breakAfter: 'avoid',
              pageBreakAfter: 'avoid',
            }}
          >
            🏆 TOP WINNERS SUMMARY
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '10px',
            }}
          >
            {summaryData.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '9px 11px',
                  backgroundColor: '#f8fafc',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                }}
              >
                {/* Position Name Header */}
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    borderBottom: '1.5px solid #0f172a',
                    paddingBottom: '3px',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>🏆</span>
                  <span>{item.positionName}</span>
                </div>

                {/* Winner Info */}
                {item.winner ? (
                  <div style={{ fontSize: '10px', lineHeight: '1.5', color: '#0f172a' }}>
                    <div style={{ fontWeight: '800', color: '#166534', fontSize: '10.5px', marginBottom: '2px' }}>
                      Winner : <span style={{ color: '#0f172a' }}>{item.winner.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: '700', color: '#475569' }}>Symbol :</span>
                      {item.winner.symbolType === 'image' && item.winner.symbol ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <img src={item.winner.symbol} alt="" style={{ width: '15px', height: '15px', objectFit: 'contain' }} />
                          <span>{item.winner.symbolName || ''}</span>
                        </span>
                      ) : (
                        <span>{item.winner.symbol || item.winner.symbolName || 'N/A'}</span>
                      )}
                    </div>

                    <div>
                      <span style={{ fontWeight: '700', color: '#475569' }}>Dept / Class :</span> {item.winner.dept}
                    </div>

                    <div>
                      <span style={{ fontWeight: '700', color: '#475569' }}>Total Votes :</span> <strong style={{ color: '#0f172a' }}>{item.winner.voteCount}</strong>
                    </div>

                    {/* Runner-up (Optional) */}
                    {item.runnerUp && (
                      <div
                        style={{
                          marginTop: '5px',
                          paddingTop: '5px',
                          borderTop: '1px dashed #cbd5e1',
                          fontSize: '9.5px',
                          color: '#475569',
                        }}
                      >
                        <span style={{ fontWeight: '700', color: '#854d0e' }}>🥈 Runner-up :</span> {item.runnerUp.name}
                        <span style={{ marginLeft: '6px', fontWeight: '700', color: '#334155' }}>({item.runnerUp.voteCount} votes)</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '9.5px', color: '#64748b' }}>No winner data</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1.5px solid #0f172a', marginTop: '14px', marginBottom: '8px' }} />
        </div>
      )}

      {/* Grouped Tables vs Flat Table */}
      {groupedData && groupedData.length > 0 ? (
        <div style={{ marginTop: '14px' }}>
          {groupedData.map((group, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: '20px' }}>
              {/* Position Header Banner */}
              <div
                className="print-position-banner"
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '0.8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  marginTop: groupIdx === 0 ? '0px' : '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                  breakAfter: 'avoid',
                  pageBreakAfter: 'avoid',
                }}
              >
                <span style={{ opacity: 0.8, fontWeight: '700', fontSize: '11px', color: '#ffffff' }}>POSITION:</span>
                <span style={{ color: '#ffffff', fontWeight: '800' }}>{group.groupTitle}</span>
              </div>

              <table className="print-table" style={{ width: '100%' }}>
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
                  {group.items && group.items.length > 0 ? (
                    group.items.map((row, rowIdx) => (
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
                        style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontWeight: 'bold', fontSize: '10px' }}
                      >
                        No candidates for this position.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        /* Dedicated Printable Flat Table */
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
      )}

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
