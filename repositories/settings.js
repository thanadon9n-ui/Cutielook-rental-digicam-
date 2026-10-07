import { supabase } from '../services/supabase.js';
import { DEFAULT_SHIPPING, normalizeConfig } from '../utils/shipping.js';

const parseJSON = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

export const settingsRepo = {
    async getBufferDays() {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'buffer_days').maybeSingle();
        if (error) throw error;
        return Number(data?.value) || 0;
    },
    async setBufferDays(n) {
        const { error } = await supabase.from('settings').upsert({ key: 'buffer_days', value: String(n) });
        if (error) throw error;
    },

    // ตั้งค่าการจัดส่ง: จังหวัดร้าน, ตัวคูณถนน, ขั้นระยะทาง->วัน, ค่าที่กำหนดทับรายจังหวัด
    async getShippingConfig() {
        const { data, error } = await supabase.from('settings').select('key, value')
            .in('key', ['ship_origin', 'ship_road_factor', 'ship_tiers', 'ship_overrides']);
        if (error) throw error;
        const m = Object.fromEntries((data || []).map(x => [x.key, x.value]));
        return normalizeConfig({
            origin: m.ship_origin,
            roadFactor: m.ship_road_factor,
            tiers: parseJSON(m.ship_tiers, DEFAULT_SHIPPING.tiers),
            overrides: parseJSON(m.ship_overrides, {})
        });
    },
    async setShippingConfig(cfg) {
        const c = normalizeConfig(cfg);
        const { error } = await supabase.from('settings').upsert([
            { key: 'ship_origin', value: c.origin },
            { key: 'ship_road_factor', value: String(c.roadFactor) },
            { key: 'ship_tiers', value: JSON.stringify(c.tiers) },
            { key: 'ship_overrides', value: JSON.stringify(c.overrides) }
        ]);
        if (error) throw error;
    }
};
