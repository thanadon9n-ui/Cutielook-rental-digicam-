import { toast } from '../components/toast.js';
import { customerRepo } from '../repositories/customers.js';

const customersPage = {
    render: () => {
        return `
            <div class="max-w-5xl mx-auto space-y-6">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <h2 class="text-2xl font-bold">👥 ข้อมูลลูกค้า</h2>
                    <button id="add-customer-btn" class="btn">
                        <span class="text-lg">+</span> เพิ่มลูกค้าใหม่
                    </button>
                </div>

                <div class="card p-2 sm:p-4">
                    <input type="text" id="search-customer" class="inp" placeholder="ค้นหาชื่อ, เบอร์โทร, Instagram, LINE...">
                </div>

                <div id="customer-list" class="space-y-3">
                    <div class="text-center text-gray-400 py-8 card">กำลังโหลดข้อมูล...</div>
                </div>
            </div>

            <!-- Modal เพิ่ม/แก้ไขลูกค้า -->
            <div id="customer-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 id="cust-modal-title" class="text-xl font-bold">เพิ่มลูกค้าใหม่</h3>
                        <button id="close-cust-modal" class="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                    </div>
                    <form id="customer-form" class="space-y-4">
                        <input type="hidden" id="cust-id">

                        <div class="grid grid-cols-2 gap-4">
                            <div class="col-span-2">
                                <label class="lb">ชื่อ-นามสกุล <span class="text-rose-500">*</span></label>
                                <input type="text" id="cust-name" required class="inp" placeholder="เช่น คุณพลอย วิริยะ">
                            </div>
                            <div>
                                <label class="lb">เบอร์โทร <span class="text-rose-500">*</span></label>
                                <input type="tel" id="cust-phone" required class="inp" placeholder="08x-xxx-xxxx">
                            </div>
                            <div>
                                <label class="lb">Instagram</label>
                                <input type="text" id="cust-instagram" class="inp" placeholder="@username">
                            </div>
                            <div>
                                <label class="lb">LINE ID</label>
                                <input type="text" id="cust-line" class="inp" placeholder="line_id">
                            </div>
                            <div>
                                <label class="lb">ที่อยู่จัดส่ง</label>
                                <input type="text" id="cust-address" class="inp" placeholder="สำหรับลูกค้าต่างจังหวัด">
                            </div>
                            <div class="col-span-2">
                                <label class="lb">หมายเหตุ</label>
                                <input type="text" id="cust-note" class="inp" placeholder="รายละเอียดเพิ่มเติม เช่น ลูกค้าประจำ, แจ้งล่วงหน้า 2 วัน">
                            </div>
                        </div>

                        <div class="pt-4 border-t flex gap-3">
                            <button type="submit" id="save-cust-btn" class="btn flex-1">บันทึกข้อมูล</button>
                            <button type="button" id="cancel-cust-btn" class="btn btn-gray">ยกเลิก</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        let customers = [];

        const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        const loadCustomers = async () => {
            try {
                customers = await customerRepo.getAll();
                renderList();
            } catch (err) {
                toast.error('เกิดข้อผิดพลาด: ' + err.message);
            }
        };

        const renderList = () => {
            const listEl = document.getElementById('customer-list');
            const q = document.getElementById('search-customer').value.toLowerCase();
            const filtered = customers.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.phone || '').toLowerCase().includes(q) ||
                (c.instagram || '').toLowerCase().includes(q) ||
                (c.line || '').toLowerCase().includes(q)
            );

            if (!filtered.length) {
                listEl.innerHTML = '<div class="text-center text-gray-400 py-8 card">ไม่พบข้อมูลลูกค้า</div>';
                return;
            }

            listEl.innerHTML = filtered.map(c => `
                <div class="card hover:border-pink-200 transition p-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold text-lg shrink-0">
                                ${esc(c.name[0] || '?')}
                            </div>
                            <div>
                                <div class="font-bold">${esc(c.name)}</div>
                                <div class="text-sm text-gray-500 flex flex-wrap gap-2 mt-0.5">
                                    <a href="tel:${esc(c.phone)}" class="hover:text-brand">📞 ${esc(c.phone)}</a>
                                    ${c.instagram ? `<span>📷 ${esc(c.instagram)}</span>` : ''}
                                    ${c.line ? `<span>💬 ${esc(c.line)}</span>` : ''}
                                </div>
                                ${c.note ? `<div class="text-xs text-gray-400 mt-1">📝 ${esc(c.note)}</div>` : ''}
                            </div>
                        </div>
                        <div class="flex gap-2 ml-auto">
                            <button class="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition edit-cust-btn" data-id="${c.customer_id}">แก้ไข</button>
                            <button class="text-sm text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition del-cust-btn" data-id="${c.customer_id}">ลบ</button>
                        </div>
                    </div>
                </div>
            `).join('');
        };

        document.getElementById('search-customer').addEventListener('input', renderList);

        const modal = document.getElementById('customer-modal');
        const form = document.getElementById('customer-form');

        const openModal = (c = null) => {
            form.reset();
            document.getElementById('cust-modal-title').textContent = c ? '✏️ แก้ไขข้อมูลลูกค้า' : '👥 เพิ่มลูกค้าใหม่';
            if (c) {
                document.getElementById('cust-id').value = c.customer_id;
                document.getElementById('cust-name').value = c.name || '';
                document.getElementById('cust-phone').value = c.phone || '';
                document.getElementById('cust-instagram').value = c.instagram || '';
                document.getElementById('cust-line').value = c.line || '';
                document.getElementById('cust-address').value = c.address || '';
                document.getElementById('cust-note').value = c.note || '';
            } else {
                document.getElementById('cust-id').value = '';
            }
            modal.classList.remove('hidden');
        };

        const closeModal = () => modal.classList.add('hidden');

        document.getElementById('add-customer-btn').addEventListener('click', () => openModal());
        document.getElementById('close-cust-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-cust-btn').addEventListener('click', closeModal);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-cust-btn');
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';
            const id = document.getElementById('cust-id').value;
            const data = {
                name: document.getElementById('cust-name').value.trim(),
                phone: document.getElementById('cust-phone').value.trim(),
                instagram: document.getElementById('cust-instagram').value.trim() || null,
                line: document.getElementById('cust-line').value.trim() || null,
                address: document.getElementById('cust-address').value.trim() || null,
                note: document.getElementById('cust-note').value.trim() || null
            };
            try {
                if (id) {
                    await customerRepo.update(id, data);
                } else {
                    await customerRepo.add(data);
                }
                closeModal();
                toast.success('บันทึกสำเร็จ');
                await loadCustomers();
            } catch (err) {
                toast.error('บันทึกไม่สำเร็จ: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'บันทึกข้อมูล';
            }
        });

        document.getElementById('customer-list').addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-cust-btn');
            const delBtn = e.target.closest('.del-cust-btn');
            if (editBtn) {
                const c = customers.find(x => x.customer_id === editBtn.getAttribute('data-id'));
                if (c) openModal(c);
            }
            if (delBtn) {
                if (confirm('ลบลูกค้ารายนี้? (จะลบได้เฉพาะกรณีที่ยังไม่มีประวัติการเช่า)')) {
                    try {
                        await customerRepo.delete(delBtn.getAttribute('data-id'));
                        await loadCustomers();
                    } catch (err) {
                        toast.error('ลบไม่สำเร็จ เนื่องจากลูกค้ารายนี้มีประวัติการเช่าอยู่ในระบบ');
                    }
                }
            }
        });

        await loadCustomers();
    }
};

export default customersPage;
