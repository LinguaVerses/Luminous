// js/pages/read.js
import { db, auth } from '../config/firebaseConfig.js';
import { doc, getDoc, collection, getDocs, addDoc, setDoc, updateDoc, writeBatch, query, orderBy, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { episodeService } from '../services/episodeService.js';
import { purchaseService } from '../services/purchaseService.js';

let workId = null;
let episodeId = null;
let currentWork = null;
let currentEpisode = null;
let allEpisodesList = []; 
let currentIndex = -1;
let currentUser = null;
let allComments = [];

// การตั้งค่าผู้ใช้ (เก็บใน LocalStorage)
let userSettings = {
    fontSize: 18, // ขนาดเริ่มต้น 18px
    isDarkMode: false
};

export async function initReader() {
    const urlParams = new URLSearchParams(window.location.search);
    workId = urlParams.get('workId');
    episodeId = urlParams.get('epId');

    if (!workId || !episodeId) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลตอนที่ต้องการอ่าน', 'error').then(() => window.history.back());
        return;
    }

    document.getElementById('back-btn').href = `work-detail.html?id=${workId}`;
    loadUserSettings();

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        
        // ตั้งค่ารูปโปรไฟล์ที่กล่องคอมเมนต์
        const avatarImg = document.getElementById('current-user-avatar');
        if (avatarImg && user) {
            avatarImg.src = user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=10b981&color=fff`;
        }

        await loadEpisodeData(user);
    });
}

// ==========================================
// 1. ระบบจัดการ Settings (Font / Theme)
// ==========================================
function loadUserSettings() {
    const savedSettings = localStorage.getItem('luminous_reader_settings');
    if (savedSettings) {
        userSettings = JSON.parse(savedSettings);
    }
    applySettings();
    setupSettingsEvents();
}

function applySettings() {
    const content = document.getElementById('reading-content');
    const body = document.getElementById('reader-body');
    const themeIcon = document.querySelector('#btn-theme-toggle i');

    // นำขนาดฟอนต์ไปใช้
    if (content) content.style.fontSize = `${userSettings.fontSize}px`;

    // นำโหมดกลางคืนไปใช้
    if (userSettings.isDarkMode) {
        body.classList.add('dark');
	document.documentElement.classList.add('dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        themeIcon.classList.replace('text-gray-500', 'text-yellow-400');
    } else {
        body.classList.remove('dark');
	document.documentElement.classList.remove('dark');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        themeIcon.classList.replace('text-yellow-400', 'text-gray-500');
    }
}

function setupSettingsEvents() {
    document.getElementById('btn-font-increase').addEventListener('click', () => {
        if (userSettings.fontSize < 32) userSettings.fontSize += 2;
        saveAndApplySettings();
    });

    document.getElementById('btn-font-decrease').addEventListener('click', () => {
        if (userSettings.fontSize > 14) userSettings.fontSize -= 2;
        saveAndApplySettings();
    });

    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
        userSettings.isDarkMode = !userSettings.isDarkMode;
        saveAndApplySettings();
    });
}

function saveAndApplySettings() {
    localStorage.setItem('luminous_reader_settings', JSON.stringify(userSettings));
    applySettings();
}

// ==========================================
// 2. ระบบโหลดข้อมูลและการตรวจสอบสิทธิ์
// ==========================================
async function loadEpisodeData(user) {
    try {
        const workSnap = await getDoc(doc(db, "works", workId));
        if (workSnap.exists()) currentWork = workSnap.data();

        const epQuery = query(collection(db, `works/${workId}/episodes`), orderBy("episodeNumber", "asc"));
        const allEpSnap = await getDocs(epQuery);
        // กรองเฉพาะตอนที่ Publish แล้ว
        allEpisodesList = allEpSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(ep => ep.published !== false);
        
        currentIndex = allEpisodesList.findIndex(ep => ep.id === episodeId);
        currentEpisode = allEpisodesList[currentIndex];

        if (!currentEpisode) throw new Error("ไม่พบตอน");

        document.getElementById('nav-work-title').innerText = currentWork?.title || "ไม่ทราบชื่อเรื่อง";
        document.getElementById('nav-ep-title').innerText = `EP.${currentEpisode.episodeNumber} ${currentEpisode.title}`;
        document.getElementById('ep-title-display').innerText = `EP.${currentEpisode.episodeNumber} : ${currentEpisode.title}`;

        checkAccessAndRender(user);

    } catch (error) {
        console.error(error);
        Swal.fire('ข้อผิดพลาด', 'เกิดปัญหาในการโหลดข้อมูลเนื้อหา', 'error');
    }
}

async function checkAccessAndRender(user) {
    const loading = document.getElementById('loading-spinner');
    const contentContainer = document.getElementById('content-container');
    const lockScreen = document.getElementById('lock-screen');
    const navButtons = document.getElementById('episode-navigation');
    
    loading.classList.add('hidden');
    navButtons.classList.remove('hidden');
    setupNavButtons();

    // ถ้าผู้เข้าชมเป็นเจ้าของผลงานเอง ให้เข้าอ่านได้เลย
    if (user && currentWork.creatorId === user.uid) {
        renderContent(contentContainer);
        return;
    }

    // ใช้ episodeService ตรวจสอบสิทธิ์ (รองรับทั้งตอนฟรี, ซื้อรายตอน และซื้อเหมา Complete Unlock)
    const hasAccess = await episodeService.checkAccess(
        user ? user.uid : null,
        workId,
        episodeId,
        currentEpisode.episodeNumber,
        currentEpisode.isFree || currentEpisode.pricePoints === 0
    );

    if (hasAccess) {
        renderContent(contentContainer); // มีสิทธิ์ -> โชว์เนื้อหา
    } else {
        showLockScreen(contentContainer, lockScreen); // ไม่มีสิทธิ์ -> โชว์หน้าล็อค
    }
}

// ==========================================
// 3. การแสดงผลเนื้อหา หรือ หน้าจอล็อก
// ==========================================
function renderContent(container) {
    container.classList.remove('hidden');
    const readingContent = document.getElementById('reading-content');
    let html = '';

        // กรณีเป็นนิยายปกติ (Novel)
        html += currentEpisode.contentText || '<p class="text-center text-gray-400">เนื้อหาว่างเปล่า</p>';

    readingContent.innerHTML = html;
    
    // แสดงระบบคอมเมนต์และโหลดข้อมูล
    document.getElementById('comments-section').classList.remove('hidden');
    loadComments();
    setupCommentEvents();
}

function showLockScreen(contentContainer, lockScreen) {
    contentContainer.classList.remove('hidden');
    lockScreen.classList.remove('hidden');
    
    // จำลองเนื้อหาเบลอๆ
    const dummyText = currentEpisode.contentText ? currentEpisode.contentText.substring(0, 200) + '...' : 'เนื้อหาตอนนี้ถูกสงวนสิทธิ์ไว้เฉพาะผู้ที่ปลดล็อก...';
    document.getElementById('reading-content').innerHTML = dummyText;
    document.getElementById('reading-content').classList.add('blur-sm', 'select-none', 'opacity-50');

    const price = currentEpisode.pricePoints || 10;
    document.getElementById('single-price').innerText = price;
    
    // ผูก Event ปุ่มซื้อ 1 ตอน
    document.getElementById('btn-unlock-single').onclick = () => processPurchase(price, false);
    
    // Bundle (ปลดล็อกล่วงหน้า ลด 10%)
    const bundleBtn = document.getElementById('btn-unlock-bundle');
    const remainingEps = allEpisodesList.length - currentIndex;
    
    if (remainingEps > 1) {
        const bundleCount = Math.min(5, remainingEps); // คำนวณตามตอนที่เหลืออยู่จริง (สูงสุด 5 ตอน)
        let totalBundlePrice = 0;
        for(let i = 0; i < bundleCount; i++) {
            totalBundlePrice += allEpisodesList[currentIndex + i].pricePoints || 0;
        }
        const finalBundlePrice = Math.floor(totalBundlePrice * 0.9);
        
        bundleBtn.classList.remove('hidden');
        bundleBtn.innerHTML = `<div class="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-[shine_1.5s_ease-in-out]"></div>
                               <i class="fa-solid fa-unlock-keyhole"></i> Unlock Next ${bundleCount} Episodes (${finalBundlePrice} กุญแจ)
                               <span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1 animate-pulse">Save 10%</span>`;
        bundleBtn.onclick = () => processPurchase(finalBundlePrice, true, bundleCount);
    } else {
        bundleBtn.classList.add('hidden'); // ซ่อนปุ่มถ้าเหลือแค่อ่านตอนสุดท้าย
    }
}

async function processPurchase(amount, isBundle, bundleCount = 5) {
    if (!auth.currentUser) {
        Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องล็อกอินก่อนทำการปลดล็อก', 'warning').then(() => window.location.href = 'login.html');
        return;
    }

    Swal.fire({
        title: 'ยืนยันการปลดล็อก?',
        text: `คุณต้องการใช้ ${amount} กุญแจ เพื่อปลดล็อก${isBundle ? ` ${bundleCount} ตอนล่วงหน้า` : 'ตอนนี้'} ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '<i class="fa-solid fa-unlock"></i> ยืนยันปลดล็อก',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังปลดล็อกเนื้อหา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            
            try {
                const userRef = doc(db, "users", auth.currentUser.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();
                const currentPoints = userData?.points || 0;

                if (currentPoints < amount) {
                    Swal.fire({
                        title: 'กุญแจไม่พอ!',
                        text: `คุณมี ${currentPoints} กุญแจ (ต้องการ ${amount} กุญแจ)`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: '<i class="fa-solid fa-coins"></i> เติมกุญแจเพิ่ม',
                        cancelButtonText: 'ยกเลิก',
                        confirmButtonColor: '#10b981'
                    }).then((res) => {
                        if (res.isConfirmed) window.location.href = 'topup.html';
                    });
                    return;
                }

                // [OVERWRITE]
                const targetEpisodes = allEpisodesList.slice(currentIndex, currentIndex + (isBundle ? bundleCount : 1));
                let purchaseResult;

                if (isBundle) {
                    // จัดเตรียมข้อมูล Array สำหรับส่งให้ purchaseService
                    const epList = targetEpisodes.map(ep => ({ episodeId: ep.id, price: ep.pricePoints }));
                    purchaseResult = await purchaseService.purchaseBundle(auth.currentUser.uid, workId, epList, amount);
                } else {
                    purchaseResult = await purchaseService.purchaseEpisode(auth.currentUser.uid, workId, episodeId, amount);
                }

                if (!purchaseResult.success) {
                    throw new Error(purchaseResult.error || "ทำรายการไม่สำเร็จ");
                }

                // อัปเดตยอดขายรวม (Total Purchases) ให้ผลงาน
                const workRef = doc(db, "works", workId);
                await updateDoc(workRef, {
                    totalPurchases: (currentWork.totalPurchases || 0) + targetEpisodes.length
                });

                // อัปเดต UI ยอดกุญแจตรง Navbar ทันทีให้ดูสมจริง
                const pointsDisplay = document.querySelector('.fa-key.text-yellow-500')?.parentElement;
                if (pointsDisplay) pointsDisplay.innerHTML = `<i class="fa-solid fa-key text-yellow-500 fa-beat-fade" style="--fa-animation-duration: 3s;"></i> ${currentPoints - amount} กุญแจ`;

                Swal.fire({
                    title: 'ปลดล็อกสำเร็จ!',
                    text: 'ขอให้สนุกกับการอ่านนะคะ',
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    // โหลดเนื้อหาที่ปลดล็อกแล้วขึ้นมาใหม่
                    checkAccessAndRender(auth.currentUser);
                });

            } catch (error) {
                console.error("Error processing purchase:", error);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถทำรายการได้ในขณะนี้', 'error');
            }
        }
    });
}

// ==========================================
// 4. การนำทาง (ตอนก่อนหน้า / ถัดไป)
// ==========================================
function setupNavButtons() {
    const prevBtn = document.getElementById('btn-prev-ep');
    const nextBtn = document.getElementById('btn-next-ep');

    if (currentIndex <= 0) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
        prevBtn.onclick = () => window.location.href = `read.html?workId=${workId}&epId=${allEpisodesList[currentIndex - 1].id}`;
    }

    if (currentIndex >= allEpisodesList.length - 1 || currentIndex === -1) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
        nextBtn.onclick = () => window.location.href = `read.html?workId=${workId}&epId=${allEpisodesList[currentIndex + 1].id}`;
    }
}

// ==========================================
// 5. ระบบ Comments & Replies
// ==========================================
async function loadComments() {
    try {
        const q = query(collection(db, `works/${workId}/episodes/${episodeId}/comments`), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        allComments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderComments();
    } catch (error) {
        console.error("Error loading comments:", error);
    }
}

function renderComments() {
    const list = document.getElementById('comments-list');
    document.getElementById('comment-count').innerText = allComments.length;

    if (allComments.length === 0) {
        list.innerHTML = '<div class="text-center py-10 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">ยังไม่มีความคิดเห็น เริ่มเป็นคนแรกเลย!</div>';
        return;
    }

    const mainComments = allComments.filter(c => !c.replyTo);
    const replies = allComments.filter(c => c.replyTo);

    list.innerHTML = mainComments.map(c => {
        const commentReplies = replies.filter(r => r.replyTo === c.id);
	// [INSERT] คำนวณสถานะการกดถูกใจของคอมเมนต์หลัก
        const likesCount = c.likes ? c.likes.length : 0;
        const isLiked = currentUser && c.likes && c.likes.includes(currentUser.uid);
        const heartIcon = isLiked ? '<i class="fa-solid fa-heart text-pink-500 fa-beat" style="--fa-animation-iteration-count: 1;"></i>' : '<i class="fa-regular fa-heart"></i>';
        const likeClass = isLiked ? 'text-pink-500' : 'hover:text-pink-500 text-gray-400';
        const likeText = likesCount > 0 ? likesCount : 'ถูกใจ';
        return `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-emerald-50 dark:border-gray-700 transition-colors">
            <div class="flex gap-3">
                <img src="${c.userPhoto || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200">
                <div class="flex-grow">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-bold text-gray-800 dark:text-gray-200 text-sm">${c.userName || 'User'}</span>
                        <span class="text-[10px] text-gray-400">${c.createdAt ? new Date(c.createdAt.toDate()).toLocaleString('th-TH') : 'เพิ่งส่ง'}</span>
                    </div>
                    <p class="text-gray-600 dark:text-gray-300 text-sm mb-2 leading-relaxed">${c.text}</p>
                    <div class="flex items-center gap-4 text-xs font-bold text-gray-400">
                        <button onclick="window.toggleLike('${c.id}')" class="${likeClass} transition-colors flex items-center gap-1">${heartIcon} ${likeText}</button>
                        <button onclick="window.toggleReplyBox('${c.id}')" class="hover:text-primary transition-colors flex items-center gap-1"><i class="fa-solid fa-reply"></i> ตอบกลับ</button>
                    </div>
                    
                    <div id="reply-box-${c.id}" class="hidden mt-3 flex gap-2">
                        <textarea id="reply-input-${c.id}" class="flex-grow bg-emerald-50/50 dark:bg-gray-700 border border-emerald-100 dark:border-gray-600 rounded-xl p-2 focus:ring-1 focus:ring-primary outline-none resize-none text-xs dark:text-gray-200" rows="1" placeholder="ตอบกลับ @${c.userName}..."></textarea>
                        <button onclick="window.submitReply('${c.id}', '${c.userName}', '${c.userId}')" class="px-4 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition shadow-sm"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>

                    ${commentReplies.length > 0 ? `
                    <div class="mt-4 space-y-3 pl-4 border-l-2 border-emerald-200 dark:border-gray-600">
                        ${commentReplies.map(r => `
                        <div class="bg-emerald-50/50 dark:bg-gray-700 p-3 rounded-xl border border-emerald-50 dark:border-gray-600">
                            <div class="flex gap-2">
                                <img src="${r.userPhoto || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full object-cover shrink-0 border border-white shadow-sm">
                                <div>
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="font-bold text-gray-800 dark:text-gray-200 text-xs">${r.userName || 'User'}</span>
                                        <span class="text-[10px] text-gray-400 ml-2">${r.createdAt ? new Date(r.createdAt.toDate()).toLocaleString('th-TH') : 'เพิ่งส่ง'}</span>
                                    </div>
                                    <p class="text-gray-600 dark:text-gray-300 text-xs"><span class="text-primary font-bold mr-1">@${r.replyToName || 'User'}</span>${r.text}</p>
                                </div>
                            </div>
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function setupCommentEvents() {
    const submitBtn = document.getElementById('btn-submit-comment');
    if (submitBtn && !submitBtn.hasAttribute('data-listener')) {
        submitBtn.setAttribute('data-listener', 'true');
        submitBtn.addEventListener('click', async () => {
            if (!currentUser) {
                Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนแสดงความคิดเห็น', 'warning').then(() => window.location.href = 'login.html');
                return;
            }
            
            const input = document.getElementById('comment-input');
            const text = input.value.trim();
            if (!text) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                let userName = "นักอ่าน";
                if(currentUser.displayName) userName = currentUser.displayName;
                else {
                    const uSnap = await getDoc(doc(db, "users", currentUser.uid));
                    if(uSnap.exists()) userName = uSnap.data().username || "นักอ่าน";
                }

                await addDoc(collection(db, `works/${workId}/episodes/${episodeId}/comments`), {
                    userId: currentUser.uid,
                    userName: userName,
                    userPhoto: currentUser.photoURL || `https://ui-avatars.com/api/?name=${userName}&background=10b981&color=fff`,
                    text: text,
                    replyTo: null,
                    createdAt: serverTimestamp()
                });

		// ส่งแจ้งเตือนให้ Creator เจ้าของเรื่อง (ถ้าไม่ใช่คนคอมเมนต์เอง)
                if (currentWork.creatorId && currentWork.creatorId !== currentUser.uid) {
                    await addDoc(collection(db, `users/${currentWork.creatorId}/notifications`), {
                        type: "comment",
                        message: `💬 ${userName} แสดงความคิดเห็นใน EP.${currentEpisode.episodeNumber}: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
                        workId: workId,
                        episodeId: episodeId,
                        isRead: false,
                        createdAt: serverTimestamp()
                    });
                }

                input.value = '';
                await loadComments();
            } catch (error) {
                console.error("Error posting comment:", error);
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งความคิดเห็นได้', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ส่งข้อความ';
            }
        });
    }
}

// ฟังก์ชัน Global ให้ปุ่มเรียกใช้ผ่าน onclick HTML
window.toggleReplyBox = (commentId) => {
    const box = document.getElementById(`reply-box-${commentId}`);
    if (box) box.classList.toggle('hidden');
};

window.submitReply = async (commentId, replyToName, originalCommenterId) => {
    if (!currentUser) {
        Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนตอบกลับ', 'warning').then(() => window.location.href = 'login.html');
        return;
    }

    const input = document.getElementById(`reply-input-${commentId}`);
    const text = input.value.trim();
    if (!text) return;

    try {
        let userName = "นักอ่าน";
        if(currentUser.displayName) userName = currentUser.displayName;
        else {
            const uSnap = await getDoc(doc(db, "users", currentUser.uid));
            if(uSnap.exists()) userName = uSnap.data().username || "นักอ่าน";
        }

        await addDoc(collection(db, `works/${workId}/episodes/${episodeId}/comments`), {
            userId: currentUser.uid,
            userName: userName,
            userPhoto: currentUser.photoURL || `https://ui-avatars.com/api/?name=${userName}&background=10b981&color=fff`,
            text: text,
            replyTo: commentId,
            replyToName: replyToName,
            createdAt: serverTimestamp()
        });

	// ส่งแจ้งเตือนให้เจ้าของคอมเมนต์เดิม (ถ้ายูสเซอร์ไม่ใช่คนเดิมตอบตัวเอง)
        if (originalCommenterId && originalCommenterId !== currentUser.uid) {
            await addDoc(collection(db, `users/${originalCommenterId}/notifications`), {
                type: "reply",
                message: `↪️ ${userName} ตอบกลับความคิดเห็นของคุณในเรื่อง ${currentWork.title} EP.${currentEpisode.episodeNumber}`,
                workId: workId,
                episodeId: episodeId,
                isRead: false,
                createdAt: serverTimestamp()
            });
        }

        await loadComments();
    } catch (error) {
        console.error("Error posting reply:", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งการตอบกลับได้', 'error');
    }
};

// [ADD] ฟังก์ชันสำหรับกดถูกใจ / ยกเลิกถูกใจ
    window.toggleLike = async (commentId) => {
        if (!currentUser) {
            Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนกดถูกใจ', 'warning').then(() => window.location.href = 'login.html');
            return;
        }

        try {
            const commentRef = doc(db, `works/${workId}/episodes/${episodeId}/comments`, commentId);
            const commentDoc = await getDoc(commentRef);
            
            if (commentDoc.exists()) {
                const commentData = commentDoc.data();
                const likes = commentData.likes || [];
                const isLiked = likes.includes(currentUser.uid);

                if (isLiked) {
                    await updateDoc(commentRef, {
                        likes: arrayRemove(currentUser.uid)
                    });
                } else {
                    await updateDoc(commentRef, {
                        likes: arrayUnion(currentUser.uid)
                    });
                }
                // รีโหลดคอมเมนต์ใหม่เพื่ออัปเดต UI ทันที
                await loadComments();
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถทำรายการได้ในขณะนี้', 'error');
        }
    };