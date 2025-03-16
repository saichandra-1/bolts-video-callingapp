import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'] // Allow specific methods
  }
});

// Store active users
const activeUsers = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // User joins with their username
  socket.on('join', (username) => {
    console.log(`${username} joined with ID: ${socket.id}`);
    activeUsers[socket.id] = username;
    
    // Broadcast updated user list to all clients
    io.emit('activeUsers', Object.entries(activeUsers).map(([id, name]) => ({
      id,
      username: name
    })));
  });
  
  // Handle call request
  socket.on('callUser', ({ userToCall, signalData, name }) => {
    console.log(`${name} is calling ${activeUsers[userToCall]}`);
    io.to(userToCall).emit('callIncoming', {
      signal: signalData,
    });
  });
  
  // Handle accepting call
  socket.on('answerCall', (data) => {
    console.log(`Call answered by ${activeUsers[socket.id]}`);
    io.to(data.to).emit('callAccepted', data.signal);
  });
  
  // Handle ICE candidates exchange
  socket.on('ice-candidate', ({ target, candidate }) => {
    io.to(target).emit('ice-candidate', {
      from: socket.id,
      candidate
    });
  });
  
  // Handle call end
  socket.on('endCall', ({ to }) => {
    console.log(`Call ended by ${activeUsers[socket.id]}`);
    io.to(to).emit('callEnded');
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${activeUsers[socket.id]}`);
    delete activeUsers[socket.id];
    
    // Broadcast updated user list
    io.emit('activeUsers', Object.entries(activeUsers).map(([id, name]) => ({
      id,
      username: name
    })));
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});