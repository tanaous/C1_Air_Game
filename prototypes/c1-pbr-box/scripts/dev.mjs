import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const workspaceRoot = path.resolve(projectDir, '..', '..')

const viteEntry = path.join(workspaceRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')
const { createServer } = await import(pathToFileURL(viteEntry).href)

const server = await createServer({
  configFile: path.join(projectDir, 'vite.config.ts'),
  root: projectDir,
})

await server.listen()
server.printUrls()

const localUrls = server.resolvedUrls?.local ?? []
const rendererUrl = localUrls[0] ?? `http://127.0.0.1:${server.config.server.port ?? 5174}/`
const electronPath = require(path.join(workspaceRoot, 'node_modules', 'electron'))
const electronMain = path.join(projectDir, 'electron', 'main.cjs')

const child = spawn(electronPath, [electronMain], {
  cwd: projectDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    C1_BOX_RENDERER_URL: rendererUrl,
  },
})

let shuttingDown = false

async function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  try {
    await server.close()
  } finally {
    process.exit(exitCode)
  }
}

child.on('exit', (code) => {
  void shutdown(code ?? 0)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal)
    void shutdown(0)
  })
}
