import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const args = process.argv.slice(2);
const checkOnly = args[0] === "--check";
const directoryArgument = checkOnly ? args[1] : args[0];

if (!directoryArgument || args.length !== (checkOnly ? 2 : 1)) {
  console.error("Usage: node build-summaries.mjs [--check] <notebook-directory>");
  process.exit(1);
}

const notebookDirectory = resolve(directoryArgument);
const sourceFiles = (await readdir(notebookDirectory))
  .filter((name) => name.endsWith("-summary.md"))
  .sort();

if (sourceFiles.length === 0) {
  console.error(`No *-summary.md files found in ${notebookDirectory}`);
  process.exit(1);
}

const staleFiles = [];

for (const sourceFilename of sourceFiles) {
  const outputFilename = sourceFilename.replace(/\.md$/, ".html");
  const markdown = await readFile(resolve(notebookDirectory, sourceFilename), "utf8");
  const html = renderSummary(markdown, sourceFilename);
  const outputPath = resolve(notebookDirectory, outputFilename);

  if (checkOnly) {
    const currentHtml = await readFile(outputPath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (currentHtml !== html) staleFiles.push(outputFilename);
    continue;
  }

  await writeFile(outputPath, html, "utf8");
  console.log(`${basename(sourceFilename)} -> ${outputFilename}`);
}

if (checkOnly) {
  if (staleFiles.length > 0) {
    console.error(`Out-of-date generated summaries:\n${staleFiles.map((name) => `- ${name}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`${sourceFiles.length} summaries are up to date`);
}

function renderSummary(markdown, sourceFilename) {
  const lines = markdown.split(/\r?\n/);
  const title = headingParts(lines.find((line) => line.startsWith("# ")))?.text;
  if (!title) throw new Error(`${sourceFilename}: a level-one heading is required`);

  const content = lines.flatMap((line, index) => convertLine(line, sourceFilename, index + 1)).join("\n");
  return `<!doctype html>
<!-- Generated from ${sourceFilename} by build-summaries.mjs. Do not edit directly. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="summary.css">
</head>
<body>
  <article class="summary-document">
${content}
  </article>
</body>
</html>
`;
}

function convertLine(line, sourceFilename, lineNumber) {
  if (!line.trim()) return [];
  const heading = headingParts(line);
  if (heading) {
    const text = escapeHtml(heading.text);
    const body = heading.href
      ? `<a href="${escapeHtml(heading.href)}" target="_blank" rel="noopener">${text}</a>`
      : text;
    return [`    <h${heading.level}>${body}</h${heading.level}>`];
  }
  if (/^(?:#{1,6}\s|[-+*]>?\s|>\s|\d+\.\s|```)/.test(line)) {
    throw new Error(`${sourceFilename}:${lineNumber}: unsupported Markdown syntax`);
  }
  return [`    <p>${renderInline(line)}</p>`];
}

function renderInline(value) {
  const links = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let html = "";
  let cursor = 0;

  for (const match of value.matchAll(links)) {
    html += renderEmphasis(value.slice(cursor, match.index));
    html += `<a href="${escapeHtml(match[2])}" target="_blank" rel="noopener">${renderEmphasis(match[1])}</a>`;
    cursor = match.index + match[0].length;
  }

  return html + renderEmphasis(value.slice(cursor));
}

function renderEmphasis(value) {
  return escapeHtml(value).replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function headingParts(line = "") {
  const linked = /^(#{1,3}) \[(.+)\]\(<(.+)>\)$/.exec(line);
  if (linked) return { level: linked[1].length, text: linked[2], href: linked[3] };
  const plain = /^(#{1,3}) (.+)$/.exec(line);
  if (plain) return { level: plain[1].length, text: plain[2], href: null };
  return null;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
