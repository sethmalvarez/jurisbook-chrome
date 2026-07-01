/*
 * JurisBook federated chrome — BEHAVIOR + i18n application.
 * Canonical source: this repo (jurisbook-chrome), consumed by apps via git submodule at <app>/chrome/.
 * Inlined into each page at build time by vite-plugin-chrome.ts.
 *
 * Contract:
 *   - The PAGE owns language state and defines window.toggleLanguage().
 *   - chrome.js applies translations to elements inside #main-header and
 *     footer#contacto using window.__CHROME_I18N__ (injected by the plugin
 *     from chrome.i18n.json), and re-applies when the page dispatches:
 *         window.dispatchEvent(new CustomEvent('jurisbook:lang-change', { detail: { lang } }))
 *   - chrome.js binds all header/nav/footer behavior (mobile menu, dropdowns,
 *     sticky header, anchor offset, Escape-to-close, solutions-button -> store).
 *
 * It does NOT define toggleLanguage and does NOT touch page-body [data-i18n].
 */
(function () {
    'use strict';

    var I18N = window.__CHROME_I18N__ || { es: {}, en: {} };
    var STORAGE_KEY = 'jurisbook_public_lang';

    function normalizeLang(value) {
        if (typeof value !== 'string') { return 'es'; }
        var lower = value.toLowerCase();
        if (lower.indexOf('en') === 0) { return 'en'; }
        return 'es';
    }

    function currentLang() {
        return normalizeLang(localStorage.getItem(STORAGE_KEY));
    }

    function dict(lang) {
        return I18N[lang] || I18N.es || {};
    }

    function chromeRoots() {
        var roots = [];
        var header = document.getElementById('main-header');
        if (header) { roots.push(header); }
        var footer = document.getElementById('contacto');
        if (footer) { roots.push(footer); }
        return roots;
    }

    function applyChromeTranslations(lang) {
        var lng = lang || currentLang();
        var table = dict(lng);
        var roots = chromeRoots();
        if (roots.length === 0 || !table) { return; }

        roots.forEach(function (root) {
            root.querySelectorAll('[data-i18n]').forEach(function (el) {
                var key = el.getAttribute('data-i18n');
                var value = table[key];
                if (typeof value === 'string') { el.textContent = value; }
            });
            root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
                var key = el.getAttribute('data-i18n-html');
                var value = table[key];
                if (typeof value === 'string') { el.innerHTML = value; }
            });
            root.querySelectorAll('[data-placeholder]').forEach(function (el) {
                var key = el.getAttribute('data-placeholder');
                var value = table[key];
                if (typeof value === 'string') { el.setAttribute('placeholder', value); }
            });
        });

        var langDisplay = document.getElementById('lang-display');
        if (langDisplay) { langDisplay.textContent = lng.toUpperCase(); }
        var htmlEl = document.documentElement;
        if (htmlEl) { htmlEl.lang = lng === 'es' ? 'es-CR' : 'en'; }
    }

    function initMobileMenu() {
        var menuBtn = document.getElementById('menu-btn');
        var mobileMenu = document.getElementById('mobile-menu');
        if (!menuBtn || !mobileMenu) { return; }
        menuBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
            if (!mobileMenu.classList.contains('hidden')) {
                mobileMenu.style.maxHeight = '500px';
                mobileMenu.style.opacity = '1';
            } else {
                mobileMenu.style.maxHeight = '0';
                mobileMenu.style.opacity = '0';
            }
        });
    }

    function initDropdowns() {
        var solutionsMenuButton = document.getElementById('solutions-menu-button');
        var solutionsMenu = document.getElementById('solutions-menu');
        var solutionsMenuWrapper = document.getElementById('solutions-menu-wrapper');
        var companyMenuButton = document.getElementById('company-menu-button');
        var companyMenu = document.getElementById('company-menu');
        var companyMenuWrapper = document.getElementById('company-menu-wrapper');

        function close(menu, button, wrapper) {
            if (!menu || !button) { return; }
            menu.classList.add('invisible', 'opacity-0', 'translate-y-2', 'pointer-events-none');
            menu.classList.remove('visible', 'opacity-100', 'translate-y-0', 'pointer-events-auto');
            button.setAttribute('aria-expanded', 'false');
            if (wrapper) { wrapper.classList.remove('is-open'); }
        }
        function open(menu, button, wrapper) {
            if (!menu || !button) { return; }
            menu.classList.remove('invisible', 'opacity-0', 'translate-y-2', 'pointer-events-none');
            menu.classList.add('visible', 'opacity-100', 'translate-y-0', 'pointer-events-auto');
            button.setAttribute('aria-expanded', 'true');
            if (wrapper) { wrapper.classList.add('is-open'); }
        }

        var closeSolutions = function () { close(solutionsMenu, solutionsMenuButton, solutionsMenuWrapper); };
        var openSolutions = function () { open(solutionsMenu, solutionsMenuButton, solutionsMenuWrapper); };
        var closeCompany = function () { close(companyMenu, companyMenuButton, companyMenuWrapper); };
        var openCompany = function () { open(companyMenu, companyMenuButton, companyMenuWrapper); };

        function bindHover(wrapper, button, menu, openMenu, closeMenu, closePeer) {
            if (!wrapper || !button || !menu) { return; }
            var closeTimer = null;
            var cancelClose = function () { if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; } };
            var scheduleClose = function () {
                cancelClose();
                closeTimer = window.setTimeout(closeMenu, 120);
            };
            wrapper.addEventListener('mouseenter', function () { cancelClose(); closePeer(); openMenu(); });
            wrapper.addEventListener('mouseleave', scheduleClose);
            wrapper.addEventListener('focusin', function () { cancelClose(); closePeer(); openMenu(); });
            wrapper.addEventListener('focusout', function (event) {
                if (!wrapper.contains(event.relatedTarget)) { scheduleClose(); }
            });
            button.addEventListener('click', function (event) {
                if (button.id === 'solutions-menu-button') {
                    window.location.href = 'https://store.jurisbook.com/';
                    return;
                }
                event.preventDefault();
                cancelClose();
                var expanded = button.getAttribute('aria-expanded') === 'true';
                if (expanded) { closeMenu(); } else { closePeer(); openMenu(); }
            });
            menu.addEventListener('mouseenter', cancelClose);
            menu.addEventListener('mouseleave', scheduleClose);
            menu.querySelectorAll('a').forEach(function (link) {
                link.addEventListener('click', closeMenu);
            });
        }

        bindHover(solutionsMenuWrapper, solutionsMenuButton, solutionsMenu, openSolutions, closeSolutions, closeCompany);
        bindHover(companyMenuWrapper, companyMenuButton, companyMenu, openCompany, closeCompany, closeSolutions);

        document.addEventListener('click', function (event) {
            if (solutionsMenu && solutionsMenuButton && !solutionsMenu.contains(event.target) && !solutionsMenuButton.contains(event.target)) {
                closeSolutions();
            }
            if (companyMenu && companyMenuButton && !companyMenu.contains(event.target) && !companyMenuButton.contains(event.target)) {
                closeCompany();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeSolutions();
                closeCompany();
            }
        });
    }

    function initLangToggle() {
        var btn = document.getElementById('lang-toggle');
        if (!btn) { return; }
        btn.addEventListener('click', function () {
            // The page owns language state and defines toggleLanguage.
            // Public_site pages expose it as a global function declaration;
            // the store exposes window.toggleLanguage from its module.
            if (typeof window.toggleLanguage === 'function') {
                window.toggleLanguage();
            }
        });
    }

    function initStickyHeader() {        var header = document.getElementById('main-header');
        if (!header) { return; }
        var updateHeaderOffset = function () {
            var h = Math.ceil(header.getBoundingClientRect().height || 92);
            document.documentElement.style.setProperty('--header-offset', h + 'px');
        };
        updateHeaderOffset();
        window.addEventListener('resize', updateHeaderOffset);
        window.addEventListener('scroll', function () {
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            updateHeaderOffset();
        });
    }

    function init() {
        applyChromeTranslations(currentLang());
        initMobileMenu();
        initDropdowns();
        initLangToggle();
        initStickyHeader();
    }

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    ready(init);

    window.addEventListener('jurisbook:lang-change', function (event) {
        var lang = (event && event.detail && event.detail.lang) || currentLang();
        applyChromeTranslations(lang);
    });

    // Cross-tab sync (same app, different tabs).
    window.addEventListener('pageshow', function () {
        applyChromeTranslations(currentLang());
    });
    window.addEventListener('storage', function (event) {
        if (event.key === STORAGE_KEY) {
            applyChromeTranslations(normalizeLang(event.newValue));
        }
    });

    // Public hook (page may call this after a hard lang change that bypasses the event).
    window.JBChrome = { apply: applyChromeTranslations };

    // Footer email-capture form handler. Only defines a fallback if the page
    // hasn't provided its own (e.g. index.html ships a fancier modal version).
    // Runs after the page's inline script (plugin injects before </body>), so a
    // page-level `function handleFormSubmit()` declaration already wins.
    if (typeof window.handleFormSubmit !== 'function') {
        window.handleFormSubmit = function (event) {
            event.preventDefault();
            var form = event.target;
            if (!form) { return; }
            var btn = form.querySelector('button[type="submit"]');
            if (btn && !btn.disabled) {
                var prev = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '&#10003;';
                window.setTimeout(function () {
                    btn.disabled = false;
                    btn.innerHTML = prev;
                    form.reset();
                }, 2200);
            }
        };
    }
})();
