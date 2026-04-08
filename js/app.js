import { loadNavbar } from './components/navbar.js';
import { loadFooter } from './components/footer.js';

// ==========================================
// 1. Mock Data (ข้อมูลจำลองสำหรับการทดสอบ)
// ==========================================
export const mockData = {
    currentUser: {
        uid: "user_001",
        username: "ReaderJourney",
        role: "user", // ลองเปลี่ยนเป็น "creator" หรือ "admin" เพื่อทดสอบ
        points: 1250,
        photoURL: "https://ui-avatars.com/api/?name=Reader&background=10b981&color=fff"
    },
    works: [
        {
            workId: "w_001",
            title: "เกิดใหม่เป็นท่านดยุกในต่างโลก",
            type: "novel",
            author: "นามปากกา A",
            coverImage: "https://placehold.co/300x450/10b981/ffffff?text=Novel",
            views: 15420,
            status: "Ongoing", // Coming Soon, Ongoing, Hiatus, Complete
            mainGenre: "Romance(ช-ญ)", 
            subGenre: "Fantasy",
            category: "ยอดฮิต" // มาใหม่, อัปเดต, ยอดฮิต
        },
        {
            workId: "w_002",
            title: "ศึกจอมเวทสะท้านภพ",
            type: "motion_comic",
            author: "Studio B x Writer C",
            coverImage: "https://placehold.co/400x225/047857/ffffff?text=Motion+Comic",
            views: 8900,
            status: "Complete",
            mainGenre: "Boy's Love(ช-ช)",
            subGenre: "Action",
            category: "มาใหม่"
        }
    ]
};

// ==========================================
// 2. Global Styles & Assets Setup
// ==========================================
function initGlobalAssets() {
    // โหลด Google Fonts (Mali & Sarabun)
    if (!document.getElementById('google-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'google-fonts';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Mali:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }

    // โหลด Font Awesome
    if (!document.getElementById('font-awesome')) {
        const faLink = document.createElement('link');
        faLink.id = 'font-awesome';
        faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
        faLink.rel = 'stylesheet';
        document.head.appendChild(faLink);
    }
}

// ==========================================
// ฟังก์ชันสร้างปุ่ม Scroll to Top
// ==========================================
function initScrollToTop() {
    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.className = 'fixed bottom-6 right-6 bg-primary text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-primary-dark transition-all duration-300 transform translate-y-20 opacity-0 z-50 cursor-pointer';
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.classList.remove('translate-y-20', 'opacity-0');
            btn.classList.add('translate-y-0', 'opacity-100');
        } else {
            btn.classList.add('translate-y-20', 'opacity-0');
            btn.classList.remove('translate-y-0', 'opacity-100');
        }
    });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==========================================
// 3. Basic Routing & UI Initialization
// ==========================================
function initApp() {
    // 3.1 ใส่ Class พื้นฐานให้ Body (ฟอนต์ Mali, สีพื้นหลัง, และ leading-loose แก้ปัญหาสระ 2 ชั้น)
    document.body.classList.add('font-sans', 'bg-emerald-50', 'text-gray-800', 'leading-loose');

    // เรียกใช้งาน Component
    loadNavbar();
    loadFooter();

// เรียกใช้ฟังก์ชัน Scroll to Top
    initScrollToTop();

    // ระบบซ่อน/แสดงรหัสผ่าน (ทำงานกับทุก input ที่มีคลาส toggle-password)
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // 3.2 ระบบ Routing จำลอง (ดักจับการคลิกลิงก์)
    // สำหรับหน้าเว็บที่ยังไม่มีไฟล์จริง ให้ใส่คลาส "mock-link" ไว้ที่แท็ก <a>
    document.querySelectorAll('a.mock-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('href').replace('.html', '');
            // ส่งไปหน้า placeholder แทน
            window.location.href = `placeholder.html?page=${targetPage}`;
        });
    });

    console.log("✅ Luminous Story App Initialized");
    console.log("👤 Current User Mock:", mockData.currentUser);
}

// ==========================================
// 4. Run Application
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initGlobalAssets();
    initApp();
});