// Debug script specifically for Brave Browser issues
// Run this in the browser console on gemini.google.com to diagnose problems

console.log('🕵️ GQS Brave Debug Tool iniciado...');

function debugBraveExtension() {
    const results = {
        browser: 'Unknown',
        braveDetected: false,
        apiAvailable: false,
        extensionLoaded: false,
        storageWorking: false,
        scriptsInjected: false,
        shieldsInfo: 'Unknown',
        errors: []
    };

    // 1. Detectar navegador
    if (navigator.userAgent.includes('Brave')) {
        results.browser = 'Brave';
        results.braveDetected = true;
    } else if (navigator.userAgent.includes('Chrome')) {
        results.browser = 'Chrome';
    } else {
        results.browser = navigator.userAgent.split(' ')[0];
    }

    // 2. Verificar API del navegador
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        results.apiAvailable = true;
    }

    // 3. Verificar si la extensión se cargó
    const sidebar = document.getElementById('gemini-quick-scroll-sidebar');
    if (sidebar) {
        results.extensionLoaded = true;
    }

    // 4. Verificar si los scripts se inyectaron
    if (window.hasRunGQS) {
        results.scriptsInjected = true;
    }

    // 5. Probar storage (si es posible)
    if (results.apiAvailable) {
        try {
            chrome.storage.local.set({test: 'value'}, () => {
                if (!chrome.runtime.lastError) {
                    results.storageWorking = true;
                    chrome.storage.local.remove('test');
                } else {
                    results.errors.push('Storage error: ' + chrome.runtime.lastError.message);
                }
            });
        } catch (e) {
            results.errors.push('Storage exception: ' + e.message);
        }
    }

    // 6. Información específica de Brave
    if (results.braveDetected) {
        // Verificar Brave Shields
        if (window.navigator.brave) {
            results.shieldsInfo = 'Brave API disponible';
        } else {
            results.shieldsInfo = 'Brave API no disponible - posibles shields activos';
        }
    }

    // 7. Verificar errores en consola
    const consoleErrors = [];
    const originalConsoleError = console.error;
    console.error = function(...args) {
        if (args[0] && args[0].includes && args[0].includes('GQS')) {
            consoleErrors.push(args.join(' '));
        }
        originalConsoleError.apply(console, args);
    };

    // Mostrar resultados
    console.log('\n📊 RESULTADOS DEL DIAGNÓSTICO:');
    console.log('================================');
    console.log(`🌐 Navegador: ${results.browser}`);
    console.log(`🛡️  Brave detectado: ${results.braveDetected ? '✅ Sí' : '❌ No'}`);
    console.log(`🔧 API disponible: ${results.apiAvailable ? '✅ Sí' : '❌ No'}`);
    console.log(`📦 Extensión cargada: ${results.extensionLoaded ? '✅ Sí' : '❌ No'}`);
    console.log(`💾 Storage funcionando: ${results.storageWorking ? '✅ Sí' : '❌ No'}`);
    console.log(`🚀 Scripts inyectados: ${results.scriptsInjected ? '✅ Sí' : '❌ No'}`);
    
    if (results.braveDetected) {
        console.log(`🛡️  Shields: ${results.shieldsInfo}`);
    }

    if (results.errors.length > 0) {
        console.log('\n❌ ERRORES ENCONTRADOS:');
        results.errors.forEach(error => console.log(`   • ${error}`));
    }

    // Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    
    if (!results.extensionLoaded) {
        console.log('   • La extensión no se cargó. Verifica que esté instalada correctamente.');
    }
    
    if (!results.apiAvailable) {
        console.log('   • API del navegador no disponible. Verifica permisos de la extensión.');
    }
    
    if (results.braveDetected && !results.storageWorking) {
        console.log('   • En Brave, verifica configuración de Shields:');
        console.log('     - Desactiva "Block scripts" para gemini.google.com');
        console.log('     - Cambia "Block fingerprinting" a Standard');
        console.log('     - Permite cookies para gemini.google.com');
    }
    
    if (!results.scriptsInjected && results.extensionLoaded) {
        console.log('   • Scripts no se inyectaron. Posible problema de CSP o Shields.');
    }

    // Sugerencias específicas para Brave
    if (results.braveDetected) {
        console.log('\n🦁 CONFIGURACIÓN ESPECÍFICA PARA BRAVE:');
        console.log('   1. Ve a brave://settings/shields');
        console.log('   2. Agrega gemini.google.com a sitios permitidos');
        console.log('   3. Desactiva shields agresivos para este sitio');
        console.log('   4. Reinicia el navegador después de cambios');
    }

    return results;
}

// Ejecutar diagnóstico automáticamente
setTimeout(() => {
    debugBraveExtension();
}, 1000);

// Hacer la función disponible globalmente para uso manual
window.debugGQSBrave = debugBraveExtension;
