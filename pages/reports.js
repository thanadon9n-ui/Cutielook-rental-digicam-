import { toast } from '../components/toast.js';
import { rentalRepo } from '../repositories/rentals.js';
import { expenseRepo } from '../repositories/expenses.js';
import { today, formatMonthTH } from '../utils/date.js';
import { baht, calcTotal } from '../utils/money.js';

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const reportsPage = {
    render: () => `
        <div class="max-w-5xl mx-auto space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <h2 class="text-2xl font-bold">📊 รายงาน / สรุปรายได้</h2>
                <select id="report-month" class="inp !w-52"></select>
            </div>

            <!-- ตัวเลขสำคัญ -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="report-stats">
                <div class="card"><div class="text-xs text-gray-500">กำลังโหลด...</div></div>
            </div>

            <div class="grid lg:grid-cols-2 gap-6">
                <div class="card">
                <h3 class="font-bold mb-4">💵 รายได้แยกประเภท (ไม่รวมเงินมัดจำ)</h3>
                <div id="report-income" class="grid grid-cols-2 lg:grid-cols-4 gap-3"></div>
            </div>

            <!-- กล้องยอดนิยม -->
                <div class="card">
                    <h3 class="font-bold mb-4">📷 กล้องที่เช่ามากที่สุด</h3>
                    <div id="report-cameras" class="space-y-2"></div>
                </div>

                <!-- รายจ่ายแยกหมวด -->
                <div class="card">
                    <h3 class="font-bold mb-4">💸 ค่าใช้จ่ายแยกหมวดหมู่</h3>
                    <div id="report-expenses" class="space-y-2"></div>
                </div>
            </div>

            <!-- รายได้ย้อนหลัง 6 เดือน -->
            <div class="card">
                <h3 class="font-bold mb-4">📈 รายได้ย้อนหลัง 6 เดือน</h3>
                <div id="report-chart" class="space-y-3"></div>
            </div>

            <!-- ลูกค้าที่ใช้จ่ายสูงสุด -->
            <div class="card">
                <h3 class="font-bold mb-4">👥 ลูกค้าที่ใช้จ่ายสูงสุด</h3>
                <div id="report-customers" class="space-y-2"></div>
            </div>
        </div>
    `,

    afterRender: async () => {
        let allRentals = [];
        let allExpenses = [];

        // สร้าง Dropdown เลือกเดือน
        const monthSel = document.getElementById('report-month');
        const generateMonths = () => {
            const months = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                months.push(ym);
            }
            monthSel.innerHTML = months.map((ym, i) =>
                `<option value="${ym}" ${i === 0 ? 'selected' : ''}>${formatMonthTH(ym)}</option>`
            ).join('');
        };
        generateMonths();

        const load = async () => {
            try {
                [allRentals, allExpenses] = await Promise.all([
                    rentalRepo.getAll(),
                    expenseRepo.getAll()
                ]);
                renderReport();
            } catch (err) {
                toast.error('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
            }
        };

        const renderReport = () => {
            const ym = monthSel.value;

            // กรองรายการเช่าของเดือนที่เลือก (ไม่นับ CANCELLED)
            const monthRentals = allRentals.filter(r =>
                r.status !== 'CANCELLED' && r.start_date.startsWith(ym)
            );
            // กรองค่าใช้จ่ายของเดือนที่เลือก
            const monthExpenses = allExpenses.filter(e => e.expense_date.startsWith(ym));

            const revenue = monthRentals.reduce((s, r) => s + calcTotal(r), 0);
            const totalExp = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
            const profit = revenue - totalExp;

            // รายได้แยกประเภท: ค่าเช่า(หลังส่วนลด) / ค่าปรับ / ค่าส่ง / อื่น ๆ  (มัดจำไม่นับ)
            const inc = { rent: 0, late: 0, ship: 0, other: 0 };
            monthRentals.forEach(r => {
                inc.rent += Number(r.subtotal) - Number(r.discount);
                inc.late += Number(r.late_fee); inc.ship += Number(r.shipping_fee); inc.other += Number(r.other_fee || 0);
            });
            document.getElementById('report-income').innerHTML = [
                ['ค่าเช่า', inc.rent], ['ค่าปรับ', inc.late], ['ค่าจัดส่ง', inc.ship], ['รายได้อื่น', inc.other]
            ].map(([l, v]) => `<div class="bg-gray-50 border rounded-xl p-3"><div class="text-xs text-gray-500">${l}</div><div class="font-bold text-emerald-600">${baht(v)}</div></div>`).join('');

            // Stats
            document.getElementById('report-stats').innerHTML = `
                <div class="card"><div class="text-xs text-gray-500">รายได้รวม</div><div class="text-2xl font-bold text-emerald-600">${baht(revenue)}</div></div>
                <div class="card"><div class="text-xs text-gray-500">ค่าใช้จ่ายรวม</div><div class="text-2xl font-bold text-rose-500">${baht(totalExp)}</div></div>
                <div class="card"><div class="text-xs text-gray-500">กำไรสุทธิ</div><div class="text-2xl font-bold ${profit >= 0 ? 'text-blue-600' : 'text-rose-500'}">${baht(profit)}</div></div>
                <div class="card"><div class="text-xs text-gray-500">จำนวนรายการเช่า</div><div class="text-2xl font-bold">${monthRentals.length} รายการ</div></div>
            `;

            // กล้องยอดนิยม
            const camStats = {};
            monthRentals.forEach(r => {
                (r.rental_items || []).forEach(item => {
                    const name = item.cameras?.name || 'ไม่ระบุ';
                    if (!camStats[name]) camStats[name] = { count: 0, revenue: 0 };
                    camStats[name].count++;
                    camStats[name].revenue += Number(item.total) || 0;
                });
            });
            const topCams = Object.entries(camStats).sort((a, b) => b[1].count - a[1].count);
            const maxCount = topCams[0]?.[1].count || 1;
            document.getElementById('report-cameras').innerHTML = topCams.length
                ? topCams.map(([name, stat]) => `
                    <div class="flex items-center gap-3">
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between text-sm mb-1"><span class="font-medium truncate">${esc(name)}</span><span class="text-brand font-bold">${baht(stat.revenue)}</span></div>
                            <div class="bg-gray-100 rounded-full h-2"><div class="bg-brand h-2 rounded-full" style="width:${Math.round(stat.count/maxCount*100)}%"></div></div>
                            <div class="text-xs text-gray-400 mt-0.5">เช่า ${stat.count} ครั้ง</div>
                        </div>
                    </div>`).join('')
                : '<p class="text-gray-400 text-sm text-center py-4">ยังไม่มีข้อมูล</p>';

            // รายจ่ายแยกหมวด
            const expCats = {};
            monthExpenses.forEach(e => {
                const cat = e.category || 'อื่น ๆ';
                expCats[cat] = (expCats[cat] || 0) + Number(e.amount);
            });
            document.getElementById('report-expenses').innerHTML = Object.entries(expCats).length
                ? Object.entries(expCats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `
                    <div class="flex items-center justify-between p-2.5 bg-gray-50 border rounded-xl text-sm">
                        <span>${esc(cat)}</span>
                        <span class="font-bold text-rose-500">-${baht(amt)}</span>
                    </div>`).join('')
                : '<p class="text-gray-400 text-sm text-center py-4">ไม่มีค่าใช้จ่ายเดือนนี้</p>';

            // ย้อนหลัง 6 เดือน
            const now = new Date();
            const months6 = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const rev = allRentals.filter(r => r.status !== 'CANCELLED' && r.start_date.startsWith(key))
                    .reduce((s, r) => s + calcTotal(r), 0);
                months6.push({ key, rev, label: formatMonthTH(key) });
            }
            const maxRev = Math.max(...months6.map(m => m.rev), 1);
            document.getElementById('report-chart').innerHTML = months6.map(m => `
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-gray-600">${m.label}</span>
                        <span class="text-brand font-bold">${baht(m.rev)}</span>
                    </div>
                    <div class="bg-gray-100 rounded-full h-3">
                        <div class="bg-gradient-to-r from-brand to-pink-400 h-3 rounded-full transition-all" style="width:${Math.round(m.rev/maxRev*100)}%"></div>
                    </div>
                </div>`).join('');

            // ลูกค้าที่ใช้จ่ายสูงสุด (ทั้งหมด ไม่ใช่แค่เดือนนี้)
            const custStats = {};
            allRentals.filter(r => r.status !== 'CANCELLED').forEach(r => {
                const name = r.customers?.name || 'ไม่ระบุ';
                if (!custStats[name]) custStats[name] = { count: 0, total: 0, last: '' };
                custStats[name].count++;
                custStats[name].total += calcTotal(r);
                if (r.start_date > custStats[name].last) custStats[name].last = r.start_date;
            });
            const topCusts = Object.entries(custStats).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
            document.getElementById('report-customers').innerHTML = topCusts.length
                ? `<div class="overflow-x-auto"><table class="w-full text-sm">
                    <thead class="text-xs text-gray-500 border-b"><tr><th class="text-left py-2">ลูกค้า</th><th class="text-right py-2">จำนวนครั้ง</th><th class="text-right py-2">เช่าล่าสุด</th><th class="text-right py-2">ยอดใช้จ่าย</th></tr></thead>
                    <tbody>${topCusts.map(([name, stat]) => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="py-2 font-medium">${esc(name)}</td>
                            <td class="py-2 text-right text-gray-500">${stat.count} ครั้ง</td>
                            <td class="py-2 text-right text-gray-500">${stat.last}</td>
                            <td class="py-2 text-right font-bold text-brand">${baht(stat.total)}</td>
                        </tr>`).join('')}</tbody>
                </table></div>`
                : '<p class="text-gray-400 text-sm text-center py-4">ยังไม่มีข้อมูล</p>';
        };

        monthSel.addEventListener('change', renderReport);
        await load();
    }
};

export default reportsPage;
