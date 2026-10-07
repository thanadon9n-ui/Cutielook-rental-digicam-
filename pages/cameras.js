import { toast } from '../components/toast.js';
import { cameraRepo } from '../repositories/cameras.js';

const camerasPage = {
    render: () => {
        return `
            <div class="max-w-5xl mx-auto space-y-6">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <h2 class="text-2xl font-bold">📷 กล้องและอุปกรณ์ของร้าน</h2>
                    <button id="add-camera-btn" class="btn">
                        <span class="text-lg">+</span> เพิ่มกล้องใหม่
                    </button>
                </div>
                
                <div class="card p-2 sm:p-4">
                    <input type="text" id="search-camera" class="inp" placeholder="ค้นหาชื่อกล้อง, รุ่น, หรือซีเรียลนัมเบอร์...">
                </div>

                <!-- รายการกล้องจะถูกแทรกลงในนี้ -->
                <div id="camera-list" class="space-y-3">
                    <div class="text-center text-gray-400 py-8 card">กำลังโหลดข้อมูล...</div>
                </div>
            </div>

            <!-- Modal สำหรับเพิ่ม/แก้ไขกล้อง -->
            <div id="camera-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 id="modal-title" class="text-xl font-bold">เพิ่มกล้องใหม่</h3>
                        <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                    </div>
                    <form id="camera-form" class="space-y-4">
                        <input type="hidden" id="cam-id">
                        
                        <div>
                            <label class="lb">ชื่อที่ใช้เรียก <span class="text-xs text-gray-400">(เช่น Canon IXY 900IS (ตัวที่ 1))</span> <span class="text-rose-500">*</span></label>
                            <input type="text" id="cam-name" required class="inp" placeholder="จำเป็นต้องใส่">
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="lb">รุ่น (Model)</label>
                                <input type="text" id="cam-model" class="inp" placeholder="ตัวเลือก">
                            </div>
                            <div>
                                <label class="lb">รหัสเครื่อง (Serial)</label>
                                <input type="text" id="cam-serial" class="inp" placeholder="ตัวเลือก">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="lb">ราคาเช่า/วัน (บาท) <span class="text-rose-500">*</span></label>
                                <input type="number" id="cam-price" required min="0" class="inp" placeholder="0">
                            </div>
                            <div>
                                <label class="lb">ราคาต้นทุน (บาท)</label>
                                <input type="number" id="cam-purchase" min="0" class="inp" placeholder="ตัวเลือก">
                            </div>
                        </div>
                        
                        <div>
                            <label class="lb">สถานะ</label>
                            <select id="cam-status" class="inp">
                                <option value="AVAILABLE">✅ พร้อมเช่า (AVAILABLE)</option>
                                <option value="MAINTENANCE">🔧 ส่งซ่อม (MAINTENANCE)</option>
                                <option value="INACTIVE">❌ ปิดการใช้งาน (INACTIVE)</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="lb">หมายเหตุ</label>
                            <input type="text" id="cam-note" class="inp" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)">
                        </div>
                        
                        <div class="pt-4 border-t flex gap-3 mt-6">
                            <button type="submit" id="save-cam-btn" class="btn flex-1">บันทึกข้อมูล</button>
                            <button type="button" id="cancel-cam-btn" class="btn btn-gray">ยกเลิก</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },
    afterRender: async () => {
        let cameras = [];
        
        // ฟังก์ชันโหลดข้อมูลกล้อง
        const loadCameras = async () => {
            try {
                cameras = await cameraRepo.getAll();
                renderList();
            } catch (err) {
                toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
            }
        };

        // ฟังก์ชันแสดงรายการกล้อง
        const renderList = () => {
            const listEl = document.getElementById('camera-list');
            const search = document.getElementById('search-camera').value.toLowerCase();
            
            const filtered = cameras.filter(c => 
                c.name.toLowerCase().includes(search) || 
                (c.model && c.model.toLowerCase().includes(search)) ||
                (c.serial_number && c.serial_number.toLowerCase().includes(search))
            );

            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="text-center text-gray-400 py-8 card">ไม่พบรายการกล้อง</div>';
                return;
            }

            listEl.innerHTML = filtered.map(c => {
                let statusBadge = '';
                if (c.status === 'AVAILABLE') statusBadge = '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full whitespace-nowrap">พร้อมเช่า</span>';
                if (c.status === 'MAINTENANCE') statusBadge = '<span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full whitespace-nowrap">ซ่อม/บำรุง</span>';
                if (c.status === 'INACTIVE') statusBadge = '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">ปิดใช้งาน</span>';
                if (c.status === 'RENTED') statusBadge = '<span class="px-2 py-0.5 bg-brand-light text-brand text-xs rounded-full whitespace-nowrap">กำลังถูกเช่า</span>';

                return `
                <div class="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 hover:border-pink-200 transition">
                    <div>
                        <div class="font-bold text-lg flex flex-wrap items-center gap-2">
                            ${escapeHtml(c.name)}
                            ${statusBadge}
                        </div>
                        <div class="text-xs text-gray-500 mt-1 flex flex-col sm:flex-row gap-1 sm:gap-3">
                            ${c.model ? `<span>รหัสรุ่น: ${escapeHtml(c.model)}</span>` : ''} 
                            ${c.serial_number ? `<span>S/N: ${escapeHtml(c.serial_number)}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end">
                        <div class="text-brand font-bold bg-pink-50 px-3 py-1 rounded-lg">${Number(c.price_per_day).toLocaleString('th-TH')} ฿/วัน</div>
                        <div class="flex gap-2">
                            <button class="text-sm text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition edit-btn" data-id="${c.camera_id}">แก้ไข</button>
                            <button class="text-sm text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition del-btn" data-id="${c.camera_id}">ลบ</button>
                        </div>
                    </div>
                </div>
            `}).join('');
        };

        const escapeHtml = (unsafe) => {
            return (unsafe || '').toString()
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        };

        // จับเหตุการณ์ค้นหา
        document.getElementById('search-camera').addEventListener('input', renderList);

        // ระบบ Modal
        const modal = document.getElementById('camera-modal');
        const form = document.getElementById('camera-form');
        
        const openModal = (cam = null) => {
            form.reset();
            document.getElementById('modal-title').textContent = cam ? '✏️ แก้ไขข้อมูลกล้อง' : '📷 เพิ่มกล้องใหม่';
            if (cam) {
                document.getElementById('cam-id').value = cam.camera_id;
                document.getElementById('cam-name').value = cam.name || '';
                document.getElementById('cam-model').value = cam.model || '';
                document.getElementById('cam-serial').value = cam.serial_number || '';
                document.getElementById('cam-price').value = cam.price_per_day || 0;
                document.getElementById('cam-purchase').value = cam.purchase_price || '';
                document.getElementById('cam-status').value = cam.status || 'AVAILABLE';
                document.getElementById('cam-note').value = cam.note || '';
            } else {
                document.getElementById('cam-id').value = '';
            }
            modal.classList.remove('hidden');
        };

        const closeModal = () => modal.classList.add('hidden');

        document.getElementById('add-camera-btn').addEventListener('click', () => openModal());
        document.getElementById('close-modal-btn').addEventListener('click', closeModal);
        document.getElementById('cancel-cam-btn').addEventListener('click', closeModal);

        // การบันทึกฟอร์ม (Submit)
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-cam-btn');
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';

            const id = document.getElementById('cam-id').value;
            const data = {
                name: document.getElementById('cam-name').value.trim(),
                model: document.getElementById('cam-model').value.trim() || null,
                serial_number: document.getElementById('cam-serial').value.trim() || null,
                price_per_day: parseFloat(document.getElementById('cam-price').value),
                purchase_price: document.getElementById('cam-purchase').value ? parseFloat(document.getElementById('cam-purchase').value) : null,
                status: document.getElementById('cam-status').value,
                note: document.getElementById('cam-note').value.trim() || null
            };

            try {
                if (id) {
                    await cameraRepo.update(id, data);
                } else {
                    await cameraRepo.add(data);
                }
                closeModal();
                toast.success('บันทึกสำเร็จ');
                await loadCameras();
            } catch (err) {
                toast.error('ไม่สามารถบันทึกได้: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'บันทึกข้อมูล';
            }
        });

        // กดปุ่มแก้ไข/ลบ (ใช้ Event Delegation)
        document.getElementById('camera-list').addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit-btn')) {
                const id = e.target.getAttribute('data-id');
                const cam = cameras.find(c => c.camera_id === id);
                if (cam) openModal(cam);
            }
            if (e.target.classList.contains('del-btn')) {
                const id = e.target.getAttribute('data-id');
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบกล้องนี้ทิ้ง?\n\n*ข้อแนะนำ: หากกล้องนี้เคยถูกเช่าไปแล้ว แนะนำให้กดยกเลิกและเข้าไป "แก้ไข" เปลี่ยนสถานะเป็น "ปิดการใช้งาน" แทนการลบ เพื่อไม่ให้ประวัติรายได้สูญหายครับ')) {
                    try {
                        const originalText = e.target.textContent;
                        e.target.textContent = 'กำลังลบ...';
                        await cameraRepo.delete(id);
                        await loadCameras();
                    } catch (err) {
                        toast.error('ลบไม่สำเร็จ (อาจมีการผูกข้อมูลการเช่าไว้แล้ว): ' + err.message);
                        await loadCameras(); // Reset UI
                    }
                }
            }
        });

        // โหลดข้อมูลครั้งแรก
        loadCameras();
    }
};

export default camerasPage;
