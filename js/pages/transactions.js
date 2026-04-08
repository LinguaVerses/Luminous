// js/pages/transactions.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadTransactions();
        } else {
            window.location.href = 'login.html';
        }
    });
});

async function loadTransactions() {
    const tbody = document.getElementById('tx-list');
    try {
        const q = query(collection(db, `users/${currentUser.uid}/pointTransactions`), orderBy("createdAt", "desc"), limit(100));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-16 text-gray-400 bg-gray-50/50">ยังไม่มีประวัติการทำรายการ</td></tr>`;
            return;
        }

        tbody.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('th-TH') : 'ไม่ระบุ';
            
            // กำหนดสีและเครื่องหมาย + - ตามการใช้จ่าย
            const isIncome = data.amount > 0;
            const amountColor = isIncome ? 'text-emerald-600' : 'text-red-500';
            const amountPrefix = isIncome ? '+' : '';
            
            // แปลงประเภทรายการให้อ่านง่าย
            let typeLabel = '';
            let icon = '';
            if (data.type === 'topup') {
                typeLabel = 'เติมกุญแจ';
                icon = '<i class="fa-solid fa-coins text-yellow-500"></i>';
            } else if (data.type === 'purchase') {
                typeLabel = 'ปลดล็อกตอน';
                icon = '<i class="fa-solid fa-unlock-keyhole text-primary"></i>';
            } else if (data.type === 'coffee') {
                typeLabel = 'สนับสนุนกาแฟ';
                icon = '<i class="fa-solid fa-mug-hot text-amber-600"></i>';
            } else if (data.type === 'purchase_complete') {
                typeLabel = 'ปลดล็อกทั้งเรื่อง';
                icon = '<i class="fa-solid fa-book-open-reader text-emerald-500"></i>';
            } else {
                typeLabel = data.type || 'รายการอื่นๆ';
                icon = '<i class="fa-solid fa-circle-info text-gray-400"></i>';
            }

            return `
                <tr class="border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors">
                    <td class="py-4 px-6 text-gray-500">${dateStr}</td>
                    <td class="py-4 px-6 font-bold text-gray-800 flex items-center gap-2">${icon} ${typeLabel}</td>
                    <td class="py-4 px-6 text-xs text-gray-500 font-mono">${data.referenceId || '-'}</td>
                    <td class="py-4 px-6 font-black text-right ${amountColor}">${amountPrefix}${data.amount} <i class="fa-solid fa-key text-[10px] opacity-70"></i></td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error("Error loading transactions:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการโหลดประวัติ</td></tr>`;
    }
}