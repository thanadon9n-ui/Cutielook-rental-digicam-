import { validateAmount } from '../utils/validation.js';
import { toast } from '../components/toast.js';
import { expenseRepo } from '../repositories/expenses.js';
import { today, formatDateTH } from '../utils/date.js';
import { baht } from '../utils/money.js';

const CATEGORIES = [
    'ค่าส่งพัสดุ',
    'ซ่อม / บำรุงรักษา',
    'ซื้ออุปกรณ์',
    'การตลาด',
    'ค่าแพ็กสินค้า',
    'ค่าเดินทาง',
    'ค่าธรรมเนียม',
    'อื่น ๆ'
];

const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const expensesPage = {
    render: () => `
        <div class="max-w-3xl mx-auto space-y-6">
            <h2 class="text-2xl font-bold">💸 บันทึกค่าใช้จ่าย</h2>

            <!-- ฟอร์มเพิ่มค่าใช้จ่าย -->
            <div class="card">
                <h3 class="font-bold mb-4">เพิ่มรายการใหม่</h3>
                <form id="expense-form" class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="lb">จำนวนเงิน (฿) <span class="text-rose-500">*</span></label>
                            <input type="number" id="exp-amount" required min="0.01" step="0.01" class="inp" placeholder="0.00">
                        </div>
                        <div>
                            <label class="lb">วันที่จ่าย <span class="text-rose-500">*</span></label>
                            <input type="date" id="exp-date" required class="inp">
                        </div>
                    </div>
                    <div>
                        <label class="lb">หมวดหมู่</label>
                        <select id="exp-category" class="inp">
                            ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="lb">รายละเอียด <span class="text-rose-500">*</span></label>
                        <input type="text" id="exp-note" required class="inp" placeholder="เช่น ค่าส่ง Ricoh GR ให้คุณพลอย, ค่าซ่อมเลนส์">
                    </div>
                    <button type="submit" id="save-exp-btn" class="btn btn-red w-full">+ บันทึกค่าใช้จ่าย</button>
                </form>
            </div>

            <!-- รายการค่าใช้จ่าย -->
            <div class="card">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 class="font-bold">รายการล่าสุด</h3>
                    <input type="text" id="search-exp" class="inp !w-52" placeholder="ค้นหา...">
                </div>
                <div id="expense-list" class="space-y-2">
                    <div class="text-center text-gray-400 py-6">กำลังโหลด...</div>
                </div>
            </div>
        </div>
    `,

    afterRender: async () => {
        let expenses = [];
        const esc = (s) => (s || '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        document.getElementById('exp-date').value = today();

        const load = async () => {
            expenses = await expenseRepo.getAll();
            renderList();
        };

        const renderList = () => {
            const q = document.getElementById('search-exp').value.toLowerCase();
            const list = document.getElementById('expense-list');
            const filtered = expenses.filter(e =>
                (e.note || '').toLowerCase().includes(q) ||
                (e.category || '').toLowerCase().includes(q)
            );

            if (!filtered.length) {
                list.innerHTML = '<div class="text-center text-gray-400 py-6">ไม่พบรายการค่าใช้จ่าย</div>';
                return;
            }

            list.innerHTML = filtered.map(e => `
                <div class="flex items-center justify-between p-3 bg-gray-50 border rounded-xl">
                    <div>
                        <div class="font-medium">${esc(e.note)}</div>
                        <div class="text-xs text-gray-400">${formatDateTH(e.expense_date)} • ${esc(e.category)}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-rose-500">-${baht(e.amount)}</span>
                        <button class="text-gray-400 hover:text-rose-500 del-exp-btn" data-id="${e.expense_id}">🗑</button>
                    </div>
                </div>`).join('');
        };

        document.getElementById('search-exp').addEventListener('input', renderList);

        document.getElementById('expense-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-exp-btn');
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';
            const vErr = validateAmount(document.getElementById('exp-amount').value, 'จำนวนเงิน');
            if (vErr) { toast.error(vErr); btn.disabled = false; btn.textContent = '+ บันทึกค่าใช้จ่าย'; return; }
            try {
                await expenseRepo.add({
                    expense_date: document.getElementById('exp-date').value,
                    category: document.getElementById('exp-category').value,
                    amount: Number(document.getElementById('exp-amount').value),
                    note: document.getElementById('exp-note').value.trim()
                });
                e.target.reset();
                document.getElementById('exp-date').value = today();
                toast.success('บันทึกค่าใช้จ่ายสำเร็จ');
                await load();
            } catch (err) {
                toast.error('บันทึกไม่สำเร็จ: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '+ บันทึกค่าใช้จ่าย';
            }
        });

        document.getElementById('expense-list').addEventListener('click', async (e) => {
            const btn = e.target.closest('.del-exp-btn');
            if (btn && confirm('ลบรายการค่าใช้จ่ายนี้?')) {
                try {
                    await expenseRepo.delete(btn.getAttribute('data-id'));
                    toast.success('ลบค่าใช้จ่ายแล้ว');
                    await load();
                } catch (err) { toast.error('ลบไม่สำเร็จ: ' + err.message); }
            }
        });

        await load();
    }
};

export default expensesPage;
