// js/creator/manageEpisodes.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUserId = null;
let workId = null;
let parentWork = null;
let allEpisodesData = [];

export function initManageEpisodes() {
    const urlParams = new URLSearchParams(window.location.search);
    workId = urlParams.get('workId');
    if (!workId) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบรหัสผลงาน', 'error').then(() => window.history.back());
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            await fetchParentWork();
            await loadEpisodesFromFirestore();
            setupFormListeners(); 
        } else {
            Swal.fire('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน', 'error').then(() => window.location.href = '../login.html');
        }
    });

    setupModal();
}

async function fetchParentWork() {
    try {
        const docSnap = await getDoc(doc(db, "works", workId));
        if (docSnap.exists()) {
            parentWork = docSnap.data();
            document.getElementById('work-title-display').innerText = `เรื่อง: ${parentWork.title}`;
        } else {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผลงาน', 'error');
        }
    } catch (error) {
        console.error("Error fetching work:", error);
    }
}

function setupFormListeners() {
    const isFreeCheckbox = document.getElementById('ep-is-free');
    const priceInput = document.getElementById('ep-price');
    const hookStartInput = document.getElementById('ep-hook-start');
    const hookEndInput = document.getElementById('ep-hook-end');

    isFreeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            priceInput.value = 0;
            priceInput.disabled = true;
            priceInput.classList.add('bg-gray-100', 'text-gray-400');
            
            // ถ้าดูฟรีทั้งตอน ไม่ต้องมีช่วง Hook
            hookStartInput.value = 0; 
            hookStartInput.disabled = true;
            hookStartInput.classList.add('bg-gray-100');
            
            hookEndInput.value = 0; 
            hookEndInput.disabled = true;
            hookEndInput.classList.add('bg-gray-100');
        } else {
            priceInput.value = ''; 
            priceInput.disabled = false;
            priceInput.classList.remove('bg-gray-100', 'text-gray-400');
            
            hookStartInput.disabled = false;
            hookStartInput.classList.remove('bg-gray-100');
            
            hookEndInput.disabled = false;
            hookEndInput.classList.remove('bg-gray-100');
        }
    });
}

async function loadEpisodesFromFirestore() {
    const container = document.getElementById('episodes-list');
    container.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500">กำลังโหลดข้อมูล...</td></tr>`;
    try {
        const q = query(collection(db, `works/${workId}/episodes`), orderBy("episodeNumber", "desc"));
        const snapshot = await getDocs(q);
        
        allEpisodesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderEpisodesList();
    } catch (error) {
        console.error("Error loading episodes:", error);
        container.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

function renderEpisodesList() {
    const container = document.getElementById('episodes-list');
    if (allEpisodesData.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-500">ยังไม่มีตอนในเรื่องนี้</td></tr>`;
        return;
    }

    const html = allEpisodesData.map(ep => `
        <tr class="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors">
            <td class="py-4 px-6 text-gray-500 font-bold">EP. ${ep.episodeNumber}</td>
            <td class="py-4 px-6 font-bold text-gray-800">
                ${ep.title} 
                <br><span class="text-xs text-gray-400"><i class="fa-brands fa-youtube text-red-500"></i> ความยาว: ${ep.duration || 0} วิ | ดูฟรี: ${ep.isFree ? 'ทั้งตอน' : 'วิที่ ' + (ep.hookStart || 0) + ' - ' + (ep.hookEnd || 0)}</span>
            </td>
            <td class="py-4 px-6 text-center">
                ${ep.published !== false 
                    ? '<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold"><i class="fa-solid fa-check"></i> เผยแพร่แล้ว</span>'
                    : '<span class="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">Draft</span>'}
            </td>
            <td class="py-4 px-6 text-center">
                ${ep.isFree 
                    ? '<span class="text-emerald-500 font-bold"><i class="fa-solid fa-lock-open"></i> ฟรี</span>' 
                    : `<span class="text-yellow-600 font-bold"><i class="fa-solid fa-key"></i> ${ep.pricePoints} กุญแจ</span>`}
            </td>
            <td class="py-4 px-6 text-right">
                <button class="edit-ep-btn text-gray-400 hover:text-primary transition-colors p-2" data-id="${ep.id}" title="แก้ไข">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="delete-ep-btn text-gray-400 hover:text-red-500 transition-colors p-2" data-id="${ep.id}" title="ลบ">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    container.innerHTML = html;

    document.querySelectorAll('.edit-ep-btn').forEach(btn => btn.addEventListener('click', (e) => editEpisode(e.currentTarget.dataset.id)));
    document.querySelectorAll('.delete-ep-btn').forEach(btn => btn.addEventListener('click', (e) => deleteEpisode(e.currentTarget.dataset.id)));
}

function setupModal() {
    const modal = document.getElementById('episode-modal');
    const openBtn = document.getElementById('open-episode-modal-btn');
    const closeBtn = document.getElementById('close-episode-modal-btn');
    const cancelBtn = document.getElementById('cancel-episode-modal-btn');
    const form = document.getElementById('episode-form');
    
    const toggleModal = () => {
        modal.classList.toggle('hidden');
        if (modal.classList.contains('hidden')) {
            form.reset();
            form.removeAttribute('data-edit-id');
            document.getElementById('modal-title').innerHTML = '<i class="fa-solid fa-file-video text-primary"></i> ข้อมูลตอน';
            
            // รีเซ็ตสถานะ Disabled
            document.getElementById('ep-price').disabled = false;
            document.getElementById('ep-price').classList.remove('bg-gray-100', 'text-gray-400');
            document.getElementById('ep-hook-start').disabled = false;
            document.getElementById('ep-hook-start').classList.remove('bg-gray-100');
            document.getElementById('ep-hook-end').disabled = false;
            document.getElementById('ep-hook-end').classList.remove('bg-gray-100');

        } else {
            if (!form.getAttribute('data-edit-id')) {
                const nextEp = allEpisodesData.length > 0 ? Math.max(...allEpisodesData.map(e => Number(e.episodeNumber) || 0)) + 1 : 1;
                document.getElementById('ep-number').value = nextEp;
            }
        }
    };

    if (openBtn) openBtn.addEventListener('click', toggleModal);
    if (closeBtn) closeBtn.addEventListener('click', toggleModal);
    if (cancelBtn) cancelBtn.addEventListener('click', toggleModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) toggleModal(); });
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const editId = form.getAttribute('data-edit-id');
            const epNumber = Number(document.getElementById('ep-number').value);
            const title = document.getElementById('ep-title').value;
            
            const isFree = document.getElementById('ep-is-free').checked;
            const pricePoints = isFree ? 0 : Number(document.getElementById('ep-price').value);
            const published = document.querySelector('input[name="ep-publish"]:checked').value === "true";
            
            const videoUrl = document.getElementById('ep-video-url').value;
            const duration = Number(document.getElementById('ep-duration').value) || 0;
            
            // ดึงค่า Hook Start และ Hook End
            const hookStart = isFree ? 0 : (Number(document.getElementById('ep-hook-start').value) || 0);
            const hookEnd = isFree ? duration : (Number(document.getElementById('ep-hook-end').value) || 0);

            if (!videoUrl) {
                Swal.fire('ข้อผิดพลาด', 'กรุณาระบุลิงก์วิดีโอ YouTube', 'warning');
                return;
            }
            if (!isFree && pricePoints <= 0) {
                 Swal.fire('ข้อผิดพลาด', 'กรุณาระบุราคา หรือติ๊กเลือกเป็นตอนฟรี', 'warning');
                 return;
            }
            // การตรวจสอบความถูกต้องของเวลา
            if (!isFree && hookStart >= hookEnd && hookEnd !== 0) {
                Swal.fire('ข้อผิดพลาด', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'warning');
                return;
            }
            if (!isFree && hookEnd > duration) {
                Swal.fire('ข้อผิดพลาด', 'เวลาสิ้นสุดดูฟรีต้องไม่มากกว่าความยาววิดีโอทั้งหมด', 'warning');
                return;
            }

            const epData = {
                episodeNumber: epNumber,
                title: title,
                videoUrl: videoUrl,
                duration: duration,
                hookStart: hookStart,
                hookEnd: hookEnd,
                pricePoints: pricePoints,
                isFree: isFree,
                published: published,
                updatedAt: serverTimestamp()
            };

            Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                if (editId) {
                    await updateDoc(doc(db, `works/${workId}/episodes`, editId), epData);
                    // ✨ อัปเดตเวลาของ "เรื่องหลัก" (Work) ด้วย เพื่อให้เรื่องนี้ถูกดันขึ้นบนสุดในหน้า Home
                    await updateDoc(doc(db, "works", workId), { 
                        updatedAt: serverTimestamp() 
                    });
                } else {
                    epData.createdAt = serverTimestamp();
                    epData.views = 0;
                    await addDoc(collection(db, `works/${workId}/episodes`), epData);
                    
                    // ✨ อัปเดตเวลา (updatedAt) ของเรื่องหลักพร้อมกับบวกจำนวนตอน เพื่อดันขึ้นบนสุดในหน้า Home
                    await updateDoc(doc(db, "works", workId), { 
                        totalEpisodes: (parentWork.totalEpisodes || 0) + 1,
                        updatedAt: serverTimestamp()
                    });
                    parentWork.totalEpisodes = (parentWork.totalEpisodes || 0) + 1;
                }

                toggleModal();
                await loadEpisodesFromFirestore();

                Swal.fire({ title: 'บันทึกสำเร็จ!', icon: 'success', confirmButtonColor: '#10b981' });
            } catch (error) {
                console.error("Error saving episode:", error);
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
            }
        });
    }
}

window.editEpisode = (id) => {
    const ep = allEpisodesData.find(e => e.id === id);
    if (!ep) return;

    document.getElementById('ep-number').value = ep.episodeNumber;
    document.getElementById('ep-title').value = ep.title;
    
    const isFreeCheckbox = document.getElementById('ep-is-free');
    const priceInput = document.getElementById('ep-price');
    const hookStartInput = document.getElementById('ep-hook-start');
    const hookEndInput = document.getElementById('ep-hook-end');

    if (ep.isFree || ep.pricePoints === 0) {
        isFreeCheckbox.checked = true;
        priceInput.value = 0;
        priceInput.disabled = true;
        priceInput.classList.add('bg-gray-100', 'text-gray-400');
        
        hookStartInput.value = 0;
        hookStartInput.disabled = true;
        hookStartInput.classList.add('bg-gray-100');
        
        hookEndInput.value = 0;
        hookEndInput.disabled = true;
        hookEndInput.classList.add('bg-gray-100');
    } else {
        isFreeCheckbox.checked = false;
        priceInput.value = ep.pricePoints;
        priceInput.disabled = false;
        priceInput.classList.remove('bg-gray-100', 'text-gray-400');
        
        hookStartInput.value = ep.hookStart || 0;
        hookStartInput.disabled = false;
        hookStartInput.classList.remove('bg-gray-100');
        
        hookEndInput.value = ep.hookEnd || 0;
        hookEndInput.disabled = false;
        hookEndInput.classList.remove('bg-gray-100');
    }
    
    document.getElementById('ep-video-url').value = ep.videoUrl || '';
    document.getElementById('ep-duration').value = ep.duration || 0;

    const isPublished = ep.published !== false;
    document.querySelector('input[name="ep-publish"][value="true"]').checked = isPublished;
    document.querySelector('input[name="ep-publish"][value="false"]').checked = !isPublished;
    
    const form = document.getElementById('episode-form');
    form.setAttribute('data-edit-id', id);

    document.getElementById('modal-title').innerHTML = '<i class="fa-solid fa-file-video text-primary"></i> แก้ไขข้อมูลตอน';
    document.getElementById('episode-modal').classList.remove('hidden');
};

window.deleteEpisode = async (id) => {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?', text: "ตอนนี้จะถูกลบถาวร!", icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', confirmButtonText: 'ใช่, ลบเลย!'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, `works/${workId}/episodes`, id));
            if(parentWork.totalEpisodes > 0) {
                await updateDoc(doc(db, "works", workId), { totalEpisodes: parentWork.totalEpisodes - 1 });
                parentWork.totalEpisodes -= 1;
            }
            await loadEpisodesFromFirestore();
            Swal.fire({ title: 'ลบสำเร็จ!', icon: 'success', confirmButtonColor: '#10b981' });
        } catch (error) {
            console.error("Error deleting episode:", error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบตอนได้', 'error');
        }
    }
};
