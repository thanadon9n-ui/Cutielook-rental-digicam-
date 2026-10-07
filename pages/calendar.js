import { toast } from '../components/toast.js';
import { cameraRepo } from '../repositories/cameras.js';
import { settingsRepo } from '../repositories/settings.js';
import { rentalRepo } from '../repositories/rentals.js';
import { today, formatDateTH, toISODate } from '../utils/date.js';

const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const STATUS_COLOR = {
    BOOKED: 'bg-blue-500',
    PREPARING: 'bg-amber-500',
    READY: 'bg-teal-500',
    RENTED: 'bg-brand',
    RETURNED: 'bg-gray-400',
    CLOSED: 'bg-gray-300',
    CANCELLED: 'bg-gray-200 !text-gray-400'
};

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const calendarPage = {
    render: () => `
        <div class="max-w-6xl mx-auto space-y-4">
            <div class="card flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <button id="cal-prev" class="btn btn-gray !px-3 !py-2">‹</button>
                    <h2 id="cal-title" class="text-xl font-bold min-w-[200px] text-center">...</h2>
                    <button id="cal-next" class="btn btn-gray !px-3 !py-2">›</button>
                    <button id="cal-today" class="btn btn-gray !px-3 !py-2 text-sm">วันนี้</button>
                </div>
                <div class="flex flex-wrap gap-2 text-xs">
                    <span class="flex items-center gap-1.5"><i class="w-3 h-3 rounded-full inline-block bg-blue-500"></i> จอง</span>
                    <span class="flex items-center gap-1.5"><i class="w-3 h-3 rounded-full inline-block bg-amber-500"></i> เตรียม</span>
                    <span class="flex items-center gap-1.5"><i class="w-3 h-3 rounded-full inline-block bg-brand"></i> เช่าอยู่</span>
                    <span class="flex items-center gap-1.5"><i class="w-3 h-3 rounded-full inline-block bg-gray-400"></i> คืนแล้ว</span>
                </div>
            </div>

            <div class="card">
                <h3 class="font-bold mb-3">🔎 ตรวจกล้องว่าง</h3>
                <div class="flex flex-wrap gap-2 items-end">
                    <div><label class="lb">ตั้งแต่</label><input type="date" id="av-start" class="inp"></div>
                    <div><label class="lb">ถึง</label><input type="date" id="av-end" class="inp"></div>
                    <button id="av-check" class="btn">ตรวจสอบ</button>
                </div>
                <div id="av-result" class="mt-3 text-sm flex flex-wrap gap-2"></div>
            </div>

            <div class="bg-white rounded-2xl border overflow-hidden">
                <div class="overflow-x-auto">
                    <div class="min-w-[700px]">
                        <div class="grid grid-cols-7 bg-gray-50 border-b text-center py-2 text-sm font-semibold text-gray-600">
                            ${['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'].map((d, i) => 
                                `<div class="${i === 0 ? 'text-rose-500' : ''}">${d}</div>`).join('')}
                        </div>
                        <div id="cal-grid" class="grid grid-cols-7 gap-px bg-gray-200 min-h-[500px]">
                            <div class="col-span-7 text-center text-gray-400 py-10 bg-white">กำลังโหลด...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Rental Quick View -->
        <div id="cal-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
            <div id="cal-modal-box" class="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"></div>
        </div>
    `,

    afterRender: async () => {
        let rentals = [];
        const now = new Date();
        let viewYear = now.getFullYear();
        let viewMonth = now.getMonth();

        const loadRentals = async () => {
            try {
                rentals = await rentalRepo.getAll();
                renderCalendar();
            } catch (err) {
                console.error(err);
            }
        };

        const renderCalendar = () => {
            document.getElementById('cal-title').textContent =
                `${MONTH_NAMES[viewMonth]} ${viewYear + 543}`;

            const firstDay = new Date(viewYear, viewMonth, 1).getDay();
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            const todayStr = today();
            const grid = document.getElementById('cal-grid');
            let html = '';

            // ช่องว่างก่อนวันที่ 1
            for (let i = 0; i < firstDay; i++) {
                html += '<div class="bg-gray-50 min-h-[100px]"></div>';
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isToday = dateStr === todayStr;
                const dayRentals = rentals.filter(r => {
                    const b = rentalRepo.blockRange(r); // งานจัดส่ง = วันส่งออก ถึง วันของคืนถึงร้าน
                    return r.status !== 'CANCELLED' && dateStr >= b.from && dateStr <= b.to;
                });
                const events = dayRentals.flatMap(r =>
                    (r.rental_items || []).map(item => ({
                        rentalId: r.rental_id,
                        status: r.status,
                        name: item.cameras?.name || 'กล้อง',
                        custName: r.customers?.name || '-'
                    }))
                );

                html += `
                <div class="bg-white p-1.5 min-h-[100px] ${isToday ? 'ring-2 ring-inset ring-brand' : ''}">
                    <div class="text-sm font-bold ${isToday ? 'text-brand' : 'text-gray-700'} mb-1">${d}</div>
                    <div class="space-y-0.5">
                        ${events.slice(0, 3).map(ev => `
                            <div class="open-rental ${STATUS_COLOR[ev.status] || 'bg-gray-400'} text-white text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer"
                                data-rental-id="${ev.rentalId}" title="${esc(ev.name)} (${esc(ev.custName)})">
                                ${esc(ev.name)}
                            </div>`).join('')}
                        ${events.length > 3 ? `<div class="text-[10px] text-gray-400 text-center">+${events.length - 3} อื่นๆ</div>` : ''}
                    </div>
                </div>`;
            }
            grid.innerHTML = html;
        };

        document.getElementById('cal-prev').addEventListener('click', () => {
            viewMonth--;
            if (viewMonth < 0) { viewMonth = 11; viewYear--; }
            renderCalendar();
        });
        document.getElementById('cal-next').addEventListener('click', () => {
            viewMonth++;
            if (viewMonth > 11) { viewMonth = 0; viewYear++; }
            renderCalendar();
        });
        document.getElementById('cal-today').addEventListener('click', () => {
            viewYear = now.getFullYear();
            viewMonth = now.getMonth();
            renderCalendar();
        });

        // คลิกดูรายละเอียดใน calendar
        const calModal = document.getElementById('cal-modal');
        const calBox = document.getElementById('cal-modal-box');

        document.getElementById('cal-grid').addEventListener('click', (e) => {
            const btn = e.target.closest('.open-rental');
            if (!btn) return;
            const r = rentals.find(x => x.rental_id === btn.getAttribute('data-rental-id'));
            if (!r) return;
            calBox.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-lg">${esc(r.customers?.name || '-')}</h3>
                    <button class="close-cal-modal text-gray-400 text-xl">✕</button>
                </div>
                <div class="text-sm space-y-2">
                    <div><span class="text-gray-500">📞 โทร:</span> <a href="tel:${esc(r.customers?.phone)}" class="text-brand">${esc(r.customers?.phone)}</a></div>
                    <div><span class="text-gray-500">📅 ช่วงเช่า:</span> ${formatDateTH(r.start_date)} – ${formatDateTH(r.end_date)}</div>
                    <div><span class="text-gray-500">📷 กล้อง:</span> ${(r.rental_items || []).map(i => esc(i.cameras?.name || '-')).join(', ')}</div>
                    <div><span class="text-gray-500">ประเภท:</span> ${r.rental_type === 'LOCAL' ? '📍 นัดรับหน้าร้าน' : '🚚 จัดส่งต่างจังหวัด'}</div>
                    ${r.rental_type === 'DELIVERY' && r.dest_province ? `<div><span class="text-gray-500">🚚 ส่งไป:</span> ${esc(r.dest_province)} • ส่งออก ${formatDateTH(r.ship_date)} • ของถึงร้าน ${formatDateTH(r.return_arrive_date)}</div>` : ''}
                    ${r.note ? `<div><span class="text-gray-500">หมายเหตุ:</span> ${esc(r.note)}</div>` : ''}
                </div>`;
            calModal.classList.remove('hidden');
        });

        calModal.addEventListener('click', (e) => {
            if (e.target === calModal || e.target.closest('.close-cal-modal')) {
                calModal.classList.add('hidden');
            }
        });

        // ตรวจกล้องว่างในช่วงวันที่เลือก (รวม buffer day จาก Settings)
        document.getElementById('av-start').value = today();
        document.getElementById('av-end').value = today();
        document.getElementById('av-check').addEventListener('click', async () => {
            const s = document.getElementById('av-start').value, e = document.getElementById('av-end').value;
            const out = document.getElementById('av-result');
            if (!s || !e || e < s) { toast.error('วันที่คืนต้องไม่ก่อนวันที่เริ่ม'); return; }
            try {
                const [cams, buf] = await Promise.all([cameraRepo.getAll(), settingsRepo.getBufferDays()]);
                const free = [], busy = [];
                for (const c of cams.filter(c => c.status !== 'MAINTENANCE' && c.status !== 'INACTIVE')) {
                    (await rentalRepo.checkConflict(c.camera_id, s, e, null, buf) ? busy : free).push(c);
                }
                out.innerHTML = (free.map(c => `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">✅ ${esc(c.name)}</span>`).join('') +
                    busy.map(c => `<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-600">❌ ${esc(c.name)}</span>`).join('')) || 'ไม่มีกล้องในระบบ';
            } catch (err) { toast.error('ตรวจสอบไม่สำเร็จ: ' + err.message); }
        });

        await loadRentals();
    }
};

export default calendarPage;
