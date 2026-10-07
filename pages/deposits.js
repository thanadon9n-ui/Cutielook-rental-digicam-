import { toast } from '../components/toast.js';
import { rentalRepo } from '../repositories/rentals.js';
import { depositRepo } from '../repositories/payments.js';
import { formatDateTH } from '../utils/date.js';
import { baht } from '../utils/money.js';

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const DEP_STATUS = {
    PENDING:  { label: '⏳ ยังไม่คืน',   color: 'bg-amber-100 text-amber-700' },
    PARTIAL:  { label: '↩️ คืนบางส่วน', color: 'bg-blue-100 text-blue-700' },
    RETURNED: { label: '✅ คืนแล้ว',     color: 'bg-emerald-100 text-emerald-700' },
    DEDUCTED: { label: '⚠️ หักค่าเสียหาย', color: 'bg-rose-100 text-rose-600' },
};

const depositsPage = {
    render: () => `
        <div class="max-w-5xl mx-auto space-y-6">
            <h2 class="text-2xl font-bold">💰 เงินมัดจำ</h2>

            <div class="card flex flex-wrap gap-3">
                <input type="text" id="search-dep" class="inp flex-1 min-w-[200px]" placeholder="ค้นหาชื่อลูกค้า...">
                <select id="filter-dep" class="inp !w-auto">
                    <option value="">ทุกสถานะ</option>
                    <option value="PENDING">⏳ ยังไม่คืน</option>
                    <option value="RETURNED">✅ คืนแล้ว</option>
                    <option value="DEDUCTED">⚠️ หักค่าเสียหาย</option>
                </select>
            </div>

            <div id="deposit-list" class="space-y-3">
                <div class="text-center text-gray-400 py-8 card">กำลังโหลดข้อมูล...</div>
            </div>
        </div>

        <!-- Modal คืนมัดจำ -->
        <div id="dep-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl p-6 w-full max-w-md">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">💰 คืนเงินมัดจำ</h3>
                    <button id="close-dep-modal" class="text-gray-400 text-xl">✕</button>
                </div>
                <div id="dep-modal-info" class="bg-gray-50 border rounded-xl p-3 mb-4 text-sm space-y-1"></div>
                <form id="dep-form" class="space-y-4">
                    <input type="hidden" id="dep-rental-id">
                    <input type="hidden" id="dep-total-amount">
                    <div>
                        <label class="lb">จำนวนที่หัก (ค่าปรับ/เสียหาย) (฿)</label>
                        <input type="number" id="dep-deduct" min="0" value="0" class="inp" placeholder="0 = ไม่หัก คืนเต็มจำนวน">
                    </div>
                    <div>
                        <label class="lb">เหตุผลที่หัก <span class="text-xs text-gray-400">(กรณีที่มีการหัก)</span></label>
                        <input type="text" id="dep-note" class="inp" placeholder="เช่น รอยขีดข่วนที่ตัวกล้อง, สายหาย">
                    </div>
                    <div class="bg-brand-light border border-pink-200 rounded-xl p-3 text-sm">
                        <div class="flex justify-between">
                            <span>มัดจำทั้งหมด</span>
                            <span id="dep-summary-total" class="font-bold">0 ฿</span>
                        </div>
                        <div class="flex justify-between text-rose-500">
                            <span>หัก</span>
                            <span id="dep-summary-deduct">0 ฿</span>
                        </div>
                        <div class="flex justify-between font-bold text-brand border-t mt-2 pt-2">
                            <span>คืนให้ลูกค้า</span>
                            <span id="dep-summary-return">0 ฿</span>
                        </div>
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="submit" id="save-dep-btn" class="btn flex-1 btn-green">✅ ยืนยันคืนมัดจำ</button>
                        <button type="button" id="cancel-dep-btn" class="btn btn-gray">ยกเลิก</button>
                    </div>
                </form>
            </div>
        </div>
    `,

    afterRender: async () => {
        let rentals = [];

        const load = async () => {
            try {
                rentals = await rentalRepo.getAll();
                renderList();
            } catch (err) {
                toast.error('โหลดไม่สำเร็จ: ' + err.message);
            }
        };

        const renderList = () => {
            const q = document.getElementById('search-dep').value.toLowerCase();
            const filter = document.getElementById('filter-dep').value;
            const list = document.getElementById('deposit-list');

            // กรองเฉพาะรายการที่มีมัดจำ
            const filtered = rentals.filter(r => {
                if (!r.deposits) return false;
                const matchQ = (r.customers?.name || '').toLowerCase().includes(q);
                const matchF = !filter || r.deposits.status === filter;
                return matchQ && matchF;
            });

            if (!filtered.length) {
                list.innerHTML = '<div class="text-center text-gray-400 py-8 card">ไม่พบรายการมัดจำ</div>';
                return;
            }

            list.innerHTML = filtered.map(r => {
                const dep = r.deposits;
                const st = DEP_STATUS[dep.status] || DEP_STATUS.PENDING;

                return `
                <div class="card hover:border-pink-200 transition p-4">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="font-bold flex flex-wrap items-center gap-2">
                                ${esc(r.customers?.name || '-')}
                                <span class="px-2 py-0.5 text-xs rounded-full ${st.color}">${st.label}</span>
                            </div>
                            <div class="text-xs text-gray-500 mt-0.5">
                                ${formatDateTH(r.start_date)} – ${formatDateTH(r.end_date)} •
                                ${(r.rental_items || []).map(i => esc(i.cameras?.name || '')).join(', ')}
                            </div>
                            ${dep.note ? `<div class="text-xs text-rose-500 mt-1">📝 ${esc(dep.note)}</div>` : ''}
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-lg font-bold text-brand">${baht(dep.amount)}</div>
                            ${Number(dep.deducted_amount) > 0 ? `<div class="text-xs text-rose-500">หัก ${baht(dep.deducted_amount)}</div>` : ''}
                            ${Number(dep.returned_amount) > 0 ? `<div class="text-xs text-emerald-600">คืน ${baht(dep.returned_amount)}</div>` : ''}
                        </div>
                    </div>
                    ${dep.status === 'PENDING' && (r.status === 'RETURNED' || r.status === 'CLOSED') ? `
                    <div class="mt-3 pt-3 border-t">
                        <button class="btn w-full !py-2 btn-green return-dep-btn" data-id="${r.rental_id}" data-amount="${dep.amount}">
                            💰 คืนเงินมัดจำให้ลูกค้า
                        </button>
                    </div>` : ''}
                </div>`;
            }).join('');
        };

        document.getElementById('search-dep').addEventListener('input', renderList);
        document.getElementById('filter-dep').addEventListener('change', renderList);

        // Modal
        const modal = document.getElementById('dep-modal');
        const closeModal = () => modal.classList.add('hidden');

        document.getElementById('close-dep-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-dep-btn').addEventListener('click', closeModal);

        // อัปเดตสรุปแบบ real-time
        document.getElementById('dep-deduct').addEventListener('input', () => {
            const total = Number(document.getElementById('dep-total-amount').value) || 0;
            const deduct = Number(document.getElementById('dep-deduct').value) || 0;
            const returnAmt = Math.max(0, total - deduct);
            document.getElementById('dep-summary-deduct').textContent = baht(deduct);
            document.getElementById('dep-summary-return').textContent = baht(returnAmt);
        });

        document.getElementById('deposit-list').addEventListener('click', (e) => {
            const btn = e.target.closest('.return-dep-btn');
            if (!btn) return;
            const rentalId = btn.getAttribute('data-id');
            const amount = Number(btn.getAttribute('data-amount'));
            const r = rentals.find(x => x.rental_id === rentalId);

            document.getElementById('dep-rental-id').value = rentalId;
            document.getElementById('dep-total-amount').value = amount;
            document.getElementById('dep-deduct').value = 0;
            document.getElementById('dep-note').value = '';
            document.getElementById('dep-summary-total').textContent = baht(amount);
            document.getElementById('dep-summary-deduct').textContent = baht(0);
            document.getElementById('dep-summary-return').textContent = baht(amount);
            document.getElementById('dep-modal-info').innerHTML = `
                <div class="flex justify-between"><span class="text-gray-500">ลูกค้า</span><span class="font-semibold">${esc(r.customers?.name)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">เงินมัดจำ</span><span class="font-bold text-brand">${baht(amount)}</span></div>
            `;
            modal.classList.remove('hidden');
        });

        document.getElementById('dep-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-dep-btn');
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';
            try {
                const rentalId = document.getElementById('dep-rental-id').value;
                const total = Number(document.getElementById('dep-total-amount').value);
                const deduct = Number(document.getElementById('dep-deduct').value) || 0;
                const returnAmt = Math.max(0, total - deduct);
                const note = document.getElementById('dep-note').value.trim() || null;
                if (deduct < 0 || deduct > total) throw new Error('ยอดหักต้องไม่ติดลบ และไม่เกินเงินมัดจำ');
                if (deduct > 0 && !note) throw new Error('กรุณาระบุเหตุผลที่หักเงินมัดจำ');

                await depositRepo.update(rentalId, {
                    returned_amount: returnAmt,
                    deducted_amount: deduct,
                    status: deduct > 0 ? 'DEDUCTED' : 'RETURNED',
                    returned_date: new Date().toISOString(),
                    note
                });
                closeModal();
                toast.success('บันทึกสำเร็จ');
                await load();
            } catch (err) {
                toast.error('บันทึกไม่สำเร็จ: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '✅ ยืนยันคืนมัดจำ';
            }
        });

        await load();
    }
};

export default depositsPage;
