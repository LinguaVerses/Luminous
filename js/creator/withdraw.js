// js/creator/withdraw.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { financeService } from '../services/financeService.js';

let currentUserId = null;

// ข้อมูลจำลองสำหรับแสดงผล UI (ในอนาคตจะดึงจาก Firestore Document ของ Creator)
let mockCreatorData = {
    lifetimeEarnings: 42500.50, // ลองเปลี่ยนตัวเลขนี้ดูเพื่อทดสอบระดับ Tier
    salesBalance: 2500.00, // รายได้จากการขาย (หัก % แพลตฟอร์มแล้ว)
    donateBalance: 700.00  // รายได้จากสนับสนุน (หักแค่ค่าธรรมเนียมโอน)
};

export function initWithdraw() {
    onAuthStateChanged(auth, async (user) => {
	    if (user) {
            currentUserId = user.uid;
            updateTierUI(mockCreatorData.lifetimeEarnings);
            
            const totalBalance = mockCreatorData.salesBalance + mockCreatorData.donateBalance;
            document.getElementById('sales-balance').innerText = mockCreatorData.salesBalance.toLocaleString('th-TH', {minimumFractionDigits: 2});
            document.getElementById('donate-balance').innerText = mockCreatorData.donateBalance.toLocaleString('th-TH', {minimumFractionDigits: 2});
            document.getElementById('available-balance').innerText = totalBalance.toLocaleString('th-TH', {minimumFractionDigits: 2});
            
            setupForm();
            await loadWithdrawHistory();
        } else {
            Swal.fire('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน', 'error').then(() => window.location.href = '../login.html');
        }
    });
}

// ฟังก์ชันคำนวณระดับตามโครงสร้าง "6. การตั้งราคา.txt"
function calculateTier(lifetime) {
    if (lifetime < 50000) return { id: 'standard', name: 'Standard Writer', share: 70, next: 50000, nextName: 'Gold (75%)' };
    if (lifetime < 150000) return { id: 'gold', name: 'Gold Writer', share: 75, next: 150000, nextName: 'Platinum (80%)' };
    if (lifetime < 500000) return { id: 'platinum', name: 'Platinum Writer', share: 80, next: 500000, nextName: 'Diamond (85%)' };
    return { id: 'diamond', name: 'Diamond Writer <i class="fa-solid fa-gem ml-1"></i>', share: 85, next: null, nextName: 'MAX' };
}

function updateTierUI(lifetime) {
    const tier = financeService.calculateRevenueShareTier(lifetime);
    
    document.getElementById('lifetime-earnings').innerText = lifetime.toLocaleString('th-TH', {minimumFractionDigits: 2});
    document.getElementById('tier-name').innerHTML = tier.name;
    document.getElementById('tier-percent').innerText = tier.share;

    // เปลี่ยนสีชื่อ Tier ตามระดับ
    const tierNameEl = document.getElementById('tier-name');
    tierNameEl.className = 'text-3xl font-black mb-6 ';
    if (tier.id === 'standard') tierNameEl.classList.add('text-emerald-600');
    if (tier.id === 'gold') tierNameEl.classList.add('text-yellow-600');
    if (tier.id === 'platinum') tierNameEl.classList.add('text-cyan-600');
    if (tier.id === 'diamond') tierNameEl.classList.add('text-purple-600');

    // คำนวณ Progress Bar
    let progress = 100;
    if (tier.next !== null) {
        // หาฐานของ Level ปัจจุบันเพื่อคำนวณเปอร์เซ็นต์หลอด
        let base = 0;
        if(tier.id === 'gold') base = 50000;
        if(tier.id === 'platinum') base = 150000;
        
        const currentLevelProgress = lifetime - base;
        const levelRange = tier.next - base;
        progress = (currentLevelProgress / levelRange) * 100;
        
        const remaining = tier.next - lifetime;
        document.getElementById('tier-next-req').innerHTML = `<i class="fa-solid fa-rocket text-primary fa-fade"></i> อีก ${remaining.toLocaleString('th-TH')} THB เพื่อปรับเป็น ${tier.nextName}`;
    } else {
        document.getElementById('tier-next-req').innerHTML = `<i class="fa-solid fa-crown text-yellow-500"></i> คุณอยู่ในระดับสูงสุดแล้ว!`;
    }
    
    // หน่วงเวลาให้ Animation หลอดวิ่งทำงาน
    setTimeout(() => {
        document.getElementById('tier-progress').style.width = `${progress}%`;
    }, 100);

    // อัปเดตกล่อง Tiers Indicator ด้านล่าง
    const boxes = document.querySelectorAll('.tier-box');
    boxes.forEach(box => {
        if (box.getAttribute('data-tier') === tier.id) {
            box.className = 'tier-box text-center py-3 rounded-xl border-2 border-primary bg-emerald-50 shadow-sm transition-all transform scale-105';
            box.querySelector('p:first-child').classList.add('text-emerald-700');
            box.querySelector('p:last-child').classList.add('text-emerald-600');
        } else {
            box.className = 'tier-box text-center py-3 rounded-xl border border-gray-100 bg-white text-gray-400 transition-all opacity-60';
        }
    });
}

function setupForm() {
    const form = document.getElementById('withdraw-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('withdraw-amount');
        const amount = Number(amountInput.value);
        const totalBalance = mockCreatorData.salesBalance + mockCreatorData.donateBalance;

        if (amount > totalBalance) {
            Swal.fire('ยอดเงินไม่เพียงพอ', 'คุณมียอดเงินที่สามารถถอนได้ไม่พอกับจำนวนที่ระบุ', 'warning');
            return;
        }

        Swal.fire({
            title: 'ยืนยันการถอนเงิน?',
            text: `ส่งคำร้องขอถอนเงินจำนวน ${amount.toLocaleString('th-TH')} บาท`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                try {
                    // อ้างอิงโครงสร้าง withdrawRequests [cite: 378, 379]
                    await addDoc(collection(db, "withdrawRequests"), {
                        creatorId: currentUserId,
                        amount: amount,
                        status: "pending",
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });

                    // หักเงินจำลองหน้าจอ (สมมติหักจากยอดขายก่อน แล้วค่อยหักจากยอด Donate)
                    let remainingWithdraw = amount;
                    if (mockCreatorData.salesBalance >= remainingWithdraw) {
                        mockCreatorData.salesBalance -= remainingWithdraw;
                    } else {
                        remainingWithdraw -= mockCreatorData.salesBalance;
                        mockCreatorData.salesBalance = 0;
                        mockCreatorData.donateBalance -= remainingWithdraw;
                    }
                    
                    const newTotal = mockCreatorData.salesBalance + mockCreatorData.donateBalance;
                    document.getElementById('sales-balance').innerText = mockCreatorData.salesBalance.toLocaleString('th-TH', {minimumFractionDigits: 2});
                    document.getElementById('donate-balance').innerText = mockCreatorData.donateBalance.toLocaleString('th-TH', {minimumFractionDigits: 2});
                    document.getElementById('available-balance').innerText = newTotal.toLocaleString('th-TH', {minimumFractionDigits: 2});
                    amountInput.value = '';

                    await loadWithdrawHistory();

                    Swal.fire('สำเร็จ!', 'คำร้องขอถอนเงินถูกส่งให้แอดมินแล้ว', 'success');
                } catch (error) {
                    console.error("Error submitting withdraw:", error);
                    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งคำร้องได้ในขณะนี้', 'error');
                }
            }
        });
    });
}

async function loadWithdrawHistory() {
    const tbody = document.getElementById('withdraw-history');
    
    try {
        const q = query(collection(db, "withdrawRequests"), where("creatorId", "==", currentUserId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-gray-400">ยังไม่มีประวัติการถอนเงิน</td></tr>';
            return;
        }

        tbody.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('th-TH') : 'วันนี้';
            const refId = doc.id.substring(0, 8).toUpperCase();
            
            let statusBadge = '';
            if (data.status === 'pending') statusBadge = '<span class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">รอตรวจสอบ</span>';
            else if (data.status === 'paid') statusBadge = '<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">โอนสำเร็จ</span>';
            else statusBadge = '<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">ปฏิเสธ</span>';

            return `
                <tr class="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors">
                    <td class="py-4 px-4 text-gray-500">${dateStr}</td>
                    <td class="py-4 px-4 font-mono text-gray-500">WD-${refId}</td>
                    <td class="py-4 px-4 font-bold text-gray-800 text-right">${data.amount.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
                    <td class="py-4 px-4 text-center">${statusBadge}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading history:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-red-400">เกิดข้อผิดพลาดในการโหลดประวัติ</td></tr>';
    }
}
