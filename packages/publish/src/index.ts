import { getTopologicalSort } from '@monodeploy/dependencies'
import logging, { assertProductionOrTest } from '@monodeploy/logging'
import type { MonodeployConfiguration, YarnContext } from '@monodeploy/types'
import { Workspace, miscUtils, structUtils } from '@yarnpkg/core'
import { npmHttpUtils, npmPublishUtils } from '@yarnpkg/plugin-npm'
import { packUtils } from '@yarnpkg/plugin-pack'
import pLimit from 'p-limit'

import commitPublishChanges from './commitPublishChanges'
import createReleaseGitTags from './createReleaseGitTags'
import getWorkspacesToPublish from './getWorkspacesToPublish'
import { prepareForPack, prepareForPublish } from './prepare'

export { commitPublishChanges, getWorkspacesToPublish, createReleaseGitTags }

export const publishPackages = async ({
    config,
    context,
    workspacesToPublish,
    registryUrl,
}: {
    config: MonodeployConfiguration
    context: YarnContext
    workspacesToPublish: Set<Workspace>
    registryUrl: string | null
}): Promise<void> => {
    const limitPublish = pLimit(config.maxConcurrentWrites || 1)
    const publishTag = config.prerelease ? config.prereleaseNPMTag : 'latest'

    const prepareWorkspace = async (workspace: Workspace) => {
        const ident = workspace.manifest.name
        if (!ident) return

        const pkgName = structUtils.stringifyIdent(ident)

        const cwd = workspace.cwd

        const pack = async () => {
            if (!registryUrl || config.noRegistry) {
                logging.info(
                    `[Publish] ${pkgName} (${publishTag}: ${workspace.manifest.version}, skipping registry)`,
                    { report: context.report },
                )
                return
            }

            const filesToPack = await packUtils.genPackList(workspace)
            const pack = await packUtils.genPackStream(workspace, filesToPack)

            const buffer = await miscUtils.bufferStream(pack)

            const body = await npmPublishUtils.makePublishBody(
                workspace,
                buffer,
                {
                    access: config.access,
                    tag: publishTag,
                    registry: registryUrl,
                },
            )

            try {
                const identUrl = npmHttpUtils.getIdentUrl(ident)

                if (!config.dryRun) {
                    assertProductionOrTest()
                    await limitPublish(() =>
                        npmHttpUtils.put(identUrl, body, {
                            authType: npmHttpUtils.AuthType.ALWAYS_AUTH,
                            configuration: context.project.configuration,
                            ident,
                            registry: registryUrl,
                        }),
                    )
                }
                logging.info(
                    `[Publish] ${pkgName} (${publishTag}: ${body['dist-tags']?.[publishTag]}, ${registryUrl})`,
                    { report: context.report },
                )
            } catch (e) {
                logging.error(e, { report: context.report })
                throw e
            }
        }

        await prepareForPublish(context, workspace, { cwd }, async () => {
            await prepareForPack(context, workspace, { cwd }, pack)
        })
    }

    const limit = pLimit(config.jobs || Infinity)
    if (config.topological || config.topologicalDev) {
        const groups = await getTopologicalSort(workspacesToPublish, {
            dev: config.topologicalDev,
        })
        const promiseChain = groups.reduce<Promise<void>>(
            (chain, group) =>
                chain.then(
                    async () =>
                        void (await Promise.all(
                            group.map((workspace) =>
                                limit(() => prepareWorkspace(workspace)),
                            ),
                        )),
                ),
            Promise.resolve(),
        )
        await promiseChain
    } else {
        await Promise.all(
            [...workspacesToPublish].map((workspace) =>
                limit(() => prepareWorkspace(workspace)),
            ),
        )
    }
}
