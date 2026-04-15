// js/pages/works.js
import { db } from '../config/firebaseConfig.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let allWorks = [];
let filteredWorks = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 24; // 1 หน้ามี 24 เรื่อง (6 เรื่อง x 4 แถว บน Desktop)
let currentFilter = 'all'; // 'all', 'animation', 'shot_animation'

// เพิ่มตัวแปรสำหรับระบบค้นหาและตัวกรอง
let searchQuery = '';
let statusFilter = 'all';
let primaryGenreFilter = 'all';
let tagFilter = 'all';

export async function initWorks() {
    // เช็ค URL parameters เผื่อกดลิงก์ "ดูทั้งหมด" มาจากหน้า Home
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    if (typeParam === 'animation') currentFilter = 'animation';
    if (typeParam === 'shot_animation') currentFilter = 'shot_animation';

    setupFilterEvents();
    await fetchWorks();
}

async function fetchWorks() {
    try {
        const worksRef = collection(db, "works");
        // ดึงเฉพาะผลงานที่กด Publish แล้ว
        const q = query(worksRef, where("published", "==", true), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allWorks = snapshot.docs.map(doc => ({ workId: doc.id, ...doc.data() }));
        
        applyFilterAndRender();
    } catch (error) {
        console.error("Error fetching works:", error);
        document.getElementById('works-list').innerHTML = '<div class="col-span-full text-center py-10 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล โปรดลองใหม่อีกครั้ง</div>';
    }
}

function setupFilterEvents() {
    document.getElementById('filter-all').addEventListener('click', () => { currentFilter = 'all'; applyFilterAndRender(); });
    document.getElementById('filter-animation').addEventListener('click', () => { currentFilter = 'animation'; applyFilterAndRender(); });
    document.getElementById('filter-shot-animation').addEventListener('click', () => { currentFilter = 'shot_animation'; applyFilterAndRender(); });
}

// ระบบค้นหาและตัวกรอง Dropdown
    const searchInput = document.getElementById('search-input');
    const statusSelect = document.getElementById('filter-status');
    const primaryGenreSelect = document.getElementById('filter-primary-genre');
    const tagsSelect = document.getElementById('filter-tags');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            applyFilterAndRender();
        });
    }
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            statusFilter = e.target.value;
            applyFilterAndRender();
        });
    }
    if (primaryGenreSelect) {
        primaryGenreSelect.addEventListener('change', (e) => {
            primaryGenreFilter = e.target.value;
            applyFilterAndRender();
        });
    }
    if (tagsSelect) {
        tagsSelect.addEventListener('change', (e) => {
            tagFilter = e.target.value;
            applyFilterAndRender();
        });
    }

function updateFilterUI() {
    const btns = {
        'all': document.getElementById('filter-all'),
        'animation': document.getElementById('filter-animation'),
        'shot_animation': document.getElementById('filter-shot-animation')
    };
    
    // รีเซ็ตปุ่มทั้งหมด
    Object.values(btns).forEach(btn => {
        btn.className = "px-6 py-2 rounded-full font-bold text-sm text-gray-500 hover:text-primary transition-colors";
    });

    // ไฮไลต์ปุ่มที่ถูกเลือก
    if (btns[currentFilter]) {
        btns[currentFilter].className = "px-6 py-2 rounded-full font-bold text-sm bg-primary text-white transition-colors shadow-sm";
    }
}

function applyFilterAndRender() {
    updateFilterUI();
    currentPage = 1;

    filteredWorks = allWorks.filter(w => {
        // 1. กรองประเภท (Type) ป้องกันงานเก่าที่ไม่เกี่ยวข้องมาแสดงปะปน
        const wTypeStr = String(w.type || '').toLowerCase().replace(/[\s-]/g, '_');
        const isValidType = wTypeStr === 'animation' || wTypeStr === 'shot_animation';
        const matchType = isValidType && (currentFilter === 'all' || wTypeStr === currentFilter);
        
        // 2. กรองคำค้นหา (Search)
        const matchSearch = searchQuery === '' || (w.title && w.title.toLowerCase().includes(searchQuery));
        
        // 3. กรองสถานะ (Status)
        const matchStatus = statusFilter === 'all' || w.status === statusFilter;
        
        // 4. กรองหมวดหลัก (Primary Genre) - ตรวจสอบใน Array primaryGenres
        const matchPrimaryGenre = primaryGenreFilter === 'all' || 
            (w.primaryGenres && Array.isArray(w.primaryGenres) && w.primaryGenres.includes(primaryGenreFilter));
        
        // 5. กรองแท็ก (Tags) - ตรวจสอบใน Array tags
        const matchTag = tagFilter === 'all' || 
            (w.tags && Array.isArray(w.tags) && w.tags.includes(tagFilter));

        return matchType && matchSearch && matchStatus && matchPrimaryGenre && matchTag;
    });

    renderPage();
}

function renderPage() {
    const listContainer = document.getElementById('works-list');
    const paginationContainer = document.getElementById('pagination-container');
    
    if (filteredWorks.length === 0) {
        listContainer.innerHTML = '<div class="col-span-full text-center py-20 text-gray-500 bg-white rounded-3xl border border-dashed border-gray-300 w-full"><i class="fa-solid fa-box-open text-4xl mb-3 text-emerald-200"></i><br>ไม่พบผลงานในหมวดหมู่นี้</div>';
        listContainer.className = "flex justify-center mb-10"; // เอา Grid ออกชั่วคราวให้สวย
        paginationContainer.innerHTML = '';
        return;
    }

    // ปรับ Grid ให้ใช้คอลัมน์ปกตั้งทั้งหมด
listContainer.className = "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 mb-10";

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageData = filteredWorks.slice(startIndex, endIndex);

    listContainer.innerHTML = pageData.map(work => createWorkCard(work)).join('');

    renderPagination(filteredWorks.length);
}

function createWorkCard(work) {
    const aspectClass = 'aspect-[2/3]';
return `
        <a href="work-detail.html?id=${work.workId}" class="group block bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-emerald-100 flex flex-col h-full">
            <div class="${aspectClass} overflow-hidden relative shrink-0">
                <img src="${work.coverImage || 'https://placehold.co/300x450/10b981/ffffff?text=No+Cover'}" alt="${work.title}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] md:text-xs font-bold shadow-sm flex items-center gap-1 ${work.type === 'animation' ? 'text-indigo-600' : 'text-orange-500'}">
                    ${work.type === 'animation' ? '<i class="fa-solid fa-film"></i> Animation' : '<i class="fa-solid fa-video"></i> Shot Animation'}
                </div>
            </div>
            <div class="p-3 md:p-4 flex-grow flex flex-col">
                <h3 class="font-bold text-sm md:text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors text-gray-800" title="${work.title}">${work.title}</h3>
                <p class="text-[10px] md:text-xs text-gray-500 mb-2 flex items-center gap-1 mt-auto pt-2">
                    <i class="fa-solid fa-layer-group text-emerald-400"></i> ${ (work.primaryGenres && work.primaryGenres.length > 0) ? work.primaryGenres[0] : 'ทั่วไป' }
                </p>
                <div class="flex items-center justify-between text-[10px] md:text-xs text-gray-400 gap-1">
                    <span class="flex items-center gap-1 shrink-0" title="ยอดวิว"><i class="fa-solid fa-eye text-gray-300"></i> ${work.views ? work.views.toLocaleString() : 0}</span>
                    <span class="flex items-center gap-1 shrink-0 text-primary font-bold" title="จำนวนตอน"><i class="fa-solid fa-list-ol"></i> ${work.totalEpisodes || 0}</span>
                    <span class="flex items-center gap-1 shrink-0 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium truncate" title="สถานะ">
                        ${work.status || 'Ongoing'}
                    </span>
                </div>
            </div>
        </a>
    `;
}

function renderPagination(totalItems) {
    const container = document.getElementById('pagination-container');
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    
    // ปุ่ม Prev
    html += `<button onclick="window.changeWorksPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-sm font-bold ${currentPage === 1 ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-primary hover:bg-emerald-50 border border-emerald-100'} transition shadow-sm"><i class="fa-solid fa-chevron-left"></i> ย้อนกลับ</button>`;
    
    // หมายเลขหน้า (แสดง 1 2 3 ... แบบง่าย)
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white font-bold shadow-lg transform scale-110">${i}</button>`;
        } else {
            // ซ่อนหน้าไกลๆ ป้องกันปุ่มล้นหน้าจอ
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                 html += `<button onclick="window.changeWorksPage(${i})" class="w-10 h-10 rounded-xl text-gray-600 hover:bg-emerald-50 border border-gray-200 transition bg-white shadow-sm">${i}</button>`;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                 html += `<span class="text-gray-400 px-1">...</span>`;
            }
        }
    }

    // ปุ่ม Next
    html += `<button onclick="window.changeWorksPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-sm font-bold ${currentPage === totalPages ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-primary hover:bg-emerald-50 border border-emerald-100'} transition shadow-sm">ถัดไป <i class="fa-solid fa-chevron-right"></i></button>`;

    container.innerHTML = html;
}

// Global function สำหรับดัก event จาก HTML Onclick
window.changeWorksPage = (page) => {
    const totalPages = Math.ceil(filteredWorks.length / ITEMS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderPage();
        // เลื่อนหน้าจอกลับขึ้นไปด้านบนอย่างนุ่มนวล
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};
