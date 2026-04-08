// js/pages/workDetail.js
import { db, auth } from '../config/firebaseConfig.js';
import { doc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, orderBy, updateDoc, increment, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { purchaseService } from '../services/purchaseService.js';

let currentWork = null;
let workId = null;
let allEpisodes = [];
let filteredEpisodes = [];
let currentEpPage = 1;
const EP_PER_PAGE = 20; // โหลดหน้าละ 20 ตอน
let epSortDesc = false; // false = เริ่มตอนแรก (1..), true = เริ่มตอนล่าสุด (99..)
let isBookmarked = false; // สำหรับเก็บสถานะการบุ๊กมาร์ก

export async function initWorkDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    workId = urlParams.get('id');

    if (!workId) {
        showError('ไม่พบรหัสผลงาน');
        return;
    }

    await loadWorkDetails();
    await loadEpisodes(); // เรียกข้อมูลตอนมาแสดง
}

async function loadWorkDetails() {
    const container = document.getElementById('work-detail-content');
    
    try {
        const docRef = doc(db, "works", workId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentWork = docSnap.data();
	// [ADD] เพิ่มยอดวิว +1 ทันทีเมื่อมีการโหลดหน้ารายละเอียดนี้
            try {
                await updateDoc(docRef, {
                    views: increment(1),
                    totalViews: increment(1) // อัปเดตเผื่อไว้ทั้งสองฟิลด์ ตามโครงสร้างที่คุณอาจใช้งานอยู่
                });
                // อัปเดตตัวเลขในตัวแปรทันที เพื่อให้ตอน Render แสดงผลยอดใหม่ล่าสุด
                currentWork.views = (currentWork.views || 0) + 1;
                currentWork.totalViews = (currentWork.totalViews || 0) + 1;
            } catch (e) {
                console.error("Error updating view count:", e);
            }
	//ดึงข้อมูลนักเขียนจากคอลเลกชัน users เพื่อเอานามปากกามาแสดง
            if (currentWork.creatorId) {
                const creatorSnap = await getDoc(doc(db, "users", currentWork.creatorId));
                if (creatorSnap.exists()) {
                    const creatorData = creatorSnap.data();
                    currentWork.creatorName = creatorData.creatorProfile?.penName || creatorData.username || "นักเขียนนิรนาม";
                }
            }
            renderWorkDetail(container);
        } else {
            showError('ผลงานนี้ถูกลบหรือไม่มีอยู่ในระบบ');
        }
    } catch (error) {
        console.error("Error loading work:", error);
        showError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

function showError(message) {
    document.getElementById('work-detail-content').innerHTML = `
        <div class="text-center py-20">
            <i class="fa-solid fa-triangle-exclamation text-6xl text-red-400 mb-4"></i>
            <h2 class="text-2xl font-bold text-gray-700">${message}</h2>
            <a href="works.html" class="inline-block mt-6 px-6 py-2 bg-primary text-white rounded-full hover:bg-primary-dark transition-colors">กลับสู่คลังผลงาน</a>
        </div>
    `;
}

function renderWorkDetail(container) {
    const coverAspect = 'w-48 sm:w-56 md:w-64 aspect-[2/3]';
    
    container.innerHTML = `
        <div class="bg-white rounded-3xl shadow-sm border border-emerald-100 p-6 md:p-8 mb-8 flex flex-col md:flex-row gap-8 items-start">
            <div class="${coverAspect} shrink-0 overflow-hidden rounded-2xl shadow-md border border-gray-100 mx-auto md:mx-0 md:sticky md:top-24 z-10 bg-white">
                <img src="${currentWork.coverImage || 'https://placehold.co/300x450/10b981/ffffff?text=No+Cover'}" class="w-full h-full object-cover bg-gray-100">
            </div>
            
            <div class="flex-grow flex flex-col justify-center w-full overflow-hidden">
                <div class="flex items-center gap-2 mb-2">
                    <span class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                        ${currentWork.type === 'animation' ? 
'<i class="fa-solid fa-film"></i> Animation' : '<i class="fa-solid fa-video"></i> Shot Animation'}
                    </span>
                    <span class="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">${currentWork.status || 'Ongoing'}</span>
                </div>
                
                <h1 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4 break-words">${currentWork.title}</h1>
                
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 border-b border-gray-100 pb-6">
                    <a href="/creator-profile.html?id=${currentWork.creatorId}" class="hover:text-primary transition-colors flex items-center gap-1" title="ผู้แต่ง">
                        <i class="fa-solid fa-pen-nib text-emerald-400"></i> ${currentWork.creatorName || 'นักเขียนนิรนาม'}
                    </a>
                    <span><i class="fa-solid fa-layer-group text-emerald-400"></i> ${currentWork.mainGenre || 'ทั่วไป'}</span>
                    <span title="ยอดวิว"><i class="fa-solid fa-eye text-emerald-400"></i> ${currentWork.views ? currentWork.views.toLocaleString() : 0}</span>
                    <span title="จำนวนตอน"><i class="fa-solid fa-list-ol text-emerald-400"></i> ${currentWork.totalEpisodes || 0} ตอน</span>
                </div>
                
                <h3 class="font-bold text-lg mb-2 text-gray-800"><i class="fa-solid fa-quote-left text-emerald-300"></i> เรื่องย่อ</h3>
		<div class="flex items-center gap-3 mb-6">
                    <button id="btn-bookmark" onclick="window.toggleBookmark()" class="px-6 py-2.5 bg-white text-primary font-bold border-2 border-primary rounded-full hover:bg-emerald-50 transition-colors flex items-center gap-2 shadow-sm">
                        <i id="bookmark-icon" class="fa-regular fa-heart"></i> <span id="bookmark-text">เพิ่มเข้าชั้น</span>
                    </button>
                </div>
                <div class="relative mb-2">
                    <div id="synopsis-content" class="synopsis-content text-gray-600 font-reading bg-emerald-50/50 p-4 md:p-6 rounded-2xl border border-emerald-50 max-h-48 overflow-hidden transition-all duration-500">
                        ${currentWork.description || 'ยังไม่มีเรื่องย่อ'}
                    </div>
                    <div id="synopsis-gradient" class="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-emerald-50 to-transparent rounded-b-2xl pointer-events-none"></div>
                </div>
                <button id="toggle-synopsis-btn" class="text-primary font-bold text-sm hover:underline flex items-center gap-1 self-start">
                    อ่านเพิ่มเติม <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
        </div>

        <div class="bg-amber-50/70 rounded-3xl border border-amber-200 p-6 md:p-8 mb-8 text-center relative max-w-2xl mx-auto shadow-sm">
            <h2 class="text-xl md:text-2xl font-bold text-amber-800 mb-2 flex items-center justify-center gap-2">
                <i class="fa-solid fa-hand-holding-dollar text-amber-600 fa-bounce"></i> ถูกใจเรื่องนี้? สนับสนุนนักเขียนกันเถอะ! (Donate)
            </h2>
            <p class="text-sm md:text-base text-amber-700/80 mb-6">กำลังใจเล็กๆ ของคุณ คือพลังที่ยิ่งใหญ่ในการปั่นตอนต่อไป <i class="fa-solid fa-cookie"></i><i class="fa-solid fa-heart text-pink-400 ml-1"></i></p>
            
            <div class="flex justify-center items-end gap-3 md:gap-6">
                <button onclick="window.triggerCoffeeSupport(20, 'ขอบคุณเล็กๆ')" class="bg-white border border-gray-200 rounded-2xl p-4 w-24 hover:border-amber-300 hover:shadow-md transition-all transform hover:-translate-y-1 flex flex-col items-center group">
                    <i class="fa-solid fa-mug-hot text-2xl text-amber-700 mb-2 group-hover:scale-110 transition-transform"></i>
                    <p class="text-gray-600 font-bold text-sm">20 ฿</p>
                </button>
                
                <div class="relative">
                    <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-red-400 text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm whitespace-nowrap z-10 animate-pulse">แนะนำ</div>
                    <button onclick="window.triggerCoffeeSupport(50, 'กำลังใจ')" class="bg-amber-100/50 border-2 border-yellow-400 rounded-2xl p-5 w-28 hover:bg-amber-100 hover:shadow-lg transition-all transform hover:-translate-y-1 flex flex-col items-center group shadow-sm">
                        <i class="fa-solid fa-pizza-slice text-3xl text-amber-800 mb-2 group-hover:scale-110 transition-transform fa-beat-fade" style="--fa-animation-duration: 3s;"></i>
                        <p class="text-amber-900 font-black text-base">50 ฿</p>
                    </button>
                </div>

                <button onclick="window.triggerCoffeeSupport(100, 'ซัพพอร์ตจริงจัง')" class="bg-white border border-gray-200 rounded-2xl p-4 w-24 hover:border-amber-300 hover:shadow-md transition-all transform hover:-translate-y-1 flex flex-col items-center group">
                    <i class="fa-solid fa-champagne-glasses text-2xl text-amber-700 mb-2 group-hover:scale-110 transition-transform"></i>
                    <p class="text-gray-600 font-bold text-sm">100 ฿</p>
                </button>
            </div>
        </div>

        <div class="bg-white rounded-3xl shadow-sm border border-emerald-100 p-6 md:p-8">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2"><i class="fa-solid fa-list-ul text-primary"></i> รายชื่อตอนทั้งหมด</h2>
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div class="relative w-full sm:w-auto">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i class="fa-solid fa-magnifying-glass text-emerald-400"></i>
                        </div>
                        <input type="text" id="search-episode-input" class="w-full sm:w-56 pl-11 pr-4 py-2 bg-gray-50 border border-emerald-100 rounded-full text-sm focus:ring-2 focus:ring-primary outline-none transition-all placeholder-gray-500" placeholder="ค้นหาตอน / เลขตอน...">
                    </div>
                    <button id="sort-episode-btn" class="w-full sm:w-auto px-5 py-2 bg-white text-emerald-700 rounded-full text-sm font-bold border border-emerald-200 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <i class="fa-solid fa-arrow-down-1-9"></i> เริ่มตอนแรก
                    </button>
                </div>
            </div>
            
            <div id="episodes-container" class="grid grid-cols-1 gap-3 min-h-[200px]">
                <div class="text-center py-10 text-gray-500"><i class="fa-solid fa-spinner fa-spin text-3xl text-primary mb-3"></i><br>กำลังโหลดตอน...</div>
            </div>
            
            <div id="episodes-pagination" class="flex justify-center items-center gap-2 mt-8"></div>
        </div>
    `;

    setupDetailEvents();
}

// ฟังก์ชันเปิด Popup สนับสนุนกาแฟ
window.triggerCoffeeSupport = async (amount, cupName) => {
    const user = auth.currentUser;
    if (!user) {
        Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนจึงจะสามารถสนับสนุน Creator ได้', 'warning')
        .then(() => window.location.href = 'login.html');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: `<span class="text-emerald-700 font-bold"><i class="fa-solid fa-heart text-pink-500 fa-beat"></i> สนับสนุน ${cupName}</span>`,
        html: `
            <div class="mb-4 text-sm text-gray-500">ยอดสนับสนุน: <strong class="text-xl text-primary">${amount} บาท</strong></div>
            <div class="bg-gray-100 p-2 rounded-xl mb-4 border border-gray-200 flex justify-center">
                <img src="./assets/images/payment_qr.jpg" alt="PromptPay QR Code" class="w-48 h-48 object-cover rounded-lg shadow-sm" onerror="this.src='https://placehold.co/200x200/10b981/ffffff?text=QR+Code'">
            </div>
            <p class="text-xs text-red-500 mb-4 font-bold">* สแกน QR Code เพื่อชำระเงินก่อนส่งข้อความ (ระบบจำลอง)</p>
            <textarea id="support-message" class="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm resize-none" rows="3" placeholder="พิมพ์ข้อความให้กำลังใจนักเขียนที่นี่..."></textarea>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> ส่งข้อความสนับสนุน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#9ca3af',
        preConfirm: () => {
            const msg = document.getElementById('support-message').value;
            return { message: msg, amount: amount };
        }
    });

    if (formValues) {
        // แสดง Loading
        Swal.fire({
            title: 'กำลังส่งกำลังใจ...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            // บันทึกการแจ้งเตือนลง Firebase (ให้ไปโผล่ที่กระดิ่งของ Creator)
            // อ้างอิงจาก Database Schema : users/{userId}/notifications/{notificationId}
            if (currentWork.creatorId) {
                const notificationRef = collection(db, `users/${currentWork.creatorId}/notifications`);
                await addDoc(notificationRef, {
                    to: currentWork.creatorId,
                    type: "coffee",
                    amount: formValues.amount,
                    message: formValues.message || "ส่งกำลังใจให้คุณ!",
                    senderId: user.uid,
                    senderName: user.displayName || "นักอ่านท่านหนึ่ง",
                    workTitle: currentWork.title,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            }

            // แสดงแจ้งเตือนสำเร็จ
            Swal.fire({
                title: 'ส่งกำลังใจสำเร็จ!',
                text: 'ขอบคุณที่สนับสนุนนักสร้างสรรค์ ข้อความของคุณถูกส่งไปยัง Creator เรียบร้อยแล้ว',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
        } catch (error) {
            console.error("Error sending coffee support:", error);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถส่งการสนับสนุนได้ในขณะนี้', 'error');
        }
    }
};

function setupDetailEvents() {
    // 1. Toggle Synopsis (ย่อขยายเรื่องย่อ)
    const synopsisContent = document.getElementById('synopsis-content');
    const synopsisGradient = document.getElementById('synopsis-gradient');
    const toggleBtn = document.getElementById('toggle-synopsis-btn');
    
    if (synopsisContent && toggleBtn) {
        if (synopsisContent.scrollHeight <= 192) {
            toggleBtn.classList.add('hidden');
            synopsisGradient.classList.add('hidden');
        } else {
            toggleBtn.addEventListener('click', () => {
                if (synopsisContent.classList.contains('max-h-48')) {
                    synopsisContent.classList.remove('max-h-48');
                    synopsisContent.classList.add('max-h-[2000px]');
                    synopsisGradient.classList.add('hidden');
                    toggleBtn.innerHTML = 'ย่อเนื้อหา <i class="fa-solid fa-chevron-up"></i>';
                } else {
                    synopsisContent.classList.add('max-h-48');
                    synopsisContent.classList.remove('max-h-[2000px]');
                    synopsisGradient.classList.remove('hidden');
                    toggleBtn.innerHTML = 'อ่านเพิ่มเติม <i class="fa-solid fa-chevron-down"></i>';
                }
            });
        }
    }

    // 2. Search & Sort Episodes
    const searchInput = document.getElementById('search-episode-input');
    const sortBtn = document.getElementById('sort-episode-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            filteredEpisodes = allEpisodes.filter(ep => 
                (ep.title && ep.title.toLowerCase().includes(term)) || 
                (ep.episodeNumber && ep.episodeNumber.toString() === term)
            );
            
            if (epSortDesc) filteredEpisodes.reverse(); // คงสถานะการเรียงลำดับไว้
            currentEpPage = 1;
            renderEpisodesPage();
        });
    }

    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            epSortDesc = !epSortDesc;
            sortBtn.innerHTML = epSortDesc 
                ? '<i class="fa-solid fa-arrow-down-9-1"></i> เริ่มตอนล่าสุด' 
                : '<i class="fa-solid fa-arrow-down-1-9"></i> เริ่มตอนแรก';
            
            filteredEpisodes.reverse();
            currentEpPage = 1;
            renderEpisodesPage();
        });
    }
}

async function loadEpisodes() {
    try {
        const epRef = collection(db, `works/${workId}/episodes`);
        // ดึงเฉพาะตอนที่กด Publish แล้วมาแสดงหน้าคนอ่าน
        const q = query(epRef, orderBy("episodeNumber", "asc"));
        const snap = await getDocs(q);
        
        // กรองเอาเฉพาะตอนที่ published = true เพื่อไม่ให้คนอ่านเห็น Draft
        allEpisodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(ep => ep.published !== false);
        filteredEpisodes = [...allEpisodes];

        // เรียกใช้ฟังก์ชันคำนวณราคาและแสดงปุ่มปลดล็อคทั้งเรื่อง
        renderCompleteUnlock();
        
        if (epSortDesc) filteredEpisodes.reverse();
        
        renderEpisodesPage();
    } catch (error) {
        console.error("Error loading episodes:", error);
        document.getElementById('episodes-container').innerHTML = '<div class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูลตอน</div>';
    }
}

function renderEpisodesPage() {
    const container = document.getElementById('episodes-container');
    const pagination = document.getElementById('episodes-pagination');
    
    if (filteredEpisodes.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><i class="fa-solid fa-box-open text-4xl text-gray-300 mb-3"></i><br>ยังไม่มีตอนที่เผยแพร่</div>';
        pagination.innerHTML = '';
        return;
    }

    const startIndex = (currentEpPage - 1) * EP_PER_PAGE;
    const endIndex = startIndex + EP_PER_PAGE;
    const pageData = filteredEpisodes.slice(startIndex, endIndex);

    // กำหนดหน้าปลายทาง (หาก Shot Animation ใช้ watch.html และ Animation ใช้ player.html)
    const targetPage = currentWork.type === 'shot_animation' ? 'watch.html' : 'player.html';

    container.innerHTML = pageData.map(ep => `
        <a href="${targetPage}?workId=${workId}&epId=${ep.id}" class="flex items-center justify-between p-4 bg-white hover:bg-emerald-50 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors shadow-sm group">
            <div class="flex items-center gap-4 overflow-hidden">
                <div class="w-10 h-10 rounded-full bg-emerald-50 shrink-0 flex items-center justify-center text-primary font-bold shadow-inner border border-emerald-100 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all">
                    ${ep.episodeNumber || '-'}
                </div>
                <div class="overflow-hidden">
                    <h4 class="font-bold text-gray-800 group-hover:text-primary transition-colors truncate">${ep.title}</h4>
                    <p class="text-[10px] md:text-xs text-gray-400 mt-1 flex items-center gap-3">
                        <span title="ยอดวิว"><i class="fa-solid fa-eye text-gray-300"></i> ${ep.views ? ep.views.toLocaleString() : 0}</span>
                        <span title="อัปเดต"><i class="fa-solid fa-clock text-gray-300"></i> ${ep.updatedAt ? new Date(ep.updatedAt.toDate()).toLocaleDateString('th-TH') : 'ใหม่'}</span>
                    </p>
                </div>
            </div>
            <div class="shrink-0 pl-2">
                ${ep.isFree !== false 
                    ? '<span class="text-emerald-500 font-bold text-xs md:text-sm bg-emerald-50 px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap"><i class="fa-solid fa-lock-open"></i> อ่านฟรี</span>' 
                    : `<span class="text-yellow-600 font-bold text-xs md:text-sm bg-yellow-50 px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap"><i class="fa-solid fa-key"></i> ${ep.pricePoints || 0} กุญแจ</span>`}
            </div>
        </a>
    `).join('');

    renderEpPagination();
}

function renderEpPagination() {
    const container = document.getElementById('episodes-pagination');
    const totalPages = Math.ceil(filteredEpisodes.length / EP_PER_PAGE);
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    
    // ปุ่ม Prev
    html += `<button onclick="window.changeEpPage(${currentEpPage - 1})" ${currentEpPage === 1 ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${currentEpPage === 1 ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-primary hover:bg-emerald-50 border border-emerald-100'} transition shadow-sm"><i class="fa-solid fa-chevron-left"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentEpPage) {
            html += `<button class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white font-bold shadow-md transform scale-110">${i}</button>`;
        } else if (i === 1 || i === totalPages || (i >= currentEpPage - 1 && i <= currentEpPage + 1)) {
            html += `<button onclick="window.changeEpPage(${i})" class="w-8 h-8 rounded-full bg-white text-gray-600 hover:bg-emerald-50 border border-gray-200 transition shadow-sm">${i}</button>`;
        } else if (i === currentEpPage - 2 || i === currentEpPage + 2) {
            html += `<span class="text-gray-400 px-1">...</span>`;
        }
    }

    // ปุ่ม Next
    html += `<button onclick="window.changeEpPage(${currentEpPage + 1})" ${currentEpPage === totalPages ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${currentEpPage === totalPages ? 'text-gray-300 bg-gray-50 cursor-not-allowed' : 'text-primary hover:bg-emerald-50 border border-emerald-100'} transition shadow-sm"><i class="fa-solid fa-chevron-right"></i></button>`;

    container.innerHTML = html;
}

async function renderCompleteUnlock() {
    const container = document.getElementById('complete-unlock-container');
    if (!container || !currentWork) return;

    // กรองหาเฉพาะตอนที่ติดเหรียญ
    const lockedEpisodes = allEpisodes.filter(ep => ep.isFree === false);
    if (lockedEpisodes.length === 0) {
        container.innerHTML = ''; // ถ้าไม่มีตอนติดเหรียญเลย ไม่ต้องโชว์ปุ่ม
        return;
    }

    // คำนวณราคาก่อนหักส่วนลด
    const baseTotalPrice = lockedEpisodes.reduce((sum, ep) => sum + (ep.pricePoints || 0), 0);
    
    // คำนวณความคืบหน้าของเรื่อง
    const totalEps = currentWork.totalEpisodes || allEpisodes.length;
    const progress = totalEps > 0 ? allEpisodes.length / totalEps : 1;

    // เงื่อนไข: เปิดขายเมื่อมีตอนอย่างน้อย 30% ของเรื่อง
    if (progress < 0.3 && currentWork.status !== 'completed') {
        container.innerHTML = ''; 
        return;
    }

    // กำหนดส่วนลดตามประเภทเรื่องและสถานะ
    let discountRate = 0;
    if (currentWork.type === 'novel') {
        if (currentWork.status === 'completed') discountRate = 0.50; // จบแล้ว 50%
        else if (progress >= 0.7) discountRate = 0.35; // ใกล้จบ 35%
        else discountRate = 0.25; // กลางเรื่อง 25%
    } else { // motion_comic
        if (currentWork.status === 'completed') discountRate = 0.35; // จบแล้ว 35%
        else if (progress >= 0.7) discountRate = 0.20; // ใกล้จบ 20%
        else discountRate = 0.10; // กลางเรื่อง 10%
    }

    const finalPrice = Math.floor(baseTotalPrice * (1 - discountRate));
    const maxEpNumber = Math.max(...allEpisodes.map(ep => ep.episodeNumber || 0));

    container.innerHTML = `
        <div class="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-6 md:p-8 w-full shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-6 transform hover:scale-[1.01] transition-transform">
            <div>
                <h3 class="text-xl md:text-2xl font-bold flex items-center gap-2 mb-2"><i class="fa-solid fa-unlock-keyhole"></i> ปลดล็อคทั้งเรื่อง (Unlock All)</h3>
                <p class="text-emerald-50 text-sm md:text-base opacity-90">จ่ายครั้งเดียว อ่านได้ทุกตอนที่มีอยู่ตอนนี้ (${allEpisodes.length} ตอน)</p>
            </div>
            <div class="flex flex-col items-center md:items-end">
                <div class="text-sm line-through text-emerald-200 mb-1">ราคาปกติ ${baseTotalPrice} Keys</div>
                <button id="btn-unlock-all" class="bg-white text-emerald-600 hover:bg-emerald-50 font-bold text-lg py-3 px-6 md:px-8 rounded-full shadow-md transition-all flex items-center gap-2">
                    <i class="fa-solid fa-key"></i> ปลดล็อค ${finalPrice} Keys
                    <span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse ml-2">ลด ${discountRate * 100}%</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-unlock-all').addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนทำการซื้อ', 'warning').then(() => window.location.href = 'login.html');
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันการปลดล็อค?',
            text: `คุณต้องการใช้ ${finalPrice} Keys เพื่อปลดล็อคตอนที่มีทั้งหมดใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: 'ยืนยันการซื้อ'
        });

        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const res = await purchaseService.purchaseComplete(user.uid, workId, finalPrice, maxEpNumber);
            if (res.success) {
                Swal.fire('สำเร็จ!', 'ปลดล็อคตอนทั้งหมดเรียบร้อยแล้ว ขอให้อ่านให้สนุกครับ 🎉', 'success').then(() => window.location.reload());
            } else {
                Swal.fire('เกิดข้อผิดพลาด', res.error, 'error');
            }
        }
    });
}

window.changeEpPage = (page) => {
    const totalPages = Math.ceil(filteredEpisodes.length / EP_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentEpPage = page;
        renderEpisodesPage();
    }
};

// [INSERT]
// ระบบ Bookmark (เพิ่มเข้าชั้น)
onAuthStateChanged(auth, async (user) => {
    if (user && workId) {
        try {
            const bookmarkRef = doc(db, `users/${user.uid}/bookmarks`, workId);
            const snap = await getDoc(bookmarkRef);
            if (snap.exists()) {
                isBookmarked = true;
                updateBookmarkUI();
            }
        } catch (err) {
            console.error("Error checking bookmark:", err);
        }
    }
});

function updateBookmarkUI() {
    const icon = document.getElementById('bookmark-icon');
    const text = document.getElementById('bookmark-text');
    const btn = document.getElementById('btn-bookmark');
    if (!icon || !text || !btn) return;

    if (isBookmarked) {
        icon.className = 'fa-solid fa-heart text-pink-500';
        text.innerText = 'อยู่ในชั้นแล้ว';
        btn.classList.remove('border-primary', 'text-primary', 'hover:bg-emerald-50');
        btn.classList.add('border-pink-500', 'text-pink-600', 'hover:bg-pink-50');
    } else {
        icon.className = 'fa-regular fa-heart';
        text.innerText = 'เพิ่มเข้าชั้น';
        btn.classList.remove('border-pink-500', 'text-pink-600', 'hover:bg-pink-50');
        btn.classList.add('border-primary', 'text-primary', 'hover:bg-emerald-50');
    }
}

window.toggleBookmark = async () => {
    const user = auth.currentUser;
    if (!user) {
        Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนเพื่อเพิ่มเข้าชั้น', 'warning')
        .then(() => window.location.href = 'login.html');
        return;
    }

    try {
        const bookmarkRef = doc(db, `users/${user.uid}/bookmarks`, workId);
        if (isBookmarked) {
            await deleteDoc(bookmarkRef);
            isBookmarked = false;
            Swal.fire({ title: 'นำออกจากชั้นแล้ว', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        } else {
            await setDoc(bookmarkRef, {
                workId: workId,
                createdAt: serverTimestamp()
            });
            isBookmarked = true;
            Swal.fire({ title: 'เพิ่มเข้าชั้นสำเร็จ!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        }
        updateBookmarkUI();
    } catch (error) {
        console.error("Bookmark error:", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถทำรายการได้ในขณะนี้', 'error');
    }
};