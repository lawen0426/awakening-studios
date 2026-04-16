import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const sourceRoot = process.cwd()
const targetRepoDir = process.env.PUBLISH_REPO_DIR || '/tmp/awakening-studios-publish'
const targetAppDir = path.join(targetRepoDir, 'Scoring-Planner')
const workflowSource = path.join(sourceRoot, 'github', 'release-scoring-planner.yml')
const workflowTarget = path.join(targetRepoDir, '.github', 'workflows', 'release-scoring-planner.yml')
const packageJson = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'))
const version = packageJson.version
const tagName = `v${version}`

function run(command, options = {}) {
  console.log(`$ ${command}`)
  execSync(command, {
    stdio: 'inherit',
    ...options,
  })
}

function runCapture(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

if (!fs.existsSync(path.join(targetRepoDir, '.git'))) {
  console.error(`Missing publish repo: ${targetRepoDir}`)
  console.error('Clone or initialize the GitHub repository there first, then run this script again.')
  process.exit(1)
}

fs.mkdirSync(path.dirname(workflowTarget), { recursive: true })
fs.copyFileSync(workflowSource, workflowTarget)

run(
  [
    'rsync -a',
    "--exclude '.git'",
    "--exclude 'node_modules'",
    "--exclude 'dist'",
    "--exclude 'release'",
    "--exclude '.env.local'",
    "--exclude '.DS_Store'",
    "--exclude 'mac-arm64'",
    "--exclude 'mac-universal'",
    `${JSON.stringify(`${sourceRoot}/`)}`,
    JSON.stringify(`${targetAppDir}/`),
  ].join(' '),
)

const statusBefore = runCapture('git status --short', { cwd: targetRepoDir })
if (!statusBefore) {
  console.log('No repository changes detected before commit.')
} else {
  run('git add .', { cwd: targetRepoDir })
  run(`git commit -m ${JSON.stringify(`Update Scoring Planner ${tagName}`)}`, { cwd: targetRepoDir })
}

run('git push origin main', { cwd: targetRepoDir })

const localTagExists = runCapture(`git tag --list ${JSON.stringify(tagName)}`, { cwd: targetRepoDir }) === tagName
if (!localTagExists) {
  run(`git tag -a ${JSON.stringify(tagName)} -m ${JSON.stringify(tagName)}`, { cwd: targetRepoDir })
  run(`git push origin ${JSON.stringify(tagName)}`, { cwd: targetRepoDir })
  console.log(`Published ${tagName}. GitHub Actions will now build and attach release assets.`)
} else {
  console.log(`${tagName} already exists. Main branch was pushed, but no new tag was created.`)
  console.log('Bump package.json version before running this script for the next release.')
}
