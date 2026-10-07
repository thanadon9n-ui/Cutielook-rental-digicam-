-- =====================================================================
-- Cutielook Digicam : schema.sql  (รันซ้ำได้ ไม่พังถ้ามีตารางอยู่แล้ว)
-- วิธีใช้: Supabase > SQL Editor > วางทั้งไฟล์ > Run
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
  customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, phone TEXT NOT NULL,
  instagram TEXT, line TEXT, address TEXT, note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cameras (
  camera_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, model TEXT, serial_number TEXT,
  price_per_day NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price_per_day >= 0),
  purchase_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE','RESERVED','RENTED','MAINTENANCE','INACTIVE')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rentals (
  rental_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(customer_id) ON DELETE RESTRICT,
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  rental_type TEXT NOT NULL CHECK (rental_type IN ('LOCAL','DELIVERY')),
  status TEXT NOT NULL DEFAULT 'BOOKED'
    CHECK (status IN ('BOOKED','PREPARING','READY','RENTED','RETURNED','CLOSED','CANCELLED')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  late_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
-- ค่าบริการอื่น (เพิ่มภายหลัง ใช้ ADD COLUMN IF NOT EXISTS เพื่อรองรับฐานข้อมูลเดิม)
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS other_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
-- การจัดส่งต่างจังหวัด: เก็บ "ผลคำนวณ ณ วันที่จอง" ไว้ในรายการ (เปลี่ยนกฎภายหลังจะไม่กระทบรายการเดิม)
--   dest_province      = จังหวัดปลายทาง
--   ship_days          = จำนวนวันที่ขนส่ง (ขาไปและขากลับใช้เท่ากัน)
--   ship_date          = วันที่ร้านต้องส่งของออก  (= start_date - ship_days)
--   return_arrive_date = วันที่ของคืนถึงร้าน     (= end_date + ship_days)  end_date คือวันที่ลูกค้าต้องส่งคืน
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS dest_province TEXT;
-- origin_province = จังหวัดต้นทางที่ส่งของออก (ปกติคือจังหวัดร้าน แต่เลือกเองได้ เช่น ลูกค้าส่งต่อกันเอง)
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS origin_province TEXT;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS ship_days INTEGER NOT NULL DEFAULT 0 CHECK (ship_days >= 0);
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS ship_date DATE;
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_arrive_date DATE;
-- ซ่อนรายการ (soft delete): ไม่ลบข้อมูลจริง เงินรับ/มัดจำที่บันทึกไว้ยังอยู่ครบ  NULL = แสดงปกติ
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS rental_items (
  rental_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID REFERENCES rentals(rental_id) ON DELETE CASCADE,
  camera_id UUID REFERENCES cameras(camera_id) ON DELETE RESTRICT,
  price_per_day NUMERIC(10,2) NOT NULL CHECK (price_per_day >= 0),
  days INTEGER NOT NULL CHECK (days >= 1),
  total NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID REFERENCES rentals(rental_id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('CASH','TRANSFER','OTHER')),
  payment_date TIMESTAMPTZ DEFAULT NOW(), note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposits (
  deposit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_id UUID UNIQUE REFERENCES rentals(rental_id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  returned_amount NUMERIC(10,2) DEFAULT 0,
  deducted_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PARTIAL','RETURNED','DEDUCTED')),
  returned_date TIMESTAMPTZ, note TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_date DATE NOT NULL, category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0), note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตั้งค่าระบบ (เช่น buffer_days)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rentals_dates ON rentals(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_items_camera ON rental_items(camera_id);
CREATE INDEX IF NOT EXISTS idx_payments_rental ON payments(rental_id);

-- ---------------------------------------------------------------------
-- กันคิวชน: ตรวจที่ฐานข้อมูลโดยตรง (ต่อให้เว็บมีบั๊กก็ยังจองซ้อนไม่ได้)
-- ชน = ช่วงใหม่ทับช่วงเดิม โดยขยายช่วงเดิมออกไปทั้งสองด้านตาม buffer_days
-- สถานะ CANCELLED / RETURNED / CLOSED ไม่นับว่าบล็อกกล้อง
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_camera_conflict()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  buf INTEGER; new_from DATE; new_to DATE; hit RECORD;
BEGIN
  SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key='buffer_days'),0) INTO buf;
  -- ช่วงที่กล้องไม่อยู่ร้าน: งานจัดส่ง = ตั้งแต่วันส่งออก ถึงวันที่ของคืนถึงร้าน, งานรับเอง = start_date ถึง end_date
  SELECT COALESCE(ship_date, start_date), COALESCE(return_arrive_date, end_date)
    INTO new_from, new_to FROM rentals WHERE rental_id = NEW.rental_id;
  SELECT COALESCE(r.ship_date, r.start_date) AS d_from, COALESCE(r.return_arrive_date, r.end_date) AS d_to INTO hit
  FROM rental_items i JOIN rentals r ON r.rental_id = i.rental_id
  WHERE i.camera_id = NEW.camera_id
    AND i.rental_id <> NEW.rental_id
    AND r.status NOT IN ('CANCELLED','RETURNED','CLOSED')
    AND new_from <= COALESCE(r.return_arrive_date, r.end_date) + buf
    AND new_to   >= COALESCE(r.ship_date, r.start_date) - buf
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'CAMERA_CONFLICT: กล้องมีคิวช่วง % - %', hit.d_from, hit.d_to;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_camera_conflict ON rental_items;
CREATE TRIGGER trg_camera_conflict BEFORE INSERT ON rental_items
FOR EACH ROW EXECUTE FUNCTION check_camera_conflict();

-- ---------------------------------------------------------------------
-- สร้างรายการเช่าทั้งก้อนใน transaction เดียว (ถ้าพังตรงไหน ยกเลิกทั้งหมด)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_rental(rental JSONB, items JSONB, deposit_amount NUMERIC DEFAULT 0)
RETURNS rentals LANGUAGE plpgsql AS $$
DECLARE new_rental rentals; it JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ต้องเข้าสู่ระบบก่อน'; END IF;
  INSERT INTO rentals (customer_id,start_date,end_date,rental_type,status,subtotal,discount,
                       shipping_fee,late_fee,other_fee,total,note,
                       dest_province,origin_province,ship_days,ship_date,return_arrive_date)
  VALUES ((rental->>'customer_id')::UUID,(rental->>'start_date')::DATE,(rental->>'end_date')::DATE,
          rental->>'rental_type','BOOKED',(rental->>'subtotal')::NUMERIC,
          COALESCE((rental->>'discount')::NUMERIC,0),COALESCE((rental->>'shipping_fee')::NUMERIC,0),
          0,COALESCE((rental->>'other_fee')::NUMERIC,0),(rental->>'total')::NUMERIC,rental->>'note',
          NULLIF(rental->>'dest_province',''),NULLIF(rental->>'origin_province',''),COALESCE((rental->>'ship_days')::INTEGER,0),
          NULLIF(rental->>'ship_date','')::DATE,NULLIF(rental->>'return_arrive_date','')::DATE)
  RETURNING * INTO new_rental;
  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    INSERT INTO rental_items (rental_id,camera_id,price_per_day,days,total)
    VALUES (new_rental.rental_id,(it->>'camera_id')::UUID,(it->>'price_per_day')::NUMERIC,
            (it->>'days')::INTEGER,(it->>'total')::NUMERIC);
  END LOOP;
  IF deposit_amount > 0 THEN
    INSERT INTO deposits (rental_id, amount, status) VALUES (new_rental.rental_id, deposit_amount, 'PENDING');
  END IF;
  RETURN new_rental;
END $$;

-- ---------------------------------------------------------------------
-- แก้ไขรายการเช่าที่สร้างแล้ว (วันที่ / ประเภท / จังหวัด / กล้อง / ราคา) ใน transaction เดียว
-- - ไม่แตะรายการรับเงิน (payments) และค่าปรับ (late_fee) ที่บันทึกไว้
-- - ลบรายการกล้องเดิมแล้วใส่ใหม่ เพื่อให้ trigger กันคิวชนตรวจซ้ำ (ไม่นับตัวเอง) ถ้าชนจะยกเลิกทั้งหมด
-- - แก้ได้เฉพาะสถานะ BOOKED / PREPARING / READY / RENTED
-- - มัดจำ: แก้ยอดได้เฉพาะที่ยังเป็น PENDING (คืน/หักไปแล้วจะไม่ถูกแตะ)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_rental(p_rental_id UUID, rental JSONB, items JSONB, deposit_amount NUMERIC DEFAULT 0)
RETURNS rentals LANGUAGE plpgsql AS $$
DECLARE cur rentals; upd rentals; it JSONB; dep_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ต้องเข้าสู่ระบบก่อน'; END IF;
  SELECT * INTO cur FROM rentals WHERE rental_id = p_rental_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการเช่านี้'; END IF;
  IF cur.status NOT IN ('BOOKED','PREPARING','READY','RENTED') THEN
    RAISE EXCEPTION 'NOT_EDITABLE: แก้ไขได้เฉพาะรายการที่ยังไม่คืน/ไม่ยกเลิก/ไม่ปิด';
  END IF;
  IF jsonb_array_length(items) = 0 THEN RAISE EXCEPTION 'ต้องมีกล้องอย่างน้อย 1 ตัว'; END IF;

  UPDATE rentals SET
    customer_id        = (rental->>'customer_id')::UUID,
    start_date         = (rental->>'start_date')::DATE,
    end_date           = (rental->>'end_date')::DATE,
    rental_type        = rental->>'rental_type',
    subtotal           = (rental->>'subtotal')::NUMERIC,
    discount           = COALESCE((rental->>'discount')::NUMERIC,0),
    shipping_fee       = COALESCE((rental->>'shipping_fee')::NUMERIC,0),
    other_fee          = COALESCE((rental->>'other_fee')::NUMERIC,0),
    total              = (rental->>'total')::NUMERIC,
    note               = rental->>'note',
    dest_province      = NULLIF(rental->>'dest_province',''),
    origin_province    = NULLIF(rental->>'origin_province',''),
    ship_days          = COALESCE((rental->>'ship_days')::INTEGER,0),
    ship_date          = NULLIF(rental->>'ship_date','')::DATE,
    return_arrive_date = NULLIF(rental->>'return_arrive_date','')::DATE
  WHERE rental_id = p_rental_id
  RETURNING * INTO upd;

  DELETE FROM rental_items WHERE rental_id = p_rental_id;
  FOR it IN SELECT * FROM jsonb_array_elements(items) LOOP
    INSERT INTO rental_items (rental_id,camera_id,price_per_day,days,total)
    VALUES (p_rental_id,(it->>'camera_id')::UUID,(it->>'price_per_day')::NUMERIC,
            (it->>'days')::INTEGER,(it->>'total')::NUMERIC);
  END LOOP;

  SELECT status INTO dep_status FROM deposits WHERE rental_id = p_rental_id;
  IF NOT FOUND THEN
    IF deposit_amount > 0 THEN
      INSERT INTO deposits (rental_id, amount, status) VALUES (p_rental_id, deposit_amount, 'PENDING');
    END IF;
  ELSIF dep_status = 'PENDING' THEN
    IF deposit_amount > 0 THEN UPDATE deposits SET amount = deposit_amount WHERE rental_id = p_rental_id;
    ELSE DELETE FROM deposits WHERE rental_id = p_rental_id; END IF;
  END IF;
  RETURN upd;
END $$;

-- updated_at อัตโนมัติ
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
DO $$ DECLARE tbl TEXT; BEGIN
  FOREACH tbl IN ARRAY ARRAY['customers','cameras','rentals'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', tbl);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', tbl);
  END LOOP;
END $$;
