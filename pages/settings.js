import { toast } from '../components/toast.js';
import { supabase } from '../services/supabase.js';
import { rentalRepo } from '../repositories/rentals.js';
import { expenseRepo } from '../repositories/expenses.js';
import { settingsRepo } from '../repositories/settings.js';
import { calcTotal } from '../utils/money.js';
import { downloadFile, toCSV } from '../utils/format.js';
import { PROVINCE_NAMES, normalizeConfig, calcShipping } from '../utils/shipping.js';

// ตารางที่ต้อง Backup / Import (เรียงตามลำดับที่ต้องใส่ เพราะมี foreign key)
const TABLES = ['customers', 'cameras', 'rentals', 'rental_items', 'payments', 'deposits', 'expenses', 'settings'];
const stamp = () => new Date().toISOString().slice(0, 10);

const settingsPage = {
    render: () => `
        <div class="max-w-2xl mx-auto space-y-6">
            <h2 class="text-2xl font-bold">⚙️ ตั้งค่า</h2>

            <div class="card space-y-3">
                <h3 class="font-bold border-b pb-3">📅 Buffer Day (วันเว้นว่างระหว่างคิว)</h3>
                <p class="text-sm text-gray-500">จำนวนวันที่ต้องเว้นก่อน/หลังการเช่าแต่ละคิว เพื่อให้มีเวลาเช็กและทำความสะอาดกล้อง (0 = ไม่เว้น)</p>
                <div class="flex gap-3">
                    <input type="number" id="buffer-days" min="0" max="14" value="0" class="inp !w-32">
                    <button id="save-buffer-btn" class="btn">บันทึก</button>
                </div>
            </div>

            <div class="card space-y-4">
                <h3 class="font-bold border-b pb-3">🚚 การจัดส่งต่างจังหวัด (คำนวณวันส่งตามระยะทาง)</h3>
                <p class="text-sm text-gray-500">ระบบคำนวณระยะทางจากจังหวัดร้านไปจังหวัดปลายทาง แล้วดูว่าเข้า "ขั้น" ไหนเพื่อกำหนดวันส่ง ใช้ทั้งขาไปและขากลับ กล้องจะถูกกันคิวตั้งแต่วันส่งออกจนถึงวันที่ของคืนถึงร้าน</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="lb">จังหวัดที่ตั้งร้าน <span class="text-rose-500">*</span></label>
                        <select id="ship-origin" class="inp"><option value="">-- เลือกจังหวัด --</option>${PROVINCE_NAMES.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
                    </div>
                    <div>
                        <label class="lb">ตัวคูณระยะทางถนน</label>
                        <input type="number" id="ship-factor" min="1" max="3" step="0.05" class="inp">
                        <p class="text-xs text-gray-400 mt-1">ระยะเส้นตรง x ตัวคูณ = ระยะถนนโดยประมาณ (ค่าตั้งต้น 1.3)</p>
                    </div>
                </div>
                <div>
                    <label class="lb">กฎ: ระยะทาง → จำนวนวันส่ง + ค่าจัดส่ง</label>
                    <div id="tier-list" class="space-y-2"></div>
                    <button type="button" id="add-tier" class="text-brand text-sm mt-2">+ เพิ่มขั้น</button>
                </div>
                <details class="border rounded-xl p-3">
                    <summary class="cursor-pointer font-medium text-sm">กำหนดรายจังหวัดเอง (ไม่บังคับ) — ใช้เมื่อระยะ/วัน/ค่าส่งที่ระบบคำนวณไม่ตรงกับความจริง</summary>
                    <input type="text" id="prov-search" class="inp my-3" placeholder="ค้นหาจังหวัด...">
                    <div class="overflow-auto max-h-96">
                        <table class="w-full text-sm">
                            <thead class="sticky top-0 bg-white text-gray-500 text-xs"><tr>
                                <th class="text-left py-1">จังหวัด</th><th class="text-right">ระยะ (กม.)</th><th class="text-right">ส่ง (วัน)</th>
                                <th class="text-right">ค่าส่ง (฿)</th>
                                <th class="px-1">ตั้งกม.เอง</th><th class="px-1">ตั้งวันเอง</th><th class="px-1">ตั้งค่าส่งเอง</th>
                            </tr></thead>
                            <tbody id="prov-body"></tbody>
                        </table>
                    </div>
                </details>
                <button id="save-ship-btn" class="btn">💾 บันทึกการตั้งค่าการจัดส่ง</button>
            </div>

            <div class="card space-y-4">
                <h3 class="font-bold border-b pb-3">💾 Backup / Export ข้อมูล</h3>
                <p class="text-sm text-gray-500">ข้อมูลหลักอยู่ใน Supabase ออนไลน์ ไฟล์ Backup เป็นเพียงสำเนาสำรอง</p>
                <div class="flex flex-wrap gap-3">
                    <button id="export-json-btn" class="btn btn-green">⬇️ Export ข้อมูลทั้งหมด (JSON)</button>
                    <button id="export-csv-btn" class="btn btn-gray">⬇️ Export ประวัติเช่า (CSV)</button>
                    <button id="export-report-btn" class="btn btn-gray">⬇️ Export รายงานรายเดือน (CSV)</button>
                </div>
            </div>

            <div class="card space-y-3">
                <h3 class="font-bold border-b pb-3">⬆️ Import JSON (กู้ข้อมูลจากไฟล์ Backup)</h3>
                <p class="text-sm text-gray-500">ระบบจะ <b>เพิ่ม/อัปเดต</b> ข้อมูลตาม ID ในไฟล์ ไม่ลบข้อมูลที่มีอยู่ ใช้ไฟล์ที่ Export จากระบบนี้เท่านั้น</p>
                <input type="file" id="import-file" accept=".json,application/json" class="inp">
                <button id="import-btn" class="btn btn-gray">Import</button>
            </div>

            <div class="card space-y-3">
                <h3 class="font-bold border-b pb-3">ℹ️ ข้อมูลระบบ</h3>
                <div class="text-sm space-y-2">
                    <div class="flex justify-between py-2 border-b"><span class="text-gray-500">ชื่อระบบ</span><span class="font-medium">Cutielook Digicam</span></div>
                    <div class="flex justify-between py-2 border-b"><span class="text-gray-500">Database</span><span class="font-medium text-emerald-600">✅ Supabase (Online)</span></div>
                    <div class="flex justify-between py-2"><span class="text-gray-500">Version</span><span class="font-medium">1.0.0</span></div>
                </div>
            </div>

            <div class="card">
                <h3 class="font-bold border-b pb-3 mb-4">🚪 ออกจากระบบ</h3>
                <button id="settings-logout-btn" class="btn btn-red w-full">ออกจากระบบ</button>
            </div>
        </div>
    `,

    afterRender: async () => {
        const $ = (id) => document.getElementById(id);

        // ---- Buffer Day ----
        try { $('buffer-days').value = await settingsRepo.getBufferDays(); } catch (e) { toast.error('โหลดค่าตั้งต้นไม่สำเร็จ: ' + e.message); }
        $('save-buffer-btn').addEventListener('click', async () => {
            const n = Number($('buffer-days').value);
            if (!Number.isInteger(n) || n < 0 || n > 14) { toast.error('Buffer Day ต้องเป็นจำนวนเต็ม 0-14'); return; }
            try { await settingsRepo.setBufferDays(n); toast.success('บันทึกการตั้งค่าสำเร็จ'); }
            catch (e) { toast.error('บันทึกไม่สำเร็จ: ' + e.message); }
        });

        // ---- ตั้งค่าการจัดส่ง ----
        const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        let ship = normalizeConfig({});
        try { ship = await settingsRepo.getShippingConfig(); } catch (e) { toast.error('โหลดตั้งค่าการจัดส่งไม่สำเร็จ: ' + e.message); }
        $('ship-origin').value = ship.origin;
        $('ship-factor').value = ship.roadFactor;

        const renderTiers = () => {
            $('tier-list').innerHTML = ship.tiers.map((t, i) => `
                <div class="flex items-center gap-2 tier-row" data-i="${i}">
                    <span class="text-sm text-gray-500">ตั้งแต่</span>
                    <input type="number" min="0" step="1" value="${t.minKm}" class="inp !w-28 t-km" ${i === 0 ? 'disabled title="ขั้นแรกเริ่มที่ 0 กม. เสมอ"' : ''}>
                    <span class="text-sm text-gray-500">กม. ขึ้นไป → ส่ง</span>
                    <input type="number" min="0" step="1" value="${t.days}" class="inp !w-20 t-days">
                    <span class="text-sm text-gray-500">วัน ค่าส่ง</span>
                    <input type="number" min="0" step="1" value="${t.fee ?? 0}" class="inp !w-24 t-fee">
                    <span class="text-sm text-gray-500">฿</span>
                    ${i === 0 ? '' : '<button type="button" class="text-gray-400 hover:text-rose-500 del-tier">✕</button>'}
                </div>`).join('');
        };
        const calcCells = (name) => {
            const c = calcShipping(ship, name);
            return c ? { km: `${c.km.toLocaleString()}${c.kmSource === 'custom' ? '*' : ''}`, days: `${c.days}${c.daysSource === 'custom' ? '*' : ''}`, fee: `${c.fee.toLocaleString()}${c.feeSource === 'custom' ? '*' : ''}` } : { km: '-', days: '-', fee: '-' };
        };
        const renderProvinces = () => {
            const q = $('prov-search').value.trim();
            $('prov-body').innerHTML = PROVINCE_NAMES.filter(n => n.includes(q)).map(n => {
                const ov = ship.overrides[n] || {}, c = calcCells(n);
                return `<tr class="border-t prov-row" data-name="${esc(n)}">
                    <td class="py-1">${esc(n)}</td>
                    <td class="text-right c-km">${c.km}</td><td class="text-right c-days">${c.days}</td><td class="text-right c-fee">${c.fee}</td>
                    <td class="px-1"><input type="number" min="0" class="inp !py-1 !w-24 o-km" value="${esc(ov.km)}"></td>
                    <td class="px-1"><input type="number" min="0" step="1" class="inp !py-1 !w-20 o-days" value="${esc(ov.days)}"></td>
                    <td class="px-1"><input type="number" min="0" step="1" class="inp !py-1 !w-20 o-fee" value="${esc(ov.fee)}"></td>
                </tr>`;
            }).join('') || '<tr><td colspan="7" class="text-center text-gray-400 py-3">ไม่พบจังหวัด</td></tr>';
        };
        // อ่านค่าจากฟอร์มกลับเข้า state (ก่อนคำนวณใหม่/บันทึก)
        const readTiers = () => { ship.tiers = [...document.querySelectorAll('.tier-row')].map((row, i) => ({
            minKm: i === 0 ? 0 : Number(row.querySelector('.t-km').value), days: Number(row.querySelector('.t-days').value), fee: Number(row.querySelector('.t-fee').value) || 0 })); };
        const refreshAll = () => {
            ship.origin = $('ship-origin').value; ship.roadFactor = Number($('ship-factor').value) || 1.3;
            readTiers(); renderProvinces();
        };
        renderTiers(); renderProvinces();

        $('ship-origin').addEventListener('change', refreshAll);
        $('ship-factor').addEventListener('input', refreshAll);
        $('prov-search').addEventListener('input', renderProvinces);
        $('tier-list').addEventListener('input', refreshAll);
        $('tier-list').addEventListener('click', (e) => {
            const del = e.target.closest('.del-tier'); if (!del) return;
            readTiers(); ship.tiers.splice(Number(del.closest('.tier-row').dataset.i), 1); renderTiers(); refreshAll();
        });
        $('add-tier').addEventListener('click', () => {
            readTiers(); const last = ship.tiers[ship.tiers.length - 1];
            ship.tiers.push({ minKm: last.minKm + 500, days: last.days + 1, fee: last.fee || 0 }); renderTiers(); refreshAll();
        });
        $('prov-body').addEventListener('input', (e) => {
            const row = e.target.closest('.prov-row'); if (!row) return;
            ship.overrides[row.dataset.name] = { km: row.querySelector('.o-km').value, days: row.querySelector('.o-days').value, fee: row.querySelector('.o-fee').value };
            const c = calcCells(row.dataset.name);
            row.querySelector('.c-km').textContent = c.km; row.querySelector('.c-days').textContent = c.days; row.querySelector('.c-fee').textContent = c.fee;
        });
        $('save-ship-btn').addEventListener('click', async () => {
            refreshAll();
            if (!ship.origin) { toast.error('กรุณาเลือกจังหวัดที่ตั้งร้าน'); return; }
            if (!(ship.roadFactor >= 1 && ship.roadFactor <= 3)) { toast.error('ตัวคูณระยะทางต้องอยู่ระหว่าง 1 - 3'); return; }
            if (ship.tiers.some(t => !Number.isFinite(t.minKm) || t.minKm < 0 || !Number.isInteger(t.days) || t.days < 0 || !(t.fee >= 0))) { toast.error('ขั้นระยะทางต้องเป็นตัวเลข ไม่ติดลบ จำนวนวันเป็นจำนวนเต็ม และค่าจัดส่งไม่ติดลบ'); return; }
            if (new Set(ship.tiers.map(t => t.minKm)).size !== ship.tiers.length) { toast.error('มีขั้นระยะทางซ้ำกัน'); return; }
            const clean = {};
            for (const [n, o] of Object.entries(ship.overrides)) {
                const v = {};
                if (o.km !== '' && o.km !== undefined && Number(o.km) >= 0) v.km = Number(o.km);
                if (o.days !== '' && o.days !== undefined && Number(o.days) >= 0) v.days = Math.round(Number(o.days));
                if (o.fee !== '' && o.fee !== undefined && Number(o.fee) >= 0) v.fee = Math.round(Number(o.fee));
                if (Object.keys(v).length) clean[n] = v;
            }
            ship.overrides = clean;
            try { await settingsRepo.setShippingConfig(ship); ship = normalizeConfig(ship); renderTiers(); renderProvinces(); toast.success('บันทึกการตั้งค่าการจัดส่งสำเร็จ'); }
            catch (e) { toast.error('บันทึกไม่สำเร็จ: ' + e.message); }
        });

        // ---- Export JSON (ทุกตาราง) ----
        $('export-json-btn').addEventListener('click', async () => {
            try {
                const out = { app: 'cutielook-digicam', exported_at: new Date().toISOString() };
                for (const t of TABLES) {
                    const { data, error } = await supabase.from(t).select('*');
                    if (error) throw error;
                    out[t] = data;
                }
                downloadFile(`cutielook-backup-${stamp()}.json`, JSON.stringify(out, null, 2), 'application/json');
                toast.success('Export JSON สำเร็จ');
            } catch (e) { toast.error('Export ไม่สำเร็จ: ' + e.message); }
        });

        // ---- Export CSV ประวัติเช่า ----
        $('export-csv-btn').addEventListener('click', async () => {
            try {
                const rentals = await rentalRepo.getAll();
                const headers = ['rental_id', 'ชื่อลูกค้า', 'เบอร์', 'วันเริ่ม', 'วันคืน', 'ประเภท', 'สถานะ', 'กล้อง', 'ค่าเช่า', 'ส่วนลด', 'ค่าส่ง', 'ค่าปรับ', 'ค่าบริการอื่น', 'ยอดรวม', 'หมายเหตุ'];
                const rows = rentals.map(r => [r.rental_id, r.customers?.name, r.customers?.phone, r.start_date, r.end_date, r.rental_type, r.status,
                    (r.rental_items || []).map(i => i.cameras?.name || '').join(' | '),
                    r.subtotal, r.discount, r.shipping_fee, r.late_fee, r.other_fee, calcTotal(r), r.note]);
                downloadFile(`cutielook-rentals-${stamp()}.csv`, toCSV(headers, rows), 'text/csv;charset=utf-8');
                toast.success('Export CSV สำเร็จ');
            } catch (e) { toast.error('Export CSV ไม่สำเร็จ: ' + e.message); }
        });

        // ---- Export รายงานรายเดือน ----
        $('export-report-btn').addEventListener('click', async () => {
            try {
                const [rentals, expenses] = await Promise.all([rentalRepo.getAll(), expenseRepo.getAll()]);
                const months = {};
                const m = (k) => (months[k] ??= { rent: 0, late: 0, ship: 0, other: 0, exp: 0 });
                rentals.filter(r => r.status !== 'CANCELLED').forEach(r => {
                    const x = m(r.start_date.slice(0, 7));
                    x.rent += Number(r.subtotal) - Number(r.discount); x.late += Number(r.late_fee);
                    x.ship += Number(r.shipping_fee); x.other += Number(r.other_fee || 0);
                });
                expenses.forEach(e => { m(e.expense_date.slice(0, 7)).exp += Number(e.amount); });
                const rows = Object.keys(months).sort().map(k => {
                    const x = months[k]; const income = x.rent + x.late + x.ship + x.other;
                    return [k, x.rent, x.late, x.ship, x.other, income, x.exp, income - x.exp];
                });
                downloadFile(`cutielook-report-${stamp()}.csv`,
                    toCSV(['เดือน', 'ค่าเช่า(หลังหักส่วนลด)', 'ค่าปรับ', 'ค่าจัดส่ง', 'รายได้อื่น', 'รายได้รวม', 'ค่าใช้จ่าย', 'กำไรสุทธิ'], rows), 'text/csv;charset=utf-8');
                toast.success('Export รายงานสำเร็จ');
            } catch (e) { toast.error('Export รายงานไม่สำเร็จ: ' + e.message); }
        });

        // ---- Import JSON ----
        $('import-btn').addEventListener('click', async () => {
            const file = $('import-file').files[0];
            if (!file) { toast.error('กรุณาเลือกไฟล์ JSON ก่อน'); return; }
            if (!confirm('นำเข้าข้อมูลจากไฟล์นี้? ข้อมูลที่ ID ตรงกันจะถูกเขียนทับ')) return;
            try {
                const json = JSON.parse(await file.text());
                if (json.app !== 'cutielook-digicam') throw new Error('ไฟล์นี้ไม่ใช่ Backup ของระบบ Cutielook');
                let count = 0;
                for (const t of TABLES) {
                    const rows = json[t];
                    if (!Array.isArray(rows) || !rows.length) continue;
                    const { error } = await supabase.from(t).upsert(rows);
                    if (error) throw new Error(`ตาราง ${t}: ${error.message}`);
                    count += rows.length;
                }
                toast.success(`Import สำเร็จ ${count} แถว`);
            } catch (e) { toast.error('Import ไม่สำเร็จ: ' + e.message); }
        });

        $('settings-logout-btn').addEventListener('click', () => document.getElementById('logout-btn')?.click());
    }
};

export default settingsPage;
