import { renderNavbar, setupMobileMenu } from '../components/navbar.js';
import dashboardPage from '../pages/dashboard.js';
import camerasPage from '../pages/cameras.js';
import customersPage from '../pages/customers.js';
import rentalsPage from '../pages/rentals.js';
import calendarPage from '../pages/calendar.js';
import paymentsPage from '../pages/payments.js';
import depositsPage from '../pages/deposits.js';
import expensesPage from '../pages/expenses.js';
import reportsPage from '../pages/reports.js';
import settingsPage from '../pages/settings.js';
import { getSession, login, logout, onAuthStateChange } from '../services/auth.js';

// -----------------------------------------------
// Routing: ชื่อเมนู -> ไฟล์ Page
// -----------------------------------------------
const routes = {
    'dashboard': dashboardPage,
    'calendar': calendarPage,
    'rentals': rentalsPage,
    'customers': customersPage,
    'cameras': camerasPage,
    'payments': paymentsPage,
    'deposits': depositsPage,
    'expenses': expensesPage,
    'reports': reportsPage,
    'settings': settingsPage,
};

const PAGE_TITLES = {
    'dashboard': 'Dashboard',
    'calendar': 'ปฏิทินคิวเช่า',
    'rentals': 'รายการเช่า',
    'customers': 'ลูกค้า',
    'cameras': 'กล้อง / อุปกรณ์',
    'payments': 'การชำระเงิน',
    'deposits': 'เงินมัดจำ',
    'expenses': 'ค่าใช้จ่าย',
    'reports': 'รายงาน / สรุป',
    'settings': 'ตั้งค่า'
};

let currentPage = 'dashboard';
let isAppInitialized = false;

// -----------------------------------------------
// เริ่มต้นแอป
// -----------------------------------------------
async function initApp() {
    const session = await getSession();

    if (!session && CONFIG.supabaseUrl !== 'YOUR_SUPABASE_URL') {
        showLoginScreen();
    } else {
        showApp();
    }

    onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            isAppInitialized = false;
            showLoginScreen();
        } else if (event === 'SIGNED_IN') {
            showApp();
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const err = document.getElementById('login-error');

        btn.disabled = true;
        btn.textContent = 'กำลังเข้าสู่ระบบ...';
        err.classList.add('hidden');

        const { error } = await login(email, pass);
        if (error) {
            err.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            err.classList.remove('hidden');
        }
        btn.disabled = false;
        btn.textContent = 'เข้าสู่ระบบ';
    });

    document.addEventListener('click', async (e) => {
        if (e.target.closest('#logout-btn')) {
            await logout();
        }
    });
}

function showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-wrapper').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');

    if (!isAppInitialized) {
        setupMainApp();
        isAppInitialized = true;
    }
}

// -----------------------------------------------
// ตั้งค่า UI หลัก
// -----------------------------------------------
function setupMainApp() {
    document.getElementById('navbar-container').innerHTML = renderNavbar(currentPage);
    setupMobileMenu();

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.getAttribute('data-page');
            navigate(page);
        });
    });

    navigate(currentPage, true);
}

// -----------------------------------------------
// เปลี่ยนหน้า
// -----------------------------------------------
function navigate(page, initial = false) {
    currentPage = page;

    document.querySelectorAll('.nav-link').forEach(link => {
        const isActive = link.getAttribute('data-page') === page;
        link.classList.toggle('bg-brand-light', isActive);
        link.classList.toggle('text-brand', isActive);
        link.classList.toggle('font-semibold', isActive);
        link.classList.toggle('text-gray-600', !isActive);
        link.classList.toggle('hover:bg-pink-50', !isActive);
    });

    document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;

    if (!initial && window.innerWidth < 1024) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.add('hidden');
    }

    const contentArea = document.getElementById('app-content');
    if (routes[page]) {
        contentArea.innerHTML = routes[page].render();
        if (routes[page].afterRender) routes[page].afterRender();
    } else {
        contentArea.innerHTML = `<div class="card text-center py-16 text-gray-400">หน้านี้กำลังอยู่ในช่วงพัฒนา</div>`;
    }
}

document.addEventListener('DOMContentLoaded', initApp);

// -----------------------------------------------
// ธีม: เปลี่ยนอีโมจิตกแต่งในหน้าเป็นชุดน่ารัก (ไม่แตะอีโมจิบอกสถานะ ✅ ⚠️ ❌)
// -----------------------------------------------
const CUTE = { '📋': '🍓', '📅': '🌸', '👥': '🐰', '📷': '📸', '💳': '💗', '💰': '🎁', '💸': '🧾', '📊': '🌈',
    '⚙️': '☁️', '💾': '💌', 'ℹ️': '💭', '🚪': '🌙', '📞': '🌷', '🎉': '🎀', '📈': '🌷', '🏠': '🎀' };
const CUTE_RE = new RegExp(Object.keys(CUTE).join('|'), 'g');

function cuteify(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
        if (CUTE_RE.test(n.nodeValue)) { CUTE_RE.lastIndex = 0; n.nodeValue = n.nodeValue.replace(CUTE_RE, (m) => CUTE[m]); }
        CUTE_RE.lastIndex = 0;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('app-content');
    // ดูเฉพาะการเพิ่ม/ลบ node (ไม่ดู characterData) จึงไม่วนลูปตอนเราแก้ข้อความ
    new MutationObserver(() => cuteify(area)).observe(area, { childList: true, subtree: true });
});
