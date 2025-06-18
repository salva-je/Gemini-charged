// Test script para verificar compatibilidad de la extensión
// Ejecutar en la consola del navegador en gemini.google.com

console.log('🧪 Iniciando tests de compatibilidad de Gemini Quick Scroll...');

// Test 1: Verificar que la extensión se cargó
function testExtensionLoaded() {
    const sidebar = document.getElementById('gemini-quick-scroll-sidebar');
    if (sidebar) {
        console.log('✅ Test 1 PASSED: Extensión cargada correctamente');
        return true;
    } else {
        console.log('❌ Test 1 FAILED: Extensión no se cargó');
        return false;
    }
}

// Test 2: Verificar elementos de la interfaz
function testUIElements() {
    const elements = [
        'gqs-search-input',
        'gqs-sort-type',
        'gqs-sort-order-btn',
        'gqs-load-history-btn',
        'gqs-nav-list',
        'gqs-toggle-btn'
    ];
    
    let allFound = true;
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.log(`❌ Elemento ${id} no encontrado`);
            allFound = false;
        }
    });
    
    if (allFound) {
        console.log('✅ Test 2 PASSED: Todos los elementos de UI encontrados');
        return true;
    } else {
        console.log('❌ Test 2 FAILED: Faltan algunos elementos de UI');
        return false;
    }
}

// Test 3: Verificar funcionalidad del toggle
function testToggleFunction() {
    const sidebar = document.getElementById('gemini-quick-scroll-sidebar');
    const toggleBtn = document.getElementById('gqs-toggle-btn');
    
    if (!sidebar || !toggleBtn) {
        console.log('❌ Test 3 FAILED: Elementos para toggle no encontrados');
        return false;
    }
    
    const initialState = sidebar.classList.contains('collapsed');
    toggleBtn.click();
    
    setTimeout(() => {
        const newState = sidebar.classList.contains('collapsed');
        if (newState !== initialState) {
            console.log('✅ Test 3 PASSED: Toggle funciona correctamente');
        } else {
            console.log('❌ Test 3 FAILED: Toggle no funciona');
        }
    }, 100);
    
    return true;
}

// Test 4: Verificar API del navegador
function testBrowserAPI() {
    let browserApi = null;
    
    if (typeof browser !== 'undefined' && browser.runtime) {
        browserApi = browser;
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        browserApi = chrome;
    }
    
    if (browserApi) {
        console.log('✅ Test 4 PASSED: API del navegador detectada');
        console.log(`   Navegador: ${navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                                   navigator.userAgent.includes('Chrome') ? 'Chrome/Chromium' : 
                                   navigator.userAgent.includes('Safari') ? 'Safari' : 
                                   navigator.userAgent.includes('Brave') ? 'Brave' : 'Desconocido'}`);
        return true;
    } else {
        console.log('❌ Test 4 FAILED: API del navegador no detectada');
        return false;
    }
}

// Test 5: Verificar CSS y estilos
function testCSS() {
    const sidebar = document.getElementById('gemini-quick-scroll-sidebar');
    if (!sidebar) {
        console.log('❌ Test 5 FAILED: Sidebar no encontrado para test CSS');
        return false;
    }
    
    const computedStyle = window.getComputedStyle(sidebar);
    const hasPosition = computedStyle.position === 'fixed';
    const hasZIndex = parseInt(computedStyle.zIndex) >= 1000;
    
    if (hasPosition && hasZIndex) {
        console.log('✅ Test 5 PASSED: CSS aplicado correctamente');
        return true;
    } else {
        console.log('❌ Test 5 FAILED: CSS no aplicado correctamente');
        console.log(`   Position: ${computedStyle.position}, Z-index: ${computedStyle.zIndex}`);
        return false;
    }
}

// Ejecutar todos los tests
function runAllTests() {
    console.log('\n🔍 Ejecutando tests de compatibilidad...\n');
    
    const tests = [
        { name: 'Carga de extensión', fn: testExtensionLoaded },
        { name: 'Elementos de UI', fn: testUIElements },
        { name: 'Función toggle', fn: testToggleFunction },
        { name: 'API del navegador', fn: testBrowserAPI },
        { name: 'Estilos CSS', fn: testCSS }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    tests.forEach((test, index) => {
        setTimeout(() => {
            console.log(`\n--- Test ${index + 1}: ${test.name} ---`);
            if (test.fn()) {
                passed++;
            }
            
            if (index === total - 1) {
                setTimeout(() => {
                    console.log(`\n📊 RESULTADOS FINALES:`);
                    console.log(`   ✅ Tests pasados: ${passed}/${total}`);
                    console.log(`   ❌ Tests fallidos: ${total - passed}/${total}`);
                    
                    if (passed === total) {
                        console.log(`\n🎉 ¡TODOS LOS TESTS PASARON! La extensión es compatible con tu navegador.`);
                    } else {
                        console.log(`\n⚠️  Algunos tests fallaron. Revisa la consola para más detalles.`);
                    }
                }, 500);
            }
        }, index * 200);
    });
}

// Esperar a que la página esté completamente cargada
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 1000);
    });
} else {
    setTimeout(runAllTests, 1000);
}
