// js/pages/topup.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let selectedPrice = 199; // Default เลือกอันที่ขายดี
let selectedKeys = 2200; // ตามเรตราคาใหม่ Fan Plan
let selectedPlan = 'Fan Plan';
let isFirstTimeTopup = false; // เอาไว้เช็คโบนัสครั้งแรก

export function initTopup() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;

	// โหลด Username มาแสดงที่ฟอร์ม
            const usernameInput = document.getElementById('display-username');
            if (usernameInput) {
                let userName = user.displayName;
                // [OVERWRITE]
                if (!userName) {
                    const uSnap = await getDoc(doc(db, "users", user.uid));
                    if (uSnap.exists()) userName = uSnap.data().username;
                }
                usernameInput.value = userName || "ผู้ใช้งาน";
            }

            // เช็คว่าเคยเติมเงินมาก่อนหรือไม่ (โบนัส 10% ครั้งแรก)
            try {
                const txQuery = query(collection(db, `users/${user.uid}/pointTransactions`), where("type", "==", "topup"));
                const txSnap = await getDocs(txQuery);
                isFirstTimeTopup = txSnap.empty; // ถ้ายังไม่มีประวัติ = เติมครั้งแรก
            } catch (error) {
                console.error("Error checking topup history:", error);
            }

            setupPackageSelection();
            setupFormSubmission();
        } else {
            Swal.fire({
                title: 'ต้องเข้าสู่ระบบ',
                text: 'กรุณาเข้าสู่ระบบก่อนทำการเติมกุญแจ',
                icon: 'warning',
                confirmButtonColor: '#10b981'
            }).then(() => {
                window.location.href = 'login.html';
            });
        }
    });
}

function setupPackageSelection() {
    const cards = document.querySelectorAll('.package-card');
    const displayAmount = document.getElementById('display-amount');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            // รีเซ็ตสไตล์ของทุกการ์ด
            cards.forEach(c => {
                c.classList.remove('border-yellow-400', 'bg-gradient-to-b', 'from-yellow-50', 'to-yellow-100', 'selected-package');
                c.classList.add('border-transparent', 'bg-white');
            });

            // เพิ่มสไตล์ให้การ์ดที่ถูกเลือก
            card.classList.remove('border-transparent', 'bg-white');
            card.classList.add('border-yellow-400', 'bg-gradient-to-b', 'from-yellow-50', 'to-yellow-100', 'selected-package');

            // [OVERWRITE]
            // อัปเดตตัวแปรและหน้าจอ
            selectedPrice = Number(card.getAttribute('data-price'));
            let baseKeys = Number(card.getAttribute('data-keys'));
            selectedPlan = card.getAttribute('data-plan');
            
            // คำนวณโบนัส 10% ถ้าเป็นการเติมเงินครั้งแรก
            if (isFirstTimeTopup) {
                selectedKeys = Math.floor(baseKeys * 1.1);
            } else {
                selectedKeys = baseKeys;
            }

            displayAmount.innerText = selectedPrice;
            
            // แสดง Keys สุทธิ (ถ้าระบบ HTML มีจุดให้ใส่ #display-keys)
            const displayKeysEle = document.getElementById('display-keys');
            if(displayKeysEle) {
                displayKeysEle.innerHTML = `${selectedKeys.toLocaleString()} Keys ${isFirstTimeTopup ? '<span class="text-red-500 text-sm font-bold ml-1 animate-pulse">+Bonus 10% 🎉</span>' : ''}`;
            }
        });
    });
}

function setupFormSubmission() {
    const form = document.getElementById('topup-form');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

	    const senderBankInfo = document.getElementById('sender-bank-info').value;
            const transferTime = document.getElementById('transfer-time').value;
	    const refNo = document.getElementById('ref-no').value;

            Swal.fire({
                title: 'กำลังส่งข้อมูล...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                // บันทึกคำขอเติมเงินลง Database (Collection: topupRequests)
                const requestData = {
                    userId: currentUser.uid,
		    username: document.getElementById('display-username').value,
                    amount: selectedPrice,
                    keysRequested: selectedKeys,
		    plan: selectedPlan,
		    senderBankInfo: senderBankInfo,
                    transferTime: transferTime,
		    referenceNo: refNo,
                    status: "pending",
                    createdAt: serverTimestamp()
                };

                // เก็บค่า Document Reference ที่ได้จากการสร้าง Topup Request
                const requestRef = await addDoc(collection(db, "topupRequests"), requestData);

                // สร้างแจ้งเตือนส่งให้ Admin พร้อมแนบข้อมูลที่จำเป็นทั้งหมด
                await addDoc(collection(db, "adminNotifications"), {
                    to: "admin",
                    type: "topup",
                    userId: currentUser.uid,
                    username: document.getElementById('display-username').value,
                    amount: selectedPrice,
                    requestId: requestRef.id,
                    message: `ผู้ใช้ส่งคำขอเติมเงิน ${selectedPrice} บาท`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });

                Swal.fire({
                    title: 'ส่งคำขอสำเร็จ!',
                    text: 'กรุณารอแอดมินตรวจสอบสลิป ภายใน 1-3 ชั่วโมง',
                    icon: 'success',
                    confirmButtonColor: '#10b981'
                }).then(() => {
                    form.reset();
                    // อาจจะพากลับไปหน้า Profile หรือ Dashboard สมาชิก
                });

            } catch (error) {
                console.error("Error submitting topup request:", error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถส่งคำขอเติมกุญแจได้', 'error');
            }
        });
    }
}