// js/pages/profile.js
import { db, auth } from '../config/firebaseConfig.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadProfileData();
            setupEvents();
        } else {
            // ถ้าไม่ได้ล็อกอิน ให้เด้งไปหน้า login
            window.location.href = 'login.html';
        }
    });
});

async function loadProfileData() {
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            userData = docSnap.data();

            // นำข้อมูลไปใส่ใน UI
            document.getElementById('input-username').value = userData.username || '';
            document.getElementById('input-email').value = userData.email || currentUser.email;
            document.getElementById('input-role').value = userData.role || 'user';
            document.getElementById('profile-points').innerText = (userData.points || 0).toLocaleString();
            
            const photoUrl = userData.photoURL || `https://ui-avatars.com/api/?name=${userData.username || 'User'}&background=10b981&color=fff`;
            document.getElementById('profile-avatar').src = photoUrl;
            document.getElementById('avatar-url-input').value = userData.photoURL || '';

            // ถ้าเป็น Creator ให้แสดงฟอร์มสำหรับนักเขียน
            if (userData.role === 'creator' || userData.role === 'admin') {
                document.getElementById('creator-section').classList.remove('hidden');
                //if (userData.creatorProfile) {
                    // ดึงข้อมูลนามปากกาและประวัติย่อ โดยเช็คทั้งจาก Root level และจาก creatorProfile เผื่อไว้
                document.getElementById('input-penname').value = userData.penName || (userData.creatorProfile ? userData.creatorProfile.penName : '') || '';
                document.getElementById('input-bio').value = userData.bio || (userData.creatorProfile ? userData.creatorProfile.bio : '') || '';
                //}
            } else {
                const upgradeSection = document.getElementById('upgrade-invite-section');
                if(upgradeSection) upgradeSection.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้', 'error');
    }
}

function setupEvents() {
    const form = document.getElementById('profile-form');
    const avatarInput = document.getElementById('avatar-url-input');

    // พรีวิวรูปภาพเมื่อผู้ใช้เปลี่ยน URL
    avatarInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            document.getElementById('profile-avatar').src = url;
        } else {
            document.getElementById('profile-avatar').src = `https://ui-avatars.com/api/?name=${userData.username || 'User'}&background=10b981&color=fff`;
        }
    });

    // อัปเดตข้อมูล
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSave = document.getElementById('btn-save-profile');
        const originalText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

        try {
            const newUsername = document.getElementById('input-username').value.trim();
            const newPhotoURL = document.getElementById('avatar-url-input').value.trim();
            const newPenName = document.getElementById('input-penname').value.trim();
            
            const updatePayload = {
                username: newUsername,
                photoURL: newPhotoURL, 
                updatedAt: new Date()
            };

            if (userData.role === 'creator' || userData.role === 'admin') {
                // บันทึกข้อมูลที่ Root level ให้สอดคล้องกับหน้าสมัคร Creator
                updatePayload.penName = newPenName;
                updatePayload.bio = document.getElementById('input-bio').value.trim();
                
                // บันทึกใน creatorProfile เผื่อรองรับระบบที่มีการเรียกใช้ก้อน Object ในอนาคต
                updatePayload.creatorProfile = {
                    ...(userData.creatorProfile || {}),
                    penName: newPenName,
                    bio: document.getElementById('input-bio').value.trim(),
                };
            }            

            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, updatePayload);

            Swal.fire({
                title: 'บันทึกสำเร็จ!',
                text: 'อัปเดตข้อมูลโปรไฟล์ของคุณเรียบร้อยแล้ว',
                icon: 'success',
                confirmButtonColor: '#10b981',
                timer: 2000,
                showConfirmButton: false
            }).then(() => {
                window.location.reload(); // โหลดหน้าใหม่เพื่อให้ Navbar อัปเดตด้วย
            });

        } catch (error) {
            console.error("Error updating profile:", error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalText;
        }
    });
}