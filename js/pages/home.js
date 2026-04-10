// js/pages/home.js
import { db } from '../config/firebaseConfig.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, getDocs, query, where, limit, orderBy, doc, getDoc, 
    updateDoc, increment, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const swalScript = document.createElement('script');
swalScript.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
document.head.appendChild(swalScript);

let ytPlayers = {}; // เก็บ Object ของ YouTube Player แต่ละคลิปเพื่อควบคุมเสียง

export async function initHome() {
    const container = document.getElementById('home-content');
    if (!container) return;

    // 1️⃣ CSS สำหรับ Vertical Feed สไตล์ TikTok
    const feedStyles = `
        <style>
            ::-webkit-scrollbar { display: none; }
            .feed-container {
                height: calc(100dvh - 60px);
                width: 100%;
                max-width: 450px; /* ขนาดจำลองมือถือ */
                margin: 0 auto;
                overflow-y: scroll;
                scroll-snap-type: y mandatory;
                background-color: #000;
                position: relative;
            }
            .video-item {
                height: calc(100dvh - 60px);
                width: 100%;
                scroll-snap-align: start;
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: #111;
                overflow: hidden;
            }
            .video-player {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .video-info {
                position: absolute;
                bottom: calc(80px + env(safe-area-inset-bottom));
                left: 15px;
                right: 70px;
                color: white;
                z-index: 10;
                text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
            }
            .action-buttons {
                position: absolute;
                bottom: calc(80px + env(safe-area-inset-bottom));
                right: 10px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                z-index: 10;
            }
            .action-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                color: white;
                background: transparent;
                border: none;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .action-btn:hover { transform: scale(1.1); }
            .action-btn i { font-size: 28px; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.8)); }
            .action-btn span { font-size: 12px; margin-top: 4px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); }
        </style>
    `;

    let feedHtml = '';

    try {
        // 1️⃣ ดึงข้อมูล Collection: works โดยเรียงตาม updatedAt ล่าสุด
        const worksRef = collection(db, "works");
        // ✨ ดึงข้อมูลโดยใช้ where คู่กับ orderBy ได้อย่างปลอดภัยเพราะคุณมี Index แล้ว!
        const qWorks = query(worksRef, where("published", "==", true), orderBy("updatedAt", "desc"), limit(40)); 
        const snapWorksRaw = await getDocs(qWorks);

        // 2️⃣ กรองข้อมูล: ดึงผลงานแอนิเมชันล่าสุด จำกัด 10 เรื่อง (โค้ดชุดนี้จะไม่มีการจำกัด 1 ครีเอเตอร์ = 1 เรื่องอีกต่อไป)
        const topWorks = [];

        for (const docSnap of snapWorksRaw.docs) {
            const work = docSnap.data();
            const t = work.type;

            // กรองเอาเฉพาะ Animation
            if (t !== "animation" && t !== "shot-animation") continue;

            work.id = docSnap.id; // เก็บ id งานไว้ใช้ต่อ
            topWorks.push(work);

            // ถ้าได้ครบ 10 เรื่องแล้วให้หยุดลูป
            if (topWorks.length === 10) break;
        }

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }

        // 3️⃣ วนลูปเพื่อดึง "ตอนล่าสุด" (Episode) ของแต่ละเรื่อง
        for (const work of topWorks) {
            const workId = work.id;

            // ค้นหาชื่อปากกา (penName)
            let creatorName = 'Creator';
            if (work.creatorId) {
                try {
                    const userSnap = await getDoc(doc(db, "users", work.creatorId));
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        creatorName = userData.creatorProfile?.penName || userData.username || 'Creator';
                    }
                } catch (error) {
                    console.error("Error fetching creator:", error);
                }
            }
            work.creatorName = creatorName;

            // ✨ เปลี่ยนเป็นการเรียงลำดับแล้วดึง "ตอนแรกสุด" ที่มีอยู่ แทนการเจาะจงตอนที่ 1
            const episodesRef = collection(db, "works", workId, "episodes");
            const qEps = query(episodesRef, orderBy("episodeNumber", "desc"), limit(1));
            const snapEps = await getDocs(qEps);

            let videoUrl = '';
            let epData = null;
            // ถ้ามีตอนที่ 1 ให้เอาวิดีโอมาใช้
            if (!snapEps.empty) {
                epData = snapEps.docs[0].data();
                videoUrl = epData.videoUrl || ''; 
            }

            // ✨ ข้ามเรื่องที่ยังไม่มีวิดีโอ
            if (!videoUrl || !epData) continue;

            // สร้าง HTML สำหรับ 1 วิดีโอ
            feedHtml += createVideoElement(workId, work, epData);
        }

    } catch (error) {
        console.error("Error fetching data from Firestore:", error);
}

    if (!feedHtml) {
        feedHtml = `<div class="text-white text-center flex items-center justify-center h-[100vh] w-full font-bold text-xl">ยังไม่มีผลงานแอนิเมชันในขณะนี้</div>`;
}

    // 5️⃣ นำ HTML ไปใส่ใน Container
    container.innerHTML = `
        ${feedStyles}
        <div class="bg-black w-full min-h-screen">
            <div class="feed-container" id="video-feed">
                ${feedHtml}
            </div>
        </div>
    `;

    // 6️⃣ รอให้ YouTube API โหลดเสร็จแล้วค่อยตั้งค่า Player ควบคุมเสียง
    if (window.YT && window.YT.Player) {
        setupYouTubePlayers();
    } else {
        window.onYouTubeIframeAPIReady = () => {
            setupYouTubePlayers();
        };
    }
}

// ---------------------------------------------------------
// ฟังก์ชันช่วยเหลือ (Helper Functions)
// ---------------------------------------------------------
function extractYouTubeID(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function createVideoElement(workId, workData, epData) {
    const ytId = extractYouTubeID(epData.videoUrl);

    // ✨ กำหนดค่า Default สำหรับช่วงที่ให้ดูฟรี (สมมติถ้าครีเอเตอร์ยังไม่ได้ตั้งค่า จะเล่น 0-10 วินาที)
    const startSec = epData.hookStart || 0;
    const endSec = epData.hookEnd || 10;
    
    if (!ytId) {
        return `
            <div class="video-item" data-work-id="${workId}">
                <img src="${workData.coverImage || 'https://placehold.co/400x800/111/fff?text=No+Video'}" class="video-player object-cover w-full h-full">
                ${getVideoUI(workId, workData, epData)}
            </div>
        `;
    }

    return `
        <div class="video-item" data-work-id="${workId}">
            <div id="yt-${workId}" class="video-player" data-yt-id="${ytId}" data-start="${startSec}" data-end="${endSec}" style="pointer-events: auto;"></div>
            ${getVideoUI(workId, workData, epData)}
        </div>
    `;
}

function getVideoUI(workId, workData, epData) {
    return `
        <div class="video-info">
            <h3 class="text-xl font-bold mb-1 drop-shadow-md">@${workData.creatorName}</h3>
            <h4 class="text-lg mb-1 font-semibold text-emerald-400 drop-shadow-md">${workData.title || 'Untitled'}</h4>
            <p class="text-sm line-clamp-2 drop-shadow-md">EP.${epData.episodeNumber || 1} ${epData.title || ''}</p>
        </div>

        <div class="action-buttons">
            <button class="action-btn" onclick="handleLike('${workId}')">
                <i class="fa-solid fa-heart"></i>
                <span>${workData.totalLikes || '0'}</span>
            </button>
            <button class="action-btn" onclick="openComments('${workId}')">
                <i class="fa-solid fa-comment-dots"></i>
                <span>${workData.totalComments || '0'}</span>
            </button>
            <button class="action-btn sound-btn" data-work-id="${workId}">
                <i class="fa-solid fa-volume-xmark text-red-400"></i>
                <span>เสียง</span>
            </button>
            <button class="action-btn" onclick="shareWork('${workId}', '${workData.title}')">
                <i class="fa-solid fa-share"></i>
                <span>แชร์</span>
            </button>
            <a href="player.html?workId=${workId}" class="action-btn mt-4">
                <div class="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-lg">
                    <i class="fa-solid fa-play text-white text-xl"></i>
                </div>
            </a>
        </div>
    `;
}

function setupYouTubePlayers() {
    const videoItems = document.querySelectorAll('.video-item');
    
    videoItems.forEach(item => {
        const workId = item.getAttribute('data-work-id');
        const playerDiv = item.querySelector('.video-player');
        const ytId = playerDiv?.getAttribute('data-yt-id');

	// ดึงค่าช่วงเวลาวิดีโอที่ฝังไว้
        const startSec = parseInt(playerDiv?.getAttribute('data-start') || 0);
        const endSec = parseInt(playerDiv?.getAttribute('data-end') || 10);

        if (ytId) {
            ytPlayers[workId] = new YT.Player(`yt-${workId}`, {
                videoId: ytId,
                playerVars: {
                    'autoplay': 1, 'controls': 0, 'disablekb': 1, 'fs': 0,
                    'modestbranding': 1, 'playsinline': 1, 'rel': 0, 'mute': 1,
                    'start': startSec, // เริ่มเล่นวินาทีที่กำหนด
                    'end': endSec,      // หยุดเล่นเมื่อถึงวินาทีที่กำหนด
                    'enablejsapi': 1,   // ✨ เพิ่มพารามิเตอร์นี้เพื่อเปิดสิทธิ์ API ให้สมบูรณ์ แก้ Error: postMessage
		    'origin': window.location.origin // แก้ Error postMessage บน localhost
                },
                events: {
                    'onReady': (event) => {
                        event.target.mute(); // บังคับ Mute ซ้ำผ่าน API เพื่อปลดล็อกข้อจำกัด Browser
                        // ตรวจสอบว่าถ้าโหลดเสร็จแล้วหน้าจออยู่ตรงวิดีโอนี้พอดี ให้เล่นทันที
                        const rect = item.getBoundingClientRect();
                        if(rect.top >= -100 && rect.top <= window.innerHeight / 2) {
                            event.target.playVideo();
                        }
                    },
                    'onStateChange': (event) => {
                        // ✨ พระเอกของการทำ Loop! เมื่อวิดีโอเล่นจบ (เพราะติด limit ของ 'end') มันจะสถานะเปลี่ยนเป็น ENDED (0)
                        // ให้เราจับ Event นี้แล้วสั่งให้มันกระโดดกลับไปวินาทีที่ startSec แล้วเล่นใหม่
                        if (event.data === YT.PlayerState.ENDED) {
                            event.target.seekTo(startSec);
                            event.target.playVideo();
                        }
                    }
                }
            });
        }

    // เพิ่มฟังก์ชันให้เมื่อผู้ใช้ "แตะ" ที่วิดีโอครั้งแรก ให้สั่งเล่นทันที (ปลดล็อกนโยบายเบราว์เซอร์)
        item.addEventListener('click', () => {
            const player = ytPlayers[workId];
            if (player && typeof player.playVideo === 'function') {
                const state = player.getPlayerState();
                if (state !== YT.PlayerState.PLAYING) {
                    player.playVideo();
                }
            }
        });

        // ผูก Event ให้ปุ่มเปิด-ปิดเสียง
        const soundBtn = item.querySelector('.sound-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const player = ytPlayers[workId];
                if (player && player.isMuted) {
                    if (player.isMuted()) {
                        player.unMute();
                        soundBtn.innerHTML = `<i class="fa-solid fa-volume-high text-white"></i><span class="text-xs font-bold mt-1">เปิดเสียง</span>`;
                    } else {
                        player.mute();
                        soundBtn.innerHTML = `<i class="fa-solid fa-volume-xmark text-red-400"></i><span class="text-xs font-bold mt-1">ปิดเสียง</span>`;
                    }
                }
            });
        }
    });

    setupAutoPlay(); // เรียก AutoPlay หลังจากตั้งค่า Player เสร็จ
}

function setupAutoPlay() {
    const observerOptions = {
        root: document.getElementById('video-feed'),
        rootMargin: '0px',
        threshold: 0.6 
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const workId = entry.target.getAttribute('data-work-id');
            const player = ytPlayers[workId];
            
            if (entry.isIntersecting) {
                if (player && typeof player.playVideo === 'function') {
                    player.playVideo();
                }
            } else {
                if (player && typeof player.pauseVideo === 'function') {
                    player.pauseVideo();
                    player.seekTo(0); // เริ่มใหม่เมื่อปัดผ่าน
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('.video-item').forEach(item => {
        observer.observe(item);
    });
}

// เพิ่มความสวยงามและเรียกใช้คำสั่ง Firestore ที่ถูกต้อง
window.handleLike = async (workId) => {
    try {
        // หา Element ของตัวเลข Like ใน Video Item นั้นๆ
        const videoItem = document.querySelector(`.video-item[data-work-id="${workId}"]`);
        const likeSpan = videoItem.querySelector('.action-btn:nth-child(1) span');
        
        // อัปเดต UI ทันที
        if (likeSpan) {
            let currentLikes = parseInt(likeSpan.innerText) || 0;
            likeSpan.innerText = currentLikes + 1;
        }

        const workRef = doc(db, "works", workId);
        await updateDoc(workRef, {
            totalLikes: increment(1)
        });

        Swal.fire({
            title: 'ถูกใจแล้ว!',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            iconColor: '#ff4b5c'
        });
    } catch (error) {
        console.error("Error liking work:", error);
    }
};

// ปรับ UI คอมเมนต์ให้ดูเป็นรายการ (List) พร้อมช่องกรอกด้านล่าง
window.openComments = async (workId) => {
    Swal.fire({
        title: 'ความคิดเห็น',
        html: `
            <div id="comment-container" class="text-left">
                <div id="comment-list" style="height: 300px; overflow-y: auto; border-bottom: 1px solid #eee; padding: 10px;">
                    <p class="text-center text-gray-400">กำลังโหลด...</p>
                </div>
            </div>
        `,
        input: 'text',
        inputPlaceholder: 'เพิ่มความคิดเห็นของคุณที่นี่...',
        showCancelButton: true,
        confirmButtonText: 'ส่งคอมเมนต์',
        confirmButtonColor: '#10b981',
        didOpen: async () => {
            const listDiv = document.getElementById('comment-list');
            try {
                const colRef = collection(db, "works", workId, "comments");
                const q = query(colRef, orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    listDiv.innerHTML = '<p class="text-center text-gray-400 mt-4">ยังไม่มีคอมเมนต์ มาเริ่มคนแรกกัน!</p>';
                    return;
                }

                const commentHTMLs = await Promise.all(snap.docs.map(async (docSnap) => {
                    const data = docSnap.data();
                    const commentId = docSnap.id;
                    const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'เมื่อครู่';
                    
                    // ดึงข้อมูลผู้ใช้จาก Collection users ตาม userId ที่เก็บในคอมเมนต์
                    let userProfile = { 
			username: 'Anonymous', 
			profileImage: '' };
			userProfile.profileImage = `https://ui-avatars.com/api/?name=${userProfile.username}&background=10b981&color=fff`;

                    if (data.userId) {
                        const userDoc = await getDoc(doc(db, "users", data.userId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            const cp = userData.creatorProfile || {}; 
                            
                            userProfile.username = cp.penname || cp.penName || userData.username || 'Anonymous'; 
                            
                            const fallbackImg = `https://ui-avatars.com/api/?name=${userProfile.username}&background=10b981&color=fff`;
                            // จัดการรูป: ใช้ photoURL เป็นหลัก ตามด้วยรูปใน profile ของ creator ถ้าไม่มีค่อยใช้ fallback
                            userProfile.profileImage = userData.photoURL || cp.profileImage || fallbackImg;
                        }
}

                    return `
                        <div class="comment-wrapper mb-4" id="comment-${commentId}">
                            <div style="display: flex; gap: 10px;">
                                <img src="${userProfile.profileImage}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid #eee;">
                                <div style="flex-grow: 1;">
                                    <div style="font-weight: bold; font-size: 0.9em;">${userProfile.username} <span style="font-weight: normal; color: #999; font-size: 0.8em;">• ${date}</span></div>
                                    <div style="font-size: 0.95em; color: #333;">${data.text}</div>
                                    <div style="margin-top: 5px; display: flex; gap: 15px; font-size: 0.8em; color: #666;">
                                        <span class="cursor-pointer" onclick="likeComment('${workId}', '${commentId}', this)"><i class="fa-solid fa-heart"></i> <small>${data.likes || 0}</small></span>
                                        <span class="cursor-pointer" onclick="toggleReply('${commentId}')">ตอบกลับ</span>
                                    </div>
                                    
                                    <div id="view-replies-${commentId}" class="mt-2 text-xs text-blue-500 cursor-pointer font-bold" onclick="loadReplies('${workId}', '${commentId}')">
                                        ---- ดูการตอบกลับ ----
                                    </div>

                                    <div id="replies-list-${commentId}" class="mt-2 ml-4 border-left-2 border-gray-100" style="display:none;"></div>

                                    <div id="reply-box-${commentId}" style="display: none; margin-top: 10px; padding-left: 10px; border-left: 2px solid #eee;">
                                        <input type="text" id="input-${commentId}" placeholder="เขียนคำตอบ..." class="w-full border rounded px-2 py-1 text-sm">
                                        <button onclick="submitReply('${workId}', '${commentId}')" class="mt-1 bg-emerald-500 text-white px-3 py-1 rounded text-xs">ส่ง</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                })); // ปิด Promise.all.map
                
                listDiv.innerHTML = commentHTMLs.join('');
            } catch (err) {
                listDiv.innerHTML = '<p class="text-center text-red-500">โหลดคอมเมนต์ไม่สำเร็จ</p>';
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed && result.value) {
                const auth = getAuth();
            	if (!auth.currentUser) {
                Swal.fire({ icon: 'error', title: 'กรุณาล็อกอินก่อนคอมเมนต์', timer: 2000, showConfirmButton: false });
                return;
            }

            const colRef = collection(db, "works", workId, "comments");
            await addDoc(colRef, {
                text: result.value,
                userId: auth.currentUser.uid,

                createdAt: serverTimestamp()
            });
            
            // อัปเดตจำนวน Comment รวมในตัวงาน
            const workRef = doc(db, "works", workId);
            await updateDoc(workRef, {
                totalComments: increment(1)
            });

            Swal.fire({ icon: 'success', title: 'ส่งแล้ว!', timer: 1000, showConfirmButton: false });
        }
    }).catch(err => console.error("Error submitting comment:", err));
};

window.shareWork = async (workId, title) => {
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    const shareUrl = `${baseUrl}/work-detail.html?workId=${workId}`;
    try {
        await navigator.clipboard.writeText(shareUrl);
        Swal.fire({
            title: 'คัดลอกลิงก์สำเร็จ!',
            text: 'ส่งต่อให้เพื่อนดูได้เลย',
            icon: 'success',
            toast: true,
            position: 'bottom-center',
            showConfirmButton: false,
            timer: 2000
        });
    } catch (err) {
        console.error("Share error:", err);
    }
};

// ฟังก์ชันเสริมสำหรับระบบคอมเมนต์แบบ Interactive
window.likeComment = async (workId, commentId, element) => {
    const icon = element.querySelector('i');
    icon.style.color = '#ff4b5c'; // เปลี่ยนเป็นสีแดงทันที
    const commentRef = doc(db, "works", workId, "comments", commentId);
    await updateDoc(commentRef, { likes: increment(1) });
};

window.toggleReply = (commentId) => {
    const replyBox = document.getElementById(`reply-box-${commentId}`);
    replyBox.style.display = replyBox.style.display === 'none' ? 'block' : 'none';
};

// ฟังก์ชันสำหรับดึงและแสดงรายการ Reply ใต้คอมเมนต์หลัก
window.loadReplies = async (workId, commentId) => {
    const repliesList = document.getElementById(`replies-list-${commentId}`);
    const viewBtn = document.getElementById(`view-replies-${commentId}`);

    if (repliesList.style.display === 'block') {
        repliesList.style.display = 'none';
        viewBtn.innerText = '---- ดูการตอบกลับ ----';
        return;
    }

    repliesList.innerHTML = '<p class="text-xs text-gray-400">กำลังโหลด...</p>';
    repliesList.style.display = 'block';

    try {
        const replyRef = collection(db, "works", workId, "comments", commentId, "replies");
        const q = query(replyRef, orderBy("createdAt", "asc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            repliesList.innerHTML = '<p class="text-xs text-gray-400">ยังไม่มีการตอบกลับ</p>';
        } else {
            const replyHTMLs = await Promise.all(snap.docs.map(async docSnap => {
                const rData = docSnap.data();
                let rUser = { 
			username: 'User', 
			profileImage: '' };
		rUser.profileImage = `https://ui-avatars.com/api/?name=${rUser.username}&background=3b82f6&color=fff`;

                if (rData.userId) {
                    const uDoc = await getDoc(doc(db, "users", rData.userId));
                    if (uDoc.exists()) {
                        const rUserData = uDoc.data();

			const cp = rUserData.creatorProfile || {};

                        rUser.username = cp.penname || cp.penName || rUserData.username || 'User';
 
			const fallbackImg = `https://ui-avatars.com/api/?name=${rUser.username}&background=3b82f6&color=fff`;

        		rUser.profileImage = rUserData.photoURL || cp.profileImage || fallbackImg; 
    }
                }
                return `
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <img src="${rUser.profileImage}" style="width: 25px; height: 25px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <div style="font-weight: bold; font-size: 0.85em;">${rUser.username}</div>
                            <div style="font-size: 0.85em; color: #444;">${rData.text}</div>
                        </div>
                    </div>
                `;
            }));
            repliesList.innerHTML = replyHTMLs.join('');
            viewBtn.innerText = '---- ซ่อนการตอบกลับ ----';
        }
    } catch (err) {
        console.error("Error loading replies:", err);
    }
};

window.submitReply = async (workId, commentId) => {
    const input = document.getElementById(`input-${commentId}`);
    if (!input.value) return;
    const auth = getAuth();
    if (!auth.currentUser) {
        Swal.fire({ icon: 'error', title: 'กรุณาล็อกอินก่อนตอบกลับ', toast: true, position: 'top', showConfirmButton: false, timer: 2000 });
        return;
    }

    const replyRef = collection(db, "works", workId, "comments", commentId, "replies");
    await addDoc(replyRef, {
        text: input.value,
        createdAt: serverTimestamp(),
        userId: auth.currentUser.uid
    });

    Swal.fire({ icon: 'success', title: 'ส่งคำตอบแล้ว', toast: true, position: 'top', showConfirmButton: false, timer: 1000 });
    input.value = '';
    window.toggleReply(commentId);
    window.loadReplies(workId, commentId);
};
