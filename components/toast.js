// แจ้งเตือนมุมจอ: toast.success('บันทึกสำเร็จ') / toast.error('ผิดพลาด')
function show(msg, bg) {
    let box = document.getElementById('toast-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toast-box';
        box.className = 'fixed top-4 right-4 left-4 sm:left-auto z-[100] space-y-2 pointer-events-none';
        document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `${bg} text-white text-sm px-4 py-3 rounded-xl shadow-lg whitespace-pre-line pointer-events-auto`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}
export const toast = {
    success: (m) => show(m, 'bg-emerald-500'),
    error: (m) => show(m, 'bg-rose-500'),
    info: (m) => show(m, 'bg-gray-700'),
};
