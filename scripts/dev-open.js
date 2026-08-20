const { spawn } = require('child_process');
const net = require('net');

// --- Auto-start the LibreTranslate server (powers the language switcher) ---
// Only starts it if nothing is already listening on :5000, and never blocks the
// dev server if Python/LibreTranslate isn't installed.
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1200, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function startLibreTranslate() {
  if (await isPortOpen(5000)) {
    console.log('[translate] LibreTranslate already running on http://localhost:5000');
    return null;
  }
  console.log('[translate] Starting LibreTranslate on http://localhost:5000 …');
  // PYTHONUTF8 avoids a Windows crash when it prints the "→" model-index character.
  const env = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  // The package has no __main__, so launch its main() with the args via sys.argv.
  const ltArgs = ['--host', '0.0.0.0', '--port', '5000', '--load-only', 'en,fr,ar,es,zh,pt'];
  const pyCode =
    `import sys; sys.argv=['libretranslate',${ltArgs.map((a) => `'${a}'`).join(',')}]; ` +
    `from libretranslate.main import main; main()`;
  // No `shell: true` + `windowsHide: true` so Windows doesn't pop open a cmd window.
  const lt = spawn('python', ['-c', pyCode], { stdio: 'ignore', windowsHide: true, env });
  lt.on('error', (e) =>
    console.log('[translate] Could not start LibreTranslate (translation will stay English):', e.message)
  );
  lt.on('exit', (code) => {
    if (code && code !== 0) {
      console.log(`[translate] LibreTranslate exited (code ${code}). Translation will stay English.`);
    }
  });
  return lt;
}

let translate = null;
startLibreTranslate().then((p) => {
  translate = p;
});

// --- Auto-start Ollama (powers the AI chatbot) ---
// Skipped when already running; if Ollama isn't installed the chatbot simply
// falls back to its built-in answers, so this never blocks the dev server.
async function startOllama() {
  if (await isPortOpen(11434)) {
    console.log('[chatbot] Ollama already running on http://localhost:11434');
    return;
  }
  console.log('[chatbot] Starting Ollama on http://localhost:11434 …');
  const exe =
    process.env.OLLAMA_EXE || 'C:\\Users\\HP\\AppData\\Local\\Programs\\Ollama\\ollama.exe';
  // Drop `detached: true` (it forces a new console window on Windows); `unref()`
  // below is enough to let it keep running after the dev process exits.
  const ollama = spawn(exe, ['serve'], { stdio: 'ignore', windowsHide: true });
  ollama.on('error', (e) =>
    console.log('[chatbot] Could not start Ollama (chatbot uses built-in answers):', e.message)
  );
  ollama.unref();
}
startOllama();

// Start the Next.js dev server.
//
// Resolve Next's CLI entry point and run it with the current Node binary rather
// than spawning a bare `next` through a shell. Going via the shell relied on
// node_modules/.bin being on PATH and made cmd.exe parse the project path —
// which fails with "The batch file cannot be found" when that path contains
// spaces or parentheses, as this one does ("apartment-website-builder (1)").
const nextBin = require.resolve('next/dist/bin/next');
const dev = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: 'inherit',
  cwd: require('path').join(__dirname, '..'),
});
dev.on('error', (e) => {
  console.error('[dev] Could not start the Next.js dev server:', e.message);
  process.exit(1);
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

// Handle process exit — also stop LibreTranslate if we started it
process.on('SIGINT', () => {
  dev.kill();
  if (translate) translate.kill();
  process.exit();
});
