// js/components/navbar.js
import { monitorAuthState, logoutUser, getUserData } from '../services/authService.js';
import { db } from '../config/firebaseConfig.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function loadNavbar() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return; // ถ้าหน้านั้นไม่มีคอนเทนเนอร์นี้ ให้ข้ามไป

    const navHTML = `
        <nav class="bg-primary text-white shadow-md sticky top-0 z-50">
            <div class="container mx-auto px-4 py-3 flex justify-between items-center">
                
		<a href="/index.html" class="text-2xl font-bold flex items-center gap-3 hover:text-emerald-100 transition-colors">
    			<img src="/assets/images/logo.webp" alt="Luminous Story Logo" class="h-10 w-auto object-contain" onerror="this.src='https://placehold.co/40x40/10b981/ffffff?text=LS'">
    			Luminous Story
		</a>

                <div id="mobile-menu" class="hidden md:flex flex-col md:flex-row absolute md:relative top-full left-0 w-full md:w-auto bg-primary md:bg-transparent p-4 md:p-0 space-y-4 md:space-y-0 md:space-x-6 items-center font-medium shadow-md md:shadow-none z-40">
                <a href="/works.html" class="block w-full text-center md:inline-block whitespace-nowrap hover:text-emerald-200 transition-colors">
                    <i class="fa-solid fa-book fa-beat"></i> ผลงานทั้งหมด
                </a>
		<a href="/about-us.html" class="block w-full text-center md:inline-block whitespace-nowrap hover:text-emerald-200 transition-colors">
                    <i class="fa-solid fa-users fa-beat-fade"></i> เกี่ยวกับเรา
                </a>
		<a href="/contact-us.html" class="block w-full text-center md:inline-block whitespace-nowrap hover:text-emerald-200 transition-colors">
                    <i class="fa-solid fa-envelope-open-text fa-bounce"></i> ติดต่อเรา
                </a>
                <div id="auth-menu-container" class="w-full md:w-auto flex justify-center shrink-0"></div>
            </div>

            <button id="hamburger-btn" class="md:hidden text-2xl hover:text-emerald-200 focus:outline-none z-50">
                <i class="fa-solid fa-bars"></i>
            </button>
            </div>
        </nav>
    `;

    navbarContainer.innerHTML = navHTML;

// ระบบ Hamburger Menu
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('flex');
            
            // เปลี่ยนไอคอนสลับระหว่าง 3 ขีด กับ ตัว X
            const icon = hamburgerBtn.querySelector('i');
            if (mobileMenu.classList.contains('hidden')) {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            } else {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            }
        });
    }

// ==========================================
    // ระบบ Auth Observer อัปเดต Navbar
    // ==========================================
    const authContainer = document.getElementById('auth-menu-container');
    if (authContainer) {
        monitorAuthState(async (user) => {
            if (user) {
                // ผู้ใช้ล็อกอินแล้ว -> ดึงข้อมูลจาก Firestore
                const userData = await getUserData(user.uid);
                
                // เช็ค Role เพื่อแสดงเมนูพิเศษ
                const isCreatorOrAdmin = userData?.role === 'creator' || userData?.role === 'admin';
                
                authContainer.innerHTML = `
                    <div class="flex items-center space-x-6 w-full md:w-auto justify-center">
                        <a href="/notifications.html" class="text-2xl hover:text-emerald-200 relative transition-transform transform hover:scale-110">
                            <i class="fa-solid fa-bell"></i>
                            <span id="nav-notif-badge" class="hidden absolute -top-1 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary shadow-sm fa-bounce" style="--fa-animation-iteration-count: 2;">0</span>
                        </a>
                        
                        <div class="relative">
                            <button id="profile-btn" class="flex items-center focus:outline-none transform hover:scale-105 transition-transform">
                                <img src="${userData?.photoURL || 'https://via.placeholder.com/40'}" class="w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] flex-shrink-0 rounded-full border-2 border-white object-cover shadow-md" alt="Profile">
                            </button>
                            
                            <div id="profile-dropdown" class="hidden absolute right-0 md:right-0 left-1/2 md:left-auto transform -translate-x-1/2 md:translate-x-0 mt-3 w-64 bg-white rounded-2xl shadow-xl py-2 text-gray-800 z-50 border border-emerald-50">
                                <div class="px-4 py-3 border-b border-gray-100">
                                    <p class="font-bold text-lg truncate text-gray-800">${userData?.username || 'User'}</p>
                                    <div class="flex items-center justify-between mt-2 bg-emerald-50 p-2 rounded-lg">
                                        <span class="text-primary font-bold text-sm"><i class="fa-solid fa-key text-yellow-500 fa-beat-fade" style="--fa-animation-duration: 3s;"></i> ${userData?.points || 0} กุญแจ</span>
                                        <a href="/topup.html" class="bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:bg-primary-dark transition shadow-sm flex items-center gap-1"><i class="fa-solid fa-plus"></i> เติม</a>
                                    </div>
                                </div>
                                <a href="/profile.html" class="block px-4 py-3 hover:bg-emerald-50 transition text-sm font-medium"><i class="fa-solid fa-user-gear w-6 text-gray-400"></i> จัดการโปรไฟล์</a>
				<a href="/library.html" class="block px-4 py-3 hover:bg-emerald-50 transition text-sm font-medium text-gray-800"><i class="fa-solid fa-book-bookmark w-6 text-primary"></i> ชั้นหนังสือของฉัน</a>

				${!isCreatorOrAdmin ? `
                                <a href="/guide-creator.html" class="block px-4 py-3 hover:bg-emerald-50 transition text-sm font-bold text-amber-500"><i class="fa-solid fa-wand-magic-sparkles w-6 text-amber-500"></i> สมัครเป็นนักเขียน</a>
                                ` : ''}
                                
                                ${isCreatorOrAdmin ? `
                                    <div class="bg-emerald-50/50">
                                        <div class="px-4 py-1 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Creator Zone</div>
                                        <a href="/creator/dashboard.html" class="block px-4 py-2 hover:bg-emerald-100 transition text-sm font-medium"><i class="fa-solid fa-chart-pie w-6 text-primary"></i> แดชบอร์ด (Dashboard)</a>
                                        <a href="/creator/works.html" class="block px-4 py-2 hover:bg-emerald-100 transition text-sm font-medium"><i class="fa-solid fa-book-open w-6 text-primary"></i> จัดการผลงานทั้งหมด</a>
                                    </div>
                                ` : ''}

                                ${userData?.role === 'admin' ? `
                                    <div class="bg-red-50/30">
                                        <div class="px-4 py-1 text-[10px] font-bold text-red-600 uppercase tracking-wider">Admin Zone</div>
                                        <a href="/admin/finance.html" class="block px-4 py-2 hover:bg-red-100 transition text-sm font-medium text-gray-800"><i class="fa-solid fa-vault w-6 text-red-500"></i> จัดการการเงิน</a>
                                    </div>
                                ` : ''}
                                
                                <div class="border-t border-gray-100 mt-1 pt-1">
                                    <a href="/transactions.html" class="block px-4 py-2 hover:bg-emerald-100 transition text-sm font-medium text-gray-700"><i class="fa-solid fa-clock-rotate-left w-6 text-gray-400"></i> ประวัติการใช้กุญแจ</a>
                                    <button id="logout-btn" class="w-full text-left px-4 py-3 text-red-500 hover:bg-red-50 transition text-sm font-bold rounded-b-xl"><i class="fa-solid fa-right-from-bracket w-6"></i> ออกจากระบบ</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // สคริปต์เปิด/ปิด Dropdown
                const profileBtn = document.getElementById('profile-btn');
                const profileDropdown = document.getElementById('profile-dropdown');
                profileBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // ป้องกันการคลิกทะลุ
                    profileDropdown.classList.toggle('hidden');
                });
                
                // ปิด Dropdown เมื่อคลิกพื้นที่อื่นบนหน้าจอ
                document.addEventListener('click', (e) => {
                    if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                        profileDropdown.classList.add('hidden');
                    }
                });

                // สคริปต์ Logout
                document.getElementById('logout-btn').addEventListener('click', async () => {
                    await logoutUser();
                    window.location.reload(); // รีเฟรชหน้าหลังล็อกเอาท์
                });

		// ระบบดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่านแบบ Real-time (รองรับทั้ง User และ Admin)
                const notifBadge = document.getElementById('nav-notif-badge');
                if (notifBadge && user) {
                    let userUnread = 0;
                    let adminUnread = 0;

                    const updateBadge = () => {
                        const total = userUnread + adminUnread;
                        if (total > 0) {
                            notifBadge.innerText = total > 99 ? '99+' : total;
                            notifBadge.classList.remove('hidden');
                        } else {
                            notifBadge.classList.add('hidden');
                        }
                    };

                    // 1. ดึงการแจ้งเตือนของผู้ใช้ทั่วไป
                    const qUser = query(collection(db, `users/${user.uid}/notifications`), where("isRead", "==", false));
                    onSnapshot(qUser, (snapshot) => {
                        userUnread = snapshot.docs.length;
                        updateBadge();
                    }, (error) => console.error("User Notif Error:", error));

                    // 2. ถ้าเป็น Admin ให้ดึงการแจ้งเตือนจาก adminNotifications ด้วย
                    if (userData?.role === 'admin') {
                        const qAdmin = query(collection(db, 'adminNotifications'), where("isRead", "==", false));
                        // [OVERWRITE] แยกนับรายการที่ยังไม่ได้อ่านและรายการที่รออนุมัติ (pending) แล้วนำมารวมกัน
                        let adminUnreadCount = 0;
                        let adminPendingCount = 0;

                        const updateAdminBadge = () => {
                            adminUnread = adminUnreadCount + adminPendingCount;
                            updateBadge();
                        };

                        const qAdminRead = query(collection(db, 'adminNotifications'), where("isRead", "==", false));
                        onSnapshot(qAdminRead, (snapshot) => {
                            // ป้องกันการนับซ้ำกับฝั่ง pending
                            adminUnreadCount = snapshot.docs.filter(doc => doc.data().status !== 'pending').length;
                            updateAdminBadge();
                        }, (error) => console.error("Admin Notif Read Error:", error));

                        const qAdminPending = query(collection(db, 'adminNotifications'), where("status", "==", "pending"));
                        onSnapshot(qAdminPending, (snapshot) => {
                            adminPendingCount = snapshot.docs.length;
                            updateAdminBadge();
                        }, (error) => console.error("Admin Notif Error:", error));
                    }
                }

            } else {
                // ผู้ใช้ยังไม่ล็อกอิน -> แสดงปุ่มเข้าสู่ระบบ/สมัครสมาชิก
                authContainer.innerHTML = `
                    <div class="w-full md:w-auto flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                        <a href="login.html" class="block w-full text-center md:inline-block whitespace-nowrap hover:text-emerald-200 transition-colors">
                            <i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ
                        </a>
                        <a href="register.html" class="block w-full text-center md:inline-flex items-center justify-center whitespace-nowrap bg-white text-primary px-5 py-2 leading-normal rounded-full shadow hover:bg-emerald-50 transition-colors duration-300 transform hover:scale-105">
                            <i class="fa-solid fa-user-plus mr-1"></i> สมัครสมาชิก
                        </a>
                    </div>
                `;
            }
        });
    }
}