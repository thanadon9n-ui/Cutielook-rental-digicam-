// ป้ายสถานะสีต่าง ๆ ใช้ร่วมกันทุกหน้า
const MAP = {
    BOOKED: ['จอง', 'bg-blue-100 text-blue-700'],
    PREPARING: ['กำลังเตรียม', 'bg-amber-100 text-amber-700'],
    READY: ['เตรียมแล้ว', 'bg-teal-100 text-teal-700'],
    RENTED: ['เช่าอยู่', 'bg-brand-light text-brand'],
    RETURNED: ['คืนแล้ว', 'bg-gray-100 text-gray-600'],
    CLOSED: ['ปิดรายการ', 'bg-gray-200 text-gray-500'],
    CANCELLED: ['ยกเลิก', 'bg-rose-100 text-rose-600'],
    PAID: ['ชำระครบ', 'bg-emerald-100 text-emerald-700'],
    PARTIAL: ['ชำระบางส่วน', 'bg-amber-100 text-amber-700'],
    UNPAID: ['ยังไม่ชำระ', 'bg-rose-100 text-rose-600'],
};
export function statusBadge(status) {
    const [label, color] = MAP[status] || [status, 'bg-gray-100 text-gray-600'];
    return `<span class="px-2 py-0.5 rounded-full text-xs ${color}">${label}</span>`;
}
