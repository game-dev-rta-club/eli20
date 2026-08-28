# eli20

[![CI](https://github.com/game-dev-rta-club/eli20/actions/workflows/ci.yml/badge.svg)](https://github.com/game-dev-rta-club/eli20/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/game-dev-rta-club/eli20)](https://github.com/game-dev-rta-club/eli20/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Two Codex skills for turning complex source material into visual HTML that is easy to understand and revisit.

## eli20

`eli20` turns one topic or a short source into a concise visual explainer. It uses diagrams and short sentences to make the central idea understandable at a glance.

![An eli20 visual explainer about the daily budget of time](docs/images/eli20-visual.png)

## eli20-notebook

`eli20-notebook` organizes larger or initially unstructured material into a browsable notebook. Each section contains a Visual created with `eli20`, followed by a concise Summary.

![An eli20-notebook with section navigation, Visuals, and Summaries](docs/images/eli20-notebook.png)

[Open the live notebook sample](https://game-dev-rta-club.github.io/eli20/) based on the public-domain book *How to Live on Twenty-Four Hours a Day*.

## Install

Requires Codex on macOS.

```sh
codex plugin marketplace add game-dev-rta-club/eli20
codex plugin add eli20@game-dev-rta-club
```

Start a new Codex task after installation so the skills are loaded.

## Use

```text
Use eli20 to explain how Git branches work.
```

```text
Use eli20-notebook to organize this source into a visual HTML notebook: <source>
```

## Development

```sh
git clone https://github.com/game-dev-rta-club/eli20.git
cd eli20
node --test tests/verify-plugin.mjs
```

Local development requires Node.js 24 or later. No package installation is required.

## Contributing

Focused issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through the private process in [SECURITY.md](SECURITY.md).

## Maintainers

[Game Dev RTA Club](https://github.com/game-dev-rta-club)

## License

[MIT](LICENSE) © 2026 Game Dev RTA Club. Third-party attribution is recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
