const lernaPublish = require('@lerna/publish')
const latestVersion = require('latest-version')

export class ResourceInterface {
    // eslint-disable-next-line no-unused-vars
    getPackageLatestVersion(name, { registryUrl } = {}) {
        throw new Error('not implemented!')
    }

    // eslint-disable-next-line no-unused-vars
    publish(options) {
        throw new Error('not implemented!')
    }
}

export class ExternalResources extends ResourceInterface {
    getPackageLatestVersion(name, { registryUrl } = {}) {
        return latestVersion(name, registryUrl ? { registryUrl } : {})
    }

    publish(options) {
        return lernaPublish(options)
    }
}