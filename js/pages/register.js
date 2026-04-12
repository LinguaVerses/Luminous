// js/pages/register.js
import { db, auth } from '../config/firebaseConfig.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;

            if (password !== confirmPassword) {
                Swal.fire({
                    icon: 'error',
                    title: 'รหัสผ่านไม่ตรงกัน',
                    text: 'กรุณาตรวจสอบรหัสผ่านและยืนยันรหัสผ่านอีกครั้ง',
                    confirmButtonColor: '#10b981'
                });
                return;
            }

            Swal.fire({
                title: 'กำลังสร้างบัญชี...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                // 1. สร้างบัญชีผ่าน Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. อัปเดต DisplayName ให้ Auth
                await updateProfile(user, { displayName: username });

                // 3. บันทึกข้อมูล Profile + Role ลง Firestore (พร้อมแจกโบนัส 30 Keys)
                const userData = {
                    username: username,
                    email: email,
                    role: 'user', // กำหนดค่าเริ่มต้นเป็น user เสมอ
                    points: 12, // 🎁 New User Starter Pack ตามแผน
                    photoURL: "", // 🟢 เก็บรูปโปรไฟล์ที่นี่ที่เดียว
                    isActive: true,
                    emailBonusClaimed: false, 
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                await setDoc(doc(db, "users", user.uid), userData);

                Swal.fire({
                    icon: 'success',
                    title: 'สมัครสมาชิกสำเร็จ!',
                    text: 'ยินดีต้อนรับสู่ Luminous Story คุณได้รับ 12 กุญแจ เป็นของขวัญต้อนรับค่ะ 🎁',
                    confirmButtonColor: '#10b981',
                    timer: 3000,
                    showConfirmButton: false
                }).then(() => {
                    // สมัครเสร็จ พากลับไปหน้า Home เสมอ
                        window.location.href = 'index.html';
                });

            } catch (error) {
                console.error("Registration Error:", error);
                let errorMsg = 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
                if (error.code === 'auth/email-already-in-use') errorMsg = 'อีเมลนี้ถูกใช้งานแล้ว';
                if (error.code === 'auth/weak-password') errorMsg = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
                
                Swal.fire({
                    icon: 'error',
                    title: 'สมัครไม่สำเร็จ',
                    text: errorMsg,
                    confirmButtonColor: '#10b981'
                });
            }
        });
    }
});
