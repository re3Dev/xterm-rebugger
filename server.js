// server.js – Express + Socket.io + node-pty with network status checks
const express = require('express');
const http    = require('http');
const socketIo= require('socket.io');
const pty     = require('node-pty');
const { exec } = require('child_process');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Whitelisted command aliases
const COMMAND_ALIASES = {
  get_log_info:   'sudo python log_info.py',
  restart_mycool: 'sudo systemctl restart mycool.service',
  // add more aliases here
};

// Helpers for network queries
function getIp(iface, cb) {
  exec(`ip -4 addr show dev ${iface}`, (err, stdout) => {
    if (err) return cb(null);
    const match = stdout.match(/inet (\d+\.\d+\.\d+\.\d+)/);
    cb(match ? match[1] : null);
  });
}

function getLink(iface, cb) {
  exec(`cat /sys/class/net/${iface}/operstate`, (err, stdout) => {
    if (err) return cb(false);
    cb(stdout.trim() === 'up');
  });
}

io.on('connection', socket => {
  // Handle network status requests
  socket.on('getNetworkStatus', () => {
    getIp('wlan0', wlan0 => {
      getIp('eth0', eth0 => {
        getLink('eth0', linkUp => {
          socket.emit('networkStatus', {
            wlan0: wlan0,
            eth0: eth0,
            link: linkUp
          });
        });
      });
    });
  });

  // Spawn persistent interactive shell as 'pi'
  const shell = pty.spawn('su', ['-l', 'pi'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: '/home/pi',
    env: { ...process.env, HOME: '/home/pi', USER: 'pi', TERM: 'xterm-256color' }
  });

  // Stream shell output to client
  shell.on('data', data => socket.emit('stdout', data));

  // Handle commands and aliases
  socket.on('command', input => {
    if (!input) return shell.write('\r');
    const cmd = COMMAND_ALIASES[input] || input;
    shell.write(cmd + '\r');
  });

  // Resize events
  socket.on('resize', ({cols, rows}) => shell.resize(cols, rows));

  // Clean up on disconnect
  socket.on('disconnect', () => shell.kill());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Web terminal listening on port ${PORT}`));
