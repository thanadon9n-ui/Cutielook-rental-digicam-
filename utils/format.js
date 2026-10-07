// ป้องกัน HTML injection เมื่อนำข้อความจากผู้ใช้ไปแสดงในหน้าเว็บ
export const esc = (s) => (s ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// สร้างและดาวน์โหลดไฟล์
export function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ทำ CSV อย่างปลอดภัย (กัน Excel formula injection)
export function toCSV(headers, rows) {
    const q = (v) => {
        let s = String(v ?? '');
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
    };
    return '\uFEFF' + [headers, ...rows].map(r => r.map(q).join(',')).join('\n');
}
