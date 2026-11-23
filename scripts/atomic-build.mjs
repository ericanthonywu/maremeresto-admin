import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const stagingDir = path.join(rootDir, 'dist.new')
const backupDir = path.join(rootDir, 'dist.old')

const bin = (name) =>
  path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

try {
  rmSync(stagingDir, { recursive: true, force: true })
  rmSync(backupDir, { recursive: true, force: true })

  execFileSync(bin('tsc'), ['-b'], { cwd: rootDir, stdio: 'inherit' })
  execFileSync(bin('vite'), ['build', '--outDir', 'dist.new'], { cwd: rootDir, stdio: 'inherit' })

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
