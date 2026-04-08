// js/creator/manageWorks.js
import { db, auth } from '../config/firebaseConfig.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentUserId = null;
let allWorksData = [];

export function initManageWorks() {
    document.execCommand('defaultParagraphSeparator', false, 'p');

    setupColorPalette();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            loadWorksFromFirestore(); 
        } else {
            Swal.fire('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อน', 'error').then(() => {
                window.location.href = '../login.html';
            });
        }
    });
    setupModal();
}

async function loadWorksFromFirestore() {
    // 💡 หมายเหตุ: ในไฟล์ HTML ของคุณอาจจะยังใช้ id="novels-list" อยู่ เราจะยืมใช้ไปก่อนเพื่อไม่ให้คุณต้องไปแก้ HTML หลายไฟล์ครับ
    const animContainer = document.getElementById('novels-list'); 
    const shotAnimContainer = document.getElementById('comics-list');
    
    if (!animContainer || !shotAnimContainer) return;

    animContainer.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500">กำลังโหลดข้อมูล...</div>`;
    shotAnimContainer.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500">กำลังโหลดข้อมูล...</div>`;

    try {
        const q = query(collection(db, "works"), where("creatorId", "==", currentUserId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allWorksData = snapshot.docs.map(doc => ({ workId: doc.id, ...doc.data() }));
        
        renderWorksList();
    } catch (error) {
        console.error("Error loading works:", error);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลผลงานได้', 'error');
    }
}

function renderWorksList() {
    const animContainer = document.getElementById('novels-list');
    const shotAnimContainer = document.getElementById('comics-list');
    if (!animContainer || !shotAnimContainer) return;

    // ✨ แยกประเภทตาม Schema ใหม่
    const animations = allWorksData.filter(w => w.type === 'animation');
    const shotAnimations = allWorksData.filter(w => w.type === 'shot-animation');

    // โซน Animation 
    if (animations.length === 0) {
        animContainer.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">ยังไม่มีผลงาน Animation</div>`;
    } else {
        animContainer.innerHTML = animations.map(work => createWorkCard(work, 'aspect-[9/16]')).join(''); // ใช้ปกแนวตั้งมือถือ
    }

    // โซน Shot-Animation
    if (shotAnimations.length === 0) {
        shotAnimContainer.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300">ยังไม่มีผลงาน Shot Animation</div>`;
    } else {
        shotAnimContainer.innerHTML = shotAnimations.map(work => createWorkCard(work, 'aspect-[9/16]')).join('');
    }

    // ผูก Event
    document.querySelectorAll('.edit-work-btn').forEach(btn => {
        btn.addEventListener('click', (e) => window.editWork(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.delete-work-btn').forEach(btn => {
        btn.addEventListener('click', (e) => window.deleteWork(e.currentTarget.dataset.id));
    });
}

function createWorkCard(work, aspectClass) {
    let statusColor = "bg-emerald-50 text-emerald-600";
    if (work.status === "Coming Soon") statusColor = "bg-yellow-50 text-yellow-600";
    else if (work.status === "Hiatus") statusColor = "bg-orange-50 text-orange-600";
    else if (work.status === "Complete") statusColor = "bg-blue-50 text-blue-600";

    const draftBadge = work.published === false ? `<span class="bg-gray-500 text-white px-2 py-0.5 rounded text-[10px] ml-1">Draft</span>` : '';

    return `
        <div class="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col">
            <div class="${aspectClass} overflow-hidden relative">
                <img src="${work.coverImage || 'https://placehold.co/300x450/10b981/ffffff?text=No+Cover'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <div class="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-[10px] md:text-xs font-bold shadow text-primary">
                    <i class="fa-solid fa-mobile-screen"></i> ${work.type === 'animation' ? 'Animation' : 'Shot'}
                </div>
            </div>
            <div class="p-4 md:p-5 flex-grow flex flex-col">
                <h3 class="font-bold text-sm md:text-lg mb-1 line-clamp-2 text-gray-800 group-hover:text-primary transition-colors" title="${work.title}">${work.title} ${draftBadge}</h3>
                <p class="text-[10px] md:text-xs text-gray-500 mb-4 flex items-center justify-between">
                    <span class="${statusColor} px-2 py-0.5 rounded font-medium">${work.status || 'Ongoing'}</span>
                    <span><i class="fa-solid fa-eye text-gray-300"></i> ${work.views ? work.views.toLocaleString() : 0}</span>
                </p>
                <div class="mt-auto grid grid-cols-3 gap-2">
                    <a href="/creator/episodes.html?workId=${work.workId}" class="col-span-1 bg-emerald-50 text-primary text-center font-bold py-2 rounded-lg hover:bg-primary hover:text-white transition-colors text-xs md:text-sm" title="จัดการตอน">
                        <i class="fa-solid fa-list-ul"></i>
                    </a>
                    <button class="edit-work-btn col-span-1 bg-gray-50 text-gray-600 text-center font-bold py-2 rounded-lg hover:bg-gray-200 transition-colors text-xs md:text-sm" data-id="${work.workId}" title="แก้ไข">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="delete-work-btn col-span-1 bg-red-50 text-red-500 text-center font-bold py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors text-xs md:text-sm" data-id="${work.workId}" title="ลบ">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

//สร้างฟังก์ชันเพิ่มพาเลทสีและจัดการการกดเลือกสี
// ผูกพาเลทสีเข้ากับ Dropdown เดิมใน HTML
function setupColorPalette() {
    const editor = document.getElementById('work-desc');
    const colorDropdown = document.getElementById('colorDropdown');

    if (!editor) return;

    // ถ้าพบกล่อง Dropdown สี (ตามโครงสร้าง HTML ที่ส่งมา)
    if (colorDropdown) {
        const colors = [
            { hex: '#666666', name: 'เทา' }, { hex: '#000000', name: 'ดำ' },
            { hex: '#ff0000', name: 'แดง' }, { hex: '#0000ff', name: 'น้ำเงิน' },
            { hex: '#1e90ff', name: 'ฟ้า' }, { hex: '#228b22', name: 'เขียว' },
            { hex: '#ff1493', name: 'ชมพู' }, { hex: '#a52a2a', name: 'น้ำตาล' },
            { hex: '#9900ff', name: 'ม่วง' }, { hex: '#ff7f50', name: 'ส้ม' }
        ];

        // สร้างปุ่มสีแบบวงกลม 10 สี ลงในกล่อง (grid-cols-5 จะทำให้เรียงแถวละ 5 สีพอดี)
        colorDropdown.innerHTML = colors.map(c =>
            `<button type="button" class="w-5 h-5 rounded-full shadow-sm border border-gray-200 hover:scale-110 transition-transform cursor-pointer" style="background-color: ${c.hex};" title="${c.name}" data-color="${c.hex}"></button>`
        ).join('');

        // ผูก Event ให้แต่ละปุ่มสี
        const colorButtons = colorDropdown.querySelectorAll('button');
        colorButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const color = e.target.getAttribute('data-color');
                
                // คำสั่งเปลี่ยนสีข้อความ
                document.execCommand('foreColor', false, color);
                editor.focus();
                
                // ปิด Dropdown ทันทีหลังจากเลือกสีเสร็จ
                colorDropdown.classList.add('hidden'); 
            });
        });
    }
}

function setupModal() {
    const modal = document.getElementById('work-modal');
    const openBtn = document.getElementById('open-modal-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');
    const form = document.getElementById('work-form');

    const toggleModal = () => {
        modal.classList.toggle('hidden');
        if (modal.classList.contains('hidden')) {
            form.reset();
            document.getElementById('work-desc').innerHTML = '';
            form.removeAttribute('data-edit-id');
            document.getElementById('modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> ข้อมูลผลงาน';
        } else {
            if (!document.getElementById('work-desc').innerHTML.trim()) {
                document.getElementById('work-desc').innerHTML = '<p><br></p>';
            }
        }
    };

    if (openBtn) openBtn.addEventListener('click', toggleModal);
    if (closeBtn) closeBtn.addEventListener('click', toggleModal);
    if (cancelBtn) cancelBtn.addEventListener('click', toggleModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) toggleModal(); });

    // วางข้อความ
    const editor = document.getElementById('work-desc');
    if(editor) {
        editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const paragraphs = text.split(/\r?\n/).filter(line => line.trim() !== '');
            let html = '';
            paragraphs.forEach(line => { html += `<p>${line}</p>`; });
            document.execCommand('insertHTML', false, html);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const editId = form.getAttribute('data-edit-id');
            const title = document.getElementById('work-title').value;
            const type = document.getElementById('work-type').value; 
            const cover = document.getElementById('work-cover').value;
            const mainGenre = document.getElementById('work-main-genre').value;
            const tone = document.getElementById('work-tone').value;
            const theme = document.getElementById('work-theme').value;
            const audience = document.getElementById('work-audience').value;
            const style = document.getElementById('work-style').value;
            const status = document.getElementById('work-status').value;
            const published = document.querySelector('input[name="work-publish"]:checked').value === "true";
            const description = document.getElementById('work-desc').innerHTML;

            const workData = {
                title: title,
                type: type, // จะส่งไปเป็น animation หรือ shot-animation ตามที่คุณแก้ HTML
                coverImage: cover,
                mainGenre: mainGenre,
                tone: tone,
                theme: theme,
                audience: audience,
                style: style,
                status: status,
                published: published,
                description: description,
                updatedAt: serverTimestamp()
            };

            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                if (editId) {
                    await updateDoc(doc(db, "works", editId), workData);
                } else {
                    workData.creatorId = currentUserId;
                    workData.views = 0;
                    workData.createdAt = serverTimestamp();
                    await addDoc(collection(db, "works"), workData);
                }

                toggleModal();
                await loadWorksFromFirestore();

                Swal.fire({ title: 'บันทึกสำเร็จ!', icon: 'success', confirmButtonColor: '#10b981' });
            } catch (error) {
                console.error("Error saving:", error);
                Swal.fire('ข้อผิดพลาด', 'บันทึกไม่สำเร็จ', 'error');
            }
        });
    }
}

window.editWork = (id) => {
    const work = allWorksData.find(w => w.workId === id);
    if (!work) return;

    document.getElementById('work-title').value = work.title || '';
    document.getElementById('work-cover').value = work.coverImage || '';
    document.getElementById('work-main-genre').value = work.mainGenre || "";
    document.getElementById('work-tone').value = work.tone || "Cute";
    document.getElementById('work-theme').value = work.theme || "Animal";
    document.getElementById('work-audience').value = work.audience || "Kids";
    document.getElementById('work-style').value = work.style || "Anime Style";
    document.getElementById('work-status').value = work.status || "Ongoing";
    document.getElementById('work-type').value = work.type || "animation"; 

    const isPublished = work.published !== false;
    document.querySelector('input[name="work-publish"][value="true"]').checked = isPublished;
    document.querySelector('input[name="work-publish"][value="false"]').checked = !isPublished;

    document.getElementById('work-desc').innerHTML = work.description || '<p><br></p>';
    
    document.getElementById('work-form').setAttribute('data-edit-id', id);
    document.getElementById('modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> แก้ไขผลงาน';
    document.getElementById('work-modal').classList.remove('hidden');
};

window.deleteWork = async (id) => {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?', text: "ผลงานและตอนทั้งหมดจะถูกลบถาวร!", icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', confirmButtonText: 'ใช่, ลบเลย!'
    });

    if (result.isConfirmed) {
        try {
            await deleteDoc(doc(db, "works", id));
            await loadWorksFromFirestore();
            Swal.fire('ลบสำเร็จ!', '', 'success');
        } catch (error) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบผลงานได้', 'error');
        }
    }
};
