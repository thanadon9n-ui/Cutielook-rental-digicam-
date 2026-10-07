// ฟังก์ชันช่วยเหลือเรื่องวันที่

// แปลงวันที่จาก Date Object เป็น "YYYY-MM-DD"
export function toISODate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// วันที่วันนี้ในรูปแบบ "YYYY-MM-DD"
export function today() {
    return toISODate(new Date());
}

// แปลง "YYYY-MM-DD" เป็น Date Object
export function parseDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// แสดงวันที่แบบไทย เช่น "7 ต.ค. 2568"
export function formatDateTH(str) {
    if (!str) return '-';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const d = parseDate(str);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// แสดงชื่อเดือนไทย เช่น "ตุลาคม 2568"
export function formatMonthTH(ym) {
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const [y, m] = ym.split('-').map(Number);
    return `${months[m - 1]} ${y + 543}`;
}

// คำนวณจำนวนวันระหว่างสองวัน (endDate - startDate)
export function daysBetween(startStr, endStr) {
    const start = parseDate(startStr);
    const end = parseDate(endStr);
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

// เพิ่มวันเข้าไปจากวันที่ที่กำหนด
export function addDays(str, n) {
    const d = parseDate(str);
    d.setDate(d.getDate() + n);
    return toISODate(d);
}
