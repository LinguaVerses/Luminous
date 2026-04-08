import { db, auth } from '../config/firebaseConfig.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ตัวแปรที่ดึงจาก DOM
const form = document.getElementById('creator-register-form');
const btnSubmit = document.getElementById('btn-submit-creator');

// ตัวแปรสำหรับเก็บข้อมูลผู้ใช้ที่ล็อกอินอยู่
let currentUser = null;

// ตรวจสอบสถานะการล็อกอินเมื่อโหลดหน้า
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
    } else {
        // หากยังไม่ได้ล็อกอิน ให้เด้งการแจ้งเตือนและอาจพากลับไปหน้าแรก
        Swal.fire('เกิดข้อผิดพลาด', 'กรุณาล็อกอินก่อนทำการสมัคร Creator', 'error')
            .then(() => window.location.href = 'index.html');
    }
});

// ดักจับเหตุการณ์การกดปุ่ม Submit เพื่อยืนยันการอัปเกรด
form.addEventListener('submit', async (e) => {
    e.preventDefault(); // ป้องกันการรีเฟรชหน้าเว็บ

    if (!currentUser) return;

    // ดึงค่าข้อมูลจากช่อง Input ในหน้าฟอร์ม
    const penName = document.getElementById('reg-penname').value;
    const bio = document.getElementById('reg-bio').value;

    try {
        // เปลี่ยนสถานะปุ่มเพื่อแสดงว่าระบบกำลังประมวลผลอยู่ ป้องกันการกดซ้ำ
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปเกรด...';

        // สร้างการอ้างอิงไปยัง Document ของผู้ใช้คนนี้ในคอลเลกชัน 'users'
        const userRef = doc(db, 'users', currentUser.uid);

        // ทำการอัปเดตข้อมูลเข้าไปใน Firestore
        await updateDoc(userRef, {
            role: 'creator', // อัปเดตสถานะเป็น creator
            penName: penName,
            bio: bio,
            updatedAt: new Date()
        });

        // แสดงหน้าต่างแจ้งเตือนว่าทำรายการสำเร็จ
        Swal.fire({
            icon: 'success',
            title: 'ยินดีต้อนรับ Creator คนใหม่!',
            text: 'ระบบได้ทำการอัปเกรดบัญชีของคุณเรียบร้อยแล้ว',
            confirmButtonColor: '#10b981'
        }).then(() => {
            // พาผู้ใช้ไปยังหน้าสำหรับ Creator (ปรับเปลี่ยนชื่อไฟล์ตามระบบของคุณ)
            //window.location.href = '/creator/dashboard.html'; 
            window.location.href = 'profile.html'; 
        });

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ", error);
        Swal.fire('ข้อผิดพลาด', 'เกิดปัญหาในการอัปเกรดบัญชี กรุณาลองใหม่อีกครั้ง', 'error');
        
        // คืนค่าปุ่มกลับมาเหมือนเดิมเพื่อให้ผู้ใช้กดลองใหม่ได้
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-rocket"></i> ยืนยันการอัปเกรดบัญชี';
    }
});