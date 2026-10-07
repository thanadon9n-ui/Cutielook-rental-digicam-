-- seed.sql : ใส่เฉพาะ "ค่าตั้งต้นของระบบ" เท่านั้น (ไม่มีข้อมูลปลอมลูกค้า/กล้อง/รายได้)
INSERT INTO settings (key, value) VALUES ('buffer_days', '0')
ON CONFLICT (key) DO NOTHING;
