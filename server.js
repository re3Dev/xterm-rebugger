// server.js – Express + Socket.io + node-pty with persistent interactive login shell as 'pi'
const express = require('express');
const http    = require('http');
const socketIo= require('socket.io');
const pty     = require('node-pty');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  // Spawn a login shell as the 'pi' user
  // Server must run as root for su to work without password prompt
  const shell = pty.spawn('su', ['-l', 'pi'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: '/home/pi',
    env: { ...process.env, HOME: '/home/pi', USER: 'pi', TERM: 'xterm-256color' }
  });

  // Forward shell output to client
  shell.on('data', data => socket.emit('stdout', data));

  // Handle incoming commands by writing to the existing terminal
  socket.on('command', input => {
    // Send newline if empty input
    shell.write((input && input.length ? input : '') + '\r');
  });

  // Handle resize
  socket.on('resize', ({cols, rows}) => shell.resize(cols, rows));

  // Clean up on disconnect
  socket.on('disconnect', () => shell.kill());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Web terminal listening on port ${PORT}`));
