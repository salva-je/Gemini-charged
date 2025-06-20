// VERSIÓN 9.3 - Fase 2.3: Lógica de Import/Export actualizada para categorías
(function () {
  if (window.hasRunGQS) return;
  window.hasRunGQS = true;

  // Detectar si estamos en Brave
  const IS_BRAVE =
    (navigator.brave && navigator.brave.isBrave) ||
    navigator.userAgent.includes("Brave") ||
    window.navigator.brave;

  if (IS_BRAVE) {
    console.log(
      "GQS Injector: Brave detectado - aplicando optimizaciones específicas"
    );
  }

  // --- FUNCIONES DE COMPATIBILIDAD ---
  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function safeQuerySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (e) {
      console.warn("GQS: Error en selector:", selector, e);
      return null;
    }
  }

  function safeQuerySelectorAll(selector, context = document) {
    try {
      return context.querySelectorAll(selector);
    } catch (e) {
      console.warn("GQS: Error en selector:", selector, e);
      return [];
    }
  }

  // --- SELECTORES Y CONSTANTES ---
  const SELECTOR_SCROLL_CONTAINER = ".chat-history-scroll-container";
  const SELECTOR_CONTENEDOR_USUARIO = "user-query";
  const SELECTOR_TEXTO_USUARIO = ".query-text-line";
  const SELECTOR_RESPUESTA_GEMINI = ".response-content";
  const SELECTOR_MENSAJES = `${SELECTOR_CONTENEDOR_USUARIO}, ${SELECTOR_RESPUESTA_GEMINI}`;
  const COLORS = [
    "#4e5461",
    "#5c454b",
    "#614a19",
    "#34595e",
    "#2e5546",
    "#422f56",
    "remover",
  ];
  const CATEGORY_COLORS = [
    "#34595e",
    "#422f56",
    "#614a19",
    "#5c454b",
    "#2e5546",
    "#4e5461",
  ];
  const PROMPTS_STORAGE_KEY = "gqs-global-prompts-categorized";
  const OLD_PROMPTS_KEY = "gqs-global-prompts";

  // --- ESTADO DE LA EXTENSIÓN ---
  let gqsCurrentURL = "";
  let gqsSortType = "normal";
  let gqsSortOrder = "asc";

  // --- FUNCIONES DE ALMACENAMIENTO (PUENTE A content.js) ---
  function getStorageKey() {
    try {
      const cleanUrl = new URL(window.location.href);
      return `gqs-chat-data:${cleanUrl.origin}${cleanUrl.pathname}`;
    } catch (e) {
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split("?")[0].split("#")[0];
      return `gqs-chat-data:${baseUrl}`;
    }
  }

  function getChatData() {
    return new Promise((resolve) => {
      const key = getStorageKey();
      const requestId = `gqs_req_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const listener = (event) => {
        if (
          event.source === window &&
          event.data &&
          event.data.type === "GQS_GET_DATA_RESPONSE" &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener("message", listener);
          resolve(event.data.payload || {});
        }
      };

      const timeoutDuration = IS_BRAVE ? 8000 : 5000;
      const timeout = setTimeout(() => {
        window.removeEventListener("message", listener);
        console.warn("GQS: Timeout al obtener datos del storage");
        resolve({});
      }, timeoutDuration);

      window.addEventListener("message", listener);

      const sendMessage = () => {
        window.postMessage(
          { type: "GQS_GET_DATA", payload: { key, requestId } },
          "*"
        );
      };

      if (IS_BRAVE) {
        setTimeout(sendMessage, 50);
      } else {
        sendMessage();
      }

      const originalResolve = resolve;
      resolve = function (data) {
        clearTimeout(timeout);
        originalResolve(data);
      };
    });
  }

  function saveChatData(data) {
    try {
      const key = getStorageKey();
      const message = { type: "GQS_SAVE_DATA", payload: { key, data } };
      if (IS_BRAVE) {
        setTimeout(() => window.postMessage(message, "*"), 50);
      } else {
        window.postMessage(message, "*");
      }
    } catch (e) {
      console.warn("GQS: Error al guardar datos:", e);
    }
  }

  async function updateMessageData(messageId, newData) {
    const chatData = await getChatData();
    const existingData = chatData[messageId] || {};
    const updatedData = { ...existingData, ...newData };
    if (updatedData.note === null || updatedData.note === "")
      delete updatedData.note;
    if (updatedData.color === null) delete updatedData.color;
    if (Object.keys(updatedData).length === 0) {
      delete chatData[messageId];
    } else {
      chatData[messageId] = updatedData;
    }
    saveChatData(chatData);
  }

  // --- FUNCIÓN DE INICIALIZACIÓN ---
  function initializeExtension() {
    try {
      main();
    } catch (e) {
      console.error("GQS: Error durante la inicialización:", e);
    }
  }

  function waitForMain() {
    const mainElement = safeQuerySelector("main");
    if (mainElement) {
      if (IS_BRAVE) {
        setTimeout(initializeExtension, 200);
      } else {
        initializeExtension();
      }
      return;
    }
    if (typeof MutationObserver !== "undefined") {
      const onReadyObserver = new MutationObserver((mutations, obs) => {
        if (safeQuerySelector("main")) {
          obs.disconnect();
          if (IS_BRAVE) {
            setTimeout(initializeExtension, 200);
          } else {
            initializeExtension();
          }
        }
      });
      if (document.body) {
        onReadyObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          if (document.body) {
            onReadyObserver.observe(document.body, {
              childList: true,
              subtree: true,
            });
          }
        });
      }
    } else {
      const checkInterval = setInterval(() => {
        if (safeQuerySelector("main")) {
          clearInterval(checkInterval);
          if (IS_BRAVE) {
            setTimeout(initializeExtension, 200);
          } else {
            initializeExtension();
          }
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 10000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForMain);
  } else {
    waitForMain();
  }

  // --- LÓGICA PRINCIPAL ---
  function main() {
    try {
      if (IS_BRAVE) {
        if (!window.location.href.includes("gemini.google.com")) {
          console.warn("GQS: Extensión ejecutándose fuera de Gemini en Brave");
          return;
        }
      }

      injectSidebar();
      injectPromptButton();

      gqsCurrentURL = window.location.href;

      setTimeout(
        () => {
          updateNavList();
        },
        IS_BRAVE ? 300 : 100
      );

      const mainElement = safeQuerySelector("main");
      if (mainElement && typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver(() => {
          const loadBtn = document.getElementById("gqs-load-history-btn");
          if (loadBtn && !loadBtn.disabled) {
            clearTimeout(window.gqsDebounce);
            window.gqsDebounce = setTimeout(
              updateNavList,
              IS_BRAVE ? 800 : 500
            );
          }
          if (!document.getElementById("gqs-prompt-library-btn")) {
            injectPromptButton();
          }
        });
        observer.observe(mainElement, { childList: true, subtree: true });
      }

      const handleBodyClick = (e) => {
        try {
          if (
            !e.target.closest(
              ".gqs-actions, .gqs-color-palette, .gqs-note-bubble, .gqs-note-actions"
            )
          ) {
            closeAllPopups();
          }
        } catch (err) {
          console.warn("GQS: Error en event listener:", err);
        }
      };

      if (document.body) {
        document.body.addEventListener("click", handleBodyClick);
      }

      const urlCheckInterval = IS_BRAVE ? 1500 : 1000;
      let urlCheckTimer = setInterval(() => {
        try {
          if (window.location.href !== gqsCurrentURL) {
            gqsCurrentURL = window.location.href;
            resetForNewChat();
          }
        } catch (err) {
          console.warn("GQS: Error en monitor de URL:", err);
        }
      }, urlCheckInterval);

      window.addEventListener("beforeunload", () => {
        clearInterval(urlCheckTimer);
      });
    } catch (e) {
      console.error("GQS: Error en función main:", e);
    }
  }

  function resetForNewChat() {
    closeAllPopups();
    const loadBtn = document.getElementById("gqs-load-history-btn");
    if (loadBtn) {
      loadBtn.textContent = "Load all messages";
      loadBtn.disabled = false;
      loadBtn.classList.remove("loaded", "loading");
    }
    setTimeout(updateNavList, 250);
  }

  async function handleLoadHistoryClick() {
    const loadBtn = document.getElementById("gqs-load-history-btn");
    if (!loadBtn || loadBtn.disabled) return;

    try {
      loadBtn.textContent = "Loading...";
      loadBtn.disabled = true;
      loadBtn.classList.add("loading");

      const scrollContainer = safeQuerySelector(SELECTOR_SCROLL_CONTAINER);
      if (!scrollContainer) {
        loadBtn.textContent = "Error: No se encontró el panel";
        loadBtn.disabled = false;
        return;
      }

      let topMessage = null;
      let stallTimeout;
      let scrollInterval;

      const finishLoading = async () => {
        try {
          clearInterval(scrollInterval);
          clearTimeout(stallTimeout);
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          await new Promise((resolve) => setTimeout(resolve, 100));
          loadBtn.classList.remove("loading");
          loadBtn.textContent = "Loading complete";
          loadBtn.classList.add("loaded");
          updateNavList();
        } catch (e) {
          console.warn("GQS: Error al finalizar carga:", e);
        }
      };

      const resetStallTimeout = () => {
        clearTimeout(stallTimeout);
        stallTimeout = setTimeout(finishLoading, 1500);
      };

      scrollInterval = setInterval(() => {
        try {
          const currentTopMessage = safeQuerySelector(SELECTOR_MENSAJES);
          if (!currentTopMessage) return;

          if (currentTopMessage !== topMessage) {
            topMessage = currentTopMessage;
            resetStallTimeout();
          }

          if (currentTopMessage.scrollIntoView) {
            currentTopMessage.scrollIntoView({
              block: "start",
              behavior: "auto",
            });
          } else {
            currentTopMessage.scrollIntoView(true);
          }
        } catch (e) {
          console.warn("GQS: Error durante scroll:", e);
        }
      }, 300);

      resetStallTimeout();
    } catch (e) {
      console.error("GQS: Error en handleLoadHistoryClick:", e);
      loadBtn.textContent = "Error";
      loadBtn.disabled = false;
    }
  }

  function injectSidebar() {
    const sidebar = document.createElement("div");
    sidebar.id = "gemini-quick-scroll-sidebar";
    sidebar.classList.add("collapsed");

    const searchContainer = document.createElement("div");
    searchContainer.id = "gqs-search-container";
    const searchInput = document.createElement("input");
    searchInput.id = "gqs-search-input";
    searchInput.type = "text";
    searchInput.placeholder = "Search for messages:";
    searchInput.addEventListener("input", filterNavList);
    searchContainer.appendChild(searchInput);

    const sortContainer = document.createElement("div");
    sortContainer.id = "gqs-sort-container";

    const sortTypeSelect = document.createElement("select");
    sortTypeSelect.id = "gqs-sort-type";
    const optionNormal = document.createElement("option");
    optionNormal.value = "normal";
    optionNormal.textContent = "Order: Normal";
    const optionByType = document.createElement("option");
    optionByType.value = "by_type";
    optionByType.textContent = "Order: By type";
    sortTypeSelect.appendChild(optionNormal);
    sortTypeSelect.appendChild(optionByType);
    sortTypeSelect.addEventListener("change", (e) => {
      gqsSortType = e.target.value;
      updateNavList();
    });

    const sortOrderBtn = document.createElement("button");
    sortOrderBtn.id = "gqs-sort-order-btn";
    sortOrderBtn.textContent = "Ascending ↑";
    sortOrderBtn.addEventListener("click", () => {
      gqsSortOrder = gqsSortOrder === "asc" ? "desc" : "asc";
      sortOrderBtn.textContent =
        gqsSortOrder === "asc" ? "Ascending ↑" : "Descending ↓";
      updateNavList();
    });
    sortContainer.appendChild(sortTypeSelect);
    sortContainer.appendChild(sortOrderBtn);

    const loadContainer = document.createElement("div");
    loadContainer.id = "gqs-load-container";
    const loadHistoryBtn = document.createElement("button");
    loadHistoryBtn.id = "gqs-load-history-btn";
    loadHistoryBtn.textContent = "Load all messages";
    loadHistoryBtn.addEventListener("click", handleLoadHistoryClick);
    loadContainer.appendChild(loadHistoryBtn);

    const navList = document.createElement("ul");
    navList.id = "gqs-nav-list";

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "gqs-toggle-btn";
    toggleBtn.style.display = "none";
    toggleBtn.textContent = "›";
    toggleBtn.addEventListener("click", toggleSidebar);

    sidebar.appendChild(searchContainer);
    sidebar.appendChild(sortContainer);
    sidebar.appendChild(loadContainer);
    sidebar.appendChild(navList);
    sidebar.appendChild(toggleBtn);

    document.body.appendChild(sidebar);
    document.body.classList.add("gqs-active", "gqs-collapsed");
  }

  function filterNavList() {
    const filterText = document
      .getElementById("gqs-search-input")
      .value.toLowerCase();
    document.querySelectorAll("#gqs-nav-list li").forEach((item) => {
      const link = item.querySelector("a");
      const fullText = link ? link.title.toLowerCase() : "";
      item.style.display = fullText.includes(filterText) ? "" : "none";
    });
  }

  async function updateNavList() {
    try {
      const navList = document.getElementById("gqs-nav-list");
      const toggleBtn = document.getElementById("gqs-toggle-btn");
      if (!navList || !toggleBtn) return;

      const chatData = await getChatData();
      const currentScroll = navList.scrollTop;

      clearElement(navList);

      let navItemsData = [];
      const messages = safeQuerySelectorAll(SELECTOR_MENSAJES);

      messages.forEach((element, index) => {
        try {
          let textElement, icon;
          if (element.matches && element.matches(SELECTOR_CONTENEDOR_USUARIO)) {
            textElement = safeQuerySelector(SELECTOR_TEXTO_USUARIO, element);
            icon = "👤";
          } else {
            textElement = element;
            icon = "✨";
          }

          if (textElement) {
            const unwantedTextRegex = /Mostrar cuando piensa/g;
            const originalText = textElement.textContent || "";
            const cleanText = originalText
              .replace(unwantedTextRegex, "")
              .trim();
            if (cleanText) {
              const messageId = createMessageId(icon, cleanText);
              element.id = messageId;
              navItemsData.push({ element, index, icon, cleanText, messageId });
            }
          }
        } catch (e) {
          console.warn("GQS: Error procesando mensaje:", e);
        }
      });

      if (gqsSortType === "by_type") {
        const userItems = navItemsData.filter((item) => item.icon === "👤");
        const geminiItems = navItemsData.filter((item) => item.icon === "✨");
        navItemsData = [...userItems, ...geminiItems];
      }

      if (gqsSortOrder === "desc") {
        navItemsData.reverse();
      }

      navItemsData.forEach((itemData) => {
        const messageInfo = chatData[itemData.messageId] || {};
        const listItem = createNavItemElement(itemData, messageInfo);
        navList.appendChild(listItem);
      });

      navList.scrollTop = currentScroll;
      filterNavList();
      toggleBtn.style.display = navList.children.length > 0 ? "flex" : "none";
    } catch (e) {
      console.error("GQS: Error en updateNavList:", e);
    }
  }

  function createMessageId(icon, text) {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const prefix = `${icon}-`;
    const body = cleanText.substring(0, 80).replace(/[^a-zA-Z0-9-]/g, "-");
    return prefix + body;
  }

  function createNavItemElement(itemData, messageInfo) {
    const { icon, cleanText, messageId } = itemData;

    let summary =
      cleanText.split(" ").slice(0, 8).join(" ") +
      (cleanText.split(" ").length > 8 ? "..." : "");

    const listItem = document.createElement("li");
    if (messageInfo.color) {
      listItem.style.backgroundColor = messageInfo.color;
    }

    const link = document.createElement("a");
    link.href = `#${messageId}`;
    link.title = cleanText;

    const iconSpan = document.createElement("span");
    iconSpan.className = "gqs-icon";
    iconSpan.textContent = icon;

    const summarySpan = document.createElement("span");
    summarySpan.className = "gqs-summary-text";
    summarySpan.textContent = summary;

    link.appendChild(iconSpan);
    link.appendChild(summarySpan);

    link.addEventListener("click", (e) => {
      e.preventDefault();
      closeAllPopups();
      const targetElement = document.getElementById(messageId);
      if (targetElement) {
        if (targetElement.scrollIntoView) {
          try {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          } catch (err) {
            targetElement.scrollIntoView(true);
          }
        } else {
          targetElement.scrollTop = targetElement.offsetTop;
        }
      }
    });

    const actionsContainer = document.createElement("div");
    actionsContainer.className = "gqs-actions";

    const noteIcon = createNoteIcon(messageId, messageInfo);
    const colorIcon = createColorIcon(messageId, listItem);

    actionsContainer.appendChild(noteIcon);
    actionsContainer.appendChild(colorIcon);
    listItem.appendChild(link);
    listItem.appendChild(actionsContainer);

    return listItem;
  }

  function closeAllPopups() {
    try {
      const popupSelectors = [
        ".gqs-color-palette",
        ".gqs-note-bubble",
        ".gqs-note-actions",
        ".gqs-readonly-note",
      ];

      popupSelectors.forEach((selector) => {
        const elements = safeQuerySelectorAll(selector);
        elements.forEach((el) => {
          try {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          } catch (e) {
            console.warn("GQS: Error removiendo popup:", e);
          }
        });
      });
    } catch (e) {
      console.warn("GQS: Error en closeAllPopups:", e);
    }
  }

  function createColorIcon(messageId, listItem) {
    const colorIcon = document.createElement("span");
    colorIcon.className = "gqs-action-icon gqs-color-icon";
    colorIcon.textContent = "🎨";
    colorIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleColorPalette(e.currentTarget, messageId, listItem);
    });
    return colorIcon;
  }

  function toggleColorPalette(parentIcon, messageId, listItem) {
    closeAllPopups();
    const palette = document.createElement("div");
    palette.className = "gqs-color-palette";

    COLORS.forEach((color) => {
      const swatch = document.createElement("div");
      swatch.className = "gqs-color-swatch";
      if (color === "remover") {
        swatch.classList.add("remover");
        swatch.textContent = "ø";
        swatch.title = "Quitar color";
        swatch.addEventListener("click", () =>
          setColor(messageId, listItem, null)
        );
      } else {
        swatch.style.backgroundColor = color;
        swatch.addEventListener("click", () =>
          setColor(messageId, listItem, color)
        );
      }
      palette.appendChild(swatch);
    });

    listItem.appendChild(palette);
  }

  async function setColor(messageId, listItem, color) {
    listItem.style.backgroundColor = color || "";
    await updateMessageData(messageId, { color });
    closeAllPopups();
  }

  function createNoteIcon(messageId, messageInfo) {
    const noteIcon = document.createElement("span");
    noteIcon.className = "gqs-action-icon gqs-note-icon";
    noteIcon.textContent = "📝";
    if (messageInfo.note) {
      noteIcon.classList.add("has-note");
    }

    noteIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      if (messageInfo.note) {
        showNoteActions(noteIcon, messageId, messageInfo);
      } else {
        showNoteEditor(noteIcon, messageId, messageInfo);
      }
    });

    noteIcon.addEventListener("mouseenter", (e) => {
      if (messageInfo.note) {
        showReadOnlyNote(e.currentTarget, messageInfo.note);
      }
    });

    noteIcon.addEventListener("mouseleave", () => {
      document
        .querySelectorAll(".gqs-readonly-note")
        .forEach((el) => el.remove());
    });

    return noteIcon;
  }

  function showNoteActions(parentIcon, messageId, messageInfo) {
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "gqs-note-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "gqs-note-action-btn gqs-edit-btn";
    editBtn.textContent = "✏️";
    editBtn.title = "Editar nota";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllPopups();
      showNoteEditor(parentIcon, messageId, messageInfo);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "gqs-note-action-btn gqs-delete-btn";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Borrar nota";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await updateMessageData(messageId, { note: null });
      parentIcon.classList.remove("has-note");
      messageInfo.note = null;
      closeAllPopups();
    });

    actionsContainer.appendChild(editBtn);
    actionsContainer.appendChild(deleteBtn);

    parentIcon.closest("li").appendChild(actionsContainer);
  }

  function showReadOnlyNote(parentIcon, noteText) {
    document
      .querySelectorAll(".gqs-readonly-note")
      .forEach((el) => el.remove());

    const bubble = document.createElement("div");
    bubble.className = "gqs-note-bubble gqs-readonly-note";

    const allItems = Array.from(parentIcon.closest("ul").children);
    const itemIndex = allItems.indexOf(parentIcon.closest("li"));
    if (itemIndex >= 0 && itemIndex < 2) {
      bubble.classList.add("is-flipped");
    }

    const p = document.createElement("p");
    p.textContent = noteText;
    bubble.appendChild(p);

    parentIcon.closest("li").appendChild(bubble);
  }

  function showNoteEditor(parentIcon, messageId, messageInfo) {
    closeAllPopups();
    const bubble = document.createElement("div");
    bubble.className = "gqs-note-bubble";

    const allItems = Array.from(parentIcon.closest("ul").children);
    const itemIndex = allItems.indexOf(parentIcon.closest("li"));
    if (itemIndex >= 0 && itemIndex < 2) {
      bubble.classList.add("is-flipped");
    }

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write your note here...";
    textarea.value = messageInfo.note || "";

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "gqs-note-bubble-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "gqs-save-note-btn";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const newNote = textarea.value.trim();
      if (newNote !== (messageInfo.note || "")) {
        await updateMessageData(messageId, { note: newNote });
        messageInfo.note = newNote;
        parentIcon.classList.toggle("has-note", !!newNote);
      }
      closeAllPopups();
    });

    actionsDiv.appendChild(saveBtn);
    bubble.appendChild(textarea);
    bubble.appendChild(actionsDiv);

    parentIcon.closest("li").appendChild(bubble);
    textarea.focus();
  }

  function toggleSidebar() {
    const sidebar = document.getElementById("gemini-quick-scroll-sidebar");
    const toggleBtn = document.getElementById("gqs-toggle-btn");
    const isCollapsed = sidebar.classList.toggle("collapsed");
    document.body.classList.toggle("gqs-collapsed", isCollapsed);
    toggleBtn.textContent = isCollapsed ? "›" : "‹";
  }

  // =======================================================================
  // ======== BIBLIOTECA DE PROMPTS - FINALIZADA ========
  // =======================================================================

  function getStorageData(key) {
    return new Promise((resolve) => {
      const requestId = `gqs_req_${key}_${Date.now()}`;
      const listener = (event) => {
        if (
          event.data.type === "GQS_GET_DATA_RESPONSE" &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener("message", listener);
          resolve(event.data.payload);
        }
      };
      window.addEventListener("message", listener);
      window.postMessage(
        { type: "GQS_GET_DATA", payload: { key, requestId } },
        "*"
      );
    });
  }

  async function getPrompts() {
    let categorizedData = await getStorageData(PROMPTS_STORAGE_KEY);
    const oldData = await getStorageData(OLD_PROMPTS_KEY);

    if (Array.isArray(oldData) && oldData.length > 0) {
      console.log("GQS: Datos de prompts antiguos encontrados. Migrando...");
      if (!categorizedData || Object.keys(categorizedData).length === 0) {
        categorizedData = {
          uncategorized: {
            id: "uncategorized",
            name: "Uncategorized",
            color: "#4a4d50",
            prompts: oldData,
          },
        };
      } else {
        if (!categorizedData.uncategorized) {
          categorizedData.uncategorized = {
            id: "uncategorized",
            name: "Uncategorized",
            color: "#4a4d50",
            prompts: [],
          };
        }
        const existingIds = new Set(
          categorizedData.uncategorized.prompts.map((p) => p.id)
        );
        const promptsToMigrate = oldData.filter((p) => !existingIds.has(p.id));
        categorizedData.uncategorized.prompts.push(...promptsToMigrate);
      }
      await savePrompts(categorizedData);
      window.postMessage(
        {
          type: "GQS_SAVE_DATA",
          payload: { key: OLD_PROMPTS_KEY, data: null },
        },
        "*"
      );
      console.log("GQS: Migración completada.");
    }
    return categorizedData || {};
  }

  function savePrompts(prompts) {
    window.postMessage(
      {
        type: "GQS_SAVE_DATA",
        payload: { key: PROMPTS_STORAGE_KEY, data: prompts },
      },
      "*"
    );
  }

  function injectPromptButton() {
    const targetWrapper = safeQuerySelector(".leading-actions-wrapper");
    if (targetWrapper && !document.getElementById("gqs-prompt-library-btn")) {
      const promptButton = document.createElement("button");
      promptButton.id = "gqs-prompt-library-btn";
      promptButton.className = "gqs-custom-button";
      promptButton.textContent = "Prompt list";
      promptButton.addEventListener("click", showPromptsModal);
      targetWrapper.appendChild(promptButton);
    }
  }

  function showPromptsModal() {
    if (document.getElementById("gqs-prompts-modal")) return;

    const overlay = document.createElement("div");
    overlay.id = "gqs-modal-overlay";
    overlay.addEventListener("click", closePromptsModal);

    const modal = document.createElement("div");
    modal.id = "gqs-prompts-modal";

    const header = document.createElement("div");
    header.className = "gqs-modal-header";
    const title = document.createElement("h2");
    title.textContent = "Prompt Library";
    const closeBtn = document.createElement("button");
    closeBtn.className = "gqs-modal-close-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", closePromptsModal);
    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "gqs-modal-body";
    body.id = "gqs-modal-prompt-container";

    const footer = document.createElement("div");
    footer.className = "gqs-modal-footer";
    const createPromptBtn = document.createElement("button");
    createPromptBtn.className = "gqs-custom-button";
    createPromptBtn.textContent = "Create New Prompt";
    createPromptBtn.addEventListener("click", () => renderPromptEditor());

    const addCategoryBtn = document.createElement("button");
    addCategoryBtn.className = "gqs-custom-button gqs-secondary-button";
    addCategoryBtn.textContent = "Add Category";
    addCategoryBtn.addEventListener("click", () => renderCategoryEditor());

    const importExportContainer = document.createElement("div");
    importExportContainer.className = "gqs-import-export-container";

    const importBtn = document.createElement("button");
    importBtn.id = "gqs-import-btn";
    importBtn.className = "gqs-custom-button gqs-secondary-button";
    importBtn.textContent = "Import";
    importBtn.addEventListener("click", importPrompts);

    const exportBtn = document.createElement("button");
    exportBtn.id = "gqs-export-btn";
    exportBtn.className = "gqs-custom-button gqs-secondary-button";
    exportBtn.textContent = "Export";
    exportBtn.addEventListener("click", exportPrompts);

    importExportContainer.appendChild(importBtn);
    importExportContainer.appendChild(exportBtn);

    const footerLeft = document.createElement("div");
    footerLeft.className = "gqs-footer-left";
    footerLeft.appendChild(createPromptBtn);
    footerLeft.appendChild(addCategoryBtn);

    footer.appendChild(footerLeft);
    footer.appendChild(importExportContainer);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    renderCategorizedPromptList();
  }

  function closePromptsModal() {
    const overlay = document.getElementById("gqs-modal-overlay");
    const modal = document.getElementById("gqs-prompts-modal");
    if (overlay) overlay.remove();
    if (modal) modal.remove();
  }

  async function renderCategorizedPromptList() {
    const container = document.getElementById("gqs-modal-prompt-container");
    if (!container) return;

    clearElement(container);
    const data = await getPrompts();

    if (Object.keys(data).length > 0 && !data.uncategorized) {
      data.uncategorized = {
        id: "uncategorized",
        name: "Uncategorized",
        color: "#4a4d50",
        prompts: [],
      };
    }
    const categories = Object.values(data);

    if (categories.length === 0) {
      container.innerHTML =
        '<p class="gqs-no-prompts">No categories or prompts yet.</p>';
      return;
    }

    categories.forEach((category) => {
      const categorySection = document.createElement("section");
      categorySection.className = "gqs-category-section";
      categorySection.style.backgroundColor = category.color || "transparent";
      categorySection.dataset.categoryId = category.id;

      categorySection.addEventListener("dragover", (e) => {
        e.preventDefault();
        categorySection.classList.add("gqs-drop-target");
      });
      categorySection.addEventListener("dragleave", () => {
        categorySection.classList.remove("gqs-drop-target");
      });
      categorySection.addEventListener("drop", async (e) => {
        e.preventDefault();
        categorySection.classList.remove("gqs-drop-target");
        const promptId = e.dataTransfer.getData("promptId");
        const sourceCatId = e.dataTransfer.getData("sourceCatId");
        const targetCatId = category.id;

        if (sourceCatId === targetCatId) return;

        const allData = await getPrompts();
        const sourceCategory = allData[sourceCatId];
        const targetCategory = allData[targetCatId];

        if (sourceCategory && targetCategory) {
          const promptIndex = sourceCategory.prompts.findIndex(
            (p) => p.id === promptId
          );
          if (promptIndex > -1) {
            const [promptToMove] = sourceCategory.prompts.splice(
              promptIndex,
              1
            );
            targetCategory.prompts.push(promptToMove);
            await savePrompts(allData);
            renderCategorizedPromptList();
          }
        }
      });

      const categoryHeader = document.createElement("div");
      categoryHeader.className = "gqs-category-header";

      const categoryName = document.createElement("span");
      categoryName.textContent = category.name;

      const categoryActions = document.createElement("div");
      categoryActions.className = "gqs-category-actions";

      if (category.id !== "uncategorized") {
        const editBtn = document.createElement("button");
        editBtn.className = "gqs-category-action-btn";
        editBtn.textContent = "✏️";
        editBtn.title = "Edit Category";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          renderCategoryEditor(category.id);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "gqs-category-action-btn";
        deleteBtn.textContent = "🗑️";
        deleteBtn.title = "Delete Category";
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (
            confirm(
              `Are you sure you want to delete the category "${category.name}"? All its prompts will be moved to Uncategorized.`
            )
          ) {
            const allData = await getPrompts();
            const promptsToMove = allData[category.id].prompts;

            if (!allData.uncategorized) {
              allData.uncategorized = {
                id: "uncategorized",
                name: "Uncategorized",
                color: "#4a4d50",
                prompts: [],
              };
            }
            allData.uncategorized.prompts.push(...promptsToMove);
            delete allData[category.id];

            await savePrompts(allData);
            renderCategorizedPromptList();
          }
        });

        categoryActions.appendChild(editBtn);
        categoryActions.appendChild(deleteBtn);
      }

      categoryHeader.appendChild(categoryName);
      categoryHeader.appendChild(categoryActions);
      categorySection.appendChild(categoryHeader);

      const promptList = document.createElement("ul");
      promptList.className = "gqs-prompt-list";

      if (category.prompts && category.prompts.length > 0) {
        category.prompts.forEach((prompt) => {
          const listItem = document.createElement("li");
          listItem.dataset.promptId = prompt.id;

          listItem.draggable = true;
          listItem.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("promptId", prompt.id);
            e.dataTransfer.setData("sourceCatId", category.id);
            e.stopPropagation();
            setTimeout(() => listItem.classList.add("gqs-dragging"), 0);
          });
          listItem.addEventListener("dragend", () => {
            listItem.classList.remove("gqs-dragging");
          });

          listItem.addEventListener("click", (e) => {
            if (e.target.closest(".gqs-prompt-actions")) return;
            const inputTarget = safeQuerySelector(".ql-editor.textarea p");
            if (inputTarget) {
              inputTarget.textContent = prompt.text;
            }
            closePromptsModal();
          });

          const textSpan = document.createElement("span");
          textSpan.className = "gqs-prompt-text";
          textSpan.textContent = prompt.text;

          const actionsDiv = document.createElement("div");
          actionsDiv.className = "gqs-prompt-actions";

          const editBtn = document.createElement("button");
          editBtn.className = "gqs-prompt-action-btn edit-btn";
          editBtn.title = "Edit Prompt";
          editBtn.textContent = "✏️";
          editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            renderPromptEditor(prompt.id);
          });

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "gqs-prompt-action-btn delete-btn";
          deleteBtn.title = "Delete Prompt";
          deleteBtn.textContent = "🗑️";
          deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (confirm("Are you sure you want to delete this prompt?")) {
              const allData = await getPrompts();
              for (const catId in allData) {
                allData[catId].prompts = allData[catId].prompts.filter(
                  (p) => p.id !== prompt.id
                );
              }
              savePrompts(allData);
              renderCategorizedPromptList();
            }
          });

          deleteBtn.addEventListener("mouseenter", () => {
            listItem.classList.add("gqs-delete-hover");
          });
          deleteBtn.addEventListener("mouseleave", () => {
            listItem.classList.remove("gqs-delete-hover");
          });

          actionsDiv.appendChild(editBtn);
          actionsDiv.appendChild(deleteBtn);
          listItem.appendChild(textSpan);
          listItem.appendChild(actionsDiv);
          promptList.appendChild(listItem);
        });
      } else {
        const emptyMsg = document.createElement("li");
        emptyMsg.className = "gqs-no-prompts-in-category";
        emptyMsg.textContent = "Drop prompts here";
        promptList.appendChild(emptyMsg);
      }
      categorySection.appendChild(promptList);
      container.appendChild(categorySection);
    });
  }

  async function renderCategoryEditor(categoryId = null) {
    const container = document.getElementById("gqs-modal-prompt-container");
    clearElement(container);

    const allData = await getPrompts();
    const isEditing = categoryId && allData[categoryId];
    const category = isEditing ? allData[categoryId] : null;

    const form = document.createElement("div");
    form.className = "gqs-category-creator";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Category Name:";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "gqs-category-name-input";
    nameInput.placeholder = "e.g., Coding, Marketing, General...";
    nameInput.value = isEditing ? category.name : "";

    const colorLabel = document.createElement("label");
    colorLabel.textContent = "Category Color:";
    const colorPalette = document.createElement("div");
    colorPalette.className = "gqs-category-color-palette";

    let selectedColor = isEditing ? category.color : CATEGORY_COLORS[0];
    CATEGORY_COLORS.forEach((color) => {
      const swatch = document.createElement("div");
      swatch.className = "gqs-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      if (color === selectedColor) swatch.classList.add("selected");

      swatch.addEventListener("click", () => {
        selectedColor = swatch.dataset.color;
        const currentSelected = colorPalette.querySelector(".selected");
        if (currentSelected) currentSelected.classList.remove("selected");
        swatch.classList.add("selected");
      });
      colorPalette.appendChild(swatch);
    });

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "gqs-editor-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "gqs-custom-button";
    saveBtn.textContent = isEditing ? "Save Changes" : "Save Category";
    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      if (name) {
        const currentData = await getPrompts();
        if (isEditing) {
          currentData[categoryId].name = name;
          currentData[categoryId].color = selectedColor;
        } else {
          const newCategoryId = `cat_${Date.now()}`;
          currentData[newCategoryId] = {
            id: newCategoryId,
            name,
            color: selectedColor,
            prompts: [],
          };
        }
        savePrompts(currentData);
        renderCategorizedPromptList();
      }
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "gqs-custom-button gqs-secondary-button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", renderCategorizedPromptList);

    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);

    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    form.appendChild(colorLabel);
    form.appendChild(colorPalette);
    form.appendChild(actionsDiv);
    container.appendChild(form);
    nameInput.focus();
  }

  async function renderPromptEditor(promptId = null) {
    let originalPrompt = null;
    let originalCategoryId = null;
    const allData = await getPrompts();

    if (promptId) {
      for (const catId in allData) {
        const foundPrompt = allData[catId].prompts.find(
          (p) => p.id === promptId
        );
        if (foundPrompt) {
          originalPrompt = foundPrompt;
          originalCategoryId = catId;
          break;
        }
      }
    }

    const container = document.getElementById("gqs-modal-prompt-container");
    clearElement(container);

    const editorDiv = document.createElement("div");
    editorDiv.className = "gqs-prompt-editor";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Enter your prompt here...";
    if (originalPrompt) {
      textarea.value = originalPrompt.text;
    }

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "gqs-editor-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "gqs-custom-button";
    saveBtn.textContent = "Save Prompt";
    saveBtn.addEventListener("click", async () => {
      const newText = textarea.value.trim();
      if (newText) {
        const currentData = await getPrompts();
        if (promptId && originalCategoryId) {
          // Editando
          const promptIndex = currentData[originalCategoryId].prompts.findIndex(
            (p) => p.id === promptId
          );
          if (promptIndex > -1) {
            currentData[originalCategoryId].prompts[promptIndex].text = newText;
          }
        } else {
          // Creando nuevo
          if (!currentData.uncategorized) {
            currentData.uncategorized = {
              id: "uncategorized",
              name: "Uncategorized",
              color: "#4a4d50",
              prompts: [],
            };
          }
          currentData.uncategorized.prompts.push({
            id: `prompt_${Date.now()}`,
            text: newText,
          });
        }
        savePrompts(currentData);
      }
      renderCategorizedPromptList();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "gqs-custom-button gqs-secondary-button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", renderCategorizedPromptList);

    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);
    editorDiv.appendChild(textarea);
    editorDiv.appendChild(actionsDiv);
    container.appendChild(editorDiv);
    textarea.focus();
  }

  // ===== INICIO: LÓGICA FINAL DE IMPORT/EXPORT =====
  async function exportPrompts() {
    const prompts = await getPrompts();
    if (Object.keys(prompts).length === 0) {
      alert("There are no prompts to export.");
      return;
    }
    const dataStr = JSON.stringify(prompts, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "gemini-quick-scroll-prompts.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importPrompts() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          if (
            typeof importedData !== "object" ||
            importedData === null ||
            Array.isArray(importedData)
          ) {
            throw new Error("Invalid file format. Expected a category object.");
          }

          const currentData = await getPrompts();
          let importedPromptsCount = 0;

          // Fusionar datos
          for (const catId in importedData) {
            const importedCategory = importedData[catId];
            // Validar estructura básica de la categoría importada
            if (
              !importedCategory.name ||
              !Array.isArray(importedCategory.prompts)
            )
              continue;

            // Buscar si la categoría ya existe por nombre
            const existingCatEntry = Object.entries(currentData).find(
              ([id, cat]) => cat.name === importedCategory.name
            );

            if (existingCatEntry) {
              // La categoría existe, fusionar prompts
              const [existingCatId, existingCat] = existingCatEntry;
              const existingPromptIds = new Set(
                existingCat.prompts.map((p) => p.id)
              );
              const newPrompts = importedCategory.prompts.filter(
                (p) => !existingPromptIds.has(p.id) && p.id && p.text
              );
              existingCat.prompts.push(...newPrompts);
              importedPromptsCount += newPrompts.length;
            } else {
              // La categoría es nueva, añadirla
              currentData[catId] = importedCategory;
              importedPromptsCount += importedCategory.prompts.length;
            }
          }

          await savePrompts(currentData);
          renderCategorizedPromptList();
          alert(`${importedPromptsCount} new prompts imported successfully!`);
        } catch (error) {
          alert("Error importing prompts: " + error.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  // ===== FIN: LÓGICA FINAL DE IMPORT/EXPORT =====
})();
