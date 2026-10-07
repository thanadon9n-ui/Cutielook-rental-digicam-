import { validateAmount } from '../utils/validation.js';
import { toast } from '../components/toast.js';
import { rentalRepo } from '../repositories/rentals.js';
import { paymentRepo } from '../repositories/payments.js';
import { formatDateTH, today } from '../utils/date.js';
import { baht, calcTotal, calcPaid, calcRemaining, paymentStatus } from '../utils/money.js';

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const paymentsPage = {
    render: () => `
        <div class="max-w-5xl mx-auto space-y-6">
            <h2 class="text-2xl font-bold">💳 การชำระเงิน</h2>

            <div class="card flex flex-wrap gap-3">
                <input type="text" id="search-pay" class="inp flex-1 min-w-[200px]" placeholder="ค้นหาชื่อลูกค้า...">
                <select id="filter-pay" class="inp !w-auto">
                    <option value="">ทุกสถานะ</option>
                    <option value="UNPAID">❌ ยังไม่ชำระ</option>
                    <option value="PARTIAL">⏳ ชำระบางส่วน</option>
                    <option value="PAID">✅ ชำระครบ</option>
                </select>
            </div>

            <div id="payment-list" class="space-y-3">
                <div class="text-center text-gray-400 py-8 card">กำลังโหลดข้อมูล...</div>
            </div>
        </div>

        <!-- Modal บันทึกชำระ -->
        <div id="pay-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">💳 บันทึกการชำระเงิน</h3>
                    <button id="close-pay-modal" class="text-gray-400 text-xl">✕</button>
                </div>
                <div id="pay-modal-info" class="bg-gray-50 border rounded-xl p-3 mb-4 text-sm space-y-1"></div>
                <form id="pay-form" class="space-y-4">
                    <input type="hidden" id="pay-rental-id">
                    <div>
                        <label class="lb">จำนวนเงินที่ชำระ (฿) <span class="text-rose-500">*</span></label>
                        <input type="number" id="pay-amount" required min="0.01" step="0.01" class="inp" placeholder="0.00">
                    </div>
                    <div>
                        <label class="lb">วิธีชำระเงิน</label>
                        <select id="pay-method" class="inp">
                            <option value="TRANSFER">💸 โอนเงิน</option>
                            <option value="CASH">💵 เงินสด</option>
                            <option value="OTHER">อื่น ๆ</option>
                        </select>
                    </div>
                    <div>
                        <label class="lb">หมายเหตุ</label>
                        <input type="text" id="pay-note" class="inp" placeholder="เช่น โอนมาแล้วแจ้งสลิป">
                    </div>
                    <div class="flex gap-3 pt-2">
                        <button type="submit" id="save-pay-btn" class="btn flex-1">บันทึกการชำระ</button>
                        <button type="button" id="cancel-pay-btn" class="btn btn-gray">ยกเลิก</button>
                    </div>
                </form>

                <!-- ประวัติการชำระของรายการนี้ -->
                <div class="mt-5 border-t pt-4">
                    <h4 class="font-bold text-sm mb-3">ประวัติการชำระ</h4>
                    <div id="pay-history" class="space-y-2"></div>
                </div>
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
            const q = document.getElementById('search-pay').value.toLowerCase();
            const filter = document.getElementById('filter-pay').value;
            const list = document.getElementById('payment-list');

            // กรองเฉพาะรายการที่ไม่ยกเลิก / ไม่ปิด
            const filtered = rentals.filter(r => {
                if (r.status === 'CANCELLED') return false;
                const pSt = paymentStatus(r, r.payments);
                const matchPay = !filter || pSt === filter;
                const matchQ = (r.customers?.name || '').toLowerCase().includes(q) || (r.customers?.phone || '').includes(q);
                return matchPay && matchQ;
            });

            if (!filtered.length) {
                list.innerHTML = '<div class="text-center text-gray-400 py-8 card">ไม่พบรายการ</div>';
                return;
            }

            list.innerHTML = filtered.map(r => {
                const total = calcTotal(r);
                const paid = calcPaid(r.payments);
                const remaining = total - paid;
                const pSt = paymentStatus(r, r.payments);
                const paidPct = total > 0 ? Math.min(100, Math.round(paid / total * 100)) : 0;

                const badge = pSt === 'PAID'
                    ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">✅ ชำระครบ</span>'
                    : pSt === 'PARTIAL'
                        ? '<span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">⏳ บางส่วน</span>'
                        : '<span class="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs rounded-full">❌ ยังไม่ชำระ</span>';

                return `
                <div class="card hover:border-pink-200 transition p-4">
                    <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div>
                            <div class="font-bold flex items-center gap-2">${esc(r.customers?.name || '-')} ${badge}</div>
                            <div class="text-xs text-gray-500 mt-0.5">
                                ${formatDateTH(r.start_date)} – ${formatDateTH(r.end_date)} •
                                ${(r.rental_items || []).map(i => esc(i.cameras?.name || '')).join(', ')}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold">${baht(total)}</div>
                            ${remaining > 0 ? `<div class="text-xs text-rose-500">ค้าง ${baht(remaining)}</div>` : ''}
                        </div>
                    </div>
                    <!-- แถบความคืบหน้า -->
                    <div class="bg-gray-100 rounded-full h-2 mb-3">
                        <div class="bg-emerald-500 h-2 rounded-full transition-all" style="width:${paidPct}%"></div>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">ชำระแล้ว ${baht(paid)} จาก ${baht(total)}</span>
                        ${pSt !== 'PAID' ? `<button class="btn !py-1.5 !px-3 !text-xs open-pay-btn" data-id="${r.rental_id}">+ บันทึกรับเงิน</button>` : '<span class="text-xs text-emerald-600 font-medium">✅ ครบแล้ว</span>'}
                    </div>
                </div>`;
            }).join('');
        };

        document.getElementById('search-pay').addEventListener('input', renderList);
        document.getElementById('filter-pay').addEventListener('change', renderList);

        // Modal
        const modal = document.getElementById('pay-modal');
        const closeModal = () => modal.classList.add('hidden');

        document.getElementById('close-pay-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-pay-btn').addEventListener('click', closeModal);

        const openModal = (rentalId) => {
            const r = rentals.find(x => x.rental_id === rentalId);
            if (!r) return;
            const total = calcTotal(r);
            const paid = calcPaid(r.payments);
            const remaining = total - paid;

            document.getElementById('pay-rental-id').value = rentalId;
            document.getElementById('pay-amount').value = remaining > 0 ? remaining : '';
            document.getElementById('pay-note').value = '';
            document.getElementById('pay-modal-info').innerHTML = `
                <div class="flex justify-between"><span class="text-gray-500">ลูกค้า</span><span class="font-semibold">${esc(r.customers?.name)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">ยอดรวม</span><span class="font-semibold">${baht(total)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">ชำระแล้ว</span><span class="text-emerald-600 font-semibold">${baht(paid)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">ยอดค้าง</span><span class="text-rose-500 font-bold">${baht(remaining)}</span></div>
            `;

            // ประวัติ
            const history = document.getElementById('pay-history');
            if (!r.payments || !r.payments.length) {
                history.innerHTML = '<p class="text-gray-400 text-xs text-center py-2">ยังไม่มีประวัติการชำระ</p>';
            } else {
                history.innerHTML = r.payments.map(p => `
                    <div class="flex items-center justify-between text-sm p-2 bg-gray-50 border rounded-lg">
                        <div>
                            <div class="font-medium">${baht(p.amount)}</div>
                            <div class="text-xs text-gray-400">${p.payment_type === 'TRANSFER' ? '💸 โอน' : p.payment_type === 'CASH' ? '💵 เงินสด' : p.payment_type} • ${new Date(p.payment_date).toLocaleDateString('th-TH')}</div>
                        </div>
                        ${p.note ? `<div class="text-xs text-gray-500">${esc(p.note)}</div>` : ''}
                    </div>`).join('');
            }

            modal.classList.remove('hidden');
        };

        document.getElementById('payment-list').addEventListener('click', (e) => {
            const btn = e.target.closest('.open-pay-btn');
            if (btn) openModal(btn.getAttribute('data-id'));
        });

        document.getElementById('pay-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-pay-btn');
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';
            const vErr = validateAmount(document.getElementById('pay-amount').value, 'จำนวนเงินที่ชำระ');
            if (vErr) { toast.error(vErr); btn.disabled = false; btn.textContent = 'บันทึกการชำระ'; return; }
            try {
                await paymentRepo.add({
                    rental_id: document.getElementById('pay-rental-id').value,
                    amount: Number(document.getElementById('pay-amount').value),
                    payment_type: document.getElementById('pay-method').value,
                    payment_date: new Date().toISOString(),
                    note: document.getElementById('pay-note').value.trim() || null
                });
                closeModal();
                toast.success('บันทึกสำเร็จ');
                await load();
            } catch (err) {
                toast.error('บันทึกไม่สำเร็จ: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'บันทึกการชำระ';
            }
        });

        await load();
    }
};

export default paymentsPage;
