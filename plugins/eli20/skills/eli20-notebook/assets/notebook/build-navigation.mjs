import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const args = process.argv.slice(2);
const checkOnly = args[0] === "--check";
const directoryArgument = checkOnly ? args[1] : args[0];

if (!directoryArgument || args.length !== (checkOnly ? 2 : 1)) {
  console.error("Usage: node build-navigation.mjs [--check] <notebook-directory>");
  process.exit(1);
}

const notebookRoot = path.resolve(directoryArgument);
const configSource = await readFile(path.join(notebookRoot, "book-config.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(configSource, sandbox);
const config = sandbox.window.BOOK_READER_CONFIG;

if (!config?.titlePage || !Array.isArray(config.sections)) {
  throw new Error("BOOK_READER_CONFIG is invalid.");
}

const startMarker = "<!-- notebook-navigation:start -->";
const endMarker = "<!-- notebook-navigation:end -->";
const generatedBlockPattern = /\n?<!-- notebook-navigation:start -->[\s\S]*?<!-- notebook-navigation:end -->\n?/g;
const staleFiles = [];
const visualSections = config.sections
  .map((section) => ({
    section,
    visual: section.documents.find((document) => document.type === "visual")
  }))
  .filter(({ visual }) => visual);

await updateNavigation(config.titlePage.src, titleContents());

for (const [index, { visual }] of visualSections.entries()) {
  const previous = index === 0 ? null : visualSections[index - 1];
  const next = visualSections[index + 1];
  await updateNavigation(visual.src, visualFooter(previous, next));
}

if (checkOnly) {
  if (staleFiles.length > 0) {
    console.error(`Out-of-date generated navigation:\n${staleFiles.map((name) => `- ${name}`).join("\n")}`);
    process.exit(1);
  }
  console.log("Notebook navigation is up to date");
}

async function updateNavigation(file, navigation) {
  const filePath = path.join(notebookRoot, file);
  const currentSource = await readFile(filePath, "utf8");
  const cleanSource = currentSource
    .replace(generatedBlockPattern, "")
    .replace(/\s*<\/body>/, "\n</body>");
  if (!cleanSource.includes("</body>")) throw new Error(`${file} has no closing body tag.`);

  const nextSource = navigation
    ? cleanSource.replace(
      "</body>",
      `${startMarker}\n${navigationStyles()}\n${navigation}\n${navigationScript()}\n${endMarker}\n</body>`
    )
    : cleanSource;

  if (checkOnly) {
    if (currentSource !== nextSource) staleFiles.push(file);
    return;
  }
  if (currentSource !== nextSource) await writeFile(filePath, nextSource, "utf8");
}

function titleContents() {
  const links = visualSections.map(({ section, visual }) => navigationLink(section, visual.id)).join("\n");
  return `<nav data-notebook-toc aria-label="Contents">
  <h2 class="notebook-nav__heading">Contents</h2>
  <div class="notebook-nav__grid">
${links}
  </div>
</nav>`;
}

function visualFooter(previous, next) {
  const links = [
    previous ? navigationLink(previous.section, previous.visual.id, "previous") : titleLink("previous"),
    next ? navigationLink(next.section, next.visual.id, "next") : titleLink("next")
  ].join("\n");
  return `<nav data-notebook-footer aria-label="Adjacent sections">
${links}
</nav>`;
}

function navigationLink(section, documentId, direction = "") {
  const marker = escapeHtml(section.marker || section.label);
  const title = escapeHtml(section.title);
  const directionAttribute = direction ? ` data-direction="${direction}"` : "";
  const accessibleName = direction ? ` aria-label="${direction === "previous" ? "Previous" : "Next"}: ${title}"` : "";
  const previousChevron = direction === "previous" ? chevron("previous") : "";
  const nextChevron = direction === "next" ? chevron("next") : "";
  return `    <a class="notebook-nav__link" href="index.html#${escapeHtml(documentId)}" target="_parent"${directionAttribute}${accessibleName}>${previousChevron}<span class="notebook-nav__label"><b>${marker}</b><span class="notebook-nav__title">${title}</span></span>${nextChevron}</a>`;
}

function titleLink(direction) {
  const previousChevron = direction === "previous" ? chevron("previous") : "";
  const nextChevron = direction === "next" ? chevron("next") : "";
  return `    <a class="notebook-nav__link" href="index.html" target="_parent" data-direction="${direction}" aria-label="Return to Title">${previousChevron}<span class="notebook-nav__label"><b class="notebook-nav__book">${bookIcon()}</b><span class="notebook-nav__title">Title</span></span>${nextChevron}</a>`;
}

function chevron(direction) {
  const path = direction === "previous" ? "15 5 8 12 15 19" : "9 5 16 12 9 19";
  return `<svg class="notebook-nav__chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="${path}"/></svg>`;
}

function bookIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c2.8-.8 5.3-.2 8 1.5v12c-2.7-1.7-5.2-2.3-8-1.5zM20 5.5c-2.8-.8-5.3-.2-8 1.5v12c2.7-1.7 5.2-2.3 8-1.5z"/></svg>';
}

function navigationStyles() {
  return `<style data-notebook-navigation>
  [data-notebook-footer], [data-notebook-toc] {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: .75rem clamp(1rem, 5vw, 4rem);
    color: #f8f5ec;
    background: #173548;
    border: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  [data-notebook-footer] {
    display: flex;
    gap: clamp(15rem, 25vw, 22.5rem);
    justify-content: space-between;
    padding-inline: clamp(.5rem, .833vw, .75rem);
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
  [data-notebook-footer] .notebook-nav__link { min-width: 0; flex: 1 1 0; }
  [data-notebook-footer] .notebook-nav__link[data-direction="next"] { margin-left: auto; }
  .notebook-nav__link:hover { background: #2d5870; }
  .notebook-nav__link:focus-visible { outline: 3px solid #e3b956; outline-offset: 2px; }
  .notebook-nav__label {
    display: grid;
    min-width: 0;
    flex: 1;
    grid-template-columns: 1.4rem minmax(0, 1fr);
    gap: .4rem;
    align-items: baseline;
    overflow: hidden;
    font-size: .78rem;
    font-weight: 750;
    line-height: 1.25;
    white-space: nowrap;
  }
  .notebook-nav__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .notebook-nav__link b { color: #e3b956; font-variant-numeric: tabular-nums; }
  .notebook-nav__chevron { width: 1rem; height: 1rem; flex: 0 0 1rem; fill: none; stroke: #e3b956; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .notebook-nav__book svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; vertical-align: -.15rem; }
  @media (max-width: 640px) {
    [data-notebook-footer] { gap: 2rem; }
  }
</style>`;
}

function navigationScript() {
  return `<script data-notebook-label-fit>
  (() => {
    const footer = document.querySelector("[data-notebook-footer]");
    if (!footer) return;

    const labels = [...footer.querySelectorAll(".notebook-nav__label")];
    const maximum = 12.5;
    const minimum = 9;
    let scheduledFrame = 0;

    function fitLabel(label) {
      const title = label.querySelector(".notebook-nav__title");
      if (!title) return;
      label.style.fontSize = maximum + "px";
      if (title.scrollWidth <= title.clientWidth) return;

      let low = minimum;
      let high = maximum;
      while (high - low > 0.1) {
        const candidate = (low + high) / 2;
        label.style.fontSize = candidate + "px";
        if (title.scrollWidth <= title.clientWidth) low = candidate;
        else high = candidate;
      }
      label.style.fontSize = Math.floor(low * 10) / 10 + "px";
    }

    function fitAll() {
      scheduledFrame = 0;
      labels.forEach(fitLabel);
    }

    function scheduleFit() {
      cancelAnimationFrame(scheduledFrame);
      scheduledFrame = requestAnimationFrame(fitAll);
    }

    scheduleFit();
    document.fonts?.ready.then(scheduleFit);
    if ("ResizeObserver" in window) new ResizeObserver(scheduleFit).observe(footer);
    else window.addEventListener("resize", scheduleFit, { passive: true });
  })();
</script>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
