const { spawn } = require('child_process');

// Start the Next.js dev server
const dev = spawn('next', ['dev'], {
  stdio: 'inherit',
  shell: true
});

// Open browser after 2 seconds
setTimeout(() => {
  try {
    const openLib = require('open');
    if (typeof openLib === 'function') {
      openLib('http://localhost:3000').catch(() => {});
    } else if (typeof openLib.default === 'function') {
      openLib.default('http://localhost:3000').catch(() => {});
    }
  } catch (e) {
    // Silently fail if open package is not available
  }
}, 2000);

// Handle process exit
process.on('SIGINT', () => {
  dev.kill();
  process.exit();
});
