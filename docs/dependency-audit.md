# Dependency audit

Audited on 2026-10-29. Scope: repository tooling, CI actions and skill runtime requirements. Laravel APIs and third-party packages mentioned in illustrative PHP are teaching references, not installed application dependencies.

## Findings and changes

| Dependency | Finding | Action |
| --- | --- | --- |
| npm packages | No dependencies, devDependencies, optionalDependencies, peerDependencies or installed transitive packages. Scripts import only Node built-ins and local modules. `npm ls --all --json` confirmed the empty tree; `npm outdated --json` returned `{}`. | Kept the project dependency-free. No install step or empty lockfile added. |
| Node.js | CI used Node 22; the package declared no runtime requirement. Node 22 is still supported. | Declared Node >=22, selected Node 24 for local work, and configured CI for supported LTS lines 22, 24 and 26. |
| actions/checkout | v4 was behind the current v7.0.1 release. | Updated to the verified v7.0.1 commit. |
| actions/setup-node | v4 was behind the current v7.1.0 release. | Updated to the verified v7.1.0 commit; disabled package-manager caching because there is no dependency lockfile. |
| shivammathur/setup-php | v2 is still the supported major, but its rolling tag was not reproducible. | Pinned the current 2.40.0 release commit; kept PHP 8.3 for minimum-version syntax checks and disabled unused coverage. |
| GitHub Actions updates | No dependency-update configuration. | Added weekly Dependabot checks for action release pins and limited workflow token permissions to contents: read. |
| Writing skill | Instructions and bundled Markdown references have no executable dependency. | No runtime package added. Optional OpenAI and Claude metadata remain host-specific packaging. |

The release script additionally invokes Git, npm and GitHub CLI. The OpenAI export uses Node's filesystem APIs. ZIP creation, when desired, is a separate archive-tool operation. Python/PyYAML used for an optional external skill-authoring check are not project dependencies.

## Verification and limits

The complete repository check runs locally on Node 24.4.1 with PHP 8.5.12. Workflow YAML and action inputs are checked against the pinned upstream action manifests. Node 22/26 and PHP 8.3 execution in the revised GitHub-hosted matrix require a CI run after pushing.

An npm advisory audit has no installed package graph to inspect here. This is not a claim that operating-system tools or the actions' internal dependency trees have no vulnerabilities. Those action trees are supplied by their upstream release artifacts, not resolved by this repository's npm metadata.

## Official sources

- [Node release schedule](https://github.com/nodejs/Release#release-schedule)
- [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)
- [setup-php 2.40.0](https://github.com/shivammathur/setup-php/releases/tag/2.40.0)
- [Claude skill packaging](https://code.claude.com/docs/en/plugins-reference)
