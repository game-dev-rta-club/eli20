# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-08-31

### Changed

- Produce every section Summary before creating Visuals, then create each Visual from the relevant source while preserving its nuance.

## [0.2.0] - 2026-08-30

### Added

- Support project-local installation for Codex and Claude Code through the open `npx skills` installer.
- Record portable notebook creation and update timestamps automatically during generation.

### Changed

- Publish `eli20` and `eli20-notebook` directly from the repository's root `skills/` directory as portable Agent Skills.
- Keep notebook-wide and section-specific creation context in `book-config.js` so long-running work does not depend on conversation memory.
- Preserve Codex goal-based section turns while letting Claude Code continue directly after organizing the section plan.
- Overlay Visual navigation without resizing its iframe, preventing layout shifts when the footer appears.
- Size notebook sections and Visuals from the source's length and conceptual density instead of copying the sample's page count.

### Fixed

- Show Visual navigation reliably when a notebook is opened directly from a local `file://` URL.
- Observe the document scroll target correctly and respect reduced-motion preferences for footer transitions.

## [0.1.4] - 2026-08-29

### Added

- Start generated notebooks on a visual title page created after all section Visuals and Summaries are complete.
- Generate a title-page contents list and compact previous/next navigation for every Visual.

### Changed

- Crossfade notebook documents without showing a blank intermediate frame.
- Fit long footer labels to their available rendered width and return to Title after the final section.

### Fixed

- Prevent the notebook sample from revealing a white canvas during Chrome overscroll.

## [0.1.1] - 2026-08-28

### Fixed

- Fit notebook titles to the actual rendered sidebar width across writing systems and font metrics.

## [0.1.0] - 2026-08-28

### Added

- The `eli20` visual HTML explainer skill.
- The `eli20-notebook` sectioned notebook skill.
- A reusable standalone notebook template.
- A public-domain notebook example based on *How to Live on Twenty-Four Hours a Day*.

[Unreleased]: https://github.com/game-dev-rta-club/eli20/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/game-dev-rta-club/eli20/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/game-dev-rta-club/eli20/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/game-dev-rta-club/eli20/compare/v0.1.1...v0.1.4
[0.1.1]: https://github.com/game-dev-rta-club/eli20/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/game-dev-rta-club/eli20/releases/tag/v0.1.0
