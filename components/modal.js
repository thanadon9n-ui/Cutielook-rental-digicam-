// เปิด/ปิด Modal ที่เป็น div แบบ fixed ซ่อนด้วยคลาส hidden
export const openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
export const closeModal = (id) => document.getElementById(id)?.classList.add('hidden');
