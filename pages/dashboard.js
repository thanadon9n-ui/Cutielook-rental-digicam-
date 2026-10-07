import { toast } from '../components/toast.js';
import { rentalRepo } from '../repositories/rentals.js';
import { expenseRepo } from '../repositories/expenses.js';
import { today, formatDateTH } from '../utils/date.js';
import { baht, calcTotal, calcPaid } from '../utils/money.js';

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const dashboardPage = {
    render: () => `
        <div class="space-y-6">
            <!-- Top summary stats -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dash-stats">
                <div class="card"><div class="text-xs text-gray-500">กำลังโหลด...</div><div class="text-2xl font-bold">...</div></div>
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="dash-stats2">
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
                <div class="card"><div class="text-xs text-gray-500">...</div><div class="text-2xl font-bold">...</div></div>
            </div>

            <div class="grid lg:grid-cols-2 gap-6">
                <!-- งานวันนี้ -->
                <div class="card">
                    <h3 class="font-bold mb-4">📋 งานที่ต้องทำวันนี้</h3>
                    <div id="dash-tasks">กำลังโหลด...</div>
                </div>
                <!-- รายการใกล้ถึงกำหนด -->
                <div class="card">
                    <h3 class="font-bold mb-4">⏰ รายการที่ต้องรับคืนเร็วๆ นี้</h3>
                    <div id="dash-upcoming">กำลังโหลด...</div>
                </div>
            </div>
        </div>
    `,

    afterRender: async () => {
        try {
            const [rentals, expenses] = await Promise.all([
                rentalRepo.getAll(),
                expenseRepo.getAll()
            ]);
            const todayStr = today();
            const ym = todayStr.slice(0, 7);

            // --- Stats Row 1 ---
            const activeRentals = rentals.filter(r => r.status === 'RENTED').length;
            const preparing = rentals.filter(r => r.status === 'BOOKED' || r.status === 'PREPARING' || r.status === 'READY').length;
            const overdueReturn = rentals.filter(r => r.status === 'RENTED' && (r.return_arrive_date || r.end_date) < todayStr).length;
            const unpaid = rentals.filter(r => {
                if (r.status === 'CANCELLED' || r.status === 'CLOSED') return false;
                const total = calcTotal(r);
                const paid = calcPaid(r.payments);
                return paid < total;
            }).length;

            document.getElementById('dash-stats').innerHTML = `
                <div class="card"><div class="text-xs text-gray-500">กล้องที่กำลังเช่า</div><div class="text-2xl font-bold text-brand">${activeRentals}</div></div>
                <div class="card"><div class="text-xs text-gray-500">รอเตรียม / เตรียมแล้ว</div><div class="text-2xl font-bold text-amber-500">${preparing}</div></div>
                <div class="card"><div class="text-xs text-gray-500">เลยกำหนดคืน</div><div class="text-2xl font-bold text-rose-500">${overdueReturn}</div></div>
                <div class="card"><div class="text-xs text-gray-500">รายการค้างชำระ</div><div class="text-2xl font-bold text-rose-400">${unpaid}</div></div>
            `;

            // --- Stats Row 2 ---
            const pendingDeposits = rentals.filter(r => r.deposits?.status === 'PENDING').reduce((s, r) => s + Number(r.deposits?.amount || 0), 0);
            const monthRevenue = rentals.filter(r => r.status !== 'CANCELLED' && r.start_date.startsWith(ym)).reduce((s, r) => s + calcTotal(r), 0);
            const monthExpenses = expenses.filter(e => e.expense_date.startsWith(ym)).reduce((s, e) => s + Number(e.amount), 0);
            const monthProfit = monthRevenue - monthExpenses;

            document.getElementById('dash-stats2').innerHTML = `
                <div class="card"><div class="text-xs text-gray-500">มัดจำยังไม่ได้คืน</div><div class="text-2xl font-bold text-amber-500">${baht(pendingDeposits)}</div></div>
                <div class="card"><div class="text-xs text-gray-500">รายได้เดือนนี้</div><div class="text-2xl font-bold text-emerald-600">${baht(monthRevenue)}</div></div>
                <div class="card"><div class="text-xs text-gray-500">ค่าใช้จ่ายเดือนนี้</div><div class="text-2xl font-bold text-rose-500">${baht(monthExpenses)}</div></div>
                <div class="card"><div class="text-xs text-gray-500">กำไรสุทธิเดือนนี้</div><div class="text-2xl font-bold ${monthProfit >= 0 ? 'text-blue-600' : 'text-rose-500'}">${baht(monthProfit)}</div></div>
            `;

            // --- งานวันนี้ ---
            // งานของร้านวันนี้: ส่งมอบ/รับคืน (งานรับเอง) และ ส่งของออก/ของถึงร้าน (งานจัดส่ง)
            const notYetOut = ['BOOKED', 'PREPARING', 'READY'];
            const tasks = [];
            rentals.filter(r => r.status !== 'CANCELLED' && r.status !== 'CLOSED').forEach(r => {
                const ship = r.rental_type === 'DELIVERY';
                if (!ship && r.start_date === todayStr) tasks.push({ r, out: true, label: '📤 ส่งมอบ' });
                if (ship && r.ship_date === todayStr && notYetOut.includes(r.status)) tasks.push({ r, out: true, label: `🚚 ส่งของออก${r.dest_province ? ' → ' + esc(r.dest_province) : ''}` });
                if (r.end_date === todayStr) tasks.push({ r, out: false, label: ship ? '↩️ ลูกค้าต้องส่งคืนวันนี้' : '📥 รับคืน' });
                if (ship && r.return_arrive_date === todayStr && r.return_arrive_date !== r.end_date) tasks.push({ r, out: false, label: '📦 ของควรถึงร้านวันนี้' });
            });
            const tasksEl = document.getElementById('dash-tasks');
            if (!tasks.length) {
                tasksEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">ไม่มีงานวันนี้ 🎉</p>';
            } else {
                tasksEl.innerHTML = tasks.map(({ r, out, label }) => `
                    <div class="flex items-center justify-between p-3 ${out ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'} border rounded-xl mb-2">
                        <div>
                            <div class="font-semibold text-sm">${label}: ${esc(r.customers?.name || '-')}</div>
                            <div class="text-xs text-gray-500">${(r.rental_items || []).map(i => esc(i.cameras?.name || '')).join(', ')}</div>
                        </div>
                        <a href="tel:${esc(r.customers?.phone)}" class="btn btn-gray !py-1 !px-2 text-xs shrink-0">📞 โทร</a>
                    </div>`).join('');
            }

            // --- ใกล้ถึงกำหนด ---
            const upcoming = rentals
                .filter(r => r.status === 'RENTED' && r.end_date >= todayStr)
                .sort((a, b) => a.end_date.localeCompare(b.end_date))
                .slice(0, 5);
            const upcomingEl = document.getElementById('dash-upcoming');
            if (!upcoming.length) {
                upcomingEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">ไม่มีรายการที่ใกล้ถึงกำหนด</p>';
            } else {
                upcomingEl.innerHTML = upcoming.map(r => {
                    const isToday = r.end_date === todayStr;
                    return `
                    <div class="flex items-center justify-between p-3 bg-gray-50 border rounded-xl mb-2">
                        <div>
                            <div class="font-semibold text-sm">${esc(r.customers?.name || '-')}</div>
                            <div class="text-xs text-gray-500">${(r.rental_items || []).map(i => esc(i.cameras?.name || '')).join(', ')}</div>
                        </div>
                        <div class="text-right shrink-0 ml-2">
                            <div class="text-sm font-medium ${isToday ? 'text-rose-500' : 'text-gray-700'}">${formatDateTH(r.end_date)}</div>
                            ${isToday ? '<div class="text-xs text-rose-500">ครบกำหนดวันนี้</div>' : ''}
                        </div>
                    </div>`;
                }).join('');
            }

        } catch (err) {
            console.error('Dashboard error:', err);
            toast.error('โหลด Dashboard ไม่สำเร็จ: ' + err.message);
        }
    }
};

export default dashboardPage;
