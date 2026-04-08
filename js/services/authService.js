// js/services/authService.js
import { auth, db } from '../config/firebaseConfig.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. ฟังก์ชันสมัครสมาชิก (Register)
// ==========================================
export async function registerUser(email, password, username) {
    try {
        // 1.1 สร้าง User ใน Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1.3 เตรียมข้อมูลสำหรับบันทึกลง Firestore
        const userData = {
            userId: user.uid,
            username: username,
            email: email,
            role: "user", // ค่าเริ่มต้นคือ user
            points: 30, // 🎁 New User Starter Pack: สมัครสมาชิกได้ 30 keys
            emailBonusClaimed: false, // ป้องกันการรับโบนัสยืนยันอีเมลซ้ำ
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=10b981&color=fff`,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // 1.4 บันทึกลง Collection 'users'
        await setDoc(doc(db, "users", user.uid), userData);

        // 1.5 บันทึก Transaction Log สำหรับการแจกเหรียญสมัครใหม่
        // [OVERWRITE]
        const txRef = doc(collection(db, `users/${user.uid}/pointTransactions`));
        await setDoc(txRef, {
            amount: 30,
            type: "bonus",
            referenceId: "welcome_bonus",
            episodeId: null,
            createdAt: serverTimestamp()
        });

        // คืนค่า message ใหม่เพื่อให้หน้า UI โชว์ข้อความแนะนำให้ไป Contact Us
        return { success: true, user: userCredential.user, message: "สมัครสมาชิกสำเร็จ! คุณได้รับ 30 Keys (หากต้องการรับเพิ่ม 20 Keys กรุณาติดต่อแอดมินผ่านเมนู Contact Us)" };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการสมัครสมาชิก:", error);
        return { success: false, message: getThaiErrorMessage(error.code) };
    }
}

// ==========================================
// 2. ฟังก์ชันเข้าสู่ระบบ (Login)
// ==========================================
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ:", error);
        return { success: false, message: getThaiErrorMessage(error.code) };
    }
}

// ==========================================
// 3. ฟังก์ชันออกจากระบบ (Logout)
// ==========================================
export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการออกจากระบบ:", error);
        return { success: false, message: error.message };
    }
}

// ==========================================
// 4. ฟังก์ชันติดตามสถานะ (Auth State Observer)
// ==========================================
export function monitorAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

// ==========================================
// 5. ฟังก์ชันดึงข้อมูลผู้ใช้จาก Firestore
// ==========================================
export async function getUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้:", error);
        return null;
    }
}

// ==========================================
// Utility: แปลง Error Code เป็นภาษาไทย
// ==========================================
function getThaiErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'อีเมลนี้ถูกใช้งานแล้ว โปรดใช้อีเมลอื่น';
        case 'auth/invalid-email':
            return 'รูปแบบอีเมลไม่ถูกต้อง';
        case 'auth/weak-password':
            return 'รหัสผ่านควรมียาวอย่างน้อย 6 ตัวอักษร';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        default:
            return `เกิดข้อผิดพลาด: ${errorCode}`;
    }
}