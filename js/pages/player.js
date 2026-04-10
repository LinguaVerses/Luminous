// js/pages/player.js
import { db, auth } from '../config/firebaseConfig.js';
import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, setDoc, addDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let ytPlayer;
let userPoints = 0; // ✨ เพิ่มตัวแปรเก็บยอดคงเหลือของผู้ใช้
let currentWorkId;
let parentWork = null; // ✨ เพิ่มตัวแปรเก็บข้อมูลเรื่องเพื่อใช้ตรวจสอบ Creator
let targetEpId = null;
let episodes = [];
let currentEpIndex = 0;
let currentUser = null;
let isPurchased = false;
let isMuted = true; // เริ่มต้นที่ปิดเสียงเพื่อให้ Autoplay บนมือถือทำงานได้
let timeChecker; // ตัวจับเวลาสำหรับตัดตอนจบ

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentWorkId = urlParams.get('workId');
    targetEpId = urlParams.get('epId');

    if (!currentWorkId) {
        alert('ไม่พบข้อมูลผลงาน');
        window.location.href = 'index.html';
        return;
    }

    // 1. ตรวจสอบ Login และดึงข้อมูลตอน (ทำตาม Flow 1 & 2)
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        await loadEpisodes();
    });
});

async function loadEpisodes() {
    try {
        // ✨ ดึงข้อมูลเรื่องเพื่อนำมาใช้เช็คสถานะ Creator เจ้าของผลงาน
        const workSnap = await getDoc(doc(db, "works", currentWorkId));
        if (workSnap.exists()) {
            parentWork = workSnap.data();
        }

        const q = query(collection(db, `works/${currentWorkId}/episodes`), orderBy("episodeNumber", "asc"));
        const snap = await getDocs(q);
        episodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // หาลำดับ (Index) ของตอนที่รับค่ามาจาก URL ถ้าหาไม่พบ (หรือเข้ามาจากหน้าหลัก) จึงให้เล่นตอนแรก (0)
        let targetIndex = 0;
        if (targetEpId) {
            const foundIndex = episodes.findIndex(ep => ep.id === targetEpId);
            if (foundIndex !== -1) {
                targetIndex = foundIndex;
            }
        }
        loadEpisodeData(targetIndex);
    } catch (error) {
        console.error("Error loading episodes:", error);
    }
}

async function loadEpisodeData(index) {
    if (index < 0 || index >= episodes.length) return;
    currentEpIndex = index;
    const ep = episodes[currentEpIndex];

    // ✨ ดึงยอดคงเหลือและ Role ปัจจุบันของผู้ใช้จาก Database
    let userRole = 'user';
    if (currentUser) {
        try {
            const userSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (userSnap.exists()) {
                userPoints = userSnap.data().points || 0;
                userRole = userSnap.data().role || 'user'; // โหลด Role เพื่อเช็คแอดมิน
            }
        } catch(e) { console.error(e); }
    }

    // อัปเดต UI
    document.getElementById('player-title').innerText = `EP.${ep.episodeNumber} ${ep.title}`;
    
    // อัปเดตยอด Like ของตอน (Episode) ปัจจุบันให้แสดงผล
    document.getElementById('like-count').innerText = ep.totalLikes || 0;

    // ผูก Event ให้ปุ่มต่างๆ
    document.getElementById('next-ep-btn').onclick = playNextEpisode;
    document.getElementById('like-btn').onclick = handleLikeEpisode;
    document.getElementById('mute-btn').onclick = toggleMute;

    document.getElementById('toc-btn').onclick = () => window.location.href = `work-detail.html?id=${currentWorkId}`;
    
    // 2. เช็คการซื้อและสิทธิ์การเข้าชม (Flow 3 & 4)
    isPurchased = false;
    
    // ✨ ตรวจสอบว่าเป็น Creator เจ้าของเรื่อง หรือ Admin หรือไม่
    let isCreatorOrAdmin = false;
    if (currentUser && parentWork) {
        isCreatorOrAdmin = (currentUser.uid === parentWork.creatorId || userRole === 'admin');
    }

    // ถ้าเป็นตอนฟรี หรือเป็นเจ้าของ/แอดมิน ให้ดูได้เลยไม่ต้องหักเหรียญและไม่เด้งหน้า Unlock
    if (ep.isFree === true || isCreatorOrAdmin) {
        isPurchased = true; 
    } else if (currentUser) {
        // Query purchasedEpisodes ว่า user นี้เคยซื้อหรือยัง
        const purchaseId = `${currentWorkId}_${ep.id}`;
        const purchaseRef = doc(db, `users/${currentUser.uid}/purchasedEpisodes`, purchaseId);
        const pSnap = await getDoc(purchaseRef);
        if (pSnap.exists()) {
            isPurchased = true;
        }
    }

    // 3. โหลดวิดีโอเข้า Player
    const ytId = extractYouTubeID(ep.videoUrl);
    // ✨ บันทึกประวัติการรับชม
    if (currentUser) {
        const historyRef = doc(db, `users/${currentUser.uid}/history`, currentWorkId);
        setDoc(historyRef, {
            workId: currentWorkId,
            episodeId: ep.id,
            episodeTitle: ep.title,
            updatedAt: serverTimestamp()
        }, { merge: true }).catch(err => console.error("History Error:", err));
    }

    if (ytId) {
        initYouTubePlayer(ytId, ep);
    }
}

function initYouTubePlayer(ytId, epData) {
    // ซ่อนหน้าจอปลดล็อก และเคลียร์ความเบลอก่อนเริ่มเล่น
    document.getElementById('unlock-screen').style.display = 'none';
    document.getElementById('yt-player').style.opacity = '1';
    
    if (ytPlayer) {
        // ถ้ามี Player อยู่แล้ว ให้เปลี่ยนวิดีโอ
        ytPlayer.mute(); // ตรวจสอบว่าปิดเสียงเพื่อให้ Autoplay ทำงานบนมือถือ
        ytPlayer.loadVideoById(ytId);
        ytPlayer.playVideo(); // สั่งเล่นทันทีสำหรับ iPhone/Android
        startPreviewChecker(epData);
        return;
    }

    // สร้าง Player ใหม่
    if (!window.YT || !window.YT.Player) {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
        
        window.onYouTubeIframeAPIReady = () => {
            createPlayer(ytId, epData);
        };
        return;
    }

    // หาก API โหลดเสร็จอยู่แล้ว ให้สร้าง Player ได้เลย (ป้องกันอาการโหลดค้าง)
    createPlayer(ytId, epData);
}

function createPlayer(ytId, epData) {
    ytPlayer = new YT.Player('yt-player', {
        videoId: ytId,
        playerVars: { 
            'autoplay': 1, 
            'controls': 0, // ปิดปุ่มพื้นฐานของ YT เพื่อใช้ UI ของเราเองได้เต็มที่ 
            'modestbranding': 1, 
            'rel': 0, 
            'playsinline': 1,
            'mute': 1,
            'enablejsapi': 1, // เปิดใช้งาน API เต็มรูปแบบ
            'origin': window.location.origin // ส่งชื่อโดเมน (GitHub) ไปยืนยันตัวตน
        },
        events: {
            'onReady': (event) => {
                event.target.mute(); // ต้อง Mute ก่อนเล่นเสมอสำหรับ Mobile
                // ทดลองใช้ Promise เพื่อดูว่าโดนบล็อกหรือไม่
                const playPromise = event.target.playVideo();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Autoplay was prevented, waiting for user interaction.");
                    });
                }
                startPreviewChecker(epData);
            },
            'onStateChange': (event) => {
                if (event.data === YT.PlayerState.PLAYING) {
                    startPreviewChecker(epData);
                } else if (event.data === YT.PlayerState.ENDED) {
                    // วิดีโอเล่นจบแล้ว ให้ข้ามไปตอนถัดไปทันที (ป้องกันหน้าจอแนะนำของ YouTube โผล่มา)
                    playNextEpisode();
                } else {
                    clearInterval(timeChecker);
                }
            }
        }
    });
}

// ฟังก์ชันเล่นตอนถัดไป
function playNextEpisode() {
    if (currentEpIndex + 1 < episodes.length) {
        loadEpisodeData(currentEpIndex + 1);
    } else {
        // ✨ เปลี่ยนเป็น SweetAlert แบบ Toast เล็กๆ น่ารักๆ
        Swal.fire({
            title: 'จบตอนแล้ว!',
            text: 'คุณรับชมจนถึงตอนล่าสุดแล้วครับ',
            icon: 'info',
            toast: true,
            position: 'center',
            showConfirmButton: false,
            timer: 2000,
            background: '#111',
            color: '#fff'
        }).then(() => {
            window.location.href = `work-detail.html?id=${currentWorkId}`;
        });
    }
}

function startPreviewChecker(epData) {
    clearInterval(timeChecker);
    
    // ถ้าดูฟรี หรือซื้อแล้ว ไม่ต้องจับเวลา ให้ดูจนจบได้เลย
    if (isPurchased) return;

    const previewLimit = epData.previewDuration || 0;
    
    // ถ้าระยะเวลาตัวอย่างเป็น 0 และยังไม่ได้ซื้อ แปลว่าไม่มีการให้ดูฟรีเลย ให้ตัดภาพทันที
    if (previewLimit === 0) {
        if(ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
        showUnlockScreen(epData);
        return;
    }

    // จับเวลาเช็คทุกๆ 1 วินาที
    timeChecker = setInterval(() => {
        if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            const currentTime = ytPlayer.getCurrentTime();
            if (currentTime >= previewLimit) {
                ytPlayer.pauseVideo();
                clearInterval(timeChecker);
                showUnlockScreen(epData);
            }
        }
    }, 1000);
}

function showUnlockScreen(epData) {
    const unlockScreen = document.getElementById('unlock-screen');
    unlockScreen.style.display = 'flex';
    
    // อัปเดตราคาบนปุ่มและโชว์ยอดคงเหลือจริง
    const btn = document.getElementById('unlock-btn');
    btn.innerHTML = `<i class="fa-solid fa-key"></i> ปลดล็อกด้วย ${epData.pricePoints} Keys`;
    document.getElementById('user-balance').innerText = userPoints;
    
    // ✨ ผูก Event ปุ่มปลดล็อก (เช็คเงิน -> ตัดเงิน -> บันทึก -> เล่นต่อ)
    btn.onclick = () => processUnlock(epData);

    // ดรอปความสว่างของวิดีโอลง
    document.getElementById('yt-player').style.opacity = '0.2';
}

async function processUnlock(epData) {
    if (!currentUser) {
        Swal.fire('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนทำการปลดล็อก', 'warning');
        return;
    }
    if (userPoints < epData.pricePoints) {
        Swal.fire('เหรียญไม่พอ', 'คุณมียอด Keys ไม่พอ กรุณาเติมเหรียญ', 'error');
        return;
    }

    Swal.fire({ title: 'กำลังปลดล็อก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const purchaseId = `${currentWorkId}_${epData.id}`;
        const userRef = doc(db, "users", currentUser.uid);
        const purchaseRef = doc(db, `users/${currentUser.uid}/purchasedEpisodes`, purchaseId);
        const transactionRef = collection(db, `users/${currentUser.uid}/pointTransactions`);

        // 1. ตัดเหรียญ User
        await updateDoc(userRef, { points: userPoints - epData.pricePoints });
        // 2. บันทึกการซื้อ
        await setDoc(purchaseRef, {
            workId: currentWorkId,
            episodeId: epData.id,
            price: epData.pricePoints,
            purchasedAt: serverTimestamp()
        });
        // 3. บันทึกประวัติ Transaction (ทำตาม Database Schema ข้อ 6)
        await addDoc(transactionRef, {
            amount: -epData.pricePoints,
            type: "purchase",
            referenceId: currentWorkId,
            episodeId: epData.id,
            createdAt: serverTimestamp()
        });

        // อัปเดตสถานะในหน้าเว็บและเล่นวิดีโอต่อ
        userPoints -= epData.pricePoints;
        isPurchased = true;
        document.getElementById('unlock-screen').style.display = 'none';
        document.getElementById('yt-player').style.opacity = '1';
        
        Swal.fire({ title: 'ปลดล็อกสำเร็จ!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        
        if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
            ytPlayer.playVideo();
        }
    } catch (error) {
        console.error("Unlock Error:", error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถปลดล็อกได้ กรุณาลองใหม่', 'error');
    }
}

async function handleLikeEpisode() {
    try {
        const likeCountSpan = document.getElementById('like-count');
        const likeIcon = document.getElementById('like-icon');
        
        // อัปเดต UI ทันที (บวกเลขและเปลี่ยนสี)
        let currentLikes = parseInt(likeCountSpan.innerText) || 0;
        likeCountSpan.innerText = currentLikes + 1;
        likeIcon.style.color = '#ff4b5c'; 
        
        // เพิ่มลูกเล่น Animation เด้งๆ เล็กน้อยให้ดูมีชีวิตชีวา
        likeIcon.classList.add('animate-bounce');
        setTimeout(() => likeIcon.classList.remove('animate-bounce'), 1000);

        // อัปเดตฐานข้อมูล Firestore ระดับ Episode
        const epId = episodes[currentEpIndex].id;
        const epRef = doc(db, "works", currentWorkId, "episodes", epId);
        await updateDoc(epRef, {
            totalLikes: increment(1)
        });

        // อัปเดตข้อมูลในตัวแปร array ปัจจุบันด้วย เผื่อผู้ใช้กดเปลี่ยนตอนไปมา
        episodes[currentEpIndex].totalLikes = (episodes[currentEpIndex].totalLikes || 0) + 1;
        
        Swal.fire({
            title: 'ถูกใจตอนนี้แล้ว!',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            iconColor: '#ff4b5c'
        });
    } catch (error) {
        console.error("Error liking episode:", error);
    }
}

function toggleMute() {
    if (!ytPlayer || typeof ytPlayer.mute !== 'function') return;

    const muteIcon = document.getElementById('mute-icon');
    const muteText = document.getElementById('mute-text');

    if (isMuted) {
        ytPlayer.unMute();
        ytPlayer.setVolume(100);
        muteIcon.classList.replace('fa-volume-xmark', 'fa-volume-high');
        muteText.innerText = "ปิดเสียง";
        isMuted = false;
    } else {
        ytPlayer.mute();
        muteIcon.classList.replace('fa-volume-high', 'fa-volume-xmark');
        muteText.innerText = "เปิดเสียง";
        isMuted = true;
    }
}

function extractYouTubeID(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
