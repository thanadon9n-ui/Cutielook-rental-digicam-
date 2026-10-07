import { supabase } from './supabase.js';

// ฟังก์ชันเข้าสู่ระบบ
export async function login(email, password) {
    if (!supabase) return { error: { message: 'Supabase is not initialized.' } };
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    return { data, error };
}

// ฟังก์ชันออกจากระบบ
export async function logout() {
    if (!supabase) return { error: null };
    const { error } = await supabase.auth.signOut();
    return { error };
}

// ตรวจสอบว่าใคร Login อยู่
export async function getSession() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Auth getSession Error:', error.message);
        return null;
    }
    return data.session;
}

// ติดตามสถานะ (เช่น ตอนถูกตัดออกจากระบบ หรือล็อกอินสำเร็จ)
export function onAuthStateChange(callback) {
    if (!supabase) return;
    supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
