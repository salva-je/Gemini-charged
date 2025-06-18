// VERSIÓN 3.1 - Robusto frente a "Extension context invalidated"

// Para compatibilidad entre Chrome (chrome) y Firefox (browser)
const browserApi = typeof browser !== 'undefined' ? browser : chrome;

// 1. Escuchar peticiones desde el script inyectado (injector.js)
window.addEventListener('message', (event) => {
  // Solo aceptamos mensajes de nuestra propia extensión
  if (event.source !== window || !event.data.type?.startsWith('GQS_')) {
    return;
  }

  const { type, payload } = event.data;

  // Si nos piden guardar datos
  if (type === 'GQS_SAVE_DATA') {
    try {
      browserApi.storage.local.set({ [payload.key]: payload.data }, () => {
        // Comprobar si el contexto fue invalidado durante la operación asíncrona
        if (browserApi.runtime.lastError) {
          console.warn(`GQS Bridge: Error al guardar datos (contexto invalidado): ${browserApi.runtime.lastError.message}`);
        }
      });
    } catch (e) {
      console.warn(`GQS Bridge: El acceso al almacenamiento para guardar falló (contexto invalidado): ${e.message}`);
    }
  }

  // Si nos piden leer datos
  if (type === 'GQS_GET_DATA') {
    try {
      browserApi.storage.local.get(payload.key, (result) => {
        // Comprobar si el contexto fue invalidado antes de enviar la respuesta
        if (browserApi.runtime.lastError) {
          console.warn(`GQS Bridge: Error al leer datos (contexto invalidado): ${browserApi.runtime.lastError.message}`);
          // No enviamos respuesta, ya que otro listener (de la nueva versión) lo hará.
          return;
        }
        
        // Devolvemos la respuesta a la página
        window.postMessage({
          type: 'GQS_GET_DATA_RESPONSE',
          payload: result[payload.key] || {},
          requestId: payload.requestId
        }, '*');
      });
    } catch (e) {
      console.warn(`GQS Bridge: El acceso al almacenamiento para leer falló (contexto invalidado): ${e.message}`);
    }
  }
});


// 2. Inyectamos el script principal en la página como antes
const s = document.createElement('script');
s.src = browserApi.runtime.getURL('injector.js');
s.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);