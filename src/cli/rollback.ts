import chalk from 'chalk'
import { homedir } from 'os'
import { gracefulShutdown } from 'src/utils/gracefulShutdown.js'
import { execFileNoThrowWithCwd } from 'src/utils/execFileNoThrow.js'
import { installLatest } from 'src/utils/nativeInstaller/index.js'
import { writeToStdout } from 'src/utils/process.js'
import { gt, gte } from 'src/utils/semver.js'
import { jsonParse } from 'src/utils/slowOperations.js'
import { getMaxVersion } from 'src/utils/autoUpdater.js'

type RollbackOptions = {
  list?: boolean
  dryRun?: boolean
  safe?: boolean
}

async function fetchPublishedVersions(): Promise<string[]> {
  const result = await execFileNoThrowWithCwd(
    'npm',
    ['view', MACRO.PACKAGE_URL, 'versions', '--json', '--prefer-online'],
    { cwd: homedir(), abortSignal: AbortSignal.timeout(8000) },
  )
  if (result.code !== 0) {
    return []
  }

  try {
    const parsed = jsonParse(result.stdout.trim())
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function getRollbackCandidates(versions: string[]): string[] {
  return versions
    .filter(version => gte(MACRO.VERSION, version) && version !== MACRO.VERSION)
    .reverse()
}

function resolveTarget(
  target: string | undefined,
  options: RollbackOptions | undefined,
  candidates: string[],
): string | null {
  if (options?.safe) {
    return null
  }

  if (!target) {
    return candidates[0] ?? null
  }

  if (/^\d+$/.test(target)) {
    const index = Number.parseInt(target, 10) - 1
    return candidates[index] ?? null
  }

  return target
}

export async function rollback(
  target?: string,
  options?: RollbackOptions,
): Promise<void> {
  const publishedVersions = await fetchPublishedVersions()
  const candidates = getRollbackCandidates(publishedVersions)

  if (options?.list) {
    if (candidates.length === 0) {
      writeToStdout('No published rollback versions were found.\n')
      await gracefulShutdown(1)
    }
    writeToStdout(`${chalk.bold('Recent rollback targets')}\n`)
    for (const version of candidates.slice(0, 15)) {
      writeToStdout(`- ${version}\n`)
    }
    await gracefulShutdown(0)
  }

  let resolvedTarget = resolveTarget(target, options, candidates)
  if (options?.safe) {
    resolvedTarget = await getMaxVersion()
    if (!resolvedTarget) {
      writeToStdout(
        `${chalk.yellow('No server-pinned safe version is available right now.')}\n`,
      )
      await gracefulShutdown(1)
    }
  }

  if (!resolvedTarget) {
    writeToStdout(
      `${chalk.yellow('Could not determine a rollback target.')}\nTry \`claude rollback --list\` to inspect published versions.\n`,
    )
    await gracefulShutdown(1)
  }

  if (gt(resolvedTarget, MACRO.VERSION)) {
    writeToStdout(
      `${chalk.yellow(`Resolved target ${resolvedTarget} is newer than the current version ${MACRO.VERSION}.`)}\n`,
    )
    await gracefulShutdown(1)
  }

  if (options?.dryRun) {
    writeToStdout(
      `${chalk.bold('Dry run')}\nWould install ${resolvedTarget} over ${MACRO.VERSION}.\n`,
    )
    await gracefulShutdown(0)
  }

  writeToStdout(`Rolling back from ${MACRO.VERSION} to ${resolvedTarget}...\n`)
  const result = await installLatest(resolvedTarget, true)

  if (result.lockFailed) {
    writeToStdout(
      `${chalk.yellow('Another Claude process is currently updating.')}\nPlease retry in a moment.\n`,
    )
    await gracefulShutdown(1)
  }

  if (!result.latestVersion) {
    writeToStdout(`${chalk.red('Rollback failed.')}\n`)
    await gracefulShutdown(1)
  }

  writeToStdout(
    `${chalk.green(`Rollback installed ${result.latestVersion}.`)} Restart Claude Code to use the downgraded build.\n`,
  )
  await gracefulShutdown(0)
}
