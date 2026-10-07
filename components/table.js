// ตารางที่เลื่อนแนวนอนได้บนมือถือ  columns = [{label, render:(row)=>html, align}]
export function renderTable(columns, rows, emptyText = 'ไม่มีข้อมูล') {
    if (!rows.length) return `<p class="text-gray-400 text-sm text-center py-6">${emptyText}</p>`;
    const head = columns.map(c => `<th class="py-2 px-2 text-${c.align || 'left'}">${c.label}</th>`).join('');
    const body = rows.map(r => `<tr class="border-b hover:bg-gray-50">${
        columns.map(c => `<td class="py-2 px-2 text-${c.align || 'left'}">${c.render(r)}</td>`).join('')}</tr>`).join('');
    return `<div class="overflow-x-auto"><table class="w-full text-sm min-w-[480px]">
        <thead class="text-xs text-gray-500 border-b"><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
