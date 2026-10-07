import { supabase } from '../services/supabase.js';

export const customerRepo = {
    // ดึงข้อมูลลูกค้าทั้งหมด
    async getAll() {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // เพิ่มลูกค้าใหม่
    async add(customerData) {
        const { data, error } = await supabase
            .from('customers')
            .insert([customerData])
            .select();
        if (error) throw error;
        return data[0];
    },

    // แก้ไขข้อมูลลูกค้า
    async update(id, updates) {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('customer_id', id)
            .select();
        if (error) throw error;
        return data[0];
    },

    // ลบลูกค้า (ลบได้เฉพาะกรณีที่ไม่เคยมีประวัติการเช่า)
    async delete(id) {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('customer_id', id);
        if (error) throw error;
        return true;
    }
};
