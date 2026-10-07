export function renderNavbar(currentPage) {
    const menus = [
        { id: 'dashboard', icon: '🎀', label: 'Dashboard' },
        { id: 'calendar', icon: '🌸', label: 'ปฏิทินคิวเช่า' },
        { id: 'rentals', icon: '🍓', label: 'รายการเช่า' },
        { id: 'customers', icon: '🐰', label: 'ลูกค้า' },
        { id: 'cameras', icon: '📸', label: 'กล้อง / อุปกรณ์' },
        { id: 'payments', icon: '💗', label: 'การชำระเงิน' },
        { id: 'deposits', icon: '🎁', label: 'เงินมัดจำ' },
        { id: 'expenses', icon: '🧾', label: 'ค่าใช้จ่าย' },
        { id: 'reports', icon: '🌈', label: 'รายงาน / สรุป' },
        { id: 'settings', icon: '☁️', label: 'ตั้งค่า' }
    ];

    const menuHtml = menus.map(m => {
        const isActive = m.id === currentPage;
        const activeClass = isActive ? 'bg-brand-light text-brand font-semibold' : 'text-gray-600 hover:bg-pink-50';
        return `
            <a href="#" data-page="${m.id}" class="nav-link flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeClass}">
                <span class="nav-ico">${m.icon}</span>
                <span>${m.label}</span>
            </a>
        `;
    }).join('');

    return `
        <aside id="sidebar" class="sidebar bg-white border-r h-full flex flex-col z-30 lg:static fixed">
            <div class="h-16 flex items-center gap-3 px-6 border-b shrink-0">
                <img src="./assets/img/logo.jpg" alt="Cutielook Rental" class="logo-ring w-10 h-10">
                <div>
                    <h1 class="text-md font-bold leading-tight text-brand">Cutielook</h1>
                    <p class="text-[11px] text-gray-400">rental · digicam 🎀</p>
                </div>
            </div>
            <nav class="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
                ${menuHtml}
            </nav>
            <div class="p-4 border-t shrink-0">
                <button id="logout-btn" class="flex items-center justify-center gap-2 w-full py-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition font-medium text-sm">
                    <span class="text-lg">🌙</span> ออกจากระบบ
                </button>
            </div>
        </aside>
    `;
}

export function setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    let isOpen = false;

    function toggleMenu() {
        isOpen = !isOpen;
        if (isOpen) {
            sidebar.classList.add('open');
            overlay.classList.remove('hidden');
        } else {
            sidebar.classList.remove('open');
            overlay.classList.add('hidden');
        }
    }

    btn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
}
