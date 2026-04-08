// js/pages/notifications.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, writeBatch, serverTimestamp, addDoc, deleteDoc, increment, where, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let allNotifications = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadNotifications();
            setupEvents();
        } else {
            window.location.href = 'login.html';
        }
    });
});

async function loadNotifications() {
    const listContainer = document.getElementById('notifications-list');
    try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        currentUser.role = userDoc.exists() ? (userDoc.data().role || 'user') : 'user';

        const q = query(collection(db, `users/${currentUser.uid}/notifications`), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        allNotifications = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), isAdminNotif: false }));

        // ถ้าผู้ใช้เป็น admin ให้ไปดึงข้อมูลจาก adminNotifications มาต่อท้าย
        if (currentUser.role === 'admin') {
            const adminQ = query(collection(db, `adminNotifications`), orderBy("createdAt", "desc"));
            const adminSnap = await getDocs(adminQ);
            const adminNotifs = adminSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isAdminNotif: true }));
            allNotifications = [...allNotifications, ...adminNotifs];
            
            // เรียงลำดับใหม่ทั้งหมดตามเวลา
            allNotifications.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date();
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date();
                return dateB - dateA;
            });
        }
        
        renderNotifications();
    } catch (error) {
        console.error("Error loading notifications:", error);
        listContainer.innerHTML = '<div class="text-center py-10 text-red-500 bg-white rounded-3xl border border-red-100">ไม่สามารถโหลดการแจ้งเตือนได้</div>';
    }
}

function renderNotifications() {
    const listContainer = document.getElementById('notifications-list');
    
    if (allNotifications.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-16 bg-white rounded-3xl shadow-sm border border-emerald-50 flex flex-col items-center">
                <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl text-gray-300 mb-4"><i class="fa-regular fa-bell-slash"></i></div>
                <h3 class="text-lg font-bold text-gray-700">ยังไม่มีการแจ้งเตือนใหม่</h3>
                <p class="text-sm text-gray-500 mt-1">คุณจะได้รับการแจ้งเตือนเมื่อมีการเคลื่อนไหวในบัญชีของคุณ</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = allNotifications.map(n => {
        let icon = '<i class="fa-solid fa-bell text-gray-400"></i>';
        let bgIconClass = 'bg-gray-100';
        let dateStr = n.createdAt ? new Date(n.createdAt.toDate()).toLocaleString('th-TH') : 'เพิ่งส่ง';
        let unreadClass = n.isRead ? 'bg-white opacity-80' : 'bg-emerald-50/60 border-l-4 border-primary shadow-sm';

        // จำแนกประเภทไอคอนตาม Type
        if (n.type === 'coffee') {
            icon = '<i class="fa-solid fa-mug-hot text-amber-600"></i>';
            bgIconClass = 'bg-amber-100';
        } else if (n.type.includes('topup')) {
            icon = '<i class="fa-solid fa-coins text-yellow-600"></i>';
            bgIconClass = 'bg-yellow-100';
	} else if (n.type === 'comment' || n.type === 'reply') {
            icon = '<i class="fa-solid fa-comment-dots text-primary"></i>';
            bgIconClass = 'bg-emerald-100';
	} else if (n.type === 'contact') {
            icon = '<i class="fa-solid fa-envelope-open-text text-blue-600"></i>';
            bgIconClass = 'bg-blue-100';
        } else if (n.type === 'contact_reply') {
            icon = '<i class="fa-solid fa-reply text-purple-600"></i>';
            bgIconClass = 'bg-purple-100';
        }

	// กำหนด action ว่าคลิกแล้วจะแค่ markAsRead หรือจะ redirect พาไปเปิดหน้าอื่นด้วย
        //const clickAction = (n.workId && n.episodeId) 
            //? `window.markAsReadAndRedirect('${n.id}', '/read.html?workId=${n.workId}&epId=${n.episodeId}')`
            //: `window.markAsRead('${n.id}')`;

	// ให้เปิด Popup สำหรับข้อความทุกประเภทรวมถึงการเติมเงิน (ยกเว้นแบบมีลิงก์)
        let clickAction = `window.openGeneralPopup('${n.id}')`;
        if (n.workId && n.episodeId) {
            clickAction = `window.markAsReadAndRedirect('${n.id}', '/read.html?workId=${n.workId}&epId=${n.episodeId}')`;
        }

        return `
            <div class="p-5 rounded-2xl border border-gray-100 transition-all hover:shadow-md cursor-pointer flex gap-4 items-start ${unreadClass}" onclick="${clickAction}">
                <div class="w-12 h-12 rounded-full ${bgIconClass} flex items-center justify-center text-xl shrink-0 shadow-inner">
                    ${icon}
                </div>
                <div class="flex-grow">
                    <div class="flex items-center justify-between mt-2">
                        <p class="text-xs text-gray-400 flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${dateStr}</p>
                        <button onclick="window.deleteNotification('${n.id}', ${n.isAdminNotif}, event)" class="text-gray-300 hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-50" title="ลบข้อความ">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function setupEvents() {
    const markAllBtn = document.getElementById('btn-mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            const unreadDocs = allNotifications.filter(n => !n.isRead);
            if (unreadDocs.length === 0) return;

            try {
                const batch = writeBatch(db);
                unreadDocs.forEach(n => {
                    const ref = doc(db, `users/${currentUser.uid}/notifications`, n.id);
                    batch.update(ref, { isRead: true });
                });
                await batch.commit();
                await loadNotifications();
            } catch (error) {
                console.error("Error marking all as read", error);
            }
        });
    }
}

window.markAsRead = async (notifId) => {
    const notif = allNotifications.find(n => n.id === notifId);
    if (!notif || notif.isRead) return;

    try {
        await updateDoc(doc(db, `users/${currentUser.uid}/notifications`, notifId), { isRead: true });
        // อัปเดตสถานะใน Array โลคอล แล้วเรนเดอร์ใหม่ ไม่ต้องโหลดจาก DB ใหม่ทั้งหมดเพื่อความรวดเร็ว
        notif.isRead = true;
        renderNotifications();
    } catch (error) {
        console.error("Error marking as read", error);
    }
};

// ฟังก์ชันสำหรับกรณีที่มีลิงก์แนบมา (เช่น คอมเมนต์) กดแล้วเปลี่ยนหน้าไปอ่านต่อทันที
window.markAsReadAndRedirect = async (notifId, url) => {
    const notif = allNotifications.find(n => n.id === notifId);
    if (notif && !notif.isRead) {
        try {
            await updateDoc(doc(db, `users/${currentUser.uid}/notifications`, notifId), { isRead: true });
        } catch (error) {
            console.error("Error updating before redirect:", error);
        }
    }
    window.location.href = url;
};

    // ฟังก์ชันเปิด Popup อ่านข้อความทั่วไป (รวมถึงเติมเงิน) และระบบตอบกลับ
    window.openGeneralPopup = async (notifId) => {
    const notif = allNotifications.find(n => n.id === notifId);    if (!notif) return;

    // อัปเดตสถานะการอ่าน
    if (!notif.isRead) {
        try {
            const notifRef = doc(db, notif.isAdminNotif ? `adminNotifications` : `users/${currentUser.uid}/notifications`, notifId);
            await updateDoc(notifRef, { isRead: true });
            notif.isRead = true;
            renderNotifications();
        } catch (e) { console.error(e); }
    }

    // ตรวจสอบประเภทการแจ้งเตือน
    const isTopup = notif.type && notif.type.includes('topup') && currentUser.role === 'admin';
    const canReply = notif.type === 'contact' && currentUser.role === 'admin';

    // -----------------------------------------
    // กรณีที่ 1: แจ้งเตือนการเติมเงิน (TopUp)
    // -----------------------------------------
    if (isTopup) {
        // ดึงข้อมูลเสริมก่อนเปิด Popup
        let targetUserId = notif.userId || notif.senderId || notif.uid || notif.fromId || notif.fromUid;
        let amount = Number(notif.amount) || 0;
        let slipUrl = notif.slipUrl || '';
        let displayUsername = notif.username || notif.senderName || notif.from || '';
        let reqRefId = notif.requestId || notif.id;

        // ลองค้นหาใน topupRequests เผื่อข้อมูล ID อยู่ในนั้น (มีระบบ Fallback หากหาไม่พบ)
        try {
            let reqSnap = await getDoc(doc(db, 'topupRequests', reqRefId));
            if (reqSnap.exists()) {
                const reqData = reqSnap.data();
                if (!targetUserId) targetUserId = reqData.userId || reqData.uid;
                if (!amount) amount = Number(reqData.amount) || 0;
                if (!slipUrl) slipUrl = reqData.slipUrl || '';
            } else {
                // Fallback: ดึงรายการแจ้งเติมเงินล่าสุดที่ยัง Pending มาเชื่อมโยงแทน
                const pendingQ = query(collection(db, 'topupRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(1));
                const pendingSnap = await getDocs(pendingQ);
                if (!pendingSnap.empty) {
                    const reqData = pendingSnap.docs[0].data();
                    reqRefId = pendingSnap.docs[0].id;
                    if (!targetUserId) targetUserId = reqData.userId || reqData.uid;
                    if (!amount) amount = Number(reqData.amount) || 0;
                    if (!slipUrl) slipUrl = reqData.slipUrl || '';
                }
            }
        } catch(e) { console.warn("Error fetching topup request details:", e); }

        // ถ้าได้ ID แล้วแต่ยังไม่มีชื่อ ให้ไปดึงชื่อจาก users
        if (targetUserId && !displayUsername) {
            try {
                const uSnap = await getDoc(doc(db, 'users', targetUserId));
                if (uSnap.exists()) {
                    displayUsername = uSnap.data().username || uSnap.data().email || '';
                }
            } catch(e) { console.warn("Error fetching user details:", e); }
        }

        // [OVERWRITE] คำนวณจำนวนกุญแจให้ตรงกับแพ็กเกจ (รายครั้ง และ รายเดือน)
        let receivedKeys = notif.receivedKeys;
        if (!receivedKeys) {
            // แพ็กเกจรายครั้ง (One-time)
            if (amount === 50) receivedKeys = 400;
            else if (amount === 100) receivedKeys = 850;
            else if (amount === 200) receivedKeys = 1800;
            // แพ็กเกจรายเดือน (Monthly Plan)
            else if (amount === 99) receivedKeys = 1000;
            else if (amount === 199) receivedKeys = 2200;
            else if (amount === 299) receivedKeys = 3300;
            // กรณีอื่นๆ (Fallback)
            else receivedKeys = amount * 8;
        }

        Swal.fire({
            title: notif.title || 'คำขอเติมเงิน',
            html: `
                <div class="text-left text-sm text-gray-700 mb-4 bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 min-h-[100px]">
                    <p class="mb-2"><strong>ผู้แจ้ง:</strong> <span class="text-primary font-bold">${displayUsername}</span></p>
                    
                    <p class="mb-2"><strong>รายการ:</strong> เติม ${amount} บาท ได้รับ ${receivedKeys} กุญแจ</p>
                    <p><strong>รายละเอียด:</strong> ${notif.fullMessage || notif.message}</p>
                    ${slipUrl ? `<div class="mt-3 text-center"><img src="${slipUrl}" class="max-h-48 mx-auto rounded-lg shadow-sm border border-gray-200" alt="Slip"></div>` : ''}
                </div>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '<i class="fa-solid fa-check"></i> Approve',
            denyButtonText: '<i class="fa-solid fa-xmark"></i> Reject',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#10b981',
            denyButtonColor: '#ef4444',
            width: '600px'
        }).then(async (result) => {
            if (result.isConfirmed || result.isDenied) {
                Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                try {
                    if (!targetUserId || targetUserId === 'guest') throw new Error("ไม่พบ ID ผู้ใช้ในระบบ (ข้อมูลการแจ้งเตือนอาจไม่สมบูรณ์)");

                    if (result.isConfirmed) {
                        // แบบ Approve: เพิ่มกุญแจ + แจ้งเตือนกลับ
                        if (amount > 0) {
                            await updateDoc(doc(db, "users", targetUserId), {
                                points: increment(amount)
                            });
                        }
                        await addDoc(collection(db, `users/${targetUserId}/notifications`), {
                            type: 'system',
                            title: 'อนุมัติการเติมเงิน',
                            message: 'เพิ่มกุญแจเรียบร้อยแล้ว ขอให้มีความสุขในการดูอนิเมชั่นนะคะ',
                            isRead: false,
                            createdAt: serverTimestamp()
                        });
                        Swal.fire('สำเร็จ', 'เพิ่มกุญแจให้ผู้ใช้เรียบร้อยแล้ว', 'success');
                    } else if (result.isDenied) {
                        // แบบ Reject: แจ้งเตือนกลับอย่างเดียว
                        await addDoc(collection(db, `users/${targetUserId}/notifications`), {
                            type: 'system',
                            title: 'ปฏิเสธการเติมเงิน',
                            message: 'ไม่สามารถเพิ่มกุญแจได้ กรุณาติดต่อกลับแอดมินค่ะ',
                            isRead: false,
                            createdAt: serverTimestamp()
                        });
                        Swal.fire('ปฏิเสธรายการ', 'ส่งข้อความแจ้งเตือนกลับไปยังผู้ใช้แล้ว', 'info');
                    }
                    
                    // ปรับสถานะทั้งในฝั่งคำขอเติมเงิน (topupRequests) และฝั่งการแจ้งเตือน
                    const finalStatus = result.isConfirmed ? 'approved' : 'rejected';
                    if (reqRefId && reqRefId !== notif.id) {
                        try { await updateDoc(doc(db, 'topupRequests', reqRefId), { status: finalStatus, updatedAt: serverTimestamp() }); } catch(e) { console.warn(e); }
                    }
                    await updateDoc(doc(db, 'adminNotifications', notif.id), { status: finalStatus });
                    
                    notif.status = finalStatus;
                    renderNotifications();

                } catch (err) {
                    console.error(err);
                    Swal.fire('ข้อผิดพลาด', err.message, 'error');
                }
            }
        });
        return; 
    }

    // -----------------------------------------
    // กรณีที่ 2: แจ้งเตือนทั่วไป / ติดต่อสอบถาม
    // -----------------------------------------
    let replyBoxHtml = '';
    if (canReply) {
        replyBoxHtml = `
            <div class="mt-4 text-left border-t border-gray-200 pt-4">
                <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fa-solid fa-reply text-primary"></i> ตอบกลับไปยัง: ${notif.from} (${notif.email})</label>
                <textarea id="reply-message" rows="4" class="w-full bg-gray-50 border border-emerald-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none resize-none" placeholder="พิมพ์ข้อความตอบกลับที่นี่..."></textarea>
            </div>
        `;
    }

    Swal.fire({
        title: notif.title || 'ข้อความ',
        html: `
            <div class="text-left text-sm text-gray-700 mb-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-50 min-h-[100px] whitespace-pre-wrap">${notif.fullMessage || notif.message}</div>
            ${replyBoxHtml}
        `,
        showCancelButton: canReply,
        showConfirmButton: true,
        confirmButtonText: canReply ? '<i class="fa-solid fa-paper-plane"></i> ส่งข้อความตอบกลับ' : 'ปิดหน้าต่าง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        width: '600px',
        preConfirm: () => {
            if (canReply) {
                const msg = document.getElementById('reply-message').value.trim();
                if (!msg) Swal.showValidationMessage('กรุณาพิมพ์ข้อความตอบกลับ');
                return msg;
            }
        }
}).then(async (result) => {
        if (canReply && result.isConfirmed && result.value) {
            try {
                // เช็คให้ครอบคลุมเผื่อฐานข้อมูลบันทึกเป็นชื่อฟิลด์อื่น
                let targetUserId = notif.senderId || notif.userId || notif.uid || notif.fromId || notif.fromUid;
                
                // Fallback: ค้นหา ID ผู้ใช้จาก Email ในฐานข้อมูล
                if (!targetUserId && notif.email) {
                    const uQ = query(collection(db, 'users'), where('email', '==', notif.email), limit(1));
                    const uSnap = await getDocs(uQ);
                    if (!uSnap.empty) targetUserId = uSnap.docs[0].id;
                }

                if (targetUserId && targetUserId !== 'guest') {
                    await addDoc(collection(db, `users/${targetUserId}/notifications`), {
                        type: 'contact_reply',
                        title: 'ฝ่ายสนับสนุนตอบกลับข้อความของคุณ',
                        message: `ตอบกลับ: ${result.value.substring(0, 50)}...`,
                        fullMessage: result.value,
                        isRead: false,
                        createdAt: serverTimestamp()
                    });
                    Swal.fire('ส่งสำเร็จ!', 'ระบบได้ส่งข้อความตอบกลับไปยังผู้ใช้แล้ว', 'success');
                } else {
                    Swal.fire('ไม่สามารถส่งในระบบได้', 'ผู้ใช้นี้ไม่ได้ล็อกอินตอนส่งข้อความ (Guest) โปรดตอบกลับผ่านอีเมลแทน', 'info');
                }
            } catch (err) {
                console.error(err);
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งข้อความได้', 'error');
            }
        }
    });
};

// [INSERT]

// [ADD] ฟังก์ชันลบการแจ้งเตือน (ถังขยะ)
window.deleteNotification = async (notifId, isAdminNotif, event) => {
    // ป้องกันไม่ให้ event click ทะลุไปโดนกล่องข้อความหลัก (ที่จะทำให้มันเปิดอ่าน)
    event.stopPropagation(); 

    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: 'คุณต้องการลบการแจ้งเตือนนี้ออกจากระบบใช่หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '<i class="fa-solid fa-trash-can"></i> ลบข้อความ',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        try {
            // อ้างอิง Path ให้ถูกต้องตามประเภทของการแจ้งเตือน (แอดมิน หรือ ผู้ใช้ปกติ)
            const notifRef = doc(db, isAdminNotif ? `adminNotifications` : `users/${currentUser.uid}/notifications`, notifId);
            await deleteDoc(notifRef);

            // นำออกจากตัวแปรโลคอลและเรนเดอร์ใหม่ เพื่อความรวดเร็วโดยไม่ต้องดึง DB ใหม่
            allNotifications = allNotifications.filter(n => n.id !== notifId);
            renderNotifications();

            Swal.fire({ title: 'ลบสำเร็จ', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        } catch (error) {
            console.error("Error deleting notification:", error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบการแจ้งเตือนได้ กรุณาลองใหม่', 'error');
        }
    }
};