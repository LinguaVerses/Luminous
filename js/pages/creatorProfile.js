// js/pages/creatorProfile.js
import { db } from '../config/firebaseConfig.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let creatorId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    creatorId = urlParams.get('id');

    if (!creatorId) {
        Swal.fire('ไม่พบนักเขียน', 'รหัสผู้เขียนไม่ถูกต้อง', 'error').then(() => {
            window.location.href = 'index.html';
        });
        return;
    }

    await loadCreatorData();
});

async function loadCreatorData() {
    const spinner = document.getElementById('loading-spinner');
    const content = document.getElementById('profile-content');
    
    try {
        // 1. ดึงข้อมูลนักเขียนจากคอลเลกชัน Users
        const userRef = doc(db, "users", creatorId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            throw new Error("ไม่พบข้อมูลผู้ใช้นี้ในระบบ");
        }

        const userData = userSnap.data();
        
        // ใช้ชื่อนามปากกา (ถ้ามี) หรือใช้ username พื้นฐาน
        const penName = userData.creatorProfile?.penName || userData.username || 'นักเขียนนิรนาม';
        const bio = userData.creatorProfile?.bio || 'นักเขียนคนนี้ยังไม่ได้เขียนแนะนำตัว...';
        const photoUrl = userData.creatorProfile?.profileImage || userData.photoURL || `https://ui-avatars.com/api/?name=${penName}&background=10b981&color=fff`;

        document.getElementById('creator-name').innerText = penName;
        document.getElementById('creator-bio').innerText = bio;
        document.getElementById('creator-avatar').src = photoUrl;

        // 2. ดึงผลงานทั้งหมดของนักเขียนคนนี้ (เฉพาะที่ Published แล้ว)
        const worksRef = collection(db, "works");
        const q = query(
            worksRef, 
            where("creatorId", "==", creatorId),
            where("published", "==", true), // แสดงเฉพาะเรื่องที่เผยแพร่แล้ว
            orderBy("createdAt", "desc")
        );
        
        const worksSnap = await getDocs(q);
        const worksList = worksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        document.getElementById('works-count').innerText = `${worksList.length} เรื่อง`;

        renderWorksGrid(worksList);

        // ซ่อนโหลดดิ้งและแสดงเนื้อหา
        spinner.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (error) {
        console.error("Error loading creator profile:", error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดโปรไฟล์นักเขียนได้', 'error').then(() => {
            window.history.back();
        });
    }
}

function renderWorksGrid(worksList) {
    const grid = document.getElementById('works-grid');
    const emptyState = document.getElementById('empty-state');

    if (worksList.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    let html = '';
    worksList.forEach(work => {
        // ระบุ Type ว่าเป็นนิยายหรือคอมมิค
        const isMotionComic = work.type === 'motion_comic';
        const typeBadge = isMotionComic 
            ? '<div class="absolute top-2 right-2 bg-rose-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm"><i class="fa-solid fa-film"></i> Motion</div>'
            : '<div class="absolute top-2 right-2 bg-blue-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm"><i class="fa-solid fa-book"></i> Novel</div>';

        html += `
            <a href="work-detail.html?id=${work.id}" class="bg-white rounded-2xl shadow-sm border border-emerald-50 overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col h-full cursor-pointer">
                <div class="relative aspect-[3/4] overflow-hidden bg-gray-100">
                    <img src="${work.coverImage || 'https://placehold.co/400x600/10b981/ffffff?text=Cover'}" alt="Cover" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    ${typeBadge}
                    <div class="absolute bottom-3 left-3 flex gap-2 text-white text-xs font-medium z-10">
                        <span class="flex items-center gap-1 drop-shadow-md"><i class="fa-solid fa-eye text-primary"></i> ${work.totalViews || 0}</span>
                        <span class="flex items-center gap-1 drop-shadow-md"><i class="fa-solid fa-list text-primary"></i> ${work.totalEpisodes || 0}</span>
                    </div>
                </div>
                <div class="p-4 flex-grow flex flex-col">
                    <h3 class="font-bold text-gray-800 text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">${work.title || 'ไม่ทราบชื่อเรื่อง'}</h3>
                    <p class="text-xs text-gray-500 flex items-center gap-1 mt-auto pt-2"><i class="fa-solid fa-layer-group"></i> ${work.status === 'completed' ? 'จบแล้ว' : 'กำลังอัปเดต'}</p>
                </div>
            </a>
        `;
    });

    grid.innerHTML = html;
}
