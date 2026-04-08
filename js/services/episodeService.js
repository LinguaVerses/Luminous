import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../config/firebaseConfig.js";

export const episodeService = {
  
  /**
   * ดึงข้อมูลตอน (Episode) จาก Firestore
   */
  async getEpisode(workId, episodeId) {
    try {
      const episodeRef = doc(db, `works/${workId}/episodes`, episodeId);
      const episodeSnap = await getDoc(episodeRef);
      
      if (episodeSnap.exists()) {
        return { id: episodeSnap.id, ...episodeSnap.data() };
      }
      return null;
    } catch (error) {
      console.error("Error fetching episode:", error);
      return null;
    }
  },

  /**
   * ตรวจสอบสิทธิ์การเข้าถึงตอน (Check Access)
   * @param {string} userId - ไอดีของผู้ใช้ (ถ้าไม่ได้ล็อกอินจะเป็น null หรือ undefined)
   * @param {string} workId - ไอดีของเรื่อง
   * @param {string} episodeId - ไอดีของตอน
   * @param {number} episodeNumber - ลำดับของตอน
   * @param {boolean} isFree - สถานะตอนฟรีหรือไม่
   * @returns {boolean} - true = เข้าอ่านได้, false = ติดเหรียญ
   */
  async checkAccess(userId, workId, episodeId, episodeNumber, isFree) {
    // 1. ถ้าเป็นตอนฟรี (isFree = true) ให้เข้าอ่านได้ทันที โดยไม่ต้องเช็คล็อกอิน
    if (isFree) return true;

    // 2. ถ้าเป็นตอนเสียเงิน แต่ User ยังไม่ได้ล็อกอิน ให้ติดเหรียญทันที
    if (!userId) return false;

    try {
      // 3. เช็คว่าเคยซื้อเหมาเรื่อง (Complete Unlock) ไว้หรือไม่ ?
      const purchasedWorkRef = doc(db, `users/${userId}/purchasedWorks`, workId);
      const purchasedWorkSnap = await getDoc(purchasedWorkRef);
      
      if (purchasedWorkSnap.exists()) {
        const workData = purchasedWorkSnap.data();
        // เช็คว่าตอนที่จะอ่านนี้ อยู่ในขอบเขต "ตอนที่มีอยู่" ณ เวลาที่ User กดซื้อเหมาไปหรือไม่
        // (เช่น ตอนซื้อเหมาเรื่องมี 10 ตอน ถ้าตอนที่กำลังเข้าคือตอนที่ 11 จะต้องติดเหรียญ)
        if (episodeNumber <= workData.maxEpisodeNumber) {
          return true; // มีสิทธิ์อ่านจากการซื้อเหมา
        }
      }

      // 4. เช็คว่าเคยซื้อแบบรายตอน (Single Episode / Bundle) ไว้หรือไม่ ?
      // เราใช้ ID แบบผสม workId_episodeId ตามที่คุณออกแบบไว้เลยครับ ช่วยให้ค้นหาง่ายและตรงจุด
      const purchasedEpisodeRef = doc(db, `users/${userId}/purchasedEpisodes`, `${workId}_${episodeId}`);
      const purchasedEpisodeSnap = await getDoc(purchasedEpisodeRef);
      
      if (purchasedEpisodeSnap.exists()) {
        return true; // มีสิทธิ์อ่านจากการซื้อรายตอน
      }

      // 5. ถ้าเช็คหมดแล้วไม่มีสิทธิ์เลย แสดงว่าต้องให้แสดงหน้า Lock Screen
      return false;

    } catch (error) {
      console.error("Error checking access:", error);
      // หากเกิดข้อผิดพลาดในการดึงข้อมูล ให้เซฟตี้ด้วยการล็อคไว้ก่อน
      return false; 
    }
  }
};