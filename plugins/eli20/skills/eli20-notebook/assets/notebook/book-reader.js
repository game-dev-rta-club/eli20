(function initializeBookReader() {
  "use strict";

  const config = window.BOOK_READER_CONFIG;
  const root = document.querySelector("#book-reader");

  if (!root || !config) {
    throw new Error("Book Reader requires #book-reader and BOOK_READER_CONFIG.");
  }

  validateConfig(config);
  document.title = config.pageTitle || `${config.title} | Notebook`;
  root.innerHTML = shellMarkup();

  const app = root.querySelector("#app");
  const menuToggle = root.querySelector("#menu-toggle");
  const menu = root.querySelector("#book-menu");
  const sidebarResizer = root.querySelector("#sidebar-resizer");
  const viewer = root.querySelector("#viewer");
  const currentContext = root.querySelector("#current-context");
  const currentTitle = root.querySelector("#current-title");
  const resourceList = root.querySelector("#resource-list");
  const bookTitle = root.querySelector("#book-title");
  const bookCopy = root.querySelector(".book__copy");
  const defaultSidebarWidth = 304;
  const minimumSidebarWidth = 240;
  const absoluteMaximumSidebarWidth = 560;
  const minimumBookTitleFontSize = 10;
  const maximumBookTitleFontSize = 16;
  let sidebarWidth = defaultSidebarWidth;
  let resizingPointerId = null;
  let bookTitleFitFrame = null;

  bookTitle.textContent = config.title;
  bookTitle.title = config.title;
  renderResources(config.resources || [], resourceList);
  const buttons = renderSections(config.sections, menu);

  function fitBookTitle() {
    bookTitleFitFrame = null;
    if (bookTitle.clientWidth === 0) return;

    bookTitle.style.fontSize = `${maximumBookTitleFontSize}px`;
    if (bookTitle.scrollWidth <= bookTitle.clientWidth) return;

    let smallestFit = minimumBookTitleFontSize;
    let largestFit = maximumBookTitleFontSize;
    while (largestFit - smallestFit > 0.1) {
      const candidate = (smallestFit + largestFit) / 2;
      bookTitle.style.fontSize = `${candidate}px`;
      if (bookTitle.scrollWidth <= bookTitle.clientWidth) smallestFit = candidate;
      else largestFit = candidate;
    }
    bookTitle.style.fontSize = `${Math.floor(smallestFit * 10) / 10}px`;
  }

  function scheduleBookTitleFit() {
    if (bookTitleFitFrame !== null) cancelAnimationFrame(bookTitleFitFrame);
    bookTitleFitFrame = requestAnimationFrame(fitBookTitle);
  }

  function showDocument(button, updateHash = true) {
    buttons.forEach((item) => item.setAttribute("aria-current", item === button ? "page" : "false"));
    viewer.src = button.dataset.src;
    viewer.title = button.dataset.title;

    currentContext.textContent = `${button.dataset.sectionLabel} / ${button.dataset.label}`;
    currentTitle.textContent = button.dataset.sectionTitle;
    if (updateHash) history.replaceState(null, "", `#${button.dataset.id}`);
  }

  function setMenuExpanded(expanded) {
    app.classList.toggle("is-expanded", expanded);
    menuToggle.setAttribute("aria-expanded", String(expanded));
    menuToggle.setAttribute("aria-label", expanded ? "Close menu" : "Open menu");
    scheduleBookTitleFit();
  }

  function maximumSidebarWidth() {
    return Math.max(minimumSidebarWidth, Math.min(absoluteMaximumSidebarWidth, window.innerWidth * 0.48));
  }

  function setSidebarWidth(width) {
    sidebarWidth = Math.round(Math.min(maximumSidebarWidth(), Math.max(minimumSidebarWidth, width)));
    document.documentElement.style.setProperty("--sidebar-width-expanded", `${sidebarWidth}px`);
    sidebarResizer.setAttribute("aria-valuenow", String(sidebarWidth));
    sidebarResizer.setAttribute("aria-valuemax", String(Math.round(maximumSidebarWidth())));
    scheduleBookTitleFit();
  }

  function finishSidebarResize(pointerId) {
    if (resizingPointerId !== pointerId) return;
    resizingPointerId = null;
    app.classList.remove("is-resizing");
  }

  buttons.forEach((button) => button.addEventListener("click", () => showDocument(button)));
  menuToggle.addEventListener("click", () => {
    setMenuExpanded(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  sidebarResizer.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    resizingPointerId = event.pointerId;
    app.classList.add("is-resizing");
    sidebarResizer.setPointerCapture(event.pointerId);
    setSidebarWidth(event.clientX);
  });
  sidebarResizer.addEventListener("pointermove", (event) => {
    if (resizingPointerId !== event.pointerId) return;
    setSidebarWidth(event.clientX);
  });
  sidebarResizer.addEventListener("pointerup", (event) => finishSidebarResize(event.pointerId));
  sidebarResizer.addEventListener("pointercancel", (event) => finishSidebarResize(event.pointerId));
  sidebarResizer.addEventListener("keydown", (event) => {
    const changes = { ArrowLeft: -16, ArrowRight: 16, Home: minimumSidebarWidth, End: maximumSidebarWidth() };
    if (!(event.key in changes)) return;
    event.preventDefault();
    const width = event.key === "Home" || event.key === "End" ? changes[event.key] : sidebarWidth + changes[event.key];
    setSidebarWidth(width);
  });
  window.addEventListener("resize", () => setSidebarWidth(sidebarWidth));
  new ResizeObserver(scheduleBookTitleFit).observe(bookCopy);
  document.fonts?.ready.then(scheduleBookTitleFit);

  const initialId = location.hash.slice(1);
  const initialButton = buttons.find((button) => button.dataset.id === initialId) || buttons[0];
  setSidebarWidth(defaultSidebarWidth);
  showDocument(initialButton, false);
})();

function validateConfig(config) {
  if (typeof config.title !== "string" || !config.title.trim()) {
    throw new Error("BOOK_READER_CONFIG.title is required.");
  }
  if (!Array.isArray(config.sections) || config.sections.length === 0) {
    throw new Error("BOOK_READER_CONFIG.sections must contain at least one section.");
  }

  const documentIds = new Set();
  config.sections.forEach((section) => {
    if (!section.id || !section.label || !section.title || !Array.isArray(section.documents) || section.documents.length === 0) {
      throw new Error("Every section requires id, label, title, and documents.");
    }
    section.documents.forEach((document) => {
      if (!document.id || !document.src || !["visual", "summary"].includes(document.type)) {
        throw new Error(`Invalid document in ${section.id}.`);
      }
      if (documentIds.has(document.id)) throw new Error(`Duplicate document id: ${document.id}`);
      documentIds.add(document.id);
    });
  });
}

function renderSections(sections, menu) {
  const buttons = [];
  sections.forEach((sectionConfig) => {
    const section = document.createElement("section");
    const titleId = `${sectionConfig.id}-title`;
    section.className = "section";
    section.setAttribute("aria-labelledby", titleId);

    const heading = document.createElement("h2");
    heading.className = "section__title";
    heading.id = titleId;
    heading.innerHTML = `<span class="section__marker" aria-hidden="true"><span class="section__number"></span></span><span class="section__name"></span>`;
    heading.querySelector(".section__number").textContent = sectionConfig.marker || sectionConfig.label;
    heading.querySelector(".section__name").textContent = `${sectionConfig.label} — ${sectionConfig.title}`;

    const items = document.createElement("div");
    items.className = "section__items";
    sectionConfig.documents.forEach((documentConfig) => {
      const button = createDocumentButton(sectionConfig, documentConfig);
      items.append(button);
      buttons.push(button);
    });

    section.append(heading, items);
    menu.append(section);
  });
  return buttons;
}

function createDocumentButton(section, documentConfig) {
  const button = document.createElement("button");
  button.className = "document-button";
  button.type = "button";
  button.title = `${section.label}: ${documentConfig.label}`;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-current", "false");
  button.dataset.id = documentConfig.id;
  button.dataset.type = documentConfig.type;
  button.dataset.src = documentConfig.src;
  button.dataset.title = `${section.label} · ${documentConfig.label}`;
  button.dataset.sectionLabel = section.label;
  button.dataset.sectionTitle = section.title;
  button.dataset.label = documentConfig.label;
  button.innerHTML = `<span class="document-button__icon" aria-hidden="true">${documentIcon(documentConfig.type)}</span><span class="document-button__text"></span>`;
  button.querySelector(".document-button__text").textContent = documentConfig.label;
  return button;
}

function renderResources(resources, container) {
  resources.forEach((resource) => {
    if (!resource.url || !resource.label) return;
    const type = ["kindle", "youtube"].includes(resource.type) ? resource.type : "external";
    const link = document.createElement("a");
    link.className = `source-link source-link--${type}`;
    link.href = resource.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", resource.label);
    link.title = resource.label;
    link.innerHTML = resourceIcon(type);
    container.append(link);
  });
}

function shellMarkup() {
  return `
    <div class="app" id="app">
      <aside class="sidebar" aria-label="Sections and documents">
        <header class="book">
          <button class="menu-toggle" id="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="book-menu">
            <svg class="open-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <svg class="close-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="book__copy"><h1 id="book-title"></h1></div>
        </header>
        <nav class="toc" id="book-menu" aria-label="Choose a document"></nav>
        <div class="sidebar-resizer" id="sidebar-resizer" role="separator" aria-label="Resize menu" aria-orientation="vertical" aria-valuemin="240" aria-valuemax="560" aria-valuenow="304" tabindex="0"></div>
      </aside>
      <main class="workspace">
        <header class="toolbar">
          <div class="toolbar__text">
            <span class="toolbar__eyebrow" id="current-context"></span>
            <h2 id="current-title"></h2>
          </div>
          <nav class="toolbar__actions" id="resource-list" aria-label="External resources"></nav>
        </header>
        <div class="viewer-shell">
          <iframe class="viewer" id="viewer" title="Document"></iframe>
        </div>
      </main>
    </div>`;
}

function documentIcon(type) {
  if (type === "summary") {
    return `<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h9l3 3V20.5H6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 3.5v3h3M9 11h6M9 15h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="15" y="4" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.7"/><rect x="9" y="15" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.7"/><path d="M6 9v3h12V9M12 12v3" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
}

function resourceIcon(type) {
  if (type === "kindle") {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4.5h8.5A2.5 2.5 0 0 1 16 7v12.5H7.5A2.5 2.5 0 0 1 5 17z" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 8v8M13 8l-4.5 4 4.5 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 7h3v12.5h-3" stroke="currentColor" stroke-width="1.7"/></svg>`;
  }
  if (type === "youtube") {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 7H6.5A2.5 2.5 0 0 0 4 9.5v8A2.5 2.5 0 0 0 6.5 20h8a2.5 2.5 0 0 0 2.5-2.5V14" stroke="currentColor" stroke-width="1.7"/><path d="M13 4h7v7M20 4l-9 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
