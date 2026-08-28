import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const pluginRoot = path.join(repositoryRoot, "plugins", "eli20");

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("the Codex manifest and marketplace expose the eli20 plugin", async () => {
  const codexManifest = JSON.parse(await read("plugins/eli20/.codex-plugin/plugin.json"));
  const codexMarketplace = JSON.parse(await read(".agents/plugins/marketplace.json"));

  assert.equal(codexManifest.name, "eli20");
  assert.equal(codexManifest.version, "0.1.2");
  assert.equal(codexMarketplace.name, "game-dev-rta-club");
  assert.equal(codexMarketplace.plugins[0].source.path, "./plugins/eli20");
});

test("the plugin contains the two intended skills and one notebook asset folder", async () => {
  const skills = (await readdir(path.join(pluginRoot, "skills"))).sort();
  const assets = (await readdir(path.join(pluginRoot, "skills", "eli20-notebook", "assets"))).sort();
  const notebookSkill = await read("plugins/eli20/skills/eli20-notebook/SKILL.md");
  const procedure = notebookSkill.slice(notebookSkill.indexOf("# eli20-notebook"));

  assert.deepEqual(skills, ["eli20", "eli20-notebook"]);
  assert.deepEqual(assets, ["notebook"]);
  assert.match(procedure, /First use eli20[\s\S]+visual[\s\S]+Then read that source range again[\s\S]+summary/);
});

test("the notebook skill gives a first-time agent a complete executable workflow", async () => {
  const notebookSkill = await read("plugins/eli20/skills/eli20-notebook/SKILL.md");
  const requiredOperationalDetails = [
    "assets/notebook/.",
    "book-config.js",
    "index.html",
    "NN-<section>-visual.html",
    "NN-<section>-summary.md",
    "build-summaries.mjs",
    "node --check",
    "--check .",
    "Untitled notebook"
  ];

  for (const detail of requiredOperationalDetails) {
    assert.ok(notebookSkill.includes(detail), `missing operational detail: ${detail}`);
  }

  const planningIndex = notebookSkill.indexOf("Survey the whole source");
  const visualIndex = notebookSkill.indexOf("use eli20");
  assert.ok(notebookSkill.indexOf("copy") < notebookSkill.indexOf("book-config.js"));
  assert.ok(planningIndex >= 0, "missing structure-planning phase");
  assert.ok(visualIndex >= 0, "missing eli20 visual phase");
  assert.ok(planningIndex < visualIndex, "structure planning must precede visual creation");
  assert.ok(notebookSkill.indexOf("build-summaries.mjs .") < notebookSkill.indexOf("build-summaries.mjs --check ."));
  assert.match(notebookSkill, /complete portable unit/);
  assert.match(notebookSkill, /all runtime and generated-file references resolve within the notebook directory/);
  assert.doesNotMatch(notebookSkill, /validate the shared scripts/);
});

test("the notebook template is portable without parent-directory dependencies", async () => {
  const notebookRoot = path.join(pluginRoot, "skills", "eli20-notebook", "assets", "notebook");
  const files = await collectFiles(notebookRoot);

  for (const file of files) {
    const content = await readTextFile(file);
    if (content === null) continue;
    assert.doesNotMatch(content, /(?:href|src)=["']\.\.\//, `${file} references a parent directory`);
    assert.doesNotMatch(content, /_shared/, `${file} references a shared directory`);
  }
});

test("the notebook template is source-agnostic and uses English interface labels", async () => {
  const config = await read("plugins/eli20/skills/eli20-notebook/assets/notebook/book-config.js");
  const reader = await read("plugins/eli20/skills/eli20-notebook/assets/notebook/book-reader.js");
  const skill = await read("plugins/eli20/skills/eli20-notebook/SKILL.md");

  assert.match(config, /sections:\s*\[/);
  assert.match(config, /label: "Section 1"/);
  assert.match(config, /label: "Visual"/);
  assert.match(config, /label: "Summary"/);
  assert.match(reader, /config\.sections/);
  assert.match(skill, /English interface labels `Section`, `Visual`, and `Summary`/);

  const assets = await collectFiles(path.join(pluginRoot, "skills", "eli20-notebook", "assets", "notebook"));
  for (const file of assets) {
    const content = await readFile(file, "utf8").catch(() => "");
    assert.doesNotMatch(content, /[\u3040-\u30ff\u3400-\u9fff]/u, `${file} contains a non-English template label`);
  }
});

test("the example uses the current notebook runtime and fits titles by rendered width", async () => {
  const assetRoot = "plugins/eli20/skills/eli20-notebook/assets/notebook";
  const exampleRoot = "examples/how-to-live-on-twenty-four-hours-a-day";
  const reader = await read(`${assetRoot}/book-reader.js`);
  const styles = await read(`${assetRoot}/book-reader.css`);

  assert.match(reader, /bookTitle\.scrollWidth <= bookTitle\.clientWidth/);
  assert.match(reader, /new ResizeObserver\(scheduleBookTitleFit\)/);
  assert.match(styles, /\.book__copy\s*\{[^}]*justify-self: stretch/s);
  assert.match(styles, /\.book h1\s*\{[^}]*width: 100%/s);
  assert.equal(await read(`${exampleRoot}/book-reader.js`), reader);
  assert.equal(await read(`${exampleRoot}/book-reader.css`), styles);
});

test("the notebook example leaves scrolling to the document instead of floating dot navigation", async () => {
  const exampleRoot = path.join(repositoryRoot, "examples", "how-to-live-on-twenty-four-hours-a-day");
  const visualFiles = (await readdir(exampleRoot)).filter((file) => file.endsWith("-visual.html"));

  for (const file of visualFiles) {
    const visual = await readFile(path.join(exampleRoot, file), "utf8");
    assert.doesNotMatch(visual, /<nav\b[^>]*aria-label="Visual sections"/);
  }
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
  assert.match(readme, /\(plugins\/eli20\/skills\/eli20\/SKILL\.md\)/);
  assert.match(readme, /\(plugins\/eli20\/skills\/eli20-notebook\/SKILL\.md\)/);
  assert.doesNotMatch(readme, /^## Output$/m);
  assert.match(readme, /https:\/\/game-dev-rta-club\.github\.io\/eli20\//);

  for (const imagePath of imagePaths) {
    assert.ok(readme.includes(`](${imagePath})`), `README does not reference ${imagePath}`);
    assert.ok((await stat(path.join(repositoryRoot, imagePath))).size > 1000, `${imagePath} is missing or empty`);
  }
});

test("Markdown is the source and generated summary HTML can be checked for drift", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "eli20-notebook-"));
  const notebookAssets = path.join(pluginRoot, "skills", "eli20-notebook", "assets", "notebook");
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
