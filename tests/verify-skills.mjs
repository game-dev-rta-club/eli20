import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const skillsRoot = path.join(repositoryRoot, "skills");

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("the repository exposes two portable skills from the root skills directory", async () => {
  const skills = (await readdir(skillsRoot)).sort();
  const assets = (await readdir(path.join(skillsRoot, "eli20-notebook", "assets"))).sort();
  const visualSkill = await read("skills/eli20/SKILL.md");
  const notebookSkill = await read("skills/eli20-notebook/SKILL.md");
  const procedure = notebookSkill.slice(notebookSkill.indexOf("# eli20-notebook"));

  assert.deepEqual(skills, ["eli20", "eli20-notebook"]);
  assert.deepEqual(assets, ["notebook"]);
  assert.match(visualSkill, /Use the topic provided in the user's request\./);
  assert.doesNotMatch(visualSkill, /\$ARGUMENTS/);
  assert.doesNotMatch(notebookSkill, /\$ARGUMENTS/);
  assert.match(procedure, /First use eli20[\s\S]+visual[\s\S]+Then read that source range again[\s\S]+summary/);
});

test("the notebook skill gives a first-time agent a complete executable workflow", async () => {
  const notebookSkill = await read("skills/eli20-notebook/SKILL.md");
  const requiredOperationalDetails = [
    "assets/notebook/.",
    "book-config.js",
    "index.html",
    "NN-<section>-visual.html",
    "NN-<section>-summary.md",
    "build-summaries.mjs",
    "build-navigation.mjs",
    "node --check",
    "--check .",
    "Untitled notebook"
  ];

  for (const detail of requiredOperationalDetails) {
    assert.ok(notebookSkill.includes(detail), `missing operational detail: ${detail}`);
  }

  const planningIndex = notebookSkill.indexOf("Survey the whole source");
  const visualIndex = notebookSkill.indexOf("use eli20");
  const buildIndex = notebookSkill.indexOf("## Build");
  assert.ok(notebookSkill.indexOf("copy", buildIndex) < notebookSkill.indexOf("book-config.js", buildIndex));
  assert.ok(planningIndex >= 0, "missing structure-planning phase");
  assert.ok(visualIndex >= 0, "missing eli20 visual phase");
  assert.ok(planningIndex < visualIndex, "structure planning must precede visual creation");
  assert.ok(notebookSkill.indexOf("build-summaries.mjs .") < notebookSkill.indexOf("build-summaries.mjs --check ."));
  assert.ok(notebookSkill.indexOf("build-navigation.mjs .") < notebookSkill.indexOf("build-navigation.mjs --check ."));
  assert.match(notebookSkill, /complete portable unit/);
  assert.match(notebookSkill, /all runtime and generated-file references resolve within the notebook directory/);
  assert.doesNotMatch(notebookSkill, /validate the shared scripts/);
});

test("the notebook skill scales its section plan to large sources", async () => {
  const skill = await readFile(path.join(repositoryRoot, "skills/eli20-notebook/SKILL.md"), "utf8");

  assert.match(skill, /live sample/);
  assert.match(skill, /about 16,000 words/);
  assert.match(skill, /examples, not targets/);
  assert.match(skill, /length and conceptual density/);
  assert.match(skill, /`1-1`, `1-2`, `1-3`, `2-1`/);
  assert.match(skill, /readable scope/);
  assert.match(skill, /creationNotes/);
});

test("the notebook template is portable without parent-directory dependencies", async () => {
  const notebookRoot = path.join(skillsRoot, "eli20-notebook", "assets", "notebook");
  const files = await collectFiles(notebookRoot);

  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) continue;
    assert.doesNotMatch(content, /(?:href|src)=["']\.\.\//, `${file} references a parent directory`);
    assert.doesNotMatch(content, /_shared/, `${file} references a shared directory`);
  }
});

test("the notebook runtime owns its English interface labels", async () => {
  const config = await read("skills/eli20-notebook/assets/notebook/book-config.js");
  const reader = await read("skills/eli20-notebook/assets/notebook/book-reader.js");
  const skill = await read("skills/eli20-notebook/SKILL.md");

  assert.match(config, /sections:\s*\[/);
  assert.doesNotMatch(config, /\blabel:/);
  assert.match(reader, /config\.sections/);
  assert.match(reader, /title:\s*"Title"/);
  assert.match(reader, /section:\s*"Section"/);
  assert.match(reader, /visual:\s*"Visual"/);
  assert.match(reader, /summary:\s*"Summary"/);
  assert.match(skill, /supplies the English interface labels `Title`, `Section`, `Visual`, and `Summary`/);
  assert.match(skill, /runtime ignores `creationNotes`/);

  const assets = await collectFiles(path.join(skillsRoot, "eli20-notebook", "assets", "notebook"));
  for (const file of assets) {
    const content = await readFile(file, "utf8").catch(() => "");
    assert.doesNotMatch(content, /[\u3040-\u30ff\u3400-\u9fff]/u, `${file} contains a non-English template label`);
  }
});

test("the notebook template starts on a reusable title page", async () => {
  const assetRoot = "skills/eli20-notebook/assets/notebook";
  const config = await read(`${assetRoot}/book-config.js`);
  const reader = await read(`${assetRoot}/book-reader.js`);
  const titlePage = await read(`${assetRoot}/00-title.html`);

  assert.match(config, /titlePage:\s*\{/);
  assert.match(config, /src: "00-title\.html"/);
  assert.match(reader, /createTitleButton/);
  assert.match(reader, /location\.pathname/);
  assert.match(titlePage, /Untitled notebook/);
  assert.match(titlePage, /grid-template-columns: minmax\(0, 1fr\)/);
});

test("the notebook skill creates the title after every section and before final verification", async () => {
  const notebookSkill = await read("skills/eli20-notebook/SKILL.md");
  const lastSectionIndex = notebookSkill.indexOf("after every section is complete");
  const titleTurnIndex = notebookSkill.indexOf("dedicated next continuation", lastSectionIndex);
  const finalVerificationIndex = notebookSkill.indexOf("separate final verification continuation", titleTurnIndex);

  assert.ok(lastSectionIndex >= 0, "missing transition after the last section");
  assert.ok(titleTurnIndex > lastSectionIndex, "title page must follow all sections");
  assert.ok(finalVerificationIndex > titleTurnIndex, "final verification must follow the title page");
  assert.match(notebookSkill, /durable section plan and creation context/i);
  assert.match(notebookSkill, /context needed to create that section without rediscovery/i);
  assert.match(notebookSkill, /read every completed Visual and Summary/i);
  assert.match(notebookSkill, /use eli20 to create `00-title\.html`/);
  assert.match(notebookSkill, /title and introduction above the illustration/);
  assert.match(notebookSkill, /one clear idea and one meaningful relationship/);
  assert.match(notebookSkill, /one-column contents/i);
  assert.match(notebookSkill, /every Visual/i);
});

test("the notebook skill stores creation context in config and keeps host workflows lightweight", async () => {
  const notebookSkill = await read("skills/eli20-notebook/SKILL.md");
  const templateConfig = await read("skills/eli20-notebook/assets/notebook/book-config.js");
  const exampleConfig = await read("examples/how-to-live-on-twenty-four-hours-a-day/book-config.js");

  assert.match(templateConfig, /creationNotes:\s*"[^"]+"/);
  assert.equal((templateConfig.match(/creationNotes:/g) || []).length, 2);
  assert.doesNotMatch(templateConfig, /notes:\s*\[/);
  assert.doesNotMatch(exampleConfig, /notes:\s*\[/);
  assert.match(notebookSkill, /\*\*Codex:\*\* Call `create_goal`/);
  assert.match(notebookSkill, /complete exactly one section per turn/i);
  assert.match(notebookSkill, /Do not duplicate config content in the goal/);
  assert.match(notebookSkill, /call `update_goal` with `complete`/i);
  assert.match(notebookSkill, /call `get_goal` to confirm that no active goal remains/i);
  assert.match(notebookSkill, /\*\*Claude Code:\*\* Its `\/goal` command cannot be started by the agent/);
  assert.match(notebookSkill, /skip goal-tool discovery/i);
  assert.match(notebookSkill, /Use `book-config\.js` as the durable section plan and creation context/);
  assert.match(notebookSkill, /continue directly into section production/i);
  assert.doesNotMatch(notebookSkill, /TaskCreate|TaskUpdate|TaskList|TodoWrite/);
  assert.doesNotMatch(notebookSkill, /notebook-status|status:\s*(?:pending|complete)/i);
  assert.doesNotMatch(notebookSkill, /durable notebook plan/i);
});

test("the example uses the current notebook runtime and fits titles by rendered width", async () => {
  const assetRoot = "skills/eli20-notebook/assets/notebook";
  const exampleRoot = "examples/how-to-live-on-twenty-four-hours-a-day";
  const reader = await read(`${assetRoot}/book-reader.js`);
  const styles = await read(`${assetRoot}/book-reader.css`);

  assert.match(reader, /bookTitle\.scrollWidth <= bookTitle\.clientWidth/);
  assert.match(reader, /new ResizeObserver\(scheduleBookTitleFit\)/);
  assert.match(styles, /\.book__copy\s*\{[^}]*justify-self: stretch/s);
  assert.match(styles, /\.book h1\s*\{[^}]*width: 100%/s);
  assert.equal(await read(`${exampleRoot}/book-reader.js`), reader);
  assert.equal(await read(`${exampleRoot}/book-reader.css`), styles);
  const exampleFiles = await readdir(path.join(repositoryRoot, exampleRoot));
  assert.ok(!exampleFiles.includes("sample-title.js"), "example still uses a sample-only title runtime");
  assert.ok(!exampleFiles.includes("sample-title.css"), "example still uses sample-only title styles");
});

test("the reusable notebook runtime provides the polished header and document transition", async () => {
  const assetRoot = "skills/eli20-notebook/assets/notebook";
  const exampleRoot = "examples/how-to-live-on-twenty-four-hours-a-day";
  const index = await read(`${exampleRoot}/index.html`);
  const reader = await read(`${assetRoot}/book-reader.js`);
  const styles = await read(`${assetRoot}/book-reader.css`);

  assert.doesNotMatch(index, /sample-preview\.(?:css|js)/);
  assert.match(reader, /toolbar__marker/);
  assert.match(reader, /toolbar__title/);
  assert.match(reader, /hashchange/);
  assert.match(reader, /createElement\("iframe"\)/);
  assert.match(reader, /activeViewer/);
  assert.match(reader, /inactiveViewer/);
  assert.match(styles, /\.toolbar__marker/);
  assert.match(styles, /\.viewer--incoming/);
  assert.match(styles, /\.viewer--revealing/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\.toolbar__marker\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(styles, /\.toolbar__marker\s*\{[^}]*min-width:\s*2rem/s);
  assert.match(styles, /\.toolbar__marker\s*\{[^}]*width:\s*auto/s);
  assert.match(styles, /\.app\.is-expanded \.section__title\s*\{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/s);
  assert.match(styles, /\.adjacent-footer__label\s*\{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/s);
  assert.equal(await read(`${exampleRoot}/book-reader.js`), reader);
  assert.equal(await read(`${exampleRoot}/book-reader.css`), styles);

  const exampleFiles = await readdir(path.join(repositoryRoot, exampleRoot));
  assert.ok(!exampleFiles.includes("sample-preview.js"));
  assert.ok(!exampleFiles.includes("sample-preview.css"));
});

test("visual documents report their scroll state so file URLs can reveal the shell footer", async () => {
  const assetRoot = "skills/eli20-notebook/assets/notebook";
  const reader = await read(`${assetRoot}/book-reader.js`);
  const styles = await read(`${assetRoot}/book-reader.css`);
  const builder = await read(`${assetRoot}/build-navigation.mjs`);

  assert.match(reader, /id="adjacent-footer"/);
  assert.match(reader, /addEventListener\("message"/);
  assert.match(reader, /event\.source !== activeViewer\.contentWindow/);
  assert.match(reader, /eli20-notebook:visual-scroll/);
  assert.match(reader, /eli20-notebook:request-scroll/);
  assert.doesNotMatch(reader, /contentDocument/);
  assert.match(builder, /data-notebook-scroll-bridge/);
  assert.match(builder, /parent\.postMessage/);
  assert.match(builder, /event\.source !== parent/);
  assert.match(builder, /eli20-notebook:request-scroll/);
  assert.match(builder, /scrollContainer === document\.scrollingElement \? document : scrollContainer/);
  assert.match(builder, /scrollContainer\.scrollHeight\s*-\s*scrollContainer\.clientHeight/);
  assert.match(builder, /Math\.min\(160, scrollContainer\.clientHeight \* 0\.25\)/);
  assert.match(styles, /\.adjacent-footer/);
  assert.match(styles, /\.is-visible/);
  assert.match(styles, /prefers-reduced-motion[\s\S]*\.adjacent-footer[\s\S]*transition: none/);
  assert.doesNotMatch(styles, /\.viewer-shell\.has-visible-footer \.viewer/);
  assert.doesNotMatch(reader, /--adjacent-footer-height/);
  assert.doesNotMatch(builder, /data-notebook-footer/);
});

test("the notebook build embeds title navigation and leaves visual footers to the shell", async () => {
  const assetRoot = "skills/eli20-notebook/assets/notebook";
  const exampleRoot = "examples/how-to-live-on-twenty-four-hours-a-day";
  const title = await read(`${exampleRoot}/00-title.html`);
  const firstVisual = await read(`${exampleRoot}/01-daily-budget-visual.html`);
  const secondVisual = await read(`${exampleRoot}/02-begin-small-visual.html`);
  const finalVisual = await read(`${exampleRoot}/06-avoid-the-traps-visual.html`);
  const builder = await read(`${assetRoot}/build-navigation.mjs`);

  assert.match(title, /data-notebook-toc/);
  assert.match(title, /target="_parent"/);
  assert.doesNotMatch(firstVisual, /data-notebook-footer/);
  assert.doesNotMatch(secondVisual, /data-notebook-footer/);
  assert.doesNotMatch(finalVisual, /data-notebook-footer/);
  assert.match(firstVisual, /data-notebook-scroll-bridge/);
  assert.match(secondVisual, /data-notebook-scroll-bridge/);
  assert.match(finalVisual, /data-notebook-scroll-bridge/);
  assert.match(title, /href="index\.html#section-1-visual"/);
  assert.match(title, /href="index\.html#section-6-visual"/);
  assert.match(builder, /BOOK_READER_CONFIG/);
  assert.match(builder, /notebook-navigation:start/);
  assert.match(builder, /--check/);
  assert.match(builder, /#173548/);
  assert.match(builder, /grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(title, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.equal(await read(`${exampleRoot}/build-navigation.mjs`), builder);
});

test("the navigation builder works inside a copied standalone notebook", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "eli20-navigation-"));
  const notebookAssets = path.join(skillsRoot, "eli20-notebook", "assets", "notebook");
  try {
    await cp(notebookAssets, temporaryRoot, { recursive: true });
    await writeFile(
      path.join(temporaryRoot, "01-visual.html"),
      "<!doctype html><html lang=\"en\"><body><main>Visual</main></body></html>\n",
      "utf8"
    );

    const builder = path.join(temporaryRoot, "build-navigation.mjs");
    await execFileAsync(process.execPath, [builder, temporaryRoot]);
    const title = await readFile(path.join(temporaryRoot, "00-title.html"), "utf8");
    const firstVisual = await readFile(path.join(temporaryRoot, "01-visual.html"), "utf8");

    assert.match(title, /data-notebook-toc/);
    assert.match(title, /grid-template-columns: minmax\(0, 1fr\)/);
    assert.doesNotMatch(firstVisual, /data-notebook-footer/);
    assert.match(firstVisual, /data-notebook-scroll-bridge/);
    await execFileAsync(process.execPath, [builder, "--check", temporaryRoot]);

    await writeFile(path.join(temporaryRoot, "00-title.html"), title.replace("Section title", "Changed"), "utf8");
    await assert.rejects(execFileAsync(process.execPath, [builder, "--check", temporaryRoot]));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("the notebook example leaves scrolling to the document instead of floating dot navigation", async () => {
  const exampleRoot = path.join(repositoryRoot, "examples", "how-to-live-on-twenty-four-hours-a-day");
  const visualFiles = (await readdir(exampleRoot)).filter((file) => file.endsWith("-visual.html"));

  for (const file of visualFiles) {
    const visual = await readFile(path.join(exampleRoot, file), "utf8");
    assert.doesNotMatch(visual, /<nav\b[^>]*aria-label="Visual sections"/);
  }
});

test("the notebook example paints the overscroll canvas to match its footer", async () => {
  const exampleRoot = path.join(repositoryRoot, "examples", "how-to-live-on-twenty-four-hours-a-day");
  const assetStyles = await read("skills/eli20-notebook/assets/notebook/book-reader.css");
  const builder = await read("skills/eli20-notebook/assets/notebook/build-navigation.mjs");
  const documentFiles = [
    "00-title.html",
    ...(await readdir(exampleRoot)).filter((file) => file.endsWith("-visual.html"))
  ];

  for (const file of documentFiles) {
    const document = await readFile(path.join(exampleRoot, file), "utf8");
    assert.match(document, /html\s*\{[^}]*background:\s*#173548/i, `${file} leaves the overscroll canvas unpainted`);
  }
  assert.match(builder, /html\s*\{\s*background:\s*#173548;\s*\}/i, "generated title pages leave their root canvas unpainted");
  assert.match(assetStyles, /html\s*\{\s*background:\s*var\(--sidebar\);\s*\}/i, "the notebook shell leaves its root canvas unpainted");
  assert.match(assetStyles, /\.viewer\s*\{[^}]*background:\s*var\(--sidebar\)/i, "the outer viewer still flashes white");
});

test("the README introduces both skills with current visual examples", async () => {
  const readme = await read("README.md");
  const imagePaths = ["docs/images/eli20-visual.png", "docs/images/eli20-notebook.png"];

  assert.match(readme, /^## \/eli20$/m);
  assert.match(readme, /^## \/eli20-notebook$/m);
  assert.match(readme, /20-year-old new employee with no prior knowledge/);
  assert.match(readme, /document, video, book, codebase, or other material/);
  assert.match(readme, /HTML is the output format, not an input requirement/);
  assert.match(readme, /\/eli20 Explain how Git branches work\./);
  assert.match(readme, /\/eli20-notebook Summarize this document\./);
  assert.match(readme, /\(skills\/eli20\/SKILL\.md\)/);
  assert.match(readme, /\(skills\/eli20-notebook\/SKILL\.md\)/);
  assert.doesNotMatch(readme, /^## Output$/m);
  assert.match(readme, /https:\/\/game-dev-rta-club\.github\.io\/eli20\/sample\//);
  assert.match(readme, /npx skills@latest add game-dev-rta-club\/eli20/);
  assert.match(readme, /--agent codex/);
  assert.match(readme, /--agent claude-code/);
  assert.match(readme, /project-local/i);
  assert.doesNotMatch(readme, /plugin marketplace|plugin install|--plugin-dir/);

  for (const imagePath of imagePaths) {
    assert.ok(readme.includes(`](${imagePath})`), `README does not reference ${imagePath}`);
    assert.ok((await stat(path.join(repositoryRoot, imagePath))).size > 1000, `${imagePath} is missing or empty`);
  }
});

test("GitHub Pages publishes the notebook under /sample/ and preserves the old root", async () => {
  const workflow = await read(".github/workflows/pages.yml");
  const redirect = await read(".github/pages/index.html");

  assert.match(workflow, /mkdir -p _site\/sample/);
  assert.match(workflow, /examples\/how-to-live-on-twenty-four-hours-a-day\/\. _site\/sample\//);
  assert.match(workflow, /path: _site/);
  assert.match(redirect, /url=\.\/sample\//);
  assert.match(redirect, /href="\.\/sample\/"/);
});

test("Markdown is the source and generated summary HTML can be checked for drift", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "eli20-notebook-"));
  const notebookAssets = path.join(skillsRoot, "eli20-notebook", "assets", "notebook");
  try {
    await cp(notebookAssets, temporaryRoot, { recursive: true });
    await writeFile(
      path.join(temporaryRoot, "01-summary.md"),
      "# Chapter One\n\nA concise explanation with [*source material*](https://example.com/book).\n\n## [Source section](<https://example.com/#section>)\n\nA linked explanation.\n",
      "utf8"
    );

    await execFileAsync(process.execPath, [path.join(temporaryRoot, "build-summaries.mjs"), temporaryRoot]);
    const generated = await readFile(path.join(temporaryRoot, "01-summary.html"), "utf8");
    assert.match(generated, /Generated from 01-summary\.md/);
    assert.match(generated, /<h1>Chapter One<\/h1>/);
    assert.match(generated, /<h2><a href="https:\/\/example\.com\/#section"/);
    assert.match(generated, /<a href="https:\/\/example\.com\/book"[^>]*><em>source material<\/em><\/a>/);

    await execFileAsync(process.execPath, [path.join(temporaryRoot, "build-summaries.mjs"), "--check", temporaryRoot]);
    await writeFile(path.join(temporaryRoot, "01-summary.html"), "stale", "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [path.join(temporaryRoot, "build-summaries.mjs"), "--check", temporaryRoot])
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("private book material is not included", async () => {
  const forbiddenFragments = ["\u597d\u304d\u3092\u8a00\u8a9e\u5316\u3059\u308b\u6280\u8853", "B0F8" + "N38KX7"];
  const files = await collectFiles(repositoryRoot);
  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) continue;
    for (const fragment of forbiddenFragments) assert.ok(!content.includes(fragment), `${file} contains private material`);
  }
});

test("the public repository contains no Japanese text", async () => {
  const files = await collectFiles(repositoryRoot);
  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) continue;
    assert.doesNotMatch(content, /[\u3040-\u30ff\u3400-\u9fff]/u, `${file} contains Japanese text`);
  }
});

async function readTextFile(file) {
  const content = await readFile(file).catch(() => null);
  if (content === null || content.includes(0)) return null;
  return content.toString("utf8");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git") continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}
