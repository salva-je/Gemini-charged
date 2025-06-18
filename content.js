// VERSIÓN 3.4 - Optimizado específicamente para Brave y navegadores con alta seguridad

// Detección específica de Brave
function isBraveBrowser() {
  return (navigator.brave && navigator.brave.isBrave) || 
         navigator.userAgent.includes('Brave') ||
         window.navigator.brave;
}

// Detección robusta del API del navegador con soporte específico para Brave
function getBrowserAPI() {
  // En Brave, chrome API está disponible pero puede tener restricciones
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    return chrome; // Chrome, Brave, Edge, Opera
  }
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
    return browser; // Firefox, Safari
  }
  
  // Fallback más agresivo para Brave
  if (window.chrome && window.chrome.runtime) {
    return window.chrome;
  }
  
  return null;
}

const browserApi = getBrowserAPI();
const IS_BRAVE = isBraveBrowser();

// Verificar que tenemos acceso al API del navegador
if (!browserApi) {
  console.error('GQS: No se pudo detectar el API del navegador');
  // En Brave, a veces el API no está disponible inmediatamente
  if (IS_BRAVE) {
    console.log('GQS: Brave detectado - reintentando detección de API...');
    setTimeout(() => {
      const retryApi = getBrowserAPI();
      if (retryApi) {
        console.log('GQS: API del navegador detectado en segundo intento');
        window.GQS_BROWSER_API = retryApi;
      }
    }, 500);
  }
} else {
  console.log('GQS: API del navegador detectado correctamente');
  window.GQS_BROWSER_API = browserApi;
  
  if (IS_BRAVE) {
    console.log('GQS: Navegador Brave detectado - aplicando configuraciones específicas');
  }
}

// 1. Escuchar peticiones desde el script inyectado (injector.js)
window.addEventListener('message', (event) => {
  // Solo aceptamos mensajes de nuestra propia extensión
  if (event.source !== window || !event.data.type?.startsWith('GQS_')) {
    return;
  }
  // Verificar que el API del navegador sigue disponible
  const currentApi = window.GQS_BROWSER_API || browserApi;
  if (!currentApi || !currentApi.storage) {
    console.warn('GQS Bridge: API del navegador no disponible');
    return;
  }

  const { type, payload } = event.data;
  // Si nos piden guardar datos
  if (type === 'GQS_SAVE_DATA') {
    try {
      // Configuración específica para diferentes navegadores
      const saveData = { [payload.key]: payload.data };
        // Brave requiere un enfoque más directo
      if (IS_BRAVE) {
        // En Brave, usar directamente la API sin delays
        try {
          currentApi.storage.local.set(saveData, () => {
            if (currentApi.runtime.lastError) {
              console.warn(`GQS Bridge: Error al guardar en Brave: ${currentApi.runtime.lastError.message}`);
            }
          });
        } catch (braveError) {
          console.warn(`GQS Bridge: Error específico de Brave: ${braveError.message}`);
        }
      } else {
        const saveOperation = currentApi.storage.local.set(saveData);
        handleStorageOperation(saveOperation, 'guardar', currentApi);
      }
    } catch (e) {
      console.warn(`GQS Bridge: Error en operación de guardado: ${e.message}`);
    }
  }
  // Si nos piden leer datos
  if (type === 'GQS_GET_DATA') {
    try {      
      const performGet = () => {
        try {
          currentApi.storage.local.get(payload.key, (result) => {
            if (currentApi.runtime.lastError) {
              console.warn(`GQS Bridge: Error al leer datos: ${currentApi.runtime.lastError.message}`);
              sendStorageResponse({}, payload);
              return;
            }
            sendStorageResponse(result, payload);
          });
        } catch (getError) {
          console.warn(`GQS Bridge: Error en get operation: ${getError.message}`);
          sendStorageResponse({}, payload);
        }
      };
      
      // En Brave, ejecutar inmediatamente sin delays
      performGet();
      
    } catch (e) {
      console.warn(`GQS Bridge: Error en operación de lectura: ${e.message}`);
      sendStorageResponse({}, payload);
    }
  }
});

// Funciones auxiliares para manejar operaciones de storage
function handleStorageOperation(operation, operationType, api) {
  const currentApi = api || window.GQS_BROWSER_API || browserApi;
  if (operation && typeof operation.then === 'function') {
    // API basada en promesas (Firefox moderno)
    operation.catch((error) => {
      console.warn(`GQS Bridge: Error al ${operationType} datos: ${error.message}`);
    });
  } else {
    // API basada en callbacks (Chrome/Brave)
    if (currentApi && currentApi.runtime && currentApi.runtime.lastError) {
      console.warn(`GQS Bridge: Error al ${operationType} datos: ${currentApi.runtime.lastError.message}`);
    }
  }
}

function sendStorageResponse(result, payload) {
  window.postMessage({
    type: 'GQS_GET_DATA_RESPONSE',
    payload: result[payload.key] || {},
    requestId: payload.requestId
  }, '*');
}


// 2. Inyectar el script principal en la página
function injectScript() {
  try {
    const currentApi = window.GQS_BROWSER_API || browserApi;
    if (!currentApi || !currentApi.runtime || !currentApi.runtime.getURL) {
      console.error('GQS: No se puede inyectar el script - API del navegador no disponible');
      return;
    }

    const script = document.createElement('script');
    script.src = currentApi.runtime.getURL('injector.js');
    script.type = 'text/javascript';
    
    // Atributos específicos para Brave
    if (IS_BRAVE) {
      script.defer = true;
    }
    
    script.onload = function() {
      console.log('GQS: Script inyectado correctamente');
      this.remove();
    };
    
    script.onerror = function() {
      console.error('GQS: Error al cargar el script inyectado');
      this.remove();
      
      // Reintentar en Brave después de un delay
      if (IS_BRAVE) {
        setTimeout(() => {
          console.log('GQS: Reintentando inyección en Brave...');
          injectScript();
        }, 1000);
      }
    };

    // Asegurar que existe un elemento donde inyectar
    const target = document.head || document.documentElement || document.body;
    if (target) {
      target.appendChild(script);
    } else {
      console.error('GQS: No se encontró un elemento para inyectar el script');
    }
  } catch (error) {
    console.error('GQS: Error durante la inyección del script:', error);
    
    // En Brave, reintentar después de un delay
    if (IS_BRAVE) {
      setTimeout(() => {
        console.log('GQS: Reintentando inyección después de error...');
        injectScript();
      }, 2000);
    }
  }
}

// Esperar a que el DOM esté listo antes de inyectar
function initializeInjection() {
  if (IS_BRAVE) {
    // En Brave, esperar un poco más para asegurar que todo esté listo
    setTimeout(injectScript, 500);
  } else {
    injectScript();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeInjection);
} else {
  initializeInjection();
}