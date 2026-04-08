// js/admin/finance.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, doc, getDoc, getDocs, updateDoc, query, orderBy, limit, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let allRequests = [];
let currentFilter = 'pending'; // 'pending', 'approved', 'all'

export function initAdminFinance() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // ตรวจสอบสิทธิ์ Admin (อิงตาม schema ที่กำหนด role ใน users)
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                setupFilters();
                await loadTopupRequests();
            } else {
                Swal.fire('ปฏิเสธการเข้าถึง', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error').then(() => window.location.href = '../index.html');
            }
        } else {
            window.location.href = '../login.html';
        }
    });
}

function setupFilters() {
    const btns = {
        'pending': document.getElementById('filter-pending'),
        'approved': document.getElementById('filter-approved'),
        'all': document.getElementById('filter-all')
    };

    Object.keys(btns).forEach(key => {
        if (btns[key]) {
            btns[key].addEventListener('click', () => {
                // Reset styles
                Object.values(btns).forEach(btn => {
                    btn.className = "px-6 py-2 rounded-full font-bold text-sm text-gray-500 hover:text-primary transition-colors";
                });
                
                // Active style
                if (key === 'pending') btns[key].className = "px-6 py-2 rounded-full font-bold text-sm bg-yellow-400 text-yellow-900 transition-colors shadow-sm";
                else btns[key].className = "px-6 py-2 rounded-full font-bold text-sm bg-primary text-white transition-colors shadow-sm";
                
                currentFilter = key;
                renderTable();
            });
        }
    });
}

async function loadTopupRequests() {
    try {
        const q = query(collection(db, "topupRequests"), orderBy("createdAt", "desc"), limit(100));
        const snapshot = await getDocs(q);
        
        allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateSummaryCards();
        renderTable();
    } catch (error) {
        console.error("Error loading topup requests:", error);
        document.getElementById('topup-list').innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

function updateSummaryCards() {
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    
    // คำนวณเฉพาะของวันนี้
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const approvedToday = allRequests.filter(r => {
        if (r.status !== 'approved' || !r.updatedAt) return false;
        const updateDate = r.updatedAt.toDate();
        return updateDate >= today;
    });

    const incomeToday = approvedToday.reduce((sum, req) => sum + (Number(req.amount) || 0), 0);

    document.getElementById('summary-pending').innerHTML = `${pendingCount} <span class="text-sm font-normal text-gray-500">รายการ</span>`;
    document.getElementById('summary-approved').innerHTML = `${approvedToday.length} <span class="text-sm font-normal text-gray-500">รายการ</span>`;
    document.getElementById('summary-income').innerHTML = `${incomeToday.toLocaleString('th-TH', {minimumFractionDigits: 2})} <span class="text-sm font-normal text-emerald-200">THB</span>`;
}

function renderTable() {
    const tbody = document.getElementById('topup-list');
    let filteredData = allRequests;
    
    if (currentFilter !== 'all') {
        filteredData = allRequests.filter(r => r.status === currentFilter);
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400 bg-gray-50/50">ไม่พบรายการในสถานะนี้</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredData.map(req => {
        const createdDate = req.createdAt ? new Date(req.createdAt.toDate()).toLocaleString('th-TH') : 'ไม่ระบุ';
        
        let statusBadge = '';
        let actionButtons = '';

        if (req.status === 'pending') {
            statusBadge = '<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-hourglass-half"></i> รอตรวจสอบ</span>';
            actionButtons = `
                <div class="flex items-center justify-center gap-2">
                    <button onclick="window.approveTopup('${req.id}', '${req.userId}', ${req.keysRequested}, ${req.amount})" class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 hover:bg-primary hover:text-white transition-colors shadow-sm flex items-center justify-center" title="อนุมัติ"><i class="fa-solid fa-check"></i></button>
                    <button onclick="window.rejectTopup('${req.id}')" class="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition-colors shadow-sm flex items-center justify-center" title="ปฏิเสธ"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        } else if (req.status === 'approved') {
            statusBadge = '<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-check-double"></i> อนุมัติแล้ว</span>';
            actionButtons = '<span class="text-gray-300 text-xs">-</span>';
        } else {
            statusBadge = '<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-ban"></i> ปฏิเสธ</span>';
            actionButtons = '<span class="text-gray-300 text-xs">-</span>';
        }

        return `
            <tr class="border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors">
                <td class="py-4 px-6 text-gray-500 text-xs">
                    <div class="font-bold text-gray-700">${createdDate}</div>
                    <div class="text-primary mt-1"><i class="fa-solid fa-clock"></i> สลิปโอน: ${req.transferTime || '-'}</div>
                </td>
                <td class="py-4 px-6">
                    <div class="font-bold text-gray-800">${req.username || 'User'}</div>
                    <div class="text-[10px] text-gray-400 font-mono" title="UserID">${req.userId ? req.userId.substring(0,8)+'...' : ''}</div>
                </td>
                <td class="py-4 px-6 text-xs">
                    <div class="text-gray-700"><span class="font-bold">ธนาคาร:</span> ${req.senderBankInfo || '-'}</div>
                    <div class="text-gray-500 mt-1"><span class="font-bold">Ref:</span> ${req.referenceNo || '-'}</div>
                </td>
                <td class="py-4 px-6">
                    <div class="font-bold text-yellow-600">${req.keysRequested.toLocaleString()} กุญแจ</div>
                    <div class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">${req.plan || '-'} (${req.amount}฿)</div>
                </td>
                <td class="py-4 px-6 text-center">${statusBadge}</td>
                <td class="py-4 px-6">${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

// ------------------------------------------------------------------------
// การทำงานระบบ อนุมัติบิล (Batch Write - เปลี่ยนสถานะ & เพิ่มกุญแจให้ User)
// ------------------------------------------------------------------------
window.approveTopup = async (requestId, userId, keysRequested, amount) => {
    Swal.fire({
        title: 'ยืนยันการอนุมัติ?',
        text: `ระบบจะเพิ่ม ${keysRequested} กุญแจ ให้กับผู้ใช้งานนี้ทันที`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'ยืนยันอนุมัติ',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const batch = writeBatch(db);
                
                // 1. อัปเดตสถานะบิลเป็น Approved
                const requestRef = doc(db, "topupRequests", requestId);
                batch.update(requestRef, { 
                    status: "approved", 
                    updatedAt: serverTimestamp() 
                });

                // 2. ดึงยอดกุญแจปัจจุบันของ User
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);
                const currentPoints = userSnap.exists() ? (userSnap.data().points || 0) : 0;

                // 3. อัปเดตบวกกุญแจให้ User
                batch.update(userRef, { 
                    points: currentPoints + keysRequested 
                });

                // 4. บันทึกลงตาราง Point Transactions ให้ผู้ใช้ดูประวัติได้
                const txRef = doc(collection(db, `users/${userId}/pointTransactions`));
                batch.set(txRef, {
                    amount: keysRequested, // จำนวนเต็มบวก = รับเข้า
                    type: "topup",
                    referenceId: requestId,
                    createdAt: serverTimestamp()
                });

                // 5. (ทางเลือก) แจ้งเตือนผู้ใช้ใน collection notifications
                const notifRef = doc(collection(db, `users/${userId}/notifications`));
                batch.set(notifRef, {
                    type: "topup_success",
                    message: `รายการเติมเงิน ${amount} บาท ของคุณได้รับการอนุมัติแล้ว ได้รับ ${keysRequested} กุญแจ`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });

                // สั่งประมวลผลคำสั่งทั้งหมดพร้อมกัน
                await batch.commit();

                Swal.fire('อนุมัติสำเร็จ!', 'กุญแจถูกเพิ่มเข้าบัญชีผู้ใช้เรียบร้อยแล้ว', 'success');
                await loadTopupRequests(); // โหลดตารางใหม่
            } catch (error) {
                console.error("Error approving topup:", error);
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถอนุมัติรายการได้', 'error');
            }
        }
    });
};

// ฟังก์ชันปฏิเสธรายการ
window.rejectTopup = async (requestId) => {
    const { value: reason } = await Swal.fire({
        title: 'ปฏิเสธรายการ',
        input: 'text',
        inputLabel: 'ระบุเหตุผล (เช่น ไม่พบยอดเงินเข้า, สลิปซ้ำ)',
        inputPlaceholder: 'กรอกเหตุผล...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันการปฏิเสธ',
        cancelButtonText: 'ยกเลิก'
    });

    if (reason !== undefined) {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            await updateDoc(doc(db, "topupRequests", requestId), {
                status: "rejected",
                rejectReason: reason || "ข้อมูลไม่ถูกต้อง",
                updatedAt: serverTimestamp()
            });
            Swal.fire('สำเร็จ', 'รายการถูกปฏิเสธเรียบร้อยแล้ว', 'success');
            await loadTopupRequests();
        } catch (error) {
            console.error("Error rejecting topup:", error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถปฏิเสธรายการได้', 'error');
        }
    }
};
