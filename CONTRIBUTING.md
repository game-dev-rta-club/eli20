# Contributing

Contributions that make eli20 clearer, safer, or easier to reuse are welcome.

All participants must follow the [Code of Conduct](CODE_OF_CONDUCT.md).

If you have found a security vulnerability, do not open a public issue. Follow the private reporting process in [SECURITY.md](SECURITY.md).

## Propose a change

- For a typo, documentation fix, or small bug fix, open a pull request directly.
- For a behavior change, a new skill, or a template change, open an issue first so the scope can be discussed.
- Keep unrelated skills in their own repositories rather than adding them to this skill collection.

## Local development

Requirements: macOS and Node.js 24 or later.

```sh
git clone https://github.com/game-dev-rta-club/eli20.git
cd eli20
node --test tests/verify-skills.mjs
```

No package installation is required.

When changing a generated notebook Summary, edit its `*-summary.md` source and regenerate the HTML:

```sh
node build-summaries.mjs .
node build-summaries.mjs --check .
```

## Pull requests

Keep each pull request focused on one logical change. A pull request should:

- Explain the problem and why the proposed change addresses it.
- Include or update tests when repository structure or behavior changes.
- Update user-facing documentation when installation or usage changes.
- Pass `node --test tests/verify-skills.mjs`.
- Avoid unrelated formatting or refactoring.

Conventional Commit prefixes such as `docs:`, `fix:`, `feat:`, and `test:` are preferred for commit and pull-request titles.

Maintainers review contributions when available. A response, merge, or release timeline is not guaranteed.

## Contribution license

No Contributor License Agreement or Developer Certificate of Origin is required. Unless explicitly stated otherwise, contributions intentionally submitted for inclusion in this repository are licensed under the repository's [MIT License](LICENSE).
