import path from 'path'

import { structUtils } from '@yarnpkg/core'
import { PortablePath } from '@yarnpkg/fslib'

import logging from '../logging'
import type {
    MonodeployConfiguration,
    PackageStrategyMap,
    PackageStrategyType,
    YarnContext,
} from '../types'
import getCommitMessages from '../utils/getCommitMessages'
import { gitDiff } from '../utils/git'
import {
    STRATEGY,
    createGetConventionalRecommendedStrategy,
    getDefaultRecommendedStrategy,
} from '../utils/versionStrategy'

const strategyLevelToType = (level: number): PackageStrategyType | null => {
    const name = Object.entries(STRATEGY)
        .find((key, value) => level === value)?.[0]
        ?.toLowerCase()
    if (name === 'none') return null
    return (name as PackageStrategyType | null) ?? null
}

const getModifiedPackages = async (
    config: MonodeployConfiguration,
    context: YarnContext,
): Promise<string[]> => {
    const diffOutput = await gitDiff(
        config.git.baseBranch,
        config.git.commitSha,
        {
            cwd: config.cwd,
        },
    )
    const paths = diffOutput.split('\n')
    const uniquePaths = paths.reduce(
        (uniquePaths: Set<string>, currentPath: string) => {
            if (currentPath) uniquePaths.add(currentPath)
            return uniquePaths
        },
        new Set(),
    )

    const modifiedPackages = [...uniquePaths].reduce(
        (modifiedPackages: string[], currentPath: string): string[] => {
            try {
                const workspace = context.project.getWorkspaceByFilePath(
                    path.resolve(config.cwd, currentPath) as PortablePath,
                )
                const ident = workspace?.manifest?.name
                if (!ident) throw new Error('Missing workspace identity.')
                const packageName = structUtils.stringifyIdent(ident)
                if (packageName && !workspace.manifest.private) {
                    modifiedPackages.push(packageName)
                }
            } catch (e) {
                logging.error(e)
            }
            return modifiedPackages
        },
        [],
    )
    return [...new Set(modifiedPackages)]
}

const getExplicitVersionStrategies = async (
    config: MonodeployConfiguration,
    context: YarnContext,
): Promise<PackageStrategyMap> => {
    const commitMessages = await getCommitMessages(config)
    const strategyDeterminer = config.conventionalChangelogConfig
        ? createGetConventionalRecommendedStrategy(config)
        : getDefaultRecommendedStrategy
    const strategy = strategyLevelToType(
        await strategyDeterminer(commitMessages),
    )
    const packageNames = await getModifiedPackages(config, context)

    const versionStrategies: PackageStrategyMap = new Map()
    for (const pkgName of packageNames) {
        if (strategy) {
            versionStrategies.set(pkgName, {
                type: strategy,
                commits: commitMessages,
            })
        }
    }

    return versionStrategies
}

export default getExplicitVersionStrategies