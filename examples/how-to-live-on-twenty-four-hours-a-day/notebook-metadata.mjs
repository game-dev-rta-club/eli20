import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

export async function loadNotebookConfig(notebookRoot, { checkOnly = false, now = new Date() } = {}) {
  const configPath = path.join(notebookRoot, "book-config.js");
  let source = await readFile(configPath, "utf8");
  let config = evaluateConfig(source);

  if (!checkOnly) {
    const timestamp = now.toISOString();
    const createdAt = isValidTimestamp(config.createdAt) ? config.createdAt : timestamp;
    source = writeTimestamps(source, createdAt, timestamp);
    await writeFile(configPath, source, "utf8");
    config = evaluateConfig(source);
  }

  validateTimestamps(config);
  return config;
}

function evaluateConfig(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.BOOK_READER_CONFIG;
}

function writeTimestamps(source, createdAt, updatedAt) {
  const withoutTimestamps = source.replace(/^  (?:createdAt|updatedAt):\s*(?:null|"(?:\\.|[^"\\])*")\s*,?\s*\n/gm, "");
  const titleLine = /^  title:\s*"(?:\\.|[^"\\])*"\s*,?\s*$/m;
  if (!titleLine.test(withoutTimestamps)) throw new Error("book-config.js must contain a top-level title.");

  return withoutTimestamps.replace(
    titleLine,
    (title) => `${title.replace(/,?\s*$/, ",")}\n  createdAt: ${JSON.stringify(createdAt)},\n  updatedAt: ${JSON.stringify(updatedAt)},`
  );
}

function validateTimestamps(config) {
  if (!isValidTimestamp(config?.createdAt)) throw new Error("book-config.js must contain a valid createdAt timestamp.");
  if (!isValidTimestamp(config?.updatedAt)) throw new Error("book-config.js must contain a valid updatedAt timestamp.");
  if (Date.parse(config.updatedAt) < Date.parse(config.createdAt)) {
    throw new Error("book-config.js updatedAt must not be earlier than createdAt.");
  }
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
