// js/pages/contactUs.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const contactForm = document.getElementById('contact-form');
const nameInput = document.getElementById('contact-name');
const emailInput = document.getElementById('contact-email');
const messageInput = document.getElementById('contact-message');

let currentUser = null;

// ตรวจสอบ Login เพื่อดึงชื่อและอีเมลมากรอกให้อัตโนมัติ (Auto-fill)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (nameInput && !nameInput.value) nameInput.value = user.displayName || user.email.split('@')[0];
        if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    }
});

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const message = messageInput.value.trim();

        if (!name || !email || !message) {
            Swal.fire('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        Swal.fire({
            title: 'กำลังส่งข้อมูล...',
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });

        try {
            // 🔥 ส่ง Notification เข้า Collection: adminNotifications (ตาม Schema ข้อ 9)
            await addDoc(collection(db, "adminNotifications"), {
                to: 'admin',                // ระบุว่าผู้รับคือแอดมิน
                type: 'contact',            // ระบุชนิดเป็น contact เพื่อให้ UI ดึงไอคอนซองจดหมายมาแสดง
                from: name,                 // ชื่อผู้ส่ง
                email: email,               // อีเมลผู้ส่ง (สำหรับอ้างอิง)
                senderId: currentUser ? currentUser.uid : 'guest', // ID ผู้ส่ง เพื่อใช้ตอนส่งข้อความกลับ
                title: `ข้อความติดต่อใหม่จากคุณ ${name}`,
                message: `${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`, // โชว์ข้อความย่อ
                fullMessage: message,       // โชว์ใน Popup เมื่อกดอ่าน
                isRead: false,
                createdAt: serverTimestamp()
            });

            Swal.fire({
                icon: 'success',
                title: 'ส่งข้อความเรียบร้อย!',
                text: 'ทีมงานได้รับข้อความของคุณแล้ว และจะติดต่อกลับโดยเร็วที่สุดครับ',
                confirmButtonColor: '#10b981',
                timer: 3000
            }).then(() => {
                contactForm.reset();
                if(currentUser) { 
                    nameInput.value = currentUser.displayName || currentUser.email.split('@')[0] || '';
                    emailInput.value = currentUser.email || '';
                }
            });

        } catch (error) {
            console.error("Error sending contact message: ", error);
            Swal.fire('ข้อผิดพลาด', 'เกิดปัญหาขัดข้องในการส่งข้อความ: ' + error.message, 'error');
        }
    });
}