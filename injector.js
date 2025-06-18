// VERSIÓN 8.3 - Corrección final para TrustedHTML
(function() {
    if (window.hasRunGQS) return;
    window.hasRunGQS = true;

    // --- SELECTORES Y CONSTANTES ---
    const SELECTOR_SCROLL_CONTAINER = '.chat-history-scroll-container';
    const SELECTOR_CONTENEDOR_USUARIO = 'user-query';
    const SELECTOR_TEXTO_USUARIO = '.query-text-line';
    const SELECTOR_RESPUESTA_GEMINI = '.response-content';
    const SELECTOR_MENSAJES = `${SELECTOR_CONTENEDOR_USUARIO}, ${SELECTOR_RESPUESTA_GEMINI}`;
    const COLORS = ['#4e5461', '#5c454b', '#614a19', '#34595e', '#2e5546', '#422f56', 'remover'];
    
    // --- ESTADO DE LA EXTENSIÓN ---
    let gqsCurrentURL = '';
    let gqsSortType = 'normal'; // 'normal' o 'by_type'
    let gqsSortOrder = 'asc';   // 'asc' o 'desc'

    // --- FUNCIONES DE ALMACENAMIENTO (PUENTE A content.js) ---
    function getStorageKey() {
        const cleanUrl = new URL(window.location.href);
        return `gqs-chat-data:${cleanUrl.origin}${cleanUrl.pathname}`;
    }
    
    function getChatData() {
        return new Promise((resolve) => {
            const key = getStorageKey();
            const requestId = `gqs_req_${Date.now()}_${Math.random()}`;

            const listener = (event) => {
                if (event.source === window && event.data.type === 'GQS_GET_DATA_RESPONSE' && event.data.requestId === requestId) {
                    window.removeEventListener('message', listener);
                    resolve(event.data.payload);
                }
            };
            window.addEventListener('message', listener);

            window.postMessage({ type: 'GQS_GET_DATA', payload: { key, requestId } }, '*');
        });
    }
    
    function saveChatData(data) {
        const key = getStorageKey();
        window.postMessage({ type: 'GQS_SAVE_DATA', payload: { key, data } }, '*');
    }

    async function updateMessageData(messageId, newData) {
        const chatData = await getChatData();
        const existingData = chatData[messageId] || {};
        const updatedData = { ...existingData, ...newData };

        if (updatedData.note === null || updatedData.note === '') delete updatedData.note;
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
      main();
    }
    
    const onReadyObserver = new MutationObserver((mutations, obs) => {
      if (document.querySelector('main')) { initializeExtension(); obs.disconnect(); }
    });
    onReadyObserver.observe(document.body, { childList: true, subtree: true });

    // --- LÓGICA PRINCIPAL ---
    function main() {
      injectSidebar();
      gqsCurrentURL = window.location.href;
      updateNavList();

      const observer = new MutationObserver(() => {
        const loadBtn = document.getElementById('gqs-load-history-btn');
        if (loadBtn && !loadBtn.disabled) {
            clearTimeout(window.gqsDebounce);
            window.gqsDebounce = setTimeout(updateNavList, 500);
        }
      });
      observer.observe(document.querySelector('main'), { childList: true, subtree: true });

      document.body.addEventListener('click', (e) => {
          if (!e.target.closest('.gqs-actions, .gqs-color-palette, .gqs-note-bubble, .gqs-note-actions')) {
              closeAllPopups();
          }
      });

      setInterval(() => {
        if (window.location.href !== gqsCurrentURL) {
            gqsCurrentURL = window.location.href;
            resetForNewChat();
        }
      }, 500);
    }

    function resetForNewChat() {
        closeAllPopups();
        const loadBtn = document.getElementById('gqs-load-history-btn');
        if (loadBtn) {
            loadBtn.textContent = 'load all messages';
            loadBtn.disabled = false;
            loadBtn.classList.remove('loaded', 'loading');
        }
        setTimeout(updateNavList, 250);
    }
    
    async function handleLoadHistoryClick() {
        const loadBtn = document.getElementById('gqs-load-history-btn');
        if (!loadBtn || loadBtn.disabled) return;
        loadBtn.textContent = 'Loading...';
        loadBtn.disabled = true;
        loadBtn.classList.add('loading');
        const scrollContainer = document.querySelector(SELECTOR_SCROLL_CONTAINER);
        if (!scrollContainer) {
            loadBtn.textContent = 'Error: No se encontró el panel';
            loadBtn.disabled = false; return;
        }
        let topMessage = null; let stallTimeout; let scrollInterval;
        const finishLoading = async () => {
            clearInterval(scrollInterval);
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 100));
            loadBtn.classList.remove('loading');
            loadBtn.textContent = 'Loading complete';
            loadBtn.classList.add('loaded');
            updateNavList();
        };
        const resetStallTimeout = () => {
            clearTimeout(stallTimeout);
            stallTimeout = setTimeout(finishLoading, 1200);
        };
        scrollInterval = setInterval(() => {
            const currentTopMessage = document.querySelector(SELECTOR_MENSAJES);
            if (!currentTopMessage) return;
            if (currentTopMessage !== topMessage) {
                topMessage = currentTopMessage;
                resetStallTimeout();
            }
            currentTopMessage.scrollIntoView({ block: 'start', behavior: 'auto' });
        }, 200);
        resetStallTimeout();
    }

    function injectSidebar() {
      const sidebar = document.createElement('div');
      sidebar.id = 'gemini-quick-scroll-sidebar';
      sidebar.classList.add('collapsed');

      const searchContainer = document.createElement('div');
      searchContainer.id = 'gqs-search-container';
      const searchInput = document.createElement('input');
      searchInput.id = 'gqs-search-input';
      searchInput.type = 'text';
      searchInput.placeholder = 'Search for messages:';
      searchInput.addEventListener('input', filterNavList);
      searchContainer.appendChild(searchInput);

      const sortContainer = document.createElement('div');
      sortContainer.id = 'gqs-sort-container';
      
      const sortTypeSelect = document.createElement('select');
      sortTypeSelect.id = 'gqs-sort-type';
      const optionNormal = document.createElement('option');
      optionNormal.value = 'normal';
      optionNormal.textContent = 'Order: Normal';
      const optionByType = document.createElement('option');
      optionByType.value = 'by_type';
      optionByType.textContent = 'Order: By type';
      sortTypeSelect.appendChild(optionNormal);
      sortTypeSelect.appendChild(optionByType);
      sortTypeSelect.addEventListener('change', (e) => {
          gqsSortType = e.target.value;
          updateNavList();
      });

      const sortOrderBtn = document.createElement('button');
      sortOrderBtn.id = 'gqs-sort-order-btn';
      sortOrderBtn.textContent = 'Ascending ↑';
      sortOrderBtn.addEventListener('click', () => {
          gqsSortOrder = gqsSortOrder === 'asc' ? 'desc' : 'asc';
          sortOrderBtn.textContent = gqsSortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓';
          updateNavList();
      });
      sortContainer.appendChild(sortTypeSelect);
      sortContainer.appendChild(sortOrderBtn);

      const loadContainer = document.createElement('div');
      loadContainer.id = 'gqs-load-container';
      const loadHistoryBtn = document.createElement('button');
      loadHistoryBtn.id = 'gqs-load-history-btn';
      loadHistoryBtn.textContent = 'Load all messages';
      loadHistoryBtn.addEventListener('click', handleLoadHistoryClick);
      loadContainer.appendChild(loadHistoryBtn);

      const navList = document.createElement('ul');
      navList.id = 'gqs-nav-list';
      
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'gqs-toggle-btn';
      toggleBtn.style.display = 'none';
      toggleBtn.textContent = '›';
      toggleBtn.addEventListener('click', toggleSidebar);

      sidebar.appendChild(searchContainer);
      sidebar.appendChild(sortContainer);
      sidebar.appendChild(loadContainer);
      sidebar.appendChild(navList);
      sidebar.appendChild(toggleBtn);
      
      document.body.appendChild(sidebar);
      document.body.classList.add('gqs-active', 'gqs-collapsed');
    }

    function filterNavList() {
        const filterText = document.getElementById('gqs-search-input').value.toLowerCase();
        document.querySelectorAll('#gqs-nav-list li').forEach(item => {
            const link = item.querySelector('a');
            const fullText = link ? link.title.toLowerCase() : '';
            item.style.display = fullText.includes(filterText) ? '' : 'none';
        });
    }

    async function updateNavList() {
        const navList = document.getElementById('gqs-nav-list');
        const toggleBtn = document.getElementById('gqs-toggle-btn');
        if (!navList || !toggleBtn) return;
        
        const chatData = await getChatData();
        const currentScroll = navList.scrollTop;
        
        // --- LÍNEA CORREGIDA ---
        // Se usa el método seguro para limpiar la lista
        navList.replaceChildren();
        
        let navItemsData = [];
        const messages = document.querySelectorAll(SELECTOR_MENSAJES);

        messages.forEach((element, index) => {
            let textElement, icon;
            if (element.matches(SELECTOR_CONTENEDOR_USUARIO)) {
                textElement = element.querySelector(SELECTOR_TEXTO_USUARIO);
                icon = '👤';
            } else {
                textElement = element;
                icon = '✨';
            }

            if (textElement) {
                const unwantedTextRegex = /Mostrar cuando piensa/g;
                const originalText = textElement.textContent || '';
                const cleanText = originalText.replace(unwantedTextRegex, '').trim();
                if (cleanText) {
                    const messageId = createMessageId(icon, cleanText);
                    element.id = messageId;
                    navItemsData.push({ element, index, icon, cleanText, messageId });
                }
            }
        });

        if (gqsSortType === 'by_type') {
            const userItems = navItemsData.filter(item => item.icon === '👤');
            const geminiItems = navItemsData.filter(item => item.icon === '✨');
            navItemsData = [...userItems, ...geminiItems];
        }

        if (gqsSortOrder === 'desc') {
            navItemsData.reverse();
        }

        navItemsData.forEach(itemData => {
            const messageInfo = chatData[itemData.messageId] || {};
            const listItem = createNavItemElement(itemData, messageInfo);
            navList.appendChild(listItem);
        });

        navList.scrollTop = currentScroll;
        filterNavList();
        toggleBtn.style.display = navList.children.length > 0 ? 'flex' : 'none';
    }
    
    function createMessageId(icon, text) { // Ya no necesitamos 'index'
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const prefix = `${icon}-`; // El prefijo ya no incluye el índice
    // Usamos más texto para que el ID sea más único y estable
    const body = cleanText.substring(0, 80).replace(/[^a-zA-Z0-9-]/g, '-');
    return prefix + body;
}
    
    function createNavItemElement(itemData, messageInfo) {
        const { icon, cleanText, messageId } = itemData;

        let summary = cleanText.split(' ').slice(0, 8).join(' ') + (cleanText.split(' ').length > 8 ? '...' : '');

        const listItem = document.createElement('li');
        if (messageInfo.color) {
            listItem.style.backgroundColor = messageInfo.color;
        }
        
        const link = document.createElement('a');
        link.href = `#${messageId}`;
        link.title = cleanText;
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'gqs-icon';
        iconSpan.textContent = icon;
        
        const summarySpan = document.createElement('span');
        summarySpan.className = 'gqs-summary-text';
        summarySpan.textContent = summary;
        
        link.appendChild(iconSpan);
        link.appendChild(summarySpan);

        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllPopups();
            document.getElementById(messageId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'gqs-actions';
        
        const noteIcon = createNoteIcon(messageId, messageInfo);
        const colorIcon = createColorIcon(messageId, listItem);

        actionsContainer.appendChild(noteIcon);
        actionsContainer.appendChild(colorIcon);
        listItem.appendChild(link);
        listItem.appendChild(actionsContainer);
        
        return listItem;
    }

    function closeAllPopups() {
        document.querySelectorAll('.gqs-color-palette, .gqs-note-bubble, .gqs-note-actions, .gqs-readonly-note').forEach(el => el.remove());
    }
    
    function createColorIcon(messageId, listItem) {
        const colorIcon = document.createElement('span');
        colorIcon.className = 'gqs-action-icon gqs-color-icon';
        colorIcon.textContent = '🎨';
        colorIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleColorPalette(e.currentTarget, messageId, listItem);
        });
        return colorIcon;
    }

    function toggleColorPalette(parentIcon, messageId, listItem) {
        closeAllPopups();
        const palette = document.createElement('div');
        palette.className = 'gqs-color-palette';
        
        COLORS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'gqs-color-swatch';
            if (color === 'remover') {
                swatch.classList.add('remover');
                swatch.textContent = 'ø';
                swatch.title = 'Quitar color';
                swatch.addEventListener('click', () => setColor(messageId, listItem, null));
            } else {
                swatch.style.backgroundColor = color;
                swatch.addEventListener('click', () => setColor(messageId, listItem, color));
            }
            palette.appendChild(swatch);
        });
        
        listItem.appendChild(palette);
    }

    async function setColor(messageId, listItem, color) {
        listItem.style.backgroundColor = color || '';
        await updateMessageData(messageId, { color });
        closeAllPopups();
    }
    
    function createNoteIcon(messageId, messageInfo) {
        const noteIcon = document.createElement('span');
        noteIcon.className = 'gqs-action-icon gqs-note-icon';
        noteIcon.textContent = '📝';
        if (messageInfo.note) {
            noteIcon.classList.add('has-note');
        }

        noteIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllPopups();
            if (messageInfo.note) {
                showNoteActions(noteIcon, messageId, messageInfo);
            } else {
                showNoteEditor(noteIcon, messageId, messageInfo);
            }
        });

        noteIcon.addEventListener('mouseenter', (e) => {
            if (messageInfo.note) {
                showReadOnlyNote(e.currentTarget, messageInfo.note);
            }
        });
        
        noteIcon.addEventListener('mouseleave', () => {
             document.querySelectorAll('.gqs-readonly-note').forEach(el => el.remove());
        });

        return noteIcon;
    }

    function showNoteActions(parentIcon, messageId, messageInfo) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'gqs-note-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'gqs-note-action-btn gqs-edit-btn';
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Editar nota';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllPopups();
            showNoteEditor(parentIcon, messageId, messageInfo);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'gqs-note-action-btn gqs-delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Borrar nota';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await updateMessageData(messageId, { note: null });
            parentIcon.classList.remove('has-note');
            messageInfo.note = null;
            closeAllPopups();
        });

        actionsContainer.appendChild(editBtn);
        actionsContainer.appendChild(deleteBtn);
        
        parentIcon.closest('li').appendChild(actionsContainer);
    }
    
    function showReadOnlyNote(parentIcon, noteText) {
        document.querySelectorAll('.gqs-readonly-note').forEach(el => el.remove());

        const bubble = document.createElement('div');
        bubble.className = 'gqs-note-bubble gqs-readonly-note';
        
        const allItems = Array.from(parentIcon.closest('ul').children);
        const itemIndex = allItems.indexOf(parentIcon.closest('li'));
        if (itemIndex >= 0 && itemIndex < 2) {
            bubble.classList.add('is-flipped');
        }
        
        const p = document.createElement('p');
        p.textContent = noteText;
        bubble.appendChild(p);
        
        parentIcon.closest('li').appendChild(bubble);
    }

    function showNoteEditor(parentIcon, messageId, messageInfo) {
        closeAllPopups();
        const bubble = document.createElement('div');
        bubble.className = 'gqs-note-bubble';
        
        const allItems = Array.from(parentIcon.closest('ul').children);
        const itemIndex = allItems.indexOf(parentIcon.closest('li'));
        if (itemIndex >= 0 && itemIndex < 2) {
            bubble.classList.add('is-flipped');
        }
        
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Write your note here...';
        textarea.value = messageInfo.note || '';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'gqs-note-bubble-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'gqs-save-note-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async () => {
            const newNote = textarea.value.trim();
            if (newNote !== (messageInfo.note || '')) {
                 await updateMessageData(messageId, { note: newNote });
                 messageInfo.note = newNote;
                 parentIcon.classList.toggle('has-note', !!newNote);
            }
            closeAllPopups();
        });
        
        actionsDiv.appendChild(saveBtn);
        bubble.appendChild(textarea);
        bubble.appendChild(actionsDiv);
        
        parentIcon.closest('li').appendChild(bubble);
        textarea.focus();
    }
    
    function toggleSidebar() {
      const sidebar = document.getElementById('gemini-quick-scroll-sidebar');
      const toggleBtn = document.getElementById('gqs-toggle-btn');
      const isCollapsed = sidebar.classList.toggle('collapsed');
      document.body.classList.toggle('gqs-collapsed', isCollapsed);
      toggleBtn.textContent = isCollapsed ? '›' : '‹';
    }
})();