import { supabase } from '../services/supabase.js';

export const expenseRepo = {
    // ดึงข้อมูลค่าใช้จ่ายทั้งหมด
    async getAll() {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('expense_date', { ascending: false });
        if (error) throw error;
        return data;
    },

    // เพิ่มค่าใช้จ่าย
    async add(expenseData) {
        const { data, error } = await supabase
            .from('expenses')
            .insert([expenseData])
            .select();
        if (error) throw error;
        return data[0];
    },

    // ลบค่าใช้จ่าย
    async delete(id) {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('expense_id', id);
        if (error) throw error;
    }
};
