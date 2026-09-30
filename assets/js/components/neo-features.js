import { getCategoryIcon } from "./category-icons";

export default function initNeoFeatures() {
    const themeToggle = document.getElementById('theme-toggle');
    const languageOptions = document.querySelectorAll('.language-option[data-language]');

    document.querySelectorAll('[data-category-icon]').forEach(cell => {
        if (cell.querySelector('.solve-cell-icon')) return;
        const icon = document.createElement('i');
        icon.className = `fas ${getCategoryIcon(cell.dataset.categoryIcon)} solve-cell-icon`;
        icon.setAttribute('aria-hidden', 'true');
        cell.prepend(icon);
    });

    document.querySelectorAll('[data-neo-select]').forEach(control => {
        if (control.dataset.neoSelectInitialized === 'true') return;

        const nativeSelect = document.querySelector(control.dataset.neoSelect);
        const toggle = control.querySelector('.neo-form-select-toggle');
        const label = control.querySelector('.neo-form-select-label');
        const menu = control.querySelector('.neo-form-select-menu');
        if (!nativeSelect || !toggle || !label || !menu) return;
        control.dataset.neoSelectInitialized = 'true';

        const closeMenu = () => {
            control.classList.remove('show');
            menu.classList.remove('show');
            toggle.setAttribute('aria-expanded', 'false');
        };

        const openMenu = () => {
            document.querySelectorAll('[data-neo-select].show').forEach(openControl => {
                if (openControl !== control) {
                    openControl.classList.remove('show');
                    openControl.querySelector('.neo-form-select-menu')?.classList.remove('show');
                    openControl.querySelector('.neo-form-select-toggle')?.setAttribute('aria-expanded', 'false');
                }
            });
            control.classList.add('show');
            menu.classList.add('show');
            toggle.setAttribute('aria-expanded', 'true');
        };

        toggle.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            control.classList.contains('show') ? closeMenu() : openMenu();
        });

        control.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeMenu();
                toggle.focus();
            }
        });

        document.addEventListener('click', event => {
            if (!control.contains(event.target)) closeMenu();
        });

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'neo-form-select-options';

        if (control.hasAttribute('data-neo-select-search')) {
            const search = document.createElement('input');
            search.type = 'search';
            search.className = 'neo-form-select-search';
            search.placeholder = 'Search country...';
            search.setAttribute('aria-label', 'Search country');
            search.addEventListener('click', event => event.stopPropagation());
            search.addEventListener('keydown', event => event.stopPropagation());
            search.addEventListener('input', () => {
                const query = search.value.trim().toLocaleLowerCase();
                optionsContainer.querySelectorAll('.dropdown-item').forEach(item => {
                    item.hidden = !item.textContent.toLocaleLowerCase().includes(query);
                });
            });
            menu.appendChild(search);
            toggle.addEventListener('click', () => {
                if (control.classList.contains('show')) window.setTimeout(() => search.focus(), 0);
            });
        }

        menu.appendChild(optionsContainer);

        const optionIcon = option => {
            if (!control.dataset.neoSelectIcons) return null;
            const field = `${option.value} ${option.textContent}`.toLowerCase();
            if (field.includes('affiliation')) return 'fa-building';
            if (field.includes('website')) return 'fa-globe';
            return control.dataset.neoSelectIcons === 'team' ? 'fa-users' : 'fa-user';
        };

        const setOptionContent = (element, option) => {
            element.textContent = '';
            const iconClass = optionIcon(option);
            if (iconClass) {
                const icon = document.createElement('i');
                icon.className = `fas ${iconClass} neo-select-option-icon`;
                icon.setAttribute('aria-hidden', 'true');
                element.appendChild(icon);
            }
            element.appendChild(document.createTextNode(option.textContent));
        };

        const sync = () => {
            const selected = nativeSelect.options[nativeSelect.selectedIndex];
            if (selected) setOptionContent(label, selected);
            else label.textContent = '';
            menu.querySelectorAll('.dropdown-item').forEach(item => {
                item.classList.toggle('active', item.dataset.value === nativeSelect.value);
            });
        };

        Array.from(nativeSelect.options).forEach(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'dropdown-item';
            item.dataset.value = option.value;
            setOptionContent(item, option);
            item.addEventListener('click', () => {
                nativeSelect.value = option.value;
                nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
                sync();
                closeMenu();
                toggle.focus();
            });
            optionsContainer.appendChild(item);
        });

        toggle.setAttribute('aria-label', nativeSelect.getAttribute('aria-label') || nativeSelect.name || 'Select option');
        nativeSelect.addEventListener('change', sync);
        sync();
    });

    languageOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const language = option.dataset.language;
            if (!language || option.disabled) return;

            languageOptions.forEach(item => { item.disabled = true; });
            document.cookie = `language=${encodeURIComponent(language)};path=/;SameSite=Lax`;
            localStorage.setItem('language', language);

            try {
                if (window.CTFd && window.CTFd.user && window.CTFd.user.id) {
                    await window.CTFd.fetch('/api/v1/users/me', {
                        method: 'PATCH',
                        body: JSON.stringify({ language })
                    });
                }
            } finally {
                window.location.reload();
            }
        });
    });

    const initPageTransitions = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let navigating = false;
        document.addEventListener('click', event => {
            const link = event.target.closest('a[href]');
            if (!link || event.defaultPrevented || navigating) return;
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (link.hasAttribute('download') || link.target === '_blank') return;
            if (link.dataset.toggle || link.dataset.dismiss || link.classList.contains('no-page-transition')) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

            const destination = new URL(link.href, window.location.href);
            if (destination.origin !== window.location.origin) return;
            if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;

            event.preventDefault();
            navigating = true;
            document.body.classList.add('page-leaving');
            window.setTimeout(() => {
                window.location.assign(destination.href);
            }, 150);
        });

        window.addEventListener('pageshow', () => {
            navigating = false;
            document.body.classList.remove('page-leaving');
        });
    };

    initPageTransitions();

    const updateThemeToggle = theme => {
        if (!themeToggle) return;
        const isDark = theme === 'dark';
        const icon = themeToggle.querySelector('i');
        const label = themeToggle.querySelector('.theme-toggle-label');
        icon.classList.toggle('fa-moon', !isDark);
        icon.classList.toggle('fa-sun', isDark);
        label.textContent = isDark ? 'LIGHT' : 'DARK';
        themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeToggle(currentTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const activeTheme = document.documentElement.getAttribute('data-theme');
            const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('gematik-color-mode', nextTheme);
            updateThemeToggle(nextTheme);
            window.dispatchEvent(new CustomEvent('gematik-theme-changed', { detail: { theme: nextTheme } }));
        });
    }

    // Easter Egg (Konami Code)
    const konamiCode = [
        'ArrowUp', 'ArrowUp', 
        'ArrowDown', 'ArrowDown', 
        'ArrowLeft', 'ArrowRight', 
        'ArrowLeft', 'ArrowRight', 
        'b', 'a'
    ];
    let konamiIndex = 0;

    document.addEventListener('keydown', (e) => {
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                activateEasterEgg();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0; // Reset
        }
    });

    const activateEasterEgg = () => {
        const body = document.body;
        body.style.transition = 'transform 1s ease-in-out';
        body.style.transform = 'rotate(180deg)';
        
        // Show alert
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%) rotate(180deg)'; // Adjust text for rotated body
        div.style.backgroundColor = 'var(--neo-red)';
        div.style.color = 'var(--neo-white)';
        div.style.border = '4px solid var(--neo-black)';
        div.style.boxShadow = '10px 10px 0 var(--neo-black)';
        div.style.padding = '2rem';
        div.style.zIndex = '9999';
        div.style.fontWeight = 'bold';
        div.style.fontSize = '2rem';
        div.style.textAlign = 'center';
        div.innerHTML = 'KONAMI CODE ACCEPTED!<br><span style="font-size: 1rem">Welcome to the Upside Down!</span>';
        
        document.body.appendChild(div);

        setTimeout(() => {
            body.style.transform = 'none';
            div.remove();
        }, 5000);
    };
}
