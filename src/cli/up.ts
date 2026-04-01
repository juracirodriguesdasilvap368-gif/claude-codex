import chalk from 'chalk'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { getOriginalCwd } from 'src/bootstrap/state.js'
import { gracefulShutdown } from 'src/utils/gracefulShutdown.js'
import { writeToStdout } from 'src/utils/process.js'

const CANDIDATE_NAMES = ['CLAUDE.md', join('.claude', 'CLAUDE.md')]

function findNearestClaudeMd(startDir: string): string | null {
  let current = startDir
  while (true) {
    for (const candidate of CANDIDATE_NAMES) {
      const fullPath = join(current, candidate)
      if (existsSync(fullPath)) {
        return fullPath
      }
    }
    const parent = dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

function extractClaudeUpSection(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/)
  let start = -1
  let end = lines.length

  for (let i = 0; i < lines.length; i += 1) {
    if (/^#{1,6}\s+claude up\s*$/i.test(lines[i].trim())) {
      start = i + 1
      break
    }
  }

  if (start === -1) {
    return null
  }

  for (let i = start; i < lines.length; i += 1) {
    if (/^#{1,6}\s+/.test(lines[i].trim())) {
      end = i
      break
    }
  }

  return lines
    .slice(start, end)
    .join('\n')
    .trim()
}

export async function up(): Promise<void> {
  const claudemdPath = findNearestClaudeMd(getOriginalCwd())
  if (!claudemdPath) {
    writeToStdout(
      `${chalk.yellow('No CLAUDE.md found.')}\nCreate one with \`/init\` or add a \`# claude up\` section to your project instructions.\n`,
    )
    await gracefulShutdown(1)
  }

  const content = readFileSync(claudemdPath, 'utf8')
  const section = extractClaudeUpSection(content)
  if (!section) {
    writeToStdout(
      `${chalk.yellow('No "# claude up" section found.')}\nFound instructions at ${claudemdPath}, but there is no setup section for \`claude up\`.\n`,
    )
    await gracefulShutdown(1)
  }

  writeToStdout(`${chalk.bold(`Using ${claudemdPath}`)}\n\n`)
  writeToStdout(`${section}\n`)
  await gracefulShutdown(0)
}
