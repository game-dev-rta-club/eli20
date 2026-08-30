import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadNotebookConfig } from "./notebook-metadata.mjs";

const args = process.argv.slice(2);
const checkOnly = args[0] === "--check";
const directoryArgument = checkOnly ? args[1] : args[0];

if (!directoryArgument || args.length !== (checkOnly ? 2 : 1)) {
  console.error("Usage: node build-navigation.mjs [--check] <notebook-directory>");
  process.exit(1);
}

const notebookRoot = path.resolve(directoryArgument);
const config = await loadNotebookConfig(notebookRoot, { checkOnly });

if (!config?.titlePage || !Array.isArray(config.sections)) {
  throw new Error("BOOK_READER_CONFIG is invalid.");
}

const startMarker = "<!-- notebook-navigation:start -->";
const endMarker = "<!-- notebook-navigation:end -->";
const generatedBlockPattern = /\n?<!-- notebook-navigation:start -->[\s\S]*?<!-- notebook-navigation:end -->\n?/g;
const staleFiles = [];
const visualSections = config.sections
  .map((section, sectionIndex) => ({
    section,
    sectionIndex,
    visual: section.documents.find((document) => document.type === "visual")
  }))
  .filter(({ visual }) => visual);

await updateNavigation(config.titlePage.src, titleContents());

for (const { visual } of visualSections) {
  await updateNavigation(visual.src, "", visualScrollBridge());
}

if (checkOnly) {
  if (staleFiles.length > 0) {
    console.error(`Out-of-date generated navigation:\n${staleFiles.map((name) => `- ${name}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Notebook navigation is up to date");
}

async function updateNavigation(file, navigation, behavior = "") {
  const filePath = path.join(notebookRoot, file);
  const currentSource = await readFile(filePath, "utf8");
  const cleanSource = currentSource
    .replace(generatedBlockPattern, "")
    .replace(/\s*<\/body>/, "\n</body>");
  if (!cleanSource.includes("</body>")) throw new Error(`${file} has no closing body tag.`);

  const generatedContent = [navigation ? navigationStyles() : "", navigation, behavior].filter(Boolean).join("\n");
  const nextSource = generatedContent
    ? cleanSource.replace(
      "</body>",
      `${startMarker}\n${generatedContent}\n${endMarker}\n</body>`
    )
    : cleanSource;

  if (checkOnly) {
    if (currentSource !== nextSource) staleFiles.push(file);
    return;
  }
  if (currentSource !== nextSource) await writeFile(filePath, nextSource, "utf8");
}

function visualScrollBridge() {
  return `<script data-notebook-scroll-bridge>
  (() => {
    const messageType = "eli20-notebook:visual-scroll";
    const requestType = "eli20-notebook:request-scroll";
    let scrollContainer = null;
    let scheduledFrame = 0;

    function findPrimaryScrollContainer() {
      const scrollingElement = document.scrollingElement;
      const candidates = [scrollingElement, ...document.querySelectorAll("body *")].filter((element, index, all) => {
        if (!element || all.indexOf(element) !== index) return false;
        if (element.scrollHeight - element.clientHeight <= 2) return false;
        if (element === scrollingElement) return true;
        const overflowY = getComputedStyle(element).overflowY;
        return overflowY === "auto" || overflowY === "scroll";
      });
      return candidates.sort((left, right) =>
        (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight)
      )[0] || null;
    }

    function report() {
      scheduledFrame = 0;
      const endThreshold = scrollContainer ? Math.max(2, Math.min(160, scrollContainer.clientHeight * 0.25)) : 0;
      const atEnd = !scrollContainer || scrollContainer.scrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop <= endThreshold;
      parent.postMessage({ type: messageType, atEnd }, "*");
    }

    function scheduleReport() {
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(report);
    }

    function connect() {
      scrollContainer = findPrimaryScrollContainer();
      const scrollTarget = scrollContainer === document.scrollingElement ? document : scrollContainer;
      scrollTarget?.addEventListener("scroll", scheduleReport, { passive: true });
      window.addEventListener("resize", scheduleReport, { passive: true });
      window.addEventListener("message", (event) => {
        if (event.source !== parent) return;
        if (event.data?.type === requestType) scheduleReport();
      });
      if ("ResizeObserver" in window) {
        const resizeObserver = new ResizeObserver(scheduleReport);
        resizeObserver.observe(document.documentElement);
        if (scrollContainer && scrollContainer !== document.documentElement) resizeObserver.observe(scrollContainer);
      }
      scheduleReport();
      setTimeout(scheduleReport, 100);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", connect, { once: true });
    } else {
      connect();
    }
  })();
</script>`;
}

function titleContents() {
  const links = visualSections.map(({ section, sectionIndex, visual }) => navigationLink(section, sectionIndex, visual.id)).join("\n");
  return `<nav data-notebook-toc aria-label="Contents">
  <h2 class="notebook-nav__heading">Contents</h2>
  <div class="notebook-nav__grid">
${links}
  </div>
</nav>`;
}

function navigationLink(section, sectionIndex, documentId) {
  const marker = escapeHtml(section.marker || sectionIndex + 1);
  const title = escapeHtml(section.title);
  return `    <a class="notebook-nav__link" href="index.html#${escapeHtml(documentId)}" target="_parent"><span class="notebook-nav__label"><b>${marker}</b><span class="notebook-nav__title">${title}</span></span></a>`;
}

function navigationStyles() {
  return `<style data-notebook-navigation>
  html { background: #173548; }
  [data-notebook-toc] {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: .75rem clamp(1rem, 5vw, 4rem);
    color: #f8f5ec;
    background: #173548;
    border: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  [data-notebook-toc] { padding-block: .75rem 1rem; }
  .notebook-nav__heading {
    margin: 0 0 .5rem;
    color: inherit;
    font: 800 1rem/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .notebook-nav__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: .4rem; }
  .notebook-nav__link {
    all: unset;
    box-sizing: border-box;
    display: flex;
    min-width: 0;
    align-items: center;
    gap: .6rem;
    padding: .5rem .65rem;
    color: #f8f5ec;
    background: #24495f;
    border: 1px solid #557287;
    border-radius: .35rem;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    text-align: left;
  }
  .notebook-nav__link:hover { background: #2d5870; }
  .notebook-nav__link:focus-visible { outline: 3px solid #e3b956; outline-offset: 2px; }
  .notebook-nav__label {
    display: grid;
    min-width: 0;
    flex: 1;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: .4rem;
    align-items: baseline;
    overflow: hidden;
    font-size: .78rem;
    font-weight: 750;
    line-height: 1.25;
    white-space: nowrap;
  }
  .notebook-nav__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .notebook-nav__link b {
    min-width: 1.4rem;
    max-width: 8rem;
    overflow: hidden;
    color: #e3b956;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
  }
</style>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
