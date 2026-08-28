# eli20

[![CI](https://github.com/game-dev-rta-club/eli20/actions/workflows/ci.yml/badge.svg)](https://github.com/game-dev-rta-club/eli20/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/game-dev-rta-club/eli20)](https://github.com/game-dev-rta-club/eli20/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Create visual HTML explanations and browsable notebooks from complex source material.

`eli20` explains one topic as a visual-first HTML page. `eli20-notebook` surveys larger or initially unstructured material, divides it into understandable sections, and builds a standalone notebook with a Visual followed by a Summary for every section.

[Open the live notebook demo](https://game-dev-rta-club.github.io/eli20/).

## Requirements

- Codex on macOS
- Node.js 24 or later for local development and notebook summary generation

Windows, Claude, and other agents are not part of the initial supported release.

## Install

```sh
codex plugin marketplace add game-dev-rta-club/eli20
codex plugin add eli20@game-dev-rta-club
```

Start a new Codex task after installation so the skills are loaded.

## Usage

Create a visual explanation for one topic:

```text
Use eli20 to explain how Git branches work.
```

Turn substantial source material into a sectioned notebook:

```text
Use eli20-notebook to organize this source into a visual HTML notebook: <source>
```

The notebook workflow first surveys the whole source and plans its sections. It then completes one section per Codex goal turn: create the Visual with `eli20`, read the source again, write the Summary, and finish the turn. A final turn validates the assembled notebook.

## Output

An `eli20-notebook` output directory contains:

- one standalone `index.html` notebook;
- one Visual HTML document per section;
- one Markdown Summary source per section;
- generated Summary HTML documents;
- shared local CSS and JavaScript with no package or web-server requirement.

Markdown is the single editable source for summaries. Run the generated builder after editing a Summary:

```sh
node build-summaries.mjs .
node build-summaries.mjs --check .
```

The complete public-domain example is available in [`examples/how-to-live-on-twenty-four-hours-a-day`](examples/how-to-live-on-twenty-four-hours-a-day/).

## Development

```sh
git clone https://github.com/game-dev-rta-club/eli20.git
cd eli20
node --test tests/verify-plugin.mjs
```

The repository has no package-install step or runtime dependency.

## Project status

This is an early public release. The skills produce local HTML artifacts through agent instructions rather than a conventional application runtime. Generated material should still be reviewed for accuracy, source fidelity, and appropriate handling of copyrighted or sensitive input.

## Maintainers

[Game Dev RTA Club](https://github.com/game-dev-rta-club) maintains this project on a volunteer basis. Response and release timelines are not guaranteed.

## Contributing

Bugs, focused improvements, and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Game Dev RTA Club. Third-party attribution is recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
