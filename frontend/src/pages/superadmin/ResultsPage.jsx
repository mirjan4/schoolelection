import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, BarChart2, RefreshCw, Crown } from 'lucide-react'
import { resultsAPI, getMediaUrl } from '../../services/api'
import { useSocket } from '../../context/SocketContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'
import ExportButtons from '../../components/ExportButtons'

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444']

const WinnerCard = ({ candidate, rank, type }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className={`relative glass-card p-5 overflow-hidden ${rank === 0 ? 'border-gold-500/40' : 'border-white/10'}`}
    style={rank === 0 ? { boxShadow: '0 0 30px rgba(251,191,36,0.15)' } : {}}
  >
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
          ${rank === 0 ? 'bg-gold-500/20' : rank === 1 ? 'bg-white/10' : 'bg-white/5'}`}>
          {candidate.photo ? (
            <img src={getMediaUrl(candidate.photo)} alt={candidate.name} className="w-full h-full object-cover rounded-2xl" />
          ) : candidate.symbolType === 'image' && candidate.symbolImage ? (
            <img src={getMediaUrl(candidate.symbolImage)} alt={candidate.symbol} className="w-full h-full object-contain p-1" />
          ) : (
            candidate.symbolIcon || '⭐'
          )}
        </div>
        <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
          ${rank === 0 ? 'bg-gold-400 text-black' : rank === 1 ? 'bg-gray-400 text-black' : 'bg-amber-700 text-white'}`}>
          {rank + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className={`font-bold truncate ${rank === 0 ? 'text-gold-300' : 'text-white'}`}>{candidate.name}</h3>
        <p className="text-white/60 text-xs truncate flex items-center gap-1 font-medium">
          {candidate.symbolIcon && <span>{candidate.symbolIcon}</span>}
          <span>{candidate.symbol}</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-white/5 rounded-full h-1.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${candidate.percentage}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className={`h-1.5 rounded-full ${rank === 0 ? 'bg-gold-400' : 'bg-primary-500'}`}
            />
          </div>
          <span className="text-white/60 text-xs font-mono">{candidate.percentage}%</span>
        </div>
      </div>

      <div className="text-right shrink-0 flex flex-col items-end justify-center">
        {rank === 0 && (
          <div className="flex items-center gap-1 mb-1.5 bg-gold-500/20 text-gold-400 text-[10px] font-black px-2 py-0.5 rounded border border-gold-500/30 tracking-widest uppercase">
            <Crown size={12} className="text-gold-400" />
            <span>{type === 'school' ? 'SCHOOL LEADER' : type === 'class' ? 'CLASS LEADER' : 'WINNER'}</span>
          </div>
        )}
        {rank === 1 && (type === 'school' || type === 'class') && (
          <div className="mb-1.5 bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded border border-white/10 tracking-widest uppercase">
            {type === 'school' ? 'ASST. SCHOOL LEADER' : 'ASST. CLASS LEADER'}
          </div>
        )}
        <p className={`text-2xl font-bold leading-none ${rank === 0 ? 'text-gold-400' : 'text-white'}`}>{candidate.voteCount}</p>
        <p className="text-white/30 text-[10px] mt-0.5 uppercase tracking-wider font-semibold">votes</p>
      </div>
    </div>
  </motion.div>
)

export default function ResultsPage() {
  const { socket } = useSocket()
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchResults = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await resultsAPI.getAll()
      setResults(res.data.data)
    } catch (err) {
      toast.error('Failed to load results')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchResults() }, [fetchResults])

  useEffect(() => {
    if (!socket) return
    socket.on('stats_update', () => fetchResults(true))
    socket.on('vote_cast', () => fetchResults(true))
    return () => { socket.off('stats_update'); socket.off('vote_cast') }
  }, [socket, fetchResults])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full" /></div>

  const schoolChartData = results?.schoolLeaders?.map(c => ({ name: c.name.split(' ')[0], Votes: c.voteCount, pct: c.percentage })) || []
  const classChartData = results?.classLeaders?.map(c => ({ name: c.name.split(' ')[0], Votes: c.voteCount })) || []

  const isCollegeMode = results?.electionType === 'college'

  const formatSymbol = (c) => {
    if (!c) return 'N/A'
    if (c.symbolIcon) return `${c.symbolIcon} ${c.symbol || ''}`.trim()
    return c.symbol || 'N/A'
  }

  // Prepare flattened results for Print and PDF Export
  const flattenedCollegeResults = (results?.positionResults || []).flatMap(({ position, candidates }) => {
    return (candidates || []).map((c, idx) => ({
      category: position.name,
      rank: `#${idx + 1}`,
      status: idx === 0 ? 'WINNER 👑' : `Rank ${idx + 1}`,
      name: c.name,
      symbol: formatSymbol(c),
      voteCount: c.voteCount || 0,
      percentage: `${c.percentage || 0}%`,
    }))
  })

  const schoolLeaderExport = (results?.schoolLeaders || []).map((c, idx) => ({
    category: 'School Leader',
    rank: `#${idx + 1}`,
    status: idx === 0 ? 'SCHOOL LEADER (WINNER 👑)' : idx === 1 ? 'ASST. SCHOOL LEADER' : `Rank ${idx + 1}`,
    name: c.name,
    symbol: formatSymbol(c),
    voteCount: c.voteCount || 0,
    percentage: `${c.percentage || 0}%`,
  }))

  const classLeadersExport = Object.entries(results?.classWiseResults || {}).flatMap(([cls, data]) => {
    return (data.candidates || []).map((c, idx) => ({
      category: `Class ${cls} Leader`,
      rank: `#${idx + 1}`,
      status: idx === 0 ? 'CLASS LEADER (WINNER 👑)' : idx === 1 ? 'ASST. CLASS LEADER' : `Rank ${idx + 1}`,
      name: c.name,
      symbol: formatSymbol(c),
      voteCount: c.voteCount || 0,
      percentage: `${c.percentage || 0}%`,
    }))
  })

  const exportResultsData = isCollegeMode
    ? flattenedCollegeResults
    : [...schoolLeaderExport, ...classLeadersExport]

  // Construct Top Winners Summary Data (ordered by Position Display Order)
  const summaryData = isCollegeMode
    ? (results?.positionResults || []).map(({ position, candidates }) => {
        const sortedCands = [...(candidates || [])].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
        const winner = sortedCands.length > 0 ? sortedCands[0] : null
        const runnerUp = sortedCands.length > 1 && sortedCands[1].voteCount > 0 ? sortedCands[1] : null
        return {
          positionName: position.name,
          winner: winner ? {
            name: winner.name,
            symbol: winner.symbolImage ? getMediaUrl(winner.symbolImage) : (winner.symbolIcon || winner.symbol || '⭐'),
            symbolName: winner.symbol || '',
            symbolType: winner.symbolType || (winner.symbolImage ? 'image' : 'icon'),
            dept: winner.department ? `${winner.department}${winner.year ? ` (Yr ${winner.year})` : ''}` : (winner.class ? `Class ${winner.class}` : 'N/A'),
            voteCount: winner.voteCount || 0,
          } : null,
          runnerUp: runnerUp ? {
            name: runnerUp.name,
            voteCount: runnerUp.voteCount || 0,
          } : null,
        }
      }).filter((s) => s.winner !== null)
    : [
        ...(results?.schoolLeaders && results.schoolLeaders.length > 0 ? [{
          positionName: 'SCHOOL LEADER',
          winner: {
            name: results.schoolLeaders[0].name,
            symbol: results.schoolLeaders[0].symbolIcon || results.schoolLeaders[0].symbol || '⭐',
            symbolName: results.schoolLeaders[0].symbol || '',
            symbolType: 'icon',
            dept: `Class ${results.schoolLeaders[0].class}`,
            voteCount: results.schoolLeaders[0].voteCount || 0,
          },
          runnerUp: results.schoolLeaders[1] ? {
            name: results.schoolLeaders[1].name,
            voteCount: results.schoolLeaders[1].voteCount || 0,
          } : null,
        }] : []),
      ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Election Results</h1>
          <p className="text-white/40 text-sm">Live results — updates automatically</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            title="Official Election Final Results Report"
            summaryData={summaryData}
            columns={[
              { header: 'Position / Category', dataKey: 'category' },
              { header: 'Rank', dataKey: 'rank' },
              { header: 'Result Status', dataKey: 'status' },
              { header: 'Candidate Name', dataKey: 'name' },
              { header: 'Symbol / Party', dataKey: 'symbol' },
              { header: 'Votes Cast', dataKey: 'voteCount' },
              { header: 'Percentage', dataKey: 'percentage' },
            ]}
            data={exportResultsData}
            fileName="Election_Results_Report.pdf"
          />
          <button onClick={() => fetchResults(true)} disabled={refreshing}
            className="btn-ghost flex items-center gap-2 text-sm py-2">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {results?.electionType === 'college' ? (
        <div className="space-y-8">
          {results.positionResults?.map(({ position, totalVotes, candidates }) => {
            const chartData = candidates?.map(c => ({ name: c.name.split(' ')[0], Votes: c.voteCount })) || []
            return (
              <div key={position._id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h2 className="text-white/80 font-bold flex items-center gap-2 text-lg">
                    <span className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-400 text-xs font-mono">
                      {position.displayOrder}
                    </span>
                    {position.name} Results
                  </h2>
                  <span className="text-white/40 text-xs font-medium">{totalVotes} votes cast (Max votes allowed: {position.maxVotes})</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {candidates.map((c, i) => (
                      <WinnerCard key={c._id} candidate={c} rank={i} type="college" />
                    ))}
                    {candidates.length === 0 && (
                      <p className="text-white/30 text-xs py-6 text-center bg-white/3 rounded-xl border border-white/5">No candidates or votes for this position</p>
                    )}
                  </div>
                  {chartData.some(d => d.Votes > 0) ? (
                    <div className="glass-card p-5 flex flex-col justify-center no-print">
                      <h4 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">Vote Distribution</h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: 'rgba(10,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} itemStyle={{ color: '#3b82f6' }} />
                          <Bar dataKey="Votes" radius={[4, 4, 0, 0]}>
                            {chartData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    candidates.length > 0 && <div className="glass-card p-5 flex items-center justify-center text-white/30 text-xs">No votes cast yet</div>
                  )}
                </div>
              </div>
            )
          })}
          {(!results.positionResults || results.positionResults.length === 0) && (
            <p className="text-white/30 text-sm py-12 text-center glass-card">No positions results defined</p>
          )}
        </div>
      ) : (
        <>
          {/* School Leaders */}
          <div>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-gold-400" /> School Leader Results
              <span className="text-white/30 text-sm font-normal">({results?.totalSchoolVotes || 0} votes)</span>
            </h2>
            <div className="space-y-3">
              {results?.schoolLeaders?.map((c, i) => <WinnerCard key={c._id} candidate={c} rank={i} type="school" />)}
              {!results?.schoolLeaders?.length && <p className="text-white/30 text-sm py-6 glass-card p-4 text-center">No school leader votes yet</p>}
            </div>
          </div>

          {/* Bar chart */}
          {schoolChartData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 no-print">
              <h3 className="text-white/70 font-semibold mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-primary-400" /> Vote Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={schoolChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'rgba(10,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} itemStyle={{ color: '#3b82f6' }} />
                  <Bar dataKey="Votes" radius={[6, 6, 0, 0]}>
                    {schoolChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Class Leaders */}
          <div className="space-y-8">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-400" />
              <h2 className="text-white font-semibold">Class Leader Results</h2>
              <span className="text-white/30 text-sm font-normal">({results?.totalClassVotes || 0} total votes)</span>
            </div>

            {results?.classWiseResults && Object.keys(results.classWiseResults).sort().map(cls => (
              <div key={cls} className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-white/80 font-bold flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-400 text-xs">
                      {cls}
                    </span>
                    Class {cls} Results
                  </h3>
                  <span className="text-white/30 text-xs">{results.classWiseResults[cls].totalVotes} votes cast</span>
                </div>
                <div className="space-y-3">
                  {results.classWiseResults[cls].candidates.map((c, i) => (
                    <WinnerCard key={c._id} candidate={c} rank={i} type="class" />
                  ))}
                </div>
              </div>
            ))}

            {(!results?.classWiseResults || Object.keys(results.classWiseResults).length === 0) && (
              <p className="text-white/30 text-sm py-12 glass-card p-4 text-center">No class leader votes cast yet</p>
            )}
          </div>
        </>
      )}

      {/* Booth results */}
      <div className="glass-card p-6">
        <h2 className="text-white font-semibold mb-4">Booth-Wise Turnout</h2>
        <table className="data-table">
          <thead><tr><th>Booth</th><th>Students</th><th>Voted</th><th>Turnout</th></tr></thead>
          <tbody>
            {results?.boothResults?.map(b => (
              <tr key={b.booth._id}>
                <td className="text-white font-medium">{b.booth.name}</td>
                <td>{b.totalStudents}</td>
                <td>{b.voted}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-white/5 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${b.turnout}%` }} />
                    </div>
                    <span className="text-white/60 text-xs">{b.turnout}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
