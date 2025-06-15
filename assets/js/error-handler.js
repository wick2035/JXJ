// 错误处理和第三方脚本拦截器
(function() {
    'use strict';
    
    // 拦截可能的第三方脚本错误
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = function(...args) {
        // 过滤掉第三方脚本的错误
        const message = args.join(' ');
        if (message.includes('operateType') || 
            message.includes('reportEvent') || 
            message.includes('setConfig') ||
            message.includes('ERR_BLOCKED_BY_CLIENT')) {
            return; // 忽略这些错误
        }
        originalError.apply(console, args);
    };
    
    console.warn = function(...args) {
        const message = args.join(' ');
        if (message.includes('operateType') || 
            message.includes('reportEvent')) {
            return; // 忽略这些警告
        }
        originalWarn.apply(console, args);
    };
    
    // 全局错误处理
    window.addEventListener('error', function(event) {
        if (event.message && (
            event.message.includes('operateType') ||
            event.message.includes('reportEvent') ||
            event.message.includes('setConfig'))) {
            event.preventDefault();
            return false;
        }
    }, true);
    
    // 拦截网络请求错误
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).catch(error => {
            if (error.message && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
                console.log('资源被阻止，尝试备用方案');
                return Promise.reject(new Error('Resource blocked, using fallback'));
            }
            throw error;
        });
    };
    
    // 创建安全的VM环境（如果需要）
    if (typeof VM21 !== 'undefined' || typeof VM920 !== 'undefined' || typeof VM354 !== 'undefined') {
        // 清理可能的VM变量
        try {
            delete window.VM21;
            delete window.VM920;
            delete window.VM354;
            delete window.VM1251;
        } catch(e) {
            // 忽略删除错误
        }
    }
    
    // 阻止可能的第三方脚本注入
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(document, tagName);
        
        if (tagName.toLowerCase() === 'script') {
            // 监控脚本创建
            element.addEventListener('error', function(e) {
                if (this.src && (this.src.includes('operateType') || this.src.includes('reportEvent'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            });
        }
        
        return element;
    };
    
    console.log('错误处理器已加载');
})(); 