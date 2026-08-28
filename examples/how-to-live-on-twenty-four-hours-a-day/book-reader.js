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
  const viewerShell = root.querySelector(".viewer-shell");
  const initialViewer = root.querySelector("#viewer");
  const currentContext = root.querySelector("#current-context");
  const currentTitle = root.querySelector("#current-title");
  const resourceList = root.querySelector("#resource-list");
  const bookTitle = root.querySelector("#book-title");
  const bookCopy = root.querySelector(".book__copy");
  const defaultSidebarWidth = 304;
  const minimumSidebarWidth = 240;
  const absoluteMaximumSidebarWidth = 560;
  const minimumBookTitleFontSize = 7.5;
  const maximumBookTitleFontSize = 16;
  let sidebarWidth = defaultSidebarWidth;
  let resizingPointerId = null;
  let bookTitleFitFrame = null;
  let activeViewer = initialViewer;
  let inactiveViewer = createStandbyViewer();
  let transitionTimer = null;
  let navigationToken = 0;

  bookTitle.textContent = config.title;
  bookTitle.title = config.title;
  renderResources(config.resources || [], resourceList);
  const titleButton = createTitleButton(config.titlePage, config.title);
  menu.append(titleButton);
  const buttons = [titleButton, ...renderSections(config.sections, menu)];
  const buttonById = new Map(buttons.map((button) => [button.dataset.id, button]));
  viewerShell.append(inactiveViewer);
  initialViewer.classList.add("viewer--active");
  initialViewer.addEventListener("load", () => handleFrameLoad(initialViewer));
  inactiveViewer.addEventListener("load", () => handleFrameLoad(inactiveViewer));

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

  function showDocument(button, updateHash = true, immediate = false) {
    buttons.forEach((item) => item.setAttribute("aria-current", item === button ? "page" : "false"));
    updateToolbar(button);
    if (updateHash) {
      const nextUrl = button.dataset.isTitle === "true"
        ? `${location.pathname}${location.search}`
        : `#${button.dataset.id}`;
      history.replaceState(null, "", nextUrl);
    }

    if (button.dataset.id === activeViewer.dataset.documentId) return;
    clearTimeout(transitionTimer);
    navigationToken += 1;

    if (immediate) {
      activeViewer.dataset.documentId = button.dataset.id;
      activeViewer.title = button.dataset.title;
      activeViewer.src = button.dataset.src;
      return;
    }

    activeViewer.className = "viewer viewer--active";
    activeViewer.removeAttribute("aria-hidden");
    activeViewer.removeAttribute("tabindex");

    inactiveViewer.className = "viewer viewer--standby";
    inactiveViewer.setAttribute("aria-hidden", "true");
    inactiveViewer.tabIndex = -1;
    inactiveViewer.dataset.documentId = button.dataset.id;
    inactiveViewer.dataset.navigationToken = String(navigationToken);
    inactiveViewer.title = button.dataset.title;
    inactiveViewer.src = button.dataset.src;
  }

  function updateToolbar(button) {
    const section = config.sections.find((item) => item.documents.some((document) => document.id === button.dataset.id));
    currentContext.textContent = "";
    currentTitle.replaceChildren();

    if (!section) {
      currentTitle.removeAttribute("aria-label");
      currentTitle.textContent = button.dataset.sectionTitle || config.title;
      return;
    }

    const marker = document.createElement("span");
    const title = document.createElement("span");
    marker.className = "toolbar__marker";
    marker.textContent = section.marker || section.label;
    marker.setAttribute("aria-hidden", "true");
    title.className = "toolbar__title";
    title.textContent = section.title;
    currentTitle.setAttribute("aria-label", `${marker.textContent} ${section.title}`);
    currentTitle.append(marker, title);
  }

  function handleFrameLoad(frame) {
    if (frame === activeViewer) return;
    if (!buttonById.has(frame.dataset.documentId)) return;
    if (Number(frame.dataset.navigationToken) !== navigationToken) return;

    activeViewer.setAttribute("aria-hidden", "true");
    activeViewer.tabIndex = -1;
    frame.className = "viewer viewer--incoming";
    frame.removeAttribute("aria-hidden");
    frame.removeAttribute("tabindex");
    void frame.offsetWidth;
    frame.classList.add("viewer--revealing");

    transitionTimer = setTimeout(() => {
      const previousViewer = activeViewer;
      previousViewer.className = "viewer viewer--standby";
      previousViewer.removeAttribute("id");
      previousViewer.setAttribute("aria-hidden", "true");
      previousViewer.tabIndex = -1;

      frame.className = "viewer viewer--active";
      frame.id = "viewer";
      activeViewer = frame;
      inactiveViewer = previousViewer;
    }, 70);
  }

  function createStandbyViewer() {
    const viewer = document.createElement("iframe");
    viewer.className = "viewer viewer--standby";
    viewer.title = "Document";
    viewer.setAttribute("aria-hidden", "true");
    viewer.tabIndex = -1;
    return viewer;
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
  window.addEventListener("hashchange", () => {
    const button = buttonById.get(location.hash.slice(1)) || titleButton;
    showDocument(button, false);
  });
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
  const initialButton = buttons.find((button) => button.dataset.id === initialId) || titleButton;
  setSidebarWidth(defaultSidebarWidth);
  showDocument(initialButton, false, true);
})();

function validateConfig(config) {
  if (typeof config.title !== "string" || !config.title.trim()) {
    throw new Error("BOOK_READER_CONFIG.title is required.");
  }
  if (!Array.isArray(config.sections) || config.sections.length === 0) {
    throw new Error("BOOK_READER_CONFIG.sections must contain at least one section.");
  }
  if (!config.titlePage?.id || !config.titlePage?.label || !config.titlePage?.src) {
    throw new Error("BOOK_READER_CONFIG.titlePage requires id, label, and src.");
  }

  const documentIds = new Set([config.titlePage.id]);
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

function createTitleButton(titlePage, notebookTitle) {
  const button = document.createElement("button");
  button.className = "document-button title-button";
  button.type = "button";
  button.title = `Open ${notebookTitle}`;
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-current", "false");
  button.dataset.id = titlePage.id;
  button.dataset.isTitle = "true";
  button.dataset.src = titlePage.src;
  button.dataset.title = notebookTitle;
  button.dataset.sectionLabel = "Notebook";
  button.dataset.sectionTitle = notebookTitle;
  button.dataset.label = titlePage.label;
  button.innerHTML = `<span class="document-button__icon" aria-hidden="true">${bookIcon()}</span><span class="document-button__text"></span>`;
  button.querySelector(".document-button__text").textContent = notebookTitle;
  return button;
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

function bookIcon() {
  return `<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h5v16H7a2.5 2.5 0 0 0-2.5 2.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M19.5 5.5A2.5 2.5 0 0 0 17 3h-5v16h5a2.5 2.5 0 0 1 2.5 2.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
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
