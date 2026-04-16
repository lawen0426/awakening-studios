const fs = require('fs')
const path = require('path')

const packageJson = require('./package.json')

function readAutoUpdateConfig() {
  const filePath = path.join(__dirname, 'electron', 'github-release.json')
  const defaults = {
    owner: '',
    repo: '',
    releaseType: 'release',
  }

  try {
    if (!fs.existsSync(filePath)) {
      return defaults
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return {
      owner: process.env.GH_RELEASE_OWNER || parsed.owner || defaults.owner,
      repo: process.env.GH_RELEASE_REPO || parsed.repo || defaults.repo,
      releaseType: process.env.GH_RELEASE_TYPE || parsed.releaseType || defaults.releaseType,
    }
  } catch (error) {
    console.warn('[auto-update] Failed to read github-release.json:', error)
    return defaults
  }
}

const baseBuild = packageJson.build ?? {}
const autoUpdate = readAutoUpdateConfig()

module.exports = {
  ...baseBuild,
  publish: autoUpdate.owner && autoUpdate.repo
    ? [
        {
          provider: 'github',
          owner: autoUpdate.owner,
          repo: autoUpdate.repo,
          releaseType: autoUpdate.releaseType,
        },
      ]
    : undefined,
}
