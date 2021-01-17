import { inc as incrementSemver } from 'semver'

import logging from '../logging'
import type {
    MonodeployConfiguration,
    PackageStrategyMap,
    PackageTagMap,
    YarnContext,
} from '../types'

import patchPackageJsons from './patchPackageJsons'

const applyReleases = async (
    config: MonodeployConfiguration,
    context: YarnContext,
    registryTags: PackageTagMap,
    versionStrategies: PackageStrategyMap,
): Promise<PackageTagMap> => {
    // Registry tags from mono
    const intendedRegistryTags = new Map()

    for (const [packageName, packageTag] of registryTags.entries()) {
        const packageVersionStrategy = versionStrategies.get(packageName)?.type
        const nextPackageTag = packageVersionStrategy
            ? incrementSemver(packageTag, packageVersionStrategy)
            : packageTag

        if (packageTag !== nextPackageTag) {
            intendedRegistryTags.set(packageName, nextPackageTag)
            logging.info(
                `[Version Change] ${packageName}: ${packageTag} -> ${nextPackageTag} (${packageVersionStrategy})`,
            )
        }
    }

    // Update newVersions to contain appropriate updates for dependents
    await patchPackageJsons(config, context, intendedRegistryTags)

    return intendedRegistryTags
}

export default applyReleases