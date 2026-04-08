// js/creator/creatorDashboard.js

import { db, auth } from '../config/firebaseConfig.js'; 
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export function initCreatorDashboard() {
    // ใช้ onAuthStateChanged เพื่อรอให้ Firebase โหลดสถานะล็อกอินให้เสร็จก่อน
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.warn("ยังไม่ได้เข้าสู่ระบบ");
            // แจ้งเตือนผู้ใช้กรณีที่ยังไม่ได้ล็อกอิน
            Swal.fire({
                icon: 'warning',
                title: 'กรุณาเข้าสู่ระบบ',
                text: 'คุณต้องเข้าสู่ระบบก่อนเพื่อดูหน้าแดชบอร์ด',
                confirmButtonText: 'ตกลง'
            }).then(() => {
                // ตัวเลือก: สามารถให้เด้งกลับไปหน้าล็อกอินได้ เช่น window.location.href = '../login.html';
                const statsContainer = document.getElementById('stats-container');
                if (statsContainer) statsContainer.innerHTML = '<div class="col-span-1 md:col-span-3 p-8 text-center text-red-500">กรุณาเข้าสู่ระบบก่อนดูข้อมูล</div>';
            });
            return;
        }

        try {
            // 1. พยายามดึงข้อมูลสถิติ (ถ้าไม่มีให้ใช้ค่าเริ่มต้น 0 แทนการปล่อยให้ Error)
            let stats = { totalViews: 0, totalFollowers: 0, totalKeys: 0 };
            try {
                const statsRef = doc(db, 'creatorStats', user.uid);
                const statsSnap = await getDoc(statsRef);
                if (statsSnap.exists()) {
                    stats = statsSnap.data();
                }
            } catch (e) { 
                console.warn("Creator stats document not found or inaccessible, using defaults."); 
            }

            // 2. ดึงข้อมูลผลงาน (Works) จาก Firestore
            const worksRef = collection(db, 'works');
            const q = query(worksRef, where("creatorId", "==", user.uid));
            const querySnapshot = await getDocs(q);
            
            const works = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                works.push({
                    id: doc.id,
                    title: data.title || 'ไม่มีชื่อเรื่อง',
                    type: data.type || 'animation',
                    views: data.views || 0,
                    keys: data.keys || 0,
                    status: data.status || 'Ongoing',
                    lastUpdate: data.lastUpdate || 'เพิ่งอัปเดต'
                });
            });

            // 3. ส่งข้อมูลจริงไปให้ฟังก์ชัน Render ทำงานต่อ
            renderStats(stats);
            renderRecentWorks(works);
            setupEventListeners();
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ในขณะนี้'
            });
        }
    });
}

function renderStats(stats) {
    const container = document.getElementById('stats-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div class="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-2xl shadow-inner">
                <i class="fa-solid fa-eye"></i>
            </div>
            <div>
                <p class="text-sm text-gray-500 font-bold">ยอดเข้าชมรวม</p>
                <h3 class="text-2xl font-bold text-gray-800">${stats.totalViews.toLocaleString()} <span class="text-sm font-normal text-gray-500">ครั้ง</span></h3>
            </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div class="w-16 h-16 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center text-2xl shadow-inner">
                <i class="fa-solid fa-users"></i>
            </div>
            <div>
                <p class="text-sm text-gray-500 font-bold">ผู้ติดตามรวม</p>
                <h3 class="text-2xl font-bold text-gray-800">${stats.totalFollowers.toLocaleString()} <span class="text-sm font-normal text-gray-500">คน</span></h3>
            </div>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 opacity-10 text-yellow-500 text-7xl"><i class="fa-solid fa-key"></i></div>
            <div class="w-16 h-16 rounded-full bg-yellow-50 text-yellow-500 flex items-center justify-center text-2xl shadow-inner relative z-10">
                <i class="fa-solid fa-key fa-pulse"></i>
            </div>
            <div class="relative z-10">
                <p class="text-sm text-gray-500 font-bold">รายได้สะสม</p>
                <h3 class="text-2xl font-bold text-yellow-600">${stats.totalKeys.toLocaleString()} <span class="text-sm font-normal text-gray-500">กุญแจ</span></h3>
            </div>
        </div>
    `;
}

function renderRecentWorks(works) {
    const container = document.getElementById('recent-works-container');
    if (!container) return;

    if (works.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-gray-500">คุณยังไม่มีผลงาน เริ่มสร้างเรื่องแรกของคุณเลย!</div>`;
        return;
    }

    const rows = works.map(work => `
        <div class="flex flex-col md:flex-row items-center justify-between p-4 border-b border-gray-50 hover:bg-emerald-50/50 transition-colors gap-4">
            <div class="flex items-center gap-4 w-full md:w-auto">
                <div class="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-xl shadow-sm shrink-0">
                    ${work.type === 'animation' ? '<i class="fa-solid fa-film text-emerald-500"></i>' : '<i class="fa-solid fa-video text-indigo-500"></i>'}
                </div>
                <div>
                    <h4 class="font-bold text-gray-800 hover:text-primary cursor-pointer truncate max-w-[200px] md:max-w-md">${work.title}</h4>
                    <p class="text-xs text-gray-400 flex items-center gap-2">
                        <span>อัปเดต: ${work.lastUpdate}</span>
                        <span class="px-2 py-0.5 rounded-full ${work.status === 'Ongoing' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}">${work.status}</span>
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end text-sm">
                <div class="text-center">
                    <p class="text-gray-400 text-xs">ยอดวิว</p>
                    <p class="font-bold text-gray-700"><i class="fa-solid fa-eye text-gray-300"></i> ${work.views.toLocaleString()}</p>
                </div>
                <div class="text-center">
                    <p class="text-gray-400 text-xs">รายได้</p>
                    <p class="font-bold text-yellow-600"><i class="fa-solid fa-key text-yellow-400"></i> ${work.keys.toLocaleString()}</p>
                </div>
                <a href="../placeholder.html?page=creator/work/${work.id}/episodes" class="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center shadow hover:bg-primary-dark transition-transform hover:scale-110" title="จัดการตอน">
                    <i class="fa-solid fa-pen"></i>
                </a>
            </div>
        </div>
    `).join('');

    container.innerHTML = rows;
}

function setupEventListeners() {
    const guideBtn = document.getElementById('guide-btn');
    if (guideBtn) {
        guideBtn.addEventListener('click', () => {
            // การใช้งาน SweetAlert2 ให้หน้าตาสวยงาม
            Swal.fire({
                title: '<h2 class="text-2xl font-bold text-emerald-700"><i class="fa-solid fa-book-open"></i> คู่มือ Creator</h2>',
                html: `
                    <div class="flex flex-col gap-3 mt-4">
                        <a href="../guide-pricing.html" class="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl hover:bg-emerald-100 transition flex items-center gap-4">
                            <div class="bg-white w-12 h-12 rounded-full flex items-center justify-center shadow-sm text-xl"><i class="fa-solid fa-tags text-emerald-500"></i></div>
                            <div class="text-left"><span class="font-bold block">รายละเอียดการตั้งราคา</span><span class="text-xs text-emerald-600/70">กลยุทธ์การตั้งราคาให้ขายดี</span></div>
                        </a>
                        <a href="../guide-creator.html" class="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl hover:bg-emerald-100 transition flex items-center gap-4">
                            <div class="bg-white w-12 h-12 rounded-full flex items-center justify-center shadow-sm text-xl"><i class="fa-solid fa-user-pen text-emerald-500"></i></div>
                            <div class="text-left"><span class="font-bold block">การสมัครเป็น Creator</span><span class="text-xs text-emerald-600/70">ขั้นตอนและวิธีเริ่มต้นลงผลงาน</span></div>
                        </a>
                        <a href="../guide-revenue.html" class="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl hover:bg-emerald-100 transition flex items-center gap-4">
                            <div class="bg-white w-12 h-12 rounded-full flex items-center justify-center shadow-sm text-xl"><i class="fa-solid fa-sack-dollar text-emerald-500"></i></div>
                            <div class="text-left"><span class="font-bold block">รายละเอียดรายได้</span><span class="text-xs text-emerald-600/70">ส่วนแบ่งรายได้และการถอนเงิน</span></div>
                        </a>
                    </div>
                `,
                showConfirmButton: false,
                showCloseButton: true,
                backdrop: `rgba(16,185,129,0.1)`
            });
        });
    }
}
