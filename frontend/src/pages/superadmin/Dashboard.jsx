import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Vote, TrendingUp, School, Activity, Clock, Zap, AlertTriangle } from 'lucide-react'
import { electionAPI, resultsAPI } from '../../services/api'
import { useSocket } from '../../context/SocketContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']

const StatCard = ({ icon: Icon, label, value, sub, color = 'blue', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="stat-card group hover:border-white/20 transition-all duration-300"
  >
    <div className="flex items-start justify-between">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center 
        ${color === 'blue' ? 'bg-primary-500/20 text-primary-400' :
          color === 'purple' ? 'bg-accent-500/20 text-accent-400' :
          color === 'green' ? 'bg-emerald-500/20 text-emerald-400' :
          'bg-gold-500/20 text-gold-400'}`}>
        <Icon size={22} />
      </div>
      <span className="text-white/20 text-xs font-mono">LIVE</span>
    </div>
    <div>
      <p className="text-3xl font-bold text-white">{value ?? '—'}</p>
      <p className="text-white/50 text-sm font-medium">{label}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  </motion.div>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-sm">
      <p className="text-white/60 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function SuperAdminDashboard() {
  const { socket } = useSocket()
  const [stats, setStats] = useState(null)
  const [results, setResults] = useState(null)
  const [election, setElection] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, resultsRes, electionRes] = await Promise.all([
        electionAPI.getStats(),
        resultsAPI.getAll(),
        electionAPI.status(),
      ])
      setStats(statsRes.data.data)
      setResults(resultsRes.data.data)
      setElection(electionRes.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime updates
  useEffect(() => {
    if (!socket) return
    socket.on('stats_update', fetchData)
    socket.on('election_started', fetchData)
    socket.on('election_ended', fetchData)
    return () => {
      socket.off('stats_update', fetchData)
      socket.off('election_started', fetchData)
      socket.off('election_ended', fetchData)
    }
  }, [socket, fetchData])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )

  const boothChartData = stats?.boothStats?.map(b => ({
    name: b.booth.name,
    Students: b.totalStudents,
    Voted: b.totalVoted,
    Turnout: b.turnout,
  })) || []

  const classPieData = results?.classTurnout?.map(c => ({
    name: `Class ${c.class}`,
    value: c.voted,
  })) || []

  const schoolLeaderData = results?.schoolLeaders?.map(c => ({
    name: c.name,
    Votes: c.voteCount,
    Percentage: c.percentage,
  })) || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Election Dashboard</h1>
          <p className="text-white/40 text-sm mt-0.5">Live statistics and real-time monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge-${election?.status === 'active' ? 'active' : 'idle'}`}>
            {election?.status === 'active' && <span className="live-dot" />}
            {election?.status === 'active' ? 'Election Live' : `Status: ${election?.status || 'Not Started'}`}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Students" value={stats?.totalStudents} color="blue" delay={0.1} />
        <StatCard icon={Vote} label="Total Votes Cast" value={stats?.totalVotes} color="purple" delay={0.15} />
        <StatCard icon={TrendingUp} label="Voter Turnout" value={stats ? `${stats.turnout}%` : '—'} sub={`${stats?.totalVoted} voted`} color="green" delay={0.2} />
        <StatCard 
          icon={AlertTriangle} 
          label="Capacity Alerts" 
          value={stats?.boothStats?.filter(b => b.status === 'overloaded').length || 0} 
          sub="Overloaded booths"
          color={stats?.boothStats?.some(b => b.status === 'overloaded') ? 'red' : 'gold'} 
          delay={0.25} 
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booth-wise chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity size={16} className="text-primary-400" /> Booth-Wise Turnout
          </h2>
          {boothChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={boothChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Students" fill="#1d4ed8" radius={[4,4,0,0]} />
                <Bar dataKey="Voted" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-white/30 text-sm text-center py-12">No booth data yet</p>}
        </motion.div>

        {/* Winners Summary Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-6 overflow-hidden relative">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl" />
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Zap size={16} className="text-accent-400" /> Top Winners Summary
          </h2>
          
          <div className="space-y-4">
            {results?.electionType === 'college' ? (
              <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-hide">
                {results.positionResults?.map(({ position, candidates }) => {
                  const winner = candidates?.[0];
                  return (
                    <div key={position._id} className="p-2 bg-white/3 border border-white/5 rounded-xl flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-sm">
                        {winner?.symbolIcon || '⭐'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-primary-400 font-bold uppercase tracking-wider leading-none mb-0.5">{position.name}</p>
                        <p className="text-white font-bold text-xs truncate leading-normal">{winner ? winner.name : 'No candidates'}</p>
                      </div>
                      {winner && (
                        <span className="text-[10px] text-white/50 bg-white/5 border border-white/10 px-2 py-0.5 rounded font-mono">
                          {winner.voteCount} votes
                        </span>
                      )}
                    </div>
                  );
                })}
                {(!results?.positionResults || results.positionResults.length === 0) && (
                  <p className="text-white/30 text-xs py-6 text-center">No college positions results yet</p>
                )}
              </div>
            ) : (
              <>
                {/* School Leader Winner */}
                {results?.schoolLeaders?.[0] && (
                  <div className="p-3 bg-gold-500/10 border border-gold-500/20 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold-500/20 flex items-center justify-center text-xl">
                      {results.schoolLeaders[0].symbolIcon}
                    </div>
                    <div>
                      <p className="text-[10px] text-gold-400 font-bold uppercase tracking-wider">School Leader</p>
                      <p className="text-white font-bold">{results.schoolLeaders[0].name}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white font-mono text-sm">{results.schoolLeaders[0].voteCount} votes</p>
                    </div>
                  </div>
                )}

                {/* Assistant School Leader Winner */}
                {results?.schoolLeaders?.[1] && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl">
                      {results.schoolLeaders[1].symbolIcon}
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Asst. School Leader</p>
                      <p className="text-white font-bold">{results.schoolLeaders[1].name}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white font-mono text-sm">{results.schoolLeaders[1].voteCount} votes</p>
                    </div>
                  </div>
                )}

                {/* Class Leaders Count */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white/60 text-xs">Class Leaders Decided</span>
                    <span className="text-primary-400 text-xs font-bold">
                      {Object.keys(results?.classWiseResults || {}).length} classes
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(results?.classWiseResults || {}).sort().map(cls => (
                      <span key={cls} className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-white/40">
                        {cls}: {results.classWiseResults[cls].candidates[0]?.name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Booth stats table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
        <h2 className="text-white font-semibold mb-4">Booth-Wise Statistics</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Booth</th><th>Code</th><th>Students</th><th>Voted</th><th>Turnout</th>
            </tr>
          </thead>
          <tbody>
            {stats?.boothStats?.length > 0 ? stats.boothStats.map((b, i) => (
              <tr key={i}>
                <td className="text-white font-medium">{b.booth.name}</td>
                <td><span className="font-mono text-xs px-2 py-0.5 bg-white/5 rounded">{b.booth.code}</span></td>
                <td>{b.totalStudents}</td>
                <td>{b.totalVoted}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/5 rounded-full h-1.5 max-w-20">
                      <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${b.turnout}%` }} />
                    </div>
                    <span className="text-white/60 text-xs">{b.turnout}%</span>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="text-center text-white/30 py-8">No booth data available</td></tr>
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  )
}
