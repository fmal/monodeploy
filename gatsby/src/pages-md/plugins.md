---
slug: '/plugins'
title: 'Plugins - Monodeploy'
---

## Plugins

You can add a plugin via a config file or CLI:

```
plugins: ['@monodeploy/plugin-github']
```

```bash
yarn monodeploy --plugins @monodeploy/plugin-github
```

A plugin is a module which exposes a function as the default. This function takes PluginHooks as an argument. You can then "tap" into the hooks.

## Plugin Development

We use [tapable](https://github.com/webpack/tapable) for an experimental plugin system.

### Hooks

#### onReleaseAvailable

This hook is triggered once a release is available, after publishing to npm, and after pushing any artifacts such as git tags to the repository (assuming running with autoCommit and push mode).
