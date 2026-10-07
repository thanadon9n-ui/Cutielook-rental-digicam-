// ดึงค่า URL และ Key มาจากตัวแปร CONFIG ใน config.js
const supabaseUrl = CONFIG.supabaseUrl;
const supabaseKey = CONFIG.supabaseKey;

// ตรวจสอบว่ามีการใส่ Key หรือยัง
if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
    console.warn('⚠️ ยังไม่ได้ตั้งค่า Supabase URL และ Key ในไฟล์ js/config.js');
}

// สร้างตัวเชื่อมต่อ Supabase
// (window.supabase ถูกโหลดมาจาก CDN ในหน้า index.html)
export const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
