import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export const SocketProvider = ({ children }) => {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!user) return

    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    s.on('connect', () => {
      setConnected(true)
      // Auto-join room based on role
      if (user.role === 'super_admin') {
        s.emit('join_super_admin', { userId: user._id })
      } else if (user.role === 'booth_admin') {
        const boothId = user.boothId?._id || user.boothId
        s.emit('join_booth_admin', { boothId, userId: user._id })
      }
    })

    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', () => setConnected(false))

    socketRef.current = s
    setSocket(s)

    return () => {
      s.disconnect()
      setConnected(false)
    }
  }, [user])

  const joinBoothDevice = (boothId) => {
    if (socketRef.current) {
      socketRef.current.emit('join_booth_device', { boothId })
    }
  }

  return (
    <SocketContext.Provider value={{ socket, connected, joinBoothDevice }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
