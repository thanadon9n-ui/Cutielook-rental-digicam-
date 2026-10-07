import { supabase } from '../services/supabase.js';

export const paymentRepo = {
    // เพิ่มการชำระเงิน
    async add(paymentData) {
        const { data, error } = await supabase
            .from('payments')
            .insert([paymentData])
            .select();
        if (error) throw error;
        return data[0];
    },

    // ดึงประวัติการชำระเงินของรายการเช่า
    async getByRental(rentalId) {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('rental_id', rentalId)
            .order('payment_date', { ascending: false });
        if (error) throw error;
        return data;
    },

    // ลบการชำระเงิน
    async delete(id) {
        const { error } = await supabase
            .from('payments')
            .delete()
            .eq('payment_id', id);
        if (error) throw error;
    }
};

export const depositRepo = {
    // อัปเดตข้อมูลมัดจำ
    async update(rentalId, data) {
        const { error } = await supabase
            .from('deposits')
            .update(data)
            .eq('rental_id', rentalId);
        if (error) throw error;
    },

    // ดึงข้อมูลมัดจำของรายการเช่า
    async getByRental(rentalId) {
        const { data, error } = await supabase
            .from('deposits')
            .select('*')
            .eq('rental_id', rentalId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
};
