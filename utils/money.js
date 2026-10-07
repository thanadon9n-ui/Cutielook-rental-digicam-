// ฟังก์ชันช่วยเหลือเรื่องเงิน

// แสดงตัวเลขแบบสกุลเงินบาท เช่น "1,500 ฿"
export function baht(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString('th-TH') + ' ฿';
}

// คำนวณยอดรวมทั้งหมดของรายการเช่า
// สูตร: subtotal - discount + shipping_fee + late_fee
export function calcTotal(rental) {
    const subtotal = Number(rental.subtotal) || 0;
    const discount = Number(rental.discount) || 0;
    const shipping = Number(rental.shipping_fee) || 0;
    const late = Number(rental.late_fee) || 0;
    const other = Number(rental.other_fee) || 0;
    return subtotal - discount + shipping + late + other;
}

// คำนวณยอดที่ชำระแล้วจาก array ของ payments
export function calcPaid(payments) {
    return (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

// คำนวณยอดคงเหลือที่ยังค้างชำระ
export function calcRemaining(rental, payments) {
    return calcTotal(rental) - calcPaid(payments);
}

// ระบุสถานะการชำระเงิน
export function paymentStatus(rental, payments) {
    const total = calcTotal(rental);
    const paid = calcPaid(payments);
    if (paid <= 0) return 'UNPAID';
    if (paid >= total) return 'PAID';
    return 'PARTIAL';
}
