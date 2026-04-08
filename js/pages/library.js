// js/pages/library.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, query, orderBy, getDocs, doc, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUser = null;
let currentTab = 'history';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadTabData(currentTab);
        } else {
            Swal.fire({
                title: 'กรุณาเข้าสู่ระบบ',
                text: 'คุณต้องเข้าสู่ระบบเพื่อดูชั้นวางอนิเมชั่นของคุณ',
                icon: 'warning',
                confirmButtonColor: '#10b981',
                confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
                allowOutsideClick: false
            }).then(() => {
                window.location.href = 'login.html';
            });
        }
    });
});

// ฟังก์ชันสำหรับเปลี่ยน Tab (ประกาศเป็น Global ให้ HTML เรียกใช้ได้)
window.switchTab = (tabName) => {
    if (currentTab === tabName) return;
    
    // อัปเดตสไตล์ของ Tabs
    document.querySelectorAll('[id^="tab-"]').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('tab-inactive');
    });
    
    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.remove('tab-inactive');
    activeBtn.classList.add('tab-active');
    
    currentTab = tabName;
    loadTabData(tabName);
};

async function loadTabData(tabName) {
    const spinner = document.getElementById('loading-spinner');
    const grid = document.getElementById('works-grid');
    const emptyState = document.getElementById('empty-state');
    
    spinner.classList.remove('hidden');
    grid.classList.add('hidden');
    emptyState.classList.add('hidden');
    grid.innerHTML = '';

    try {
        let items = [];
        if (tabName === 'history') {
            try {
                const q = query(collection(db, `users/${currentUser.uid}/history`), orderBy("updatedAt", "desc"), limit(20));
                const snap = await getDocs(q);
                items = snap.docs.map(doc => ({ id: doc.id, workId: data.workId || doc.id, ...doc.data() }));
            } catch (e) { console.error("History access denied:", e); }

        } else if (tabName === 'bookmarks') {
            // สมมติฐาน: เก็บเรื่องที่โปรดปรานไว้ใน Subcollection `bookmarks` ของ User
            const q = query(collection(db, `users/${currentUser.uid}/bookmarks`), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
        } else if (tabName === 'purchased') {
            // ดึงข้อมูลจาก PurchasedEpisodes ตามโครงสร้างฐานข้อมูล
            const q = query(collection(db, `users/${currentUser.uid}/purchasedEpisodes`), orderBy("purchasedAt", "desc"));
            const snap = await getDocs(q);
            
            // Group ข้อมูลที่ซื้อตาม workId เพื่อไม่ให้แสดงการ์ดซ้ำ
            const purchasedWorksMap = new Map();
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (!purchasedWorksMap.has(data.workId)) {
                    purchasedWorksMap.set(data.workId, data);
                }
            });
            items = Array.from(purchasedWorksMap.values());
        }

        if (items.length === 0) {
            showEmptyState(tabName);
        } else {
            await renderGrid(items, tabName);
        }

    } catch (error) {
        console.error("Error loading library data:", error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลชั้นวางอนิเมชั่นได้ในขณะนี้', 'error');
        showEmptyState(tabName);
    } finally {
        spinner.classList.add('hidden');
    }
}

async function renderGrid(items, tabName) {
    const grid = document.getElementById('works-grid');
    let html = '';

    for (const item of items) {
        // ดึงข้อมูลหน้าปกและชื่อเรื่องหลักจาก Collection `works`
        const workDoc = await getDoc(doc(db, "works", item.workId));
        if (!workDoc.exists()) continue; // ข้ามไปถ้าผลงานถูกลบไปแล้ว
        const workData = workDoc.data();

        // ยกเลิกการแบ่งประเภท ให้แสดง Badge อนิเมชั่นอย่างเดียว และเปลี่ยนคำปุ่มเป็น "ดูต่อ"
        const typeBadge = '<div class="absolute top-2 right-2 bg-rose-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm"><i class="fa-solid fa-film"></i> Animation</div>';
        // ข้อความปุ่มตามบริบท
        let actionBtnText = "ดูต่อ";
        let actionUrl = `works.html?workId=${item.workId}&epId=${item.episodeId || ''}`;
        
        if (tabName === 'bookmarks') {
            actionBtnText = "หน้ารายละเอียด";
            actionUrl = `work-detail.html?id=${item.workId}`;
        }

        html += `
            <div class="bg-white rounded-2xl shadow-sm border border-emerald-50 overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col h-full cursor-pointer" onclick="window.location.href='${actionUrl}'">
                <div class="relative aspect-[3/4] overflow-hidden bg-gray-100">
                    <img src="${workData.coverImage || 'https://placehold.co/400x600/10b981/ffffff?text=Cover'}" alt="Cover" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    ${typeBadge}
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                        <div class="bg-primary/90 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-300">
                            <i class="fa-solid ${tabName === 'bookmarks' ? 'fa-info' : 'fa-play ml-1'}"></i>
                        </div>
                    </div>
                </div>
                <div class="p-4 flex-grow flex flex-col">
                    <h3 class="font-bold text-gray-800 text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">${workData.title || 'ไม่ทราบชื่อเรื่อง'}</h3>
                    ${item.episodeTitle && tabName !== 'bookmarks' ? `<p class="text-xs text-gray-500 mb-2 truncate">ล่าสุด: ${item.episodeTitle}</p>` : ''}
                    <div class="mt-auto pt-3 border-t border-gray-100 flex justify-center">
                        <span class="text-primary text-xs font-bold flex items-center gap-1 group-hover:scale-105 transition-transform"><i class="fa-solid fa-arrow-right"></i> ${actionBtnText}</span>
                    </div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
    grid.classList.remove('hidden');
}

function showEmptyState(tabName) {
    const emptyState = document.getElementById('empty-state');
    const icon = document.getElementById('empty-icon');
    const title = document.getElementById('empty-title');
    const desc = document.getElementById('empty-desc');

    if (tabName === 'history') {
        icon.className = 'fa-solid fa-clock-rotate-left';
        title.innerText = 'ยังไม่มีประวัติการรับชม';
        desc.innerText = 'ผลงานที่คุณเพิ่งรับชมจะปรากฏที่นี่ เพื่อให้คุณกลับมาดูต่อได้อย่างราบรื่น';
    } else if (tabName === 'bookmarks') {
        icon.className = 'fa-solid fa-heart-crack';
        title.innerText = 'ชั้นวางอนิเมชั่นว่างเปล่า';
        desc.innerText = 'กดไอคอนหัวใจในหน้ารายละเอียดผลงาน เพื่อเก็บเรื่องโปรดไว้ในชั้นวางอนิเมชั่นของคุณ';
    } else {
        icon.className = 'fa-solid fa-box-open';
        title.innerText = 'ยังไม่มีผลงานที่ปลดล็อก';
        desc.innerText = 'ตอนของผลงานที่คุณใช้กุญแจปลดล็อกจะถูกบันทึกรวบรวมไว้ที่นี่ทั้งหมด';
    }

    emptyState.classList.remove('hidden');
}
