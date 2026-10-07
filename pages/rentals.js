import { toast } from '../components/toast.js';
import { settingsRepo } from '../repositories/settings.js';
import { validateRental, validateCustomer } from '../utils/validation.js';
import { rentalRepo } from '../repositories/rentals.js';
import { cameraRepo } from '../repositories/cameras.js';
import { customerRepo } from '../repositories/customers.js';
import { paymentRepo, depositRepo } from '../repositories/payments.js';
import { today, formatDateTH, daysBetween, toISODate, addDays } from '../utils/date.js';
import { PROVINCE_NAMES, calcShipping } from '../utils/shipping.js';
import { baht, calcTotal, calcPaid, calcRemaining, paymentStatus } from '../utils/money.js';

const STATUS_LABELS = {
    BOOKED: { label: 'จอง', color: 'bg-blue-100 text-blue-700' },
    PREPARING: { label: 'กำลังเตรียม', color: 'bg-amber-100 text-amber-700' },
    READY: { label: 'เตรียมแล้ว', color: 'bg-teal-100 text-teal-700' },
    RENTED: { label: 'เช่าอยู่', color: 'bg-brand-light text-brand' },
    RETURNED: { label: 'คืนแล้ว', color: 'bg-gray-100 text-gray-600' },
    CLOSED: { label: 'ปิดรายการ', color: 'bg-gray-200 text-gray-500' },
    CANCELLED: { label: 'ยกเลิก', color: 'bg-rose-100 text-rose-600' }
};

// สถานะที่แก้ไขวัน/จังหวัด/กล้องได้ (ตรงกับฟังก์ชัน update_rental ในฐานข้อมูล)
const EDITABLE = ['BOOKED', 'PREPARING', 'READY', 'RENTED'];

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const rentalsPage = {
    render: () => `
        <div class="max-w-6xl mx-auto space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-4">
                <h2 class="text-2xl font-bold">📋 รายการเช่า</h2>
                <button id="new-rental-btn" class="btn">+ สร้างรายการเช่าใหม่</button>
            </div>

            <div class="card flex flex-wrap gap-3">
                <input type="text" id="search-rental" class="inp flex-1 min-w-[200px]" placeholder="ค้นหาชื่อลูกค้า, เบอร์, กล้อง...">
                <select id="filter-status" class="inp !w-auto">
                    <option value="">ทุกสถานะ</option>
                    ${Object.entries(STATUS_LABELS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
                </select>
                <label class="flex items-center gap-2 text-sm text-gray-500 cursor-pointer"><input type="checkbox" id="show-hidden"> แสดงรายการที่ซ่อนไว้</label>
            </div>

            <div id="rentals-list" class="space-y-3">
                <div class="text-center text-gray-400 py-8 card">กำลังโหลดข้อมูล...</div>
            </div>
        </div>

        <!-- Rental Detail Modal -->
        <div id="rental-detail-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div id="rental-detail-box" class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"></div>
        </div>

        <!-- New Rental Modal -->
        <div id="new-rental-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-5">
                    <h3 id="rental-form-title" class="text-xl font-bold">📋 สร้างรายการเช่าใหม่</h3>
                    <button id="close-new-rental" class="text-gray-400 text-xl">✕</button>
                </div>
                <form id="new-rental-form" class="space-y-4">
                    <!-- ลูกค้า -->
                    <div>
                        <label class="lb">ลูกค้า <span class="text-rose-500">*</span></label>
                        <input type="text" id="r-cust-search" class="inp mb-2" placeholder="🔍 ค้นหาลูกค้าเดิมด้วยชื่อหรือเบอร์...">
                        <select id="r-customer" class="inp">
                            <option value="">-- เลือกลูกค้า --</option>
                        </select>
                        <button type="button" id="toggle-new-cust" class="text-brand text-sm mt-2">+ เพิ่มลูกค้าใหม่</button>
                        <div id="new-cust-box" class="hidden mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input id="nc-name" class="inp" placeholder="ชื่อลูกค้า *">
                            <input id="nc-phone" class="inp" placeholder="เบอร์โทร *">
                            <button type="button" id="nc-save" class="btn">บันทึกลูกค้า</button>
                        </div>
                    </div>
                    <!-- วันที่ -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="lb">วันเริ่มเช่า <span class="text-rose-500">*</span></label>
                            <input type="date" id="r-start" required class="inp">
                        </div>
                        <div>
                            <label class="lb">วันคืน <span class="text-rose-500">*</span></label>
                            <input type="date" id="r-end" required class="inp">
                        </div>
                    </div>
                    <!-- ประเภทการรับ -->
                    <div>
                        <label class="lb">ประเภทการรับ-คืน</label>
                        <div class="flex gap-3 mt-1">
                            <label class="flex-1 flex items-center gap-2 border-2 border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-pink-50">
                                <input type="radio" name="r-type" value="LOCAL" checked> <span>📍 นัดรับหน้าร้าน</span>
                            </label>
                            <label class="flex-1 flex items-center gap-2 border-2 border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-50">
                                <input type="radio" name="r-type" value="DELIVERY"> <span>🚚 จัดส่งต่างจังหวัด</span>
                            </label>
                        </div>
                    </div>
                    <!-- จัดส่งต่างจังหวัด: คำนวณวันส่งตามระยะทาง -->
                    <div id="delivery-box" class="hidden space-y-3 bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="lb">จังหวัดต้นทาง (ส่งของออกจาก) <span class="text-rose-500">*</span></label>
                                <select id="r-origin" class="inp">
                                    <option value="">-- เลือกจังหวัด --</option>
                                    ${PROVINCE_NAMES.map(n => `<option value="${n}">${n}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="lb">จังหวัดปลายทาง (ส่งไปที่) <span class="text-rose-500">*</span></label>
                                <select id="r-dest" class="inp">
                                    <option value="">-- เลือกจังหวัด --</option>
                                    ${PROVINCE_NAMES.map(n => `<option value="${n}">${n}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="lb">เวลาส่ง (วัน) <span class="text-xs text-gray-400">ระบบคำนวณให้ แก้เองได้</span></label>
                                <input type="number" id="r-ship-days" min="0" step="1" class="inp">
                            </div>
                        </div>
                        <div id="ship-info" class="text-sm text-gray-600 space-y-1"></div>
                    </div>
                    <!-- เพิ่มกล้อง -->
                    <div>
                        <label class="lb">กล้องที่เช่า <span class="text-rose-500">*</span></label>
                        <div class="flex gap-2 mb-2">
                            <select id="r-camera-select" class="inp flex-1">
                                <option value="">-- เลือกกล้อง --</option>
                            </select>
                            <button type="button" id="add-cam-to-cart" class="btn shrink-0">+ เพิ่ม</button>
                        </div>
                        <div id="rental-cart" class="bg-gray-50 border rounded-xl p-3 min-h-[60px] space-y-2">
                            <p class="text-gray-400 text-xs text-center">ยังไม่มีกล้องในรายการ</p>
                        </div>
                    </div>
                    <!-- ราคา -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label class="lb">ส่วนลด (฿)</label>
                            <input type="number" id="r-discount" min="0" value="0" class="inp">
                        </div>
                        <div>
                            <label class="lb">ค่าจัดส่ง (฿) <span class="text-xs text-gray-400">คิดตามจังหวัดให้ แก้เองได้</span></label>
                            <input type="number" id="r-shipping" min="0" value="0" class="inp">
                        </div>
                        <div>
                            <label class="lb">ค่าบริการอื่น (฿)</label>
                            <input type="number" id="r-other" min="0" value="0" class="inp">
                        </div>
                        <div>
                            <label class="lb">มัดจำ (฿)</label>
                            <input type="number" id="r-deposit" min="0" value="0" class="inp">
                        </div>
                    </div>
                    <!-- หมายเหตุ -->
                    <div>
                        <label class="lb">หมายเหตุ / ที่อยู่จัดส่ง</label>
                        <input type="text" id="r-note" class="inp">
                    </div>
                    <!-- สรุปราคา -->
                    <div class="bg-gray-50 border rounded-xl p-4">
                        <div class="flex justify-between text-sm mb-1"><span>ค่าเช่ารวม</span><span id="summary-subtotal">0 ฿</span></div>
                        <div class="flex justify-between text-sm mb-1 text-rose-500"><span>ส่วนลด</span><span id="summary-discount">0 ฿</span></div>
                        <div class="flex justify-between text-sm mb-1"><span>ค่าจัดส่ง</span><span id="summary-shipping">0 ฿</span></div>
                        <div class="flex justify-between font-bold text-brand border-t pt-2 mt-2"><span>ยอดรวม</span><span id="summary-total">0 ฿</span></div>
                        <div class="flex justify-between text-xs text-gray-500 mt-1"><span>เงินมัดจำ (ไม่นับเป็นรายได้)</span><span id="summary-deposit">0 ฿</span></div>
                    </div>

                    <div class="flex gap-3">
                        <button type="submit" id="save-rental-btn" class="btn flex-1">💾 บันทึกรายการเช่า</button>
                        <button type="button" id="cancel-rental-btn" class="btn btn-gray">ยกเลิก</button>
                    </div>
                </form>
            </div>
        </div>
    `,

    afterRender: async () => {
        let rentals = [];
        let cameras = [];
        let customers = [];
        let cart = []; // กล้องที่เลือกไว้ในฟอร์ม
        let bufferDays = 0;
        let shipCfg = null;          // ตั้งค่าการจัดส่งจากหน้าตั้งค่า
        let shipDaysManual = false;  // เจ้าของแก้จำนวนวันเองในฟอร์มนี้หรือไม่
        let shipFeeManual = false;   // เจ้าของแก้ค่าจัดส่งเองในฟอร์มนี้หรือไม่
        let editing = null;          // รายการที่กำลังแก้ไข (null = สร้างใหม่)

        // โหลดข้อมูลทั้งหมดพร้อมกัน
        const loadAll = async () => {
            try {
                [rentals, cameras, customers, bufferDays, shipCfg] = await Promise.all([
                    rentalRepo.getAll({ includeHidden: true }),
                    cameraRepo.getAll(),
                    customerRepo.getAll(),
                    settingsRepo.getBufferDays(),
                    settingsRepo.getShippingConfig()
                ]);
                renderRentals();
                populateForms();
            } catch (err) {
                toast.error('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
            }
        };

        // ใส่ข้อมูลลูกค้าและกล้องลงในฟอร์ม
        const populateForms = () => {
            const custSel = document.getElementById('r-customer');
            const kw = (document.getElementById('r-cust-search')?.value || '').toLowerCase();
            const prev = custSel.value;
            custSel.innerHTML = '<option value="">-- เลือกลูกค้า --</option>' +
                customers.filter(c => (c.name + c.phone).toLowerCase().includes(kw)).map(c => `<option value="${c.customer_id}">${esc(c.name)} (${esc(c.phone)})</option>`).join('');

            custSel.value = prev;
            const camSel = document.getElementById('r-camera-select');
            const availableCams = cameras.filter(c => c.status !== 'MAINTENANCE' && c.status !== 'INACTIVE');
            camSel.innerHTML = '<option value="">-- เลือกกล้อง --</option>' +
                availableCams.map(c => `<option value="${c.camera_id}" data-price="${c.price_per_day}">${esc(c.name)} (${baht(c.price_per_day)}/วัน)</option>`).join('');
        };

        // แสดงรายการเช่า
        const renderRentals = () => {
            const list = document.getElementById('rentals-list');
            const q = document.getElementById('search-rental').value.toLowerCase();
            const filterStatus = document.getElementById('filter-status').value;
            const showHidden = document.getElementById('show-hidden').checked;

            const filtered = rentals.filter(r => {
                const custName = r.customers?.name || '';
                const custPhone = r.customers?.phone || '';
                const camNames = (r.rental_items || []).map(i => i.cameras?.name || '').join(' ');
                const matchSearch = (custName + custPhone + camNames).toLowerCase().includes(q);
                const matchStatus = !filterStatus || r.status === filterStatus;
                const matchHidden = showHidden ? true : !r.deleted_at;
                return matchSearch && matchStatus && matchHidden;
            });

            if (!filtered.length) {
                list.innerHTML = '<div class="text-center text-gray-400 py-8 card">ไม่พบรายการ</div>';
                return;
            }

            list.innerHTML = filtered.map(r => {
                const st = STATUS_LABELS[r.status] || STATUS_LABELS.BOOKED;
                const paid = calcPaid(r.payments);
                const total = calcTotal(r);
                const remaining = total - paid;
                const pStatus = paymentStatus(r, r.payments);
                const cameras = (r.rental_items || []).map(i => esc(i.cameras?.name || '-')).join(', ');
                const isOverdue = r.status === 'RENTED' && (r.return_arrive_date || r.end_date) < today();

                return `
                <div class="card hover:border-pink-200 transition cursor-pointer p-4 view-rental-btn ${r.deleted_at ? 'opacity-60' : ''}" data-id="${r.rental_id}">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-wrap items-center gap-2 mb-1">
                                <span class="font-bold">${esc(r.customers?.name || 'ลูกค้าไม่ระบุ')}</span>
                                <span class="px-2 py-0.5 rounded-full text-xs ${st.color}">${st.label}</span>
                                ${r.deleted_at ? '<span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">🙈 ซ่อนอยู่</span>' : ''}
                                ${isOverdue ? '<span class="px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-600">⚠️ เลยกำหนด</span>' : ''}
                            </div>
                            <div class="text-sm text-gray-500">
                                📷 ${cameras || '-'}
                            </div>
                            <div class="text-xs text-gray-400 mt-1">
                                ${formatDateTH(r.start_date)} – ${formatDateTH(r.end_date)}
                                • ${r.rental_type === 'LOCAL' ? '📍 นัดรับ' : '🚚 จัดส่ง'}
                                ${r.rental_type === 'DELIVERY' && r.dest_province ? `${r.origin_province ? esc(r.origin_province) + ' ' : ''}→ ${esc(r.dest_province)} (ส่งออก ${formatDateTH(r.ship_date)})` : ''}
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="font-bold text-gray-800">${baht(total)}</div>
                            <div class="text-xs ${pStatus === 'PAID' ? 'text-emerald-600' : pStatus === 'PARTIAL' ? 'text-amber-600' : 'text-rose-500'}">
                                ${pStatus === 'PAID' ? '✅ ชำระครบ' : pStatus === 'PARTIAL' ? `⏳ ค้าง ${baht(remaining)}` : '❌ ยังไม่ชำระ'}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        };

        document.getElementById('search-rental').addEventListener('input', renderRentals);
        document.getElementById('filter-status').addEventListener('change', renderRentals);
        document.getElementById('show-hidden').addEventListener('change', renderRentals);

        // ---- รายละเอียดการเช่า ----
        const detailModal = document.getElementById('rental-detail-modal');
        const detailBox = document.getElementById('rental-detail-box');

        const openDetail = (rentalId) => {
            const r = rentals.find(x => x.rental_id === rentalId);
            if (!r) return;
            const paid = calcPaid(r.payments);
            const total = calcTotal(r);
            const remaining = total - paid;
            const dep = r.deposits;
            const st = STATUS_LABELS[r.status] || STATUS_LABELS.BOOKED;
            const nextStatuses = {
                BOOKED: 'PREPARING', PREPARING: 'READY', READY: 'RENTED',
                RENTED: 'RETURNED', RETURNED: 'CLOSED'
            };

            detailBox.innerHTML = `
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-xl font-bold">${esc(r.customers?.name || '-')}</h3>
                            <div class="text-sm text-gray-500">${esc(r.customers?.phone || '-')}</div>
                        </div>
                        <button class="text-gray-400 text-xl close-detail-btn">✕</button>
                    </div>

                    <div class="space-y-2 text-sm mb-4">
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ช่วงเช่า</span><span class="font-medium">${formatDateTH(r.start_date)} – ${formatDateTH(r.end_date)}</span></div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">จำนวนวัน</span><span class="font-medium">${daysBetween(r.start_date, r.end_date) + 1} วัน</span></div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ประเภท</span><span class="font-medium">${r.rental_type === 'LOCAL' ? '📍 นัดรับหน้าร้าน' : '🚚 จัดส่งต่างจังหวัด'}</span></div>
                        ${r.rental_type === 'DELIVERY' && r.dest_province ? `
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">เส้นทางจัดส่ง</span><span class="font-medium">${r.origin_province ? esc(r.origin_province) + ' → ' : ''}${esc(r.dest_province)} (ส่ง ${r.ship_days} วัน)</span></div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ส่งของออกวันที่</span><span class="font-medium">${formatDateTH(r.ship_date)}</span></div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ลูกค้าส่งคืนภายใน / ของถึงร้าน</span><span class="font-medium">${formatDateTH(r.end_date)} / ${formatDateTH(r.return_arrive_date)}</span></div>` : ''}
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">สถานะ</span><span class="px-2 py-0.5 rounded-full text-xs ${st.color}">${st.label}</span></div>
                        <div class="flex flex-col py-2 border-b gap-1"><span class="text-gray-500">กล้องที่เช่า</span>${(r.rental_items || []).map(i => `<span class="font-medium pl-2">• ${esc(i.cameras?.name || '-')} × ${i.days} วัน = ${baht(i.total)}</span>`).join('')}</div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ค่าเช่ารวม</span><span>${baht(r.subtotal)}</span></div>
                        ${Number(r.discount) > 0 ? `<div class="flex justify-between py-2 border-b text-rose-500"><span>ส่วนลด</span><span>-${baht(r.discount)}</span></div>` : ''}
                        ${Number(r.shipping_fee) > 0 ? `<div class="flex justify-between py-2 border-b"><span class="text-gray-500">ค่าจัดส่ง</span><span>${baht(r.shipping_fee)}</span></div>` : ''}
                        ${Number(r.late_fee) > 0 ? `<div class="flex justify-between py-2 border-b text-rose-500"><span>ค่าปรับ</span><span>${baht(r.late_fee)}</span></div>` : ''}
                        <div class="flex justify-between py-2 border-b font-bold"><span>ยอดรวมสุทธิ</span><span class="text-brand">${baht(total)}</span></div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ชำระแล้ว</span><span class="text-emerald-600">${baht(paid)}</span></div>
                        <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ค้างชำระ</span><span class="${remaining > 0 ? 'text-rose-500 font-bold' : 'text-emerald-600'}">${baht(remaining)}</span></div>
                        ${dep ? `<div class="flex justify-between py-2 border-b"><span class="text-gray-500">เงินมัดจำ</span><span>${baht(dep.amount)} (${dep.status === 'RETURNED' ? '✅ คืนแล้ว' : dep.status === 'DEDUCTED' ? '⚠️ หักแล้ว' : '⏳ ยังไม่คืน'})</span></div>` : ''}
                        ${r.note ? `<div class="flex flex-col py-2 border-b gap-1"><span class="text-gray-500">หมายเหตุ</span><span class="font-medium">${esc(r.note)}</span></div>` : ''}
                    </div>

                    <!-- ปุ่มชำระเงิน -->
                    <div class="mb-4">
                        <button class="w-full border border-brand text-brand py-2 rounded-xl text-sm font-semibold hover:bg-pink-50 transition pay-btn" data-id="${r.rental_id}">
                            💳 บันทึกการชำระเงิน
                        </button>
                    </div>

                    <!-- ปุ่มเปลี่ยนสถานะ -->
                    <div class="flex flex-wrap gap-2">
                        ${nextStatuses[r.status] ? `<button class="btn flex-1 change-status-btn" data-id="${r.rental_id}" data-status="${nextStatuses[r.status]}">→ ${STATUS_LABELS[nextStatuses[r.status]]?.label}</button>` : ''}
                        ${EDITABLE.includes(r.status) ? `<button class="btn btn-gray text-sm edit-rental-btn" data-id="${r.rental_id}">✏️ แก้ไข</button>` : ''}
                        ${r.status !== 'CANCELLED' && r.status !== 'CLOSED' ? `<button class="btn btn-gray text-sm late-fee-btn" data-id="${r.rental_id}">ค่าปรับ</button>` : ''}
                        ${r.status !== 'CANCELLED' && r.status !== 'CLOSED' ? `<button class="btn btn-red text-sm cancel-rental-btn" data-id="${r.rental_id}">ยกเลิก</button>` : ''}
                        ${r.status === 'CANCELLED' && !r.deleted_at ? `<button class="btn btn-gray text-sm hide-rental-btn" data-id="${r.rental_id}">🙈 ซ่อนรายการนี้</button>` : ''}
                        ${r.deleted_at ? `<button class="btn btn-green text-sm unhide-rental-btn" data-id="${r.rental_id}">↩️ แสดงรายการกลับ</button>` : ''}
                        ${dep && dep.status === 'PENDING' && r.status === 'RETURNED' ? `<button class="btn btn-green text-sm return-deposit-btn" data-id="${r.rental_id}">คืนมัดจำ</button>` : ''}
                    </div>
                </div>`;

            detailModal.classList.remove('hidden');
        };

        const closeDetail = () => detailModal.classList.add('hidden');

        // คลิกเปิดรายละเอียด
        document.getElementById('rentals-list').addEventListener('click', (e) => {
            const card = e.target.closest('.view-rental-btn');
            if (card) openDetail(card.getAttribute('data-id'));
        });

        // คลิกปุ่มใน modal รายละเอียด
        const handleDetail = async (e) => {
            if (e.target.closest('.close-detail-btn')) { closeDetail(); return; }

            // เปลี่ยนสถานะ
            const stBtn = e.target.closest('.change-status-btn');
            if (stBtn) {
                const id = stBtn.getAttribute('data-id');
                const newStatus = stBtn.getAttribute('data-status');
                const r = rentals.find(x => x.rental_id === id);
                if (confirm(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[newStatus]?.label}" ใช่หรือไม่?`)) {
                    await rentalRepo.updateStatus(id, newStatus);
                    toast.success('เปลี่ยนสถานะสำเร็จ');
                    closeDetail();
                    await loadAll();
                }
            }

            // ยกเลิกการเช่า
            const cancelBtn = e.target.closest('.cancel-rental-btn');
            if (cancelBtn) {
                if (confirm('ยกเลิกรายการเช่านี้? กล้องจะว่างทันที')) {
                    await rentalRepo.updateStatus(cancelBtn.getAttribute('data-id'), 'CANCELLED');
                    toast.success('ยกเลิกรายการเช่าแล้ว');
                    closeDetail();
                    await loadAll();
                }
            }

            // แก้ไขรายการเช่า
            const editBtn = e.target.closest('.edit-rental-btn');
            if (editBtn) {
                const r = rentals.find(x => x.rental_id === editBtn.getAttribute('data-id'));
                if (!r) return;
                closeDetail();
                openEdit(r);
                return;
            }

            // ซ่อนรายการเช่า (soft delete: ข้อมูลรับเงิน/มัดจำยังอยู่ครบ)
            const hideBtn = e.target.closest('.hide-rental-btn');
            if (hideBtn) {
                const rid = hideBtn.getAttribute('data-id');
                const r = rentals.find(x => x.rental_id === rid);
                if (!r || r.status !== 'CANCELLED') { toast.error('ซ่อนได้เฉพาะรายการที่ยกเลิกแล้ว'); return; }
                const paid = calcPaid(r.payments);
                let msg = `ซ่อนรายการของ "${r.customers?.name || '-'}"?\nรายการจะหายจากหน้านี้ แต่ข้อมูลไม่ถูกลบ เปิด "แสดงรายการที่ซ่อนไว้" เพื่อเอากลับมาได้`;
                if (paid > 0) msg += `\n\n💰 ยอดรับเงิน ${baht(paid)} ยังเก็บอยู่ในบัญชีตามเดิม`;
                if (!confirm(msg)) return;
                await rentalRepo.hide(rid);
                toast.success('ซ่อนรายการแล้ว');
                closeDetail();
                await loadAll();
            }

            // แสดงรายการที่ซ่อนกลับมา
            const unhideBtn = e.target.closest('.unhide-rental-btn');
            if (unhideBtn) {
                await rentalRepo.unhide(unhideBtn.getAttribute('data-id'));
                toast.success('แสดงรายการกลับมาแล้ว');
                closeDetail();
                await loadAll();
            }

            // บันทึกชำระเงิน
            const payBtn = e.target.closest('.pay-btn');
            if (payBtn) {
                const amount = prompt('จำนวนเงินที่ชำระ (บาท):');
                if (!amount || isNaN(amount) || Number(amount) <= 0) return;
                const method = prompt('วิธีชำระ: พิมพ์ CASH (เงินสด), TRANSFER (โอน), หรือ OTHER');
                if (!method) return;
                const m = method.trim().toUpperCase();
                if (!['CASH', 'TRANSFER', 'OTHER'].includes(m)) { toast.error('วิธีชำระต้องเป็น CASH, TRANSFER หรือ OTHER'); return; }
                await paymentRepo.add({
                    rental_id: payBtn.getAttribute('data-id'),
                    amount: Number(amount),
                    payment_type: m,
                    payment_date: new Date().toISOString()
                });
                toast.success('บันทึกการชำระเงินสำเร็จ');
                closeDetail();
                await loadAll();
            }

            // บันทึกค่าปรับ (ยอดรวมจะถูกคำนวณใหม่)
            const lateBtn = e.target.closest('.late-fee-btn');
            if (lateBtn) {
                const v = prompt('ค่าปรับ/ค่าเสียหายทั้งหมดของรายการนี้ (บาท):');
                if (v === null) return;
                if (isNaN(v) || Number(v) < 0) { toast.error('ค่าปรับต้องเป็นตัวเลขและไม่ติดลบ'); return; }
                const r = rentals.find(x => x.rental_id === lateBtn.getAttribute('data-id'));
                const updated = { ...r, late_fee: Number(v) };
                await rentalRepo.update(r.rental_id, { late_fee: Number(v), total: calcTotal(updated) });
                toast.success('บันทึกค่าปรับสำเร็จ');
                closeDetail();
                await loadAll();
            }

            // คืนมัดจำ
            const depBtn = e.target.closest('.return-deposit-btn');
            if (depBtn) {
                const rid = depBtn.getAttribute('data-id');
                const deduct = prompt('จำนวนที่หักไว้ (บาท) ถ้าไม่มีให้ใส่ 0:');
                if (deduct === null) return;
                const r = rentals.find(x => x.rental_id === rid);
                const dep = r.deposits;
                if (isNaN(deduct) || Number(deduct) < 0 || Number(deduct) > Number(dep.amount)) { toast.error('ยอดหักต้องไม่ติดลบ และไม่เกินเงินมัดจำ'); return; }
                const returnAmt = Number(dep.amount) - Number(deduct);
                const note = Number(deduct) > 0 ? prompt('เหตุผลที่หัก:') : null;
                if (Number(deduct) > 0 && !note) { toast.error('กรุณาระบุเหตุผลที่หัก'); return; }
                await depositRepo.update(rid, {
                    returned_amount: returnAmt,
                    deducted_amount: Number(deduct),
                    status: Number(deduct) > 0 ? 'DEDUCTED' : 'RETURNED',
                    returned_date: new Date().toISOString(),
                    note: note || null
                });
                toast.success('บันทึกการคืนมัดจำสำเร็จ');
                closeDetail();
                await loadAll();
            }
        };
        detailModal.addEventListener('click', (e) => handleDetail(e).catch(err => toast.error('ทำรายการไม่สำเร็จ: ' + err.message)));

        // ---- ฟอร์มสร้างรายการเช่าใหม่ ----
        const newModal = document.getElementById('new-rental-modal');
        const setFormMode = () => {
            document.getElementById('rental-form-title').textContent = editing ? '✏️ แก้ไขรายการเช่า' : '📋 สร้างรายการเช่าใหม่';
            document.getElementById('save-rental-btn').textContent = editing ? '💾 บันทึกการแก้ไข' : '💾 บันทึกรายการเช่า';
        };
        const openNew = () => {
            editing = null;
            cart = [];
            document.getElementById('new-rental-form').reset();
            document.getElementById('r-start').value = today();
            document.getElementById('r-end').value = today();
            document.getElementById('r-deposit').disabled = false;
            document.getElementById('r-origin').value = shipCfg?.origin || ''; // ต้นทางเริ่มต้น = จังหวัดร้าน เปลี่ยนได้
            shipDaysManual = false;
            shipFeeManual = false;
            setFormMode();
            syncDelivery();
            renderCart();
            populateForms();
            newModal.classList.remove('hidden');
        };
        // เปิดฟอร์มเดิมในโหมดแก้ไข: ใส่ค่าเดิมทั้งหมด ค่าที่เคยบันทึกไว้ (วันส่ง/ค่าส่ง) ไม่ถูกคำนวณทับจนกว่าจะเปลี่ยนจังหวัด
        const openEdit = (r) => {
            editing = r;
            document.getElementById('new-rental-form').reset();
            document.getElementById('r-cust-search').value = '';
            populateForms();
            document.getElementById('r-customer').value = r.customer_id || '';
            document.getElementById('r-start').value = r.start_date;
            document.getElementById('r-end').value = r.end_date;
            document.querySelector(`input[name="r-type"][value="${r.rental_type}"]`).checked = true;
            document.getElementById('r-origin').value = r.origin_province || shipCfg?.origin || '';
            document.getElementById('r-dest').value = r.dest_province || '';
            document.getElementById('r-ship-days').value = r.rental_type === 'DELIVERY' ? r.ship_days : '';
            document.getElementById('r-discount').value = Number(r.discount) || 0;
            document.getElementById('r-shipping').value = Number(r.shipping_fee) || 0;
            document.getElementById('r-other').value = Number(r.other_fee) || 0;
            document.getElementById('r-note').value = r.note || '';
            const dep = r.deposits;
            const depInput = document.getElementById('r-deposit');
            depInput.value = dep ? Number(dep.amount) : 0;
            depInput.disabled = !!dep && dep.status !== 'PENDING'; // คืน/หักมัดจำไปแล้วแก้ยอดไม่ได้
            // ใช้ราคา/วันที่บันทึกไว้เดิมของกล้องเดิม (กล้องที่เพิ่มใหม่จะใช้ราคาปัจจุบัน)
            cart = (r.rental_items || []).map(i => ({
                camera_id: i.cameras?.camera_id, name: i.cameras?.name || '-', price_per_day: Number(i.price_per_day)
            })).filter(i => i.camera_id);
            shipDaysManual = true;
            shipFeeManual = true;
            setFormMode();
            syncDelivery();
            renderCart();
            newModal.classList.remove('hidden');
        };
        const closeNew = () => newModal.classList.add('hidden');

        document.getElementById('new-rental-btn').addEventListener('click', openNew);
        document.getElementById('close-new-rental').addEventListener('click', closeNew);
        document.getElementById('cancel-rental-btn').addEventListener('click', closeNew);

        // ---- แผนการจัดส่ง ----
        const val = (id) => document.getElementById(id).value;
        const isDeliveryType = () => document.querySelector('input[name="r-type"]:checked').value === 'DELIVERY';

        // คืนช่วงที่กล้องไม่อยู่ร้าน (from-to) + วันส่งออก/วันของคืนถึงร้าน
        const getPlan = () => {
            const start = val('r-start'), end = val('r-end');
            const delivery = isDeliveryType();
            if (!delivery || !start || !end) return { delivery, from: start, to: end, shipDays: 0 };
            const raw = val('r-ship-days');
            const shipDays = raw === '' ? NaN : Number(raw);
            const d = Number.isInteger(shipDays) && shipDays >= 0 ? shipDays : 0;
            return {
                delivery, origin: val('r-origin'), dest: val('r-dest'), shipDays,
                shipDate: addDays(start, -d), arriveDate: addDays(end, d),
                from: addDays(start, -d), to: addDays(end, d)
            };
        };

        // แสดง/ซ่อนกล่องจัดส่ง และอัปเดตข้อความสรุป
        const syncDelivery = () => {
            const box = document.getElementById('delivery-box');
            const delivery = isDeliveryType();
            box.classList.toggle('hidden', !delivery);
            if (!delivery) return;
            const info = document.getElementById('ship-info');
            const start = val('r-start'), end = val('r-end');
            const plan = getPlan();
            const calc = plan.dest ? calcShipping(shipCfg, plan.dest, plan.origin) : null;
            const lines = [];

            if (!plan.origin) {
                lines.push('<div class="text-amber-600">⚠️ ยังไม่ได้เลือกจังหวัดต้นทาง จึงคำนวณอัตโนมัติไม่ได้ (ตั้งจังหวัดร้านไว้ที่ ตั้งค่า > การจัดส่ง เพื่อให้เลือกให้อัตโนมัติ) หรือกรอกจำนวนวันเอง</div>');
            } else if (calc) {
                lines.push(`<div>📏 ${esc(plan.origin)} → ${esc(plan.dest)} ประมาณ <b>${calc.km.toLocaleString()} กม.</b>${calc.kmSource === 'custom' ? ' (กำหนดเอง)' : ''} → ส่ง <b>${calc.days} วัน</b>${calc.daysSource === 'custom' ? ' (กำหนดเอง)' : ''} • ค่าจัดส่งตามอัตรา <b>${baht(calc.fee)}</b>${calc.feeSource === 'custom' ? ' (กำหนดเอง)' : ''}</div>`);
            }
            if (start && end && end >= start && Number.isInteger(plan.shipDays)) {
                lines.push(`<div>📦 ส่งของออกวันที่ <b>${formatDateTH(plan.shipDate)}</b> (ถึงลูกค้าวันที่ ${formatDateTH(start)})</div>`);
                lines.push(`<div>↩️ ลูกค้าส่งคืนภายใน <b>${formatDateTH(end)}</b> → ของถึงร้านประมาณ <b>${formatDateTH(plan.arriveDate)}</b></div>`);
                lines.push(`<div class="text-xs text-gray-500">🔒 กล้องจะถูกกันคิวตั้งแต่ ${formatDateTH(plan.from)} ถึง ${formatDateTH(plan.to)} (ไม่รวมวันเว้นว่างตามตั้งค่า)</div>`);
                if (plan.shipDate < today()) lines.push('<div class="text-rose-500">⚠️ วันส่งของออกผ่านมาแล้ว ส่งไม่ทันตามวันที่ลูกค้าต้องการ</div>');
            }
            info.innerHTML = lines.join('');
        };

        // เลือกจังหวัด -> ใส่จำนวนวันที่คำนวณได้ (ถ้าเจ้าของยังไม่แก้เอง)
        const recalcFromProvinces = () => {
            shipDaysManual = false;
            shipFeeManual = false;
            const calc = calcShipping(shipCfg, val('r-dest'), val('r-origin'));
            if (calc) {
                document.getElementById('r-ship-days').value = calc.days;
                document.getElementById('r-shipping').value = calc.fee; // ค่าจัดส่งตามจังหวัด (แก้เองได้)
            }
            renderCart();
            syncDelivery();
        };
        document.getElementById('r-dest').addEventListener('change', recalcFromProvinces);
        document.getElementById('r-origin').addEventListener('change', recalcFromProvinces);
        document.getElementById('r-shipping').addEventListener('input', () => { shipFeeManual = true; });
        document.getElementById('r-ship-days').addEventListener('input', () => { shipDaysManual = true; syncDelivery(); });
        document.querySelectorAll('input[name="r-type"]').forEach(el => el.addEventListener('change', syncDelivery));
        ['r-start', 'r-end'].forEach(id => document.getElementById(id).addEventListener('change', syncDelivery));

        // ฟังก์ชัน render ตะกร้ากล้อง
        const renderCart = () => {
            const cartEl = document.getElementById('rental-cart');
            const start = document.getElementById('r-start').value;
            const end = document.getElementById('r-end').value;
            const days = start && end && end >= start ? daysBetween(start, end) + 1 : 0;

            if (!cart.length) {
                cartEl.innerHTML = '<p class="text-gray-400 text-xs text-center py-2">ยังไม่มีกล้องในรายการ</p>';
                updateSummary(0);
                return;
            }
            let subtotal = 0;
            cartEl.innerHTML = cart.map((item, idx) => {
                const total = item.price_per_day * days;
                subtotal += total;
                return `<div class="flex items-center justify-between bg-white border rounded-lg p-2.5 text-sm">
                    <span class="font-medium">${esc(item.name)}</span>
                    <span class="flex items-center gap-2">
                        <span class="text-brand font-semibold">${baht(item.price_per_day)}/วัน × ${days} วัน = ${baht(total)}</span>
                        <button type="button" class="text-gray-400 hover:text-rose-500 remove-cart" data-idx="${idx}">✕</button>
                    </span>
                </div>`;
            }).join('');
            updateSummary(subtotal);
        };

        const updateSummary = (subtotal) => {
            const disc = Number(document.getElementById('r-discount').value) || 0;
            const ship = Number(document.getElementById('r-shipping').value) || 0;
            const dep = Number(document.getElementById('r-deposit').value) || 0;
            const other = Number(document.getElementById('r-other').value) || 0;
            document.getElementById('summary-subtotal').textContent = baht(subtotal);
            document.getElementById('summary-discount').textContent = baht(disc);
            document.getElementById('summary-shipping').textContent = baht(ship);
            document.getElementById('summary-total').textContent = baht(subtotal - disc + ship + other + (Number(editing?.late_fee) || 0));
            document.getElementById('summary-deposit').textContent = baht(dep);
        };

        // เพิ่มกล้องในตะกร้า
        document.getElementById('add-cam-to-cart').addEventListener('click', async () => {
            const sel = document.getElementById('r-camera-select');
            const camId = sel.value;
            const price = Number(sel.options[sel.selectedIndex]?.getAttribute('data-price') || 0);
            const camName = sel.options[sel.selectedIndex]?.text || '';
            const start = document.getElementById('r-start').value;
            const end = document.getElementById('r-end').value;

            if (!camId) { toast.error('กรุณาเลือกกล้องก่อน'); return; }
            if (!start || !end || end < start) { toast.error('กรุณาเลือกวันเริ่มและวันคืนให้ถูกต้องก่อน'); return; }
            if (cart.some(i => i.camera_id === camId)) { toast.error('เพิ่มกล้องตัวนี้ไว้แล้ว'); return; }

            // ตรวจสอบคิวชนกัน
            try {
                const plan = getPlan();
                const conflict = await rentalRepo.checkConflict(camId, plan.from, plan.to, editing?.rental_id || null, bufferDays);
                if (conflict) {
                    toast.error(`ไม่สามารถจองกล้องตัวนี้ได้ เนื่องจากมีคิวในช่วงเวลาดังกล่าว\n(${formatDateTH(conflict.start_date)} – ${formatDateTH(conflict.end_date)}, เว้นว่าง ${bufferDays} วัน)`);
                    return;
                }
            } catch (err) {
                console.error(err);
            }

            cart.push({ camera_id: camId, name: camName.split(' (')[0], price_per_day: price });
            sel.value = '';
            renderCart();
        });

        // ค้นหา / เพิ่มลูกค้าใหม่ในฟอร์ม
        document.getElementById('r-cust-search').addEventListener('input', populateForms);
        document.getElementById('toggle-new-cust').addEventListener('click', () => document.getElementById('new-cust-box').classList.toggle('hidden'));
        document.getElementById('nc-save').addEventListener('click', async () => {
            const name = document.getElementById('nc-name').value, phone = document.getElementById('nc-phone').value;
            const err = validateCustomer({ name, phone });
            if (err) { toast.error(err); return; }
            try {
                const c = await customerRepo.add({ name: name.trim(), phone: phone.trim() });
                customers.unshift(c);
                document.getElementById('r-cust-search').value = '';
                populateForms();
                document.getElementById('r-customer').value = c.customer_id;
                document.getElementById('new-cust-box').classList.add('hidden');
                toast.success('เพิ่มลูกค้าใหม่สำเร็จ');
            } catch (e) { toast.error('เพิ่มลูกค้าไม่สำเร็จ: ' + e.message); }
        });

        // ลบกล้องออกจากตะกร้า
        document.getElementById('rental-cart').addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-cart');
            if (btn) {
                cart.splice(Number(btn.getAttribute('data-idx')), 1);
                renderCart();
            }
        });

        // อัปเดตสรุปเมื่อเปลี่ยนวันหรือราคา
        ['r-start', 'r-end', 'r-discount', 'r-shipping', 'r-other', 'r-deposit'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', renderCart);
        });

        // Submit ฟอร์มสร้างรายการเช่า
        document.getElementById('new-rental-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const vErr = validateRental({
                customerId: document.getElementById('r-customer').value,
                start: document.getElementById('r-start').value, end: document.getElementById('r-end').value, cart,
                discount: Number(document.getElementById('r-discount').value) || 0,
                shipping: Number(document.getElementById('r-shipping').value) || 0,
                deposit: Number(document.getElementById('r-deposit').value) || 0,
                rentalType: isDeliveryType() ? 'DELIVERY' : 'LOCAL',
                destProvince: val('r-dest'),
                originProvince: val('r-origin'),
                shipDays: getPlan().shipDays
            });
            if (vErr) { toast.error(vErr); return; }

            const btn = document.getElementById('save-rental-btn');
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';

            const start = document.getElementById('r-start').value;
            const end = document.getElementById('r-end').value;
            const days = daysBetween(start, end) + 1;
            const discount = Number(document.getElementById('r-discount').value) || 0;
            const shipping = Number(document.getElementById('r-shipping').value) || 0;
            const depositAmt = Number(document.getElementById('r-deposit').value) || 0;
            const subtotal = cart.reduce((s, i) => s + i.price_per_day * days, 0);
            const other = Number(document.getElementById('r-other').value) || 0;
            const total = subtotal - discount + shipping + other + (Number(editing?.late_fee) || 0); // ค่าปรับที่บันทึกไว้เดิมยังนับอยู่

            // ตรวจสอบคิวชนอีกรอบก่อนบันทึก
            const plan = getPlan();
            for (const item of cart) {
                const conflict = await rentalRepo.checkConflict(item.camera_id, plan.from, plan.to, editing?.rental_id || null, bufferDays);
                if (conflict) {
                    toast.error(`⚠️ ${item.name} ถูกจองแล้วช่วง ${formatDateTH(conflict.start_date)} – ${formatDateTH(conflict.end_date)}`);
                    btn.disabled = false;
                    setFormMode();
                    return;
                }
            }

            const rentalData = {
                customer_id: document.getElementById('r-customer').value,
                start_date: start,
                end_date: end,
                rental_type: document.querySelector('input[name="r-type"]:checked').value,
                status: 'BOOKED',
                subtotal,
                discount,
                shipping_fee: shipping,
                other_fee: other,
                total,
                note: document.getElementById('r-note').value.trim() || null,
                dest_province: plan.delivery ? plan.dest : null,
                origin_province: plan.delivery ? plan.origin : null,
                ship_days: plan.delivery ? plan.shipDays : 0,
                ship_date: plan.delivery ? plan.shipDate : null,
                return_arrive_date: plan.delivery ? plan.arriveDate : null
            };

            const items = cart.map(i => ({
                camera_id: i.camera_id,
                price_per_day: i.price_per_day,
                days,
                total: i.price_per_day * days
            }));

            try {
                if (editing) {
                    await rentalRepo.edit(editing.rental_id, { rentalData, items, depositAmount: depositAmt });
                } else {
                    await rentalRepo.create({ rentalData, items, depositAmount: depositAmt });
                }
                const wasEdit = !!editing;
                cart = [];
                closeNew();
                toast.success(wasEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'บันทึกรายการเช่าสำเร็จ');
                await loadAll();
            } catch (err) {
                toast.error(err.message.includes('CAMERA_CONFLICT') ? 'ไม่สามารถจองกล้องตัวนี้ได้ เนื่องจากมีคิวในช่วงเวลาดังกล่าว' : err.message.includes('NOT_EDITABLE') ? 'รายการนี้แก้ไขไม่ได้แล้ว (คืน/ยกเลิก/ปิดรายการไปแล้ว)' : 'บันทึกไม่สำเร็จ: ' + err.message);
            } finally {
                btn.disabled = false;
                setFormMode();
            }
        });

        await loadAll();
    }
};

export default rentalsPage;
