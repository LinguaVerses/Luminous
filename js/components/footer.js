// js/components/footer.js

export function loadFooter() {
    const footerContainer = document.getElementById('footer-container');
    if (!footerContainer) return;

    const footerHTML = `
        <footer class="bg-primary-dark text-emerald-50 mt-12 pt-10 pb-6">
            <div class="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                
                <div>
                    <h3 class="text-xl font-bold mb-4 flex items-center justify-center md:justify-start gap-2">
                         <i class="fa-solid fa-clapperboard fa-beat" style="--fa-animation-duration: 5s;"></i> Luminous Story
                    </h3>
                    <p class="text-sm text-emerald-200 leading-loose">
                        แพลตฟอร์มรับชมอนิเมชันแนวตั้งแบบครบวงจร สนับสนุน Creator ไทยให้สร้างสรรค์ผลงานสู่ระดับโลก
                    </p>
                </div>

                <div>
                    <h4 class="font-bold mb-4 text-white">เมนูหลัก</h4>
                    <ul class="space-y-2 text-sm">
                        <li><a href="/index.html" class="hover:text-white transition-colors"><i class="fa-solid fa-angle-right"></i> หน้าแรก</a></li>
                        <li><a href="/works.html" class="hover:text-white transition-colors"><i class="fa-solid fa-angle-right"></i> ผลงานทั้งหมด</a></li>
                        <li><a href="/guide-viewer.html" class="hover:text-white transition-colors"><i class="fa-solid fa-angle-right"></i> คู่มือการใช้งาน (Viewer)</a></li>
                        <li><a href="/creator/dashboard.html" class="hover:text-white transition-colors text-amber-300 font-medium"><i class="fa-solid fa-star fa-spin" style="--fa-animation-duration: 3s;"></i> ศูนย์นักเขียน (Creator Center)</a></li>
                    </ul>
                </div>

                <div>
                    <h4 class="font-bold mb-4 text-white">การช่วยเหลือและนโยบาย</h4>
                    <ul class="space-y-2 text-sm">
                        <li><a href="/help-center.html#faq" class="hover:text-white transition-colors"><i class="fa-solid fa-circle-question"></i> คำถามที่พบบ่อย (FAQ)</a></li>
                        <li><a href="/help-center.html#terms" class="hover:text-white transition-colors"><i class="fa-solid fa-file-contract"></i> ข้อตกลงการใช้งาน</a></li>
                        <li><a href="/help-center.html#privacy" class="hover:text-white transition-colors"><i class="fa-solid fa-user-shield"></i> นโยบายความเป็นส่วนตัว</a></li>
                        <li><a href="/contact-us.html" class="hover:text-white transition-colors"><i class="fa-solid fa-envelope"></i> ติดต่อเรา</a></li>
                    </ul>
                </div>

                <div>
                    <h4 class="font-bold mb-4 text-white">ติดตามเรา</h4>
                    <div class="flex justify-center md:justify-start space-x-4">
                        <a href="#" class="text-2xl hover:text-emerald-300 transition-colors transform hover:-translate-y-1 inline-block"><i class="fa-brands fa-facebook"></i></a>
                        <a href="#" class="text-2xl hover:text-emerald-300 transition-colors transform hover:-translate-y-1 inline-block"><i class="fa-brands fa-twitter"></i></a>
                        <a href="#" class="text-2xl hover:text-emerald-300 transition-colors transform hover:-translate-y-1 inline-block"><i class="fa-brands fa-youtube"></i></a>
                    </div>
                </div>
            </div>

            <div class="text-center mt-10 pt-4 border-t border-emerald-600 text-xs text-emerald-300">
                &copy; 2026 Luminous Story. All rights reserved.
            </div>
        </footer>
    `;

    footerContainer.innerHTML = footerHTML;
}