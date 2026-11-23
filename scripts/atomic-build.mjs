import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const stagingDir = path.join(rootDir, 'dist.new')
const backupDir = path.join(rootDir, 'dist.old')

// Keep previous hashed assets for 24h so users mid-session during a build never hit 404s
const ASSET_RETENTION_MS = 24 * 60 * 60 * 1000

const bin = (name) =>
  path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

function preserveRecentAssets() {
  const oldAssetsDir = path.join(distDir, 'assets')
  const newAssetsDir = path.join(stagingDir, 'assets')
  if (!existsSync(oldAssetsDir) || !existsSync(newAssetsDir)) return

  const cutoff = Date.now() - ASSET_RETENTION_MS
  for (const entry of readdirSync(oldAssetsDir)) {
    const srcPath = path.join(oldAssetsDir, entry)
    const destPath = path.join(newAssetsDir, entry)
    if (existsSync(destPath)) continue
    try {
      const stats = statSync(srcPath)
      if (stats.isFile() && stats.mtimeMs >= cutoff) {
        copyFileSync(srcPath, destPath)
      }
    } catch {
      // Ignore transient file errors
    }
  }
}

try {
  rmSync(stagingDir, { recursive: true, force: true })
  rmSync(backupDir, { recursive: true, force: true })

  execFileSync(bin('tsc'), ['-b'], { cwd: rootDir, stdio: 'inherit' })
  execFileSync(bin('vite'), ['build', '--outDir', 'dist.new'], { cwd: rootDir, stdio: 'inherit' })

  preserveRecentAssets()

  if (process.platform !== 'win32') {
    execFileSync('chmod', ['-R', 'o+rX', stagingDir], { stdio: 'inherit' })
  }

  if (existsSync(distDir)) {
    renameSync(distDir, backupDir)
  }
  renameSync(stagingDir, distDir)
  rmSync(backupDir, { recursive: true, force: true })
} catch (err) {
  if (!existsSync(distDir) && existsSync(backupDir)) {
    try {
      renameSync(backupDir, distDir)
    } catch {
      mkdirSync(distDir, { recursive: true })
    }
  }
  rmSync(stagingDir, { recursive: true, force: true })
  throw err
}
