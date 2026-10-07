import { supabase } from '../services/supabase.js';
import { addDays } from '../utils/date.js';

export const rentalRepo = {
    // ดึงรายการเช่าทั้งหมด พร้อมข้อมูลลูกค้าและรายการกล้อง
    // ค่าเริ่มต้น: ไม่รวมรายการที่ "ซ่อน" ไว้ (deleted_at) ส่ง { includeHidden: true } เพื่อดึงรวมที่ซ่อน
    async getAll({ includeHidden = false } = {}) {
        let q = supabase
            .from('rentals')
            .select(`
                *,
                customers ( customer_id, name, phone, instagram, line ),
                rental_items (
                    rental_item_id, price_per_day, days, total,
                    cameras ( camera_id, name, model )
                ),
                payments ( payment_id, amount, payment_type, payment_date, note ),
                deposits ( deposit_id, amount, returned_amount, deducted_amount, status, note )
            `)
            .order('created_at', { ascending: false });
        if (!includeHidden) q = q.is('deleted_at', null);
        const { data, error } = await q;
        if (error) throw error;
        return data;
    },

    // สร้างรายการเช่าใหม่ ผ่านฟังก์ชัน create_rental ในฐานข้อมูล (บันทึกทั้งก้อนหรือไม่บันทึกเลย)
    // ถ้าคิวชนจะ throw error ที่ขึ้นต้นด้วย CAMERA_CONFLICT
    async create({ rentalData, items, depositAmount }) {
        const { data, error } = await supabase.rpc('create_rental', {
            rental: rentalData, items, deposit_amount: depositAmount || 0
        });
        if (error) throw error;
        return data;
    },

    // อัปเดตสถานะการเช่า
    async updateStatus(id, status) {
        const { error } = await supabase
            .from('rentals')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('rental_id', id);
        if (error) throw error;
    },

    // แก้ไขรายการเช่าที่สร้างแล้ว (ผ่านฟังก์ชัน update_rental: atomic + ตรวจคิวชนซ้ำ ไม่แตะรายการรับเงิน)
    // ถ้าคิวชนจะ throw error ที่ขึ้นต้นด้วย CAMERA_CONFLICT
    async edit(id, { rentalData, items, depositAmount }) {
        const { data, error } = await supabase.rpc('update_rental', {
            p_rental_id: id, rental: rentalData, items, deposit_amount: depositAmount || 0
        });
        if (error) throw error;
        return data;
    },

    // ซ่อนรายการ (soft delete): ข้อมูลรับเงิน/มัดจำยังอยู่ครบในฐานข้อมูล ซ่อนได้เฉพาะรายการที่ยกเลิกแล้ว
    async hide(id) {
        const { error } = await supabase.from('rentals')
            .update({ deleted_at: new Date().toISOString() })
            .eq('rental_id', id).eq('status', 'CANCELLED');
        if (error) throw error;
    },

    // แสดงรายการที่ซ่อนไว้กลับมา
    async unhide(id) {
        const { error } = await supabase.from('rentals').update({ deleted_at: null }).eq('rental_id', id);
        if (error) throw error;
    },

    // อัปเดตข้อมูลการเช่า
    async update(id, data) {
        data.updated_at = new Date().toISOString();
        const { error } = await supabase
            .from('rentals')
            .update(data)
            .eq('rental_id', id);
        if (error) throw error;
    },

    // ช่วงที่กล้อง "ไม่อยู่ร้านจริง" ของรายการเช่า
    // งานจัดส่ง: วันส่งออก -> วันที่ของคืนถึงร้าน | งานรับเอง: วันเริ่ม -> วันคืน
    blockRange(r) {
        return { from: r.ship_date || r.start_date, to: r.return_arrive_date || r.end_date };
    },

    // ตรวจสอบกล้องว่างในช่วงวันที่กำหนด (startDate/endDate = ช่วงที่กล้องจะไม่อยู่ร้านของรายการใหม่)
    async checkConflict(cameraId, startDate, endDate, excludeRentalId = null, bufferDays = 0) {
        const { data, error } = await supabase
            .from('rental_items')
            .select('rental_id, rentals!inner(rental_id, start_date, end_date, ship_date, return_arrive_date, status)')
            .eq('camera_id', cameraId)
            .not('rentals.status', 'in', '(CANCELLED,RETURNED,CLOSED)');
        if (error) throw error;

        const conflicts = (data || []).filter(item => {
            const r = item.rentals;
            if (!r) return false;
            if (excludeRentalId && r.rental_id === excludeRentalId) return false;
            const b = rentalRepo.blockRange(r);
            return startDate <= addDays(b.to, bufferDays) && endDate >= addDays(b.from, -bufferDays);
        });

        if (!conflicts.length) return null;
        const b = rentalRepo.blockRange(conflicts[0].rentals);
        return { ...conflicts[0].rentals, start_date: b.from, end_date: b.to };
    }
};
