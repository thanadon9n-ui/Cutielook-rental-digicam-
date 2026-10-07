import { supabase } from '../services/supabase.js';

export const cameraRepo = {
    // ดึงข้อมูลกล้องทั้งหมดเรียงตามวันที่สร้าง
    async getAll() {
        const { data, error } = await supabase
            .from('cameras')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // เพิ่มกล้องใหม่
    async add(cameraData) {
        const { data, error } = await supabase
            .from('cameras')
            .insert([cameraData])
            .select();
        if (error) throw error;
        return data[0];
    },

    // แก้ไขข้อมูลกล้อง
    async update(id, updates) {
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabase
            .from('cameras')
            .update(updates)
            .eq('camera_id', id)
            .select();
        if (error) throw error;
        return data[0];
    },

    // ลบกล้อง
    async delete(id) {
        const { error } = await supabase
            .from('cameras')
            .delete()
            .eq('camera_id', id);
        if (error) throw error;
        return true;
    }
};
