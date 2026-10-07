// คืนข้อความ error ภาษาไทย ถ้าผ่านคืน null
export function validateCustomer({ name, phone }) {
    if (!name || !name.trim()) return 'กรุณากรอกชื่อลูกค้า';
    if (!phone || !phone.trim()) return 'กรุณากรอกเบอร์โทร';
    return null;
}
export function validateRental({ start, end, cart, discount, shipping, deposit, customerId, rentalType, destProvince, originProvince, shipDays }) {
    if (!customerId) return 'กรุณาเลือกลูกค้า';
    if (!start || !end) return 'กรุณาเลือกวันเริ่มและวันคืน';
    if (end < start) return 'วันที่คืนต้องไม่ก่อนวันที่เริ่ม';
    if (!cart.length) return 'กรุณาเลือกกล้องอย่างน้อย 1 ตัว';
    if ([discount, shipping, deposit].some(n => n < 0)) return 'ส่วนลด ค่าจัดส่ง และมัดจำต้องไม่ติดลบ';
    if (rentalType === 'DELIVERY') {
        if (!originProvince) return 'กรุณาเลือกจังหวัดต้นทางสำหรับงานจัดส่ง';
        if (!destProvince) return 'กรุณาเลือกจังหวัดปลายทางสำหรับงานจัดส่ง';
        if (!Number.isInteger(shipDays) || shipDays < 0) return 'จำนวนวันส่งต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป';
    }
    return null;
}
export function validateAmount(n, label = 'จำนวนเงิน') {
    if (!(Number(n) > 0)) return `${label}ต้องมากกว่า 0`;
    return null;
}
