-- =====================================================================
-- policies.sql : Row Level Security (รันซ้ำได้)
-- เฉพาะผู้ที่ Login แล้วเท่านั้นจึงอ่าน/เขียนได้ คนทั่วไป (anon) ทำอะไรไม่ได้เลย
-- สำคัญ: ใน Supabase > Authentication > Providers > Email ให้ปิด "Allow new users to sign up"
--        เพื่อไม่ให้คนอื่นสมัครบัญชีแล้วเข้าข้อมูลร้านได้
-- =====================================================================
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['customers','cameras','rentals','rental_items','payments','deposits','expenses','settings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner_all_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow ALL to authenticated users on %1$s" ON %1$I', t);
    EXECUTE format('CREATE POLICY "owner_all_%1$s" ON %1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
