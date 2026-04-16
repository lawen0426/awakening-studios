import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const packageJsonPath = path.join(projectRoot, 'package.json')
const githubConfigPath = path.join(projectRoot, 'electron', 'github-release.json')
const releaseDir = path.join(projectRoot, 'release')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function exists(filePath) {
  return fs.existsSync(filePath)
}

const packageJson = readJson(packageJsonPath)
const githubConfig = readJson(githubConfigPath)

const version = packageJson.version
const productName = packageJson.productName
const baseName = `${productName}-${version}-arm64`
const requiredFiles = [
  `${baseName}.dmg`,
  `${baseName}.dmg.blockmap`,
  `${baseName}-mac.zip`,
  `${baseName}-mac.zip.blockmap`,
]

const missingConfig = []
if (!githubConfig.owner?.trim()) {
  missingConfig.push('owner')
}
if (!githubConfig.repo?.trim()) {
  missingConfig.push('repo')
}

const missingFiles = requiredFiles.filter((fileName) => !exists(path.join(releaseDir, fileName)))

console.log('')
console.log('GitHub Releases Check')
console.log('=====================')
console.log(`App: ${productName}`)
console.log(`Version: ${version}`)
console.log(
  `Repository: ${
    githubConfig.owner && githubConfig.repo ? `${githubConfig.owner}/${githubConfig.repo}` : '(not configured)'
  }`,
)
console.log(`Release type: ${githubConfig.releaseType || 'release'}`)
console.log('')

if (missingConfig.length > 0) {
  console.log('Missing GitHub config:')
  for (const key of missingConfig) {
    console.log(`- electron/github-release.json -> ${key}`)
  }
  console.log('')
}

if (missingFiles.length > 0) {
  console.log('Missing release files:')
  for (const fileName of missingFiles) {
    console.log(`- release/${fileName}`)
  }
  console.log('')
} else {
  console.log('Release files ready to upload:')
  for (const fileName of requiredFiles) {
    console.log(`- release/${fileName}`)
  }
  console.log('')
}

console.log('Next steps:')
console.log('1. Run `npm run pack:mac` if any release file is missing.')
console.log('2. Create a GitHub Release with a tag like `v' + version + '`.')
console.log('3. Upload the files listed above to that GitHub Release.')
console.log('4. Users on older versions can use Check for Updates or reopen the app.')
console.log('')

if (missingConfig.length > 0 || missingFiles.length > 0) {
  process.exitCode = 1
}
