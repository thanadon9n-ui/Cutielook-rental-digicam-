// คำนวณระยะทาง/จำนวนวันส่งของตามจังหวัด
// หลักการ: ระยะทางเส้นตรงระหว่างจังหวัด (พิกัดตัวเมือง) x ตัวคูณถนน = ระยะทางโดยประมาณ
// แล้วเทียบกับ "ขั้นระยะทาง" ที่เจ้าของร้านกำหนดเองในหน้าตั้งค่า (เช่น ตั้งแต่ 1000 กม. = 3 วัน)
// เจ้าของร้านแก้ทับรายจังหวัดได้ทั้งระยะทางและจำนวนวัน

// [ชื่อจังหวัด, ละติจูด, ลองจิจูด] ของตัวเมือง (ค่าประมาณ ใช้คำนวณระยะทางเท่านั้น)
export const PROVINCES = [
    ['กรุงเทพมหานคร', 13.7563, 100.5018], ['กระบี่', 8.0863, 98.9063], ['กาญจนบุรี', 14.0228, 99.5328],
    ['กาฬสินธุ์', 16.4322, 103.5061], ['กำแพงเพชร', 16.4828, 99.5227], ['ขอนแก่น', 16.4419, 102.8360],
    ['จันทบุรี', 12.6114, 102.1039], ['ฉะเชิงเทรา', 13.6904, 101.0779], ['ชลบุรี', 13.3611, 100.9847],
    ['ชัยนาท', 15.1852, 100.1251], ['ชัยภูมิ', 15.8068, 102.0316], ['ชุมพร', 10.4930, 99.1800],
    ['เชียงราย', 19.9105, 99.8406], ['เชียงใหม่', 18.7883, 98.9853], ['ตรัง', 7.5563, 99.6114],
    ['ตราด', 12.2428, 102.5175], ['ตาก', 16.8840, 99.1258], ['นครนายก', 14.2069, 101.2131],
    ['นครปฐม', 13.8199, 100.0620], ['นครพนม', 17.4108, 104.7785], ['นครราชสีมา', 14.9799, 102.0978],
    ['นครศรีธรรมราช', 8.4304, 99.9631], ['นครสวรรค์', 15.7047, 100.1372], ['นนทบุรี', 13.8591, 100.5217],
    ['นราธิวาส', 6.4255, 101.8253], ['น่าน', 18.7756, 100.7730], ['บึงกาฬ', 18.3609, 103.6464],
    ['บุรีรัมย์', 14.9930, 103.1029], ['ปทุมธานี', 14.0208, 100.5250], ['ประจวบคีรีขันธ์', 11.8124, 99.7973],
    ['ปราจีนบุรี', 14.0509, 101.3720], ['ปัตตานี', 6.8695, 101.2505], ['พระนครศรีอยุธยา', 14.3532, 100.5689],
    ['พะเยา', 19.1665, 99.9019], ['พังงา', 8.4509, 98.5255], ['พัทลุง', 7.6167, 100.0779],
    ['พิจิตร', 16.4429, 100.3487], ['พิษณุโลก', 16.8211, 100.2659], ['เพชรบุรี', 13.1112, 99.9447],
    ['เพชรบูรณ์', 16.4190, 101.1606], ['แพร่', 18.1446, 100.1410], ['ภูเก็ต', 7.8804, 98.3923],
    ['มหาสารคาม', 16.1832, 103.3003], ['มุกดาหาร', 16.5453, 104.7235], ['แม่ฮ่องสอน', 19.3020, 97.9654],
    ['ยโสธร', 15.7927, 104.1452], ['ยะลา', 6.5411, 101.2804], ['ร้อยเอ็ด', 16.0538, 103.6520],
    ['ระนอง', 9.9529, 98.6085], ['ระยอง', 12.6814, 101.2816], ['ราชบุรี', 13.5283, 99.8134],
    ['ลพบุรี', 14.7995, 100.6534], ['ลำปาง', 18.2888, 99.4908], ['ลำพูน', 18.5745, 99.0087],
    ['เลย', 17.4860, 101.7223], ['ศรีสะเกษ', 15.1186, 104.3220], ['สกลนคร', 17.1664, 104.1486],
    ['สงขลา', 7.1897, 100.5951], ['สตูล', 6.6238, 100.0674], ['สมุทรปราการ', 13.5991, 100.5968],
    ['สมุทรสงคราม', 13.4098, 100.0023], ['สมุทรสาคร', 13.5475, 100.2740], ['สระแก้ว', 13.8240, 102.0645],
    ['สระบุรี', 14.5289, 100.9101], ['สิงห์บุรี', 14.8936, 100.3967], ['สุโขทัย', 17.0056, 99.8264],
    ['สุพรรณบุรี', 14.4745, 100.1222], ['สุราษฎร์ธานี', 9.1382, 99.3217], ['สุรินทร์', 14.8818, 103.4936],
    ['หนองคาย', 17.8783, 102.7420], ['หนองบัวลำภู', 17.2218, 102.4260], ['อ่างทอง', 14.5896, 100.4551],
    ['อำนาจเจริญ', 15.8657, 104.6258], ['อุดรธานี', 17.4138, 102.7872], ['อุตรดิตถ์', 17.6200, 100.0993],
    ['อุทัยธานี', 15.3835, 100.0245], ['อุบลราชธานี', 15.2448, 104.8473]
].map(([name, lat, lng]) => ({ name, lat, lng }));

export const PROVINCE_NAMES = PROVINCES.map(p => p.name);

// ค่าตั้งต้น (เจ้าของร้านแก้ได้ในหน้าตั้งค่า > การจัดส่ง)
// ขั้นระยะทาง: ตั้งแต่ minKm ขึ้นไป ใช้เวลาส่ง days วัน และคิดค่าจัดส่ง fee บาท (ระบบเลือกขั้นที่ minKm สูงสุดที่ไม่เกินระยะทาง)
export const DEFAULT_SHIPPING = {
    origin: '',            // จังหวัดที่ตั้งร้าน (ต้องเลือกในหน้าตั้งค่า)
    roadFactor: 1.3,       // ตัวคูณจากระยะเส้นตรงเป็นระยะทางถนนโดยประมาณ
    tiers: [{ minKm: 0, days: 1, fee: 0 }, { minKm: 1000, days: 3, fee: 0 }],
    overrides: {}          // { 'ชื่อจังหวัด': { km?: number, days?: number, fee?: number } }
};

const R = 6371; // รัศมีโลก (กม.)
const rad = (d) => d * Math.PI / 180;

export function straightLineKm(a, b) {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

const byName = (name) => PROVINCES.find(p => p.name === name);

// ทำให้ค่าที่อ่านจากฐานข้อมูลปลอดภัยก่อนใช้ (กันค่าเพี้ยน/ว่าง)
export function normalizeConfig(raw = {}) {
    const tiers = (Array.isArray(raw.tiers) ? raw.tiers : DEFAULT_SHIPPING.tiers)
        .map(t => ({ minKm: Math.max(0, Number(t.minKm) || 0), days: Math.max(0, Math.round(Number(t.days) || 0)), fee: Math.max(0, Math.round(Number(t.fee) || 0)) }))
        .sort((x, y) => x.minKm - y.minKm);
    if (!tiers.length || tiers[0].minKm > 0) tiers.unshift({ minKm: 0, days: DEFAULT_SHIPPING.tiers[0].days, fee: 0 });
    const rf = Number(raw.roadFactor);
    return {
        origin: raw.origin || '',
        roadFactor: rf >= 1 && rf <= 3 ? rf : DEFAULT_SHIPPING.roadFactor,
        tiers,
        overrides: raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {}
    };
}

// ขั้นที่ตรงกับระยะทาง (ขั้นที่ minKm สูงสุดที่ไม่เกินระยะทาง)
export function tierForKm(km, tiers) {
    let hit = tiers[0];
    for (const t of tiers) if (km >= t.minKm) hit = t;
    return hit;
}

// จำนวนวันตามระยะทาง ตามขั้นที่เจ้าของร้านกำหนด
export function daysForKm(km, tiers) {
    return tierForKm(km, tiers).days;
}

// ค่าจัดส่ง (บาท) ตามระยะทาง ตามขั้นที่เจ้าของร้านกำหนด
export function feeForKm(km, tiers) {
    return tierForKm(km, tiers).fee || 0;
}

// ระยะทาง (กม.) จากจังหวัดร้านไปจังหวัดปลายทาง (ไม่รวมการกำหนดทับ)
export function estimateKm(origin, dest, roadFactor) {
    const a = byName(origin), b = byName(dest);
    if (!a || !b) return null;
    if (a.name === b.name) return 0;
    return Math.round(straightLineKm(a, b) * roadFactor);
}

// ผลลัพธ์รวม: { km, days, fee, kmSource, daysSource, feeSource } หรือ null ถ้ายังเลือกจังหวัดไม่ครบ
// origin = จังหวัดต้นทาง (ไม่ใส่ = ใช้จังหวัดร้านจากตั้งค่า)
// ค่า "กำหนดรายจังหวัดเอง" ตั้งไว้เทียบกับจังหวัดร้าน จึงใช้เฉพาะเมื่อต้นทาง = จังหวัดร้านเท่านั้น
export function calcShipping(config, dest, origin) {
    const cfg = normalizeConfig(config);
    const from = origin || cfg.origin;
    if (!from || !dest) return null;
    const est = estimateKm(from, dest, cfg.roadFactor);
    if (est === null) return null;
    const ov = (from === cfg.origin ? cfg.overrides[dest] : null) || {};
    const hasKm = ov.km !== undefined && ov.km !== null && ov.km !== '' && Number(ov.km) >= 0;
    const hasDays = ov.days !== undefined && ov.days !== null && ov.days !== '' && Number(ov.days) >= 0;
    const hasFee = ov.fee !== undefined && ov.fee !== null && ov.fee !== '' && Number(ov.fee) >= 0;
    const km = hasKm ? Math.round(Number(ov.km)) : est;
    const days = hasDays ? Math.round(Number(ov.days)) : daysForKm(km, cfg.tiers);
    const fee = hasFee ? Math.round(Number(ov.fee)) : feeForKm(km, cfg.tiers);
    return { km, days, fee, kmSource: hasKm ? 'custom' : 'auto', daysSource: hasDays ? 'custom' : 'auto', feeSource: hasFee ? 'custom' : 'auto' };
}
