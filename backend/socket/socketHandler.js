const LiveSession = require('../models/LiveSession');
const Student = require('../models/Student');
const Election = require('../models/Election');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // --- JOIN ROOMS ---

    // Voting device joins its booth room
    socket.on('join_booth_device', async ({ boothId }) => {
      if (!boothId) return;
      socket.join(`booth_${boothId}`);
      socket.join('devices');
      socket.boothId = boothId;
      socket.role = 'device';
      console.log(`📟 Device joined booth_${boothId}`);

      // Send current session state immediately
      try {
        const session = await LiveSession.findOne({ boothId })
          .populate('currentStudent')
          .populate('boothId');
        socket.emit('session_state', { session });

        const election = await Election.findOne().sort({ createdAt: -1 });
        socket.emit('election_state', { election });
      } catch (err) {
        console.error('Error sending session state:', err);
      }
    });

    // Booth admin joins admin room + booth room
    socket.on('join_booth_admin', async ({ boothId, userId }) => {
      if (!boothId) return;
      socket.join(`booth_${boothId}`);
      socket.join('admins');
      socket.boothId = boothId;
      socket.role = 'booth_admin';
      console.log(`👤 Booth Admin joined booth_${boothId}`);

      try {
        const session = await LiveSession.findOne({ boothId })
          .populate('currentStudent')
          .populate('boothId');
        socket.emit('session_state', { session });
      } catch (err) {}
    });

    // Super admin joins global admin room
    socket.on('join_super_admin', ({ userId }) => {
      socket.join('admins');
      socket.join('super_admins');
      socket.role = 'super_admin';
      console.log(`👑 Super Admin connected`);
    });

    // --- VOTING EVENTS ---

    // Booth admin triggers voting for a student (alternative to REST)
    socket.on('start_voting_session', async ({ boothId, studentId }) => {
      try {
        const student = await Student.findById(studentId);
        if (!student) return socket.emit('error', { message: 'Student not found' });

        const session = await LiveSession.findOneAndUpdate(
          { boothId },
          { boothId, currentStudent: studentId, status: 'voting', startedAt: new Date(), completedAt: null },
          { upsert: true, new: true }
        );

        const populated = await LiveSession.findById(session._id)
          .populate('currentStudent')
          .populate('boothId');

        // Push to voting device
        io.to(`booth_${boothId}`).emit('voting_started', { session: populated, student });
        // Update admins
        io.to('admins').emit('session_update', { boothId, status: 'voting', student });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Vote cast from device
    socket.on('vote_submitted', async ({ boothId, electionType, studentId }) => {
      io.to(`booth_${boothId}`).emit('vote_cast', { electionType, studentId });
      io.to('admins').emit('stats_update', { boothId });
    });

    // Voting completed (both types done)
    socket.on('voting_complete', async ({ boothId, studentId }) => {
      try {
        await LiveSession.findOneAndUpdate(
          { boothId },
          { status: 'completed', completedAt: new Date() }
        );
        io.to(`booth_${boothId}`).emit('voting_completed', { boothId, studentId });
        io.to('admins').emit('session_update', { boothId, status: 'completed', studentId });

        // Auto reset after 6 seconds
        setTimeout(async () => {
          await LiveSession.findOneAndUpdate(
            { boothId },
            { status: 'idle', currentStudent: null }
          );
          io.to(`booth_${boothId}`).emit('session_reset', { boothId });
        }, 6000);
      } catch (err) {
        console.error('voting_complete error:', err);
      }
    });

    // Manual session reset by admin
    socket.on('reset_session', async ({ boothId }) => {
      try {
        await LiveSession.findOneAndUpdate(
          { boothId },
          { status: 'idle', currentStudent: null, startedAt: null, completedAt: null },
          { upsert: true }
        );
        io.to(`booth_${boothId}`).emit('session_reset', { boothId });
        io.to('admins').emit('session_update', { boothId, status: 'idle' });
      } catch (err) {
        console.error('reset_session error:', err);
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      console.log(`🔴 Client disconnected: ${socket.id}`);
    });
  });
};
