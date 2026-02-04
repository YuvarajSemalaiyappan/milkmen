import { spawn } from 'child_process'
import { networkInterfaces } from 'os'

function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

function printBanner(localIP) {
  const divider = '═'.repeat(56)
  const line = (text = '') => console.log(`  ║  ${text.padEnd(52)}║`)

  console.log()
  console.log(`  ╔${divider}╗`)
  line('MILKMEN - Development Servers')
  console.log(`  ╠${divider}╣`)
  line()
  line('Frontend (Vite + React)')
  line(`  Local:    https://localhost:5173`)
  line(`  Network:  https://${localIP}:5173`)
  line()
  console.log(`  ╠${divider}╣`)
  line()
  line('Backend (Express API)')
  line(`  Local:    http://localhost:3001`)
  line(`  Health:   http://localhost:3001/health`)
  line()
  console.log(`  ╠${divider}╣`)
  line()
  line('Mobile Access (same Wi-Fi network)')
  line(`  Open on phone:  https://${localIP}:5173`)
  line()
  line('  Note: Accept the SSL warning on mobile')
  line('  (self-signed cert from @vitejs/plugin-basic-ssl)')
  line()
  console.log(`  ╚${divider}╝`)
  console.log()
}

const localIP = getLocalIP()
printBanner(localIP)

const frontend = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
})

const backend = spawn('npm', ['run', 'dev:server'], {
  stdio: 'pipe',
  shell: true
})

frontend.stdout.on('data', (data) => {
  const text = data.toString().trim()
  if (text) console.log(`[frontend] ${text}`)
})

frontend.stderr.on('data', (data) => {
  const text = data.toString().trim()
  if (text) console.error(`[frontend] ${text}`)
})

backend.stdout.on('data', (data) => {
  const text = data.toString().trim()
  if (text) console.log(`[backend]  ${text}`)
})

backend.stderr.on('data', (data) => {
  const text = data.toString().trim()
  if (text) console.error(`[backend]  ${text}`)
})

frontend.on('close', (code) => {
  console.log(`[frontend] exited with code ${code}`)
  backend.kill()
  process.exit(code)
})

backend.on('close', (code) => {
  console.log(`[backend]  exited with code ${code}`)
  frontend.kill()
  process.exit(code)
})

process.on('SIGINT', () => {
  console.log('\nShutting down servers...')
  frontend.kill()
  backend.kill()
  process.exit(0)
})

process.on('SIGTERM', () => {
  frontend.kill()
  backend.kill()
  process.exit(0)
})
