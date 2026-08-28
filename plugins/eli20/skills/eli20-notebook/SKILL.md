---
name: eli20-notebook
description: Use when substantial or initially unstructured source material should become a browsable HTML notebook organized into understandable sections, with both visual explainers and concise summaries.
license: MIT
---

# eli20-notebook

Create one standalone notebook directory. It runs from local files and needs no package installation or web server. Treat that directory as the complete portable unit: keep every runtime asset and generation script inside it, and use same-directory relative paths so it continues to work when copied or moved.

## Build

1. Resolve the directory containing this `SKILL.md`, create the output directory, and copy every bundled notebook file into it:

   ```sh
   cp -R "<this-skill-directory>/assets/notebook/." "<output-directory>/"
   ```

2. Survey the whole source before producing documents. Make an ordered section plan. For every section, record its number, title, source range or relevant parts, and a short list of the ideas or operations it must explain. Use existing chapters when they help. For unstructured material such as a program, derive sections from its purpose, entry points, major flows or responsibilities, dependencies, and practical operation. Include enough local context that a newcomer can follow a section without having to rediscover omitted basics.
3. Replace the sample data in `book-config.js` from the section plan. Set the notebook title, optional external `resources`, and every planned section. List each section's documents in the fixed order `visual`, then `summary`, and point the summary entry to the generated `.html` file. Use the English interface labels `Section`, `Visual`, and `Summary`. Unless the requester chooses another language, also write notebook titles and generated explanations in English.
4. Call `create_goal` after the complete section plan is fixed. Put the ordered section checklist, each section's title and coverage list, the one-section-per-turn rule, and a separate final verification turn into the goal objective. Finish the current turn immediately after creating the goal; the first automatic continuation starts the first section.
5. In each goal continuation, complete exactly one section and then finish the current turn:

   1. Read only that section's source range and the nearby context needed to understand it.
   2. First use eli20 to create its visual HTML explainer as `NN-<section>-visual.html`.
   3. Then read that source range again from the beginning and write `NN-<section>-summary.md`. Use linked or plain `#`–`###` headings and plain paragraphs; heading links may point back to the relevant source location. This Markdown is the only editable summary source.
   4. Generate its display HTML with `node build-summaries.mjs .`, confirm the Visual and Summary files exist and are non-empty, record the completed section in goal progress, and end the turn. The next automatic continuation handles the next checklist item.

6. After the last section turn ends, use the next continuation as the final verification turn. Generate and check every summary, validate the notebook's own scripts, and inspect the complete notebook:

   ```sh
   cd "<output-directory>"
   node build-summaries.mjs .
   node build-summaries.mjs --check .
   node --check book-config.js
   node --check book-reader.js
   ```

7. Confirm that `book-config.js` no longer contains `Untitled notebook` or `Section title`, every configured file exists and is non-empty, all runtime and generated-file references resolve within the notebook directory, and `index.html` opens with every Visual and Summary selectable. Edit a `*-summary.md` and regenerate when summary content changes; generated `*-summary.html` files are display artifacts. When all checks pass, call `update_goal` with `complete`, then call `get_goal` to confirm that no active goal remains and finish the task.

Source: $ARGUMENTS
