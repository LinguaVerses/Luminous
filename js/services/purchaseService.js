import { doc, collection, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../config/firebaseConfig.js";

export const purchaseService = {
  
  /**
   * 1. ซื้อแบบรายตอน (Single Episode)
   */
  async purchaseEpisode(userId, workId, episodeId, pricePoints) {
    const userRef = doc(db, "users", userId);
    const purchasedEpisodeRef = doc(db, `users/${userId}/purchasedEpisodes`, `${workId}_${episodeId}`);
    const transactionLogRef = doc(collection(db, `users/${userId}/pointTransactions`));

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("ไม่พบข้อมูลผู้ใช้");

        const currentPoints = userDoc.data().points || 0;
        if (currentPoints < pricePoints) throw new Error("Keys ไม่เพียงพอ กรุณาเติมเงิน");

        // หัก Keys
        transaction.update(userRef, { points: currentPoints - pricePoints });

        // บันทึกการเข้าถึงตอน
        transaction.set(purchasedEpisodeRef, {
          workId: workId,
          episodeId: episodeId,
          price: pricePoints,
          purchasedAt: serverTimestamp()
        });

        // บันทึกประวัติการใช้จ่าย
        transaction.set(transactionLogRef, {
          amount: pricePoints,
          type: "purchase", // 
          referenceId: workId,
          episodeId: episodeId,
          createdAt: serverTimestamp()
        });
      });
      return { success: true };
    } catch (error) {
      console.error("Purchase Episode Error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 2. ซื้อเหมาเรื่อง (Complete Unlock)
   */
  async purchaseComplete(userId, workId, totalPrice, currentMaxEpisodeNumber) {
    const userRef = doc(db, "users", userId);
    const purchasedWorkRef = doc(db, `users/${userId}/purchasedWorks`, workId);
    const transactionLogRef = doc(collection(db, `users/${userId}/pointTransactions`));

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("ไม่พบข้อมูลผู้ใช้");

        const currentPoints = userDoc.data().points || 0;
        if (currentPoints < totalPrice) throw new Error("Keys ไม่เพียงพอ กรุณาเติมเงิน");

        // หัก Keys
        transaction.update(userRef, { points: currentPoints - totalPrice });

        // บันทึกการซื้อเหมา โดยจำกัดสิทธิ์ถึงแค่ตอนที่มี ณ ปัจจุบัน
        transaction.set(purchasedWorkRef, {
          workId: workId,
          pricePoints: totalPrice,
          maxEpisodeNumber: currentMaxEpisodeNumber,
          purchasedAt: serverTimestamp()
        });

        // บันทึกประวัติการใช้จ่าย
        transaction.set(transactionLogRef, {
          amount: totalPrice,
          type: "purchase_complete", // 
          referenceId: workId,
          episodeId: null, // ไม่มี episodeId เพราะเหมาทั้งเรื่อง 
          createdAt: serverTimestamp()
        });
      });
      return { success: true };
    } catch (error) {
      console.error("Purchase Complete Error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 3. ซื้อแบบมัดรวม 5 ตอน (Bundle Unlock - Save 10%)
   * @param {Array} episodes - Array ของ object { episodeId, price } ของตอนที่ต้องการซื้อ
   */
  async purchaseBundle(userId, workId, episodes, totalPrice) {
    const userRef = doc(db, "users", userId);
    const transactionLogRef = doc(collection(db, `users/${userId}/pointTransactions`));

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("ไม่พบข้อมูลผู้ใช้");

        const currentPoints = userDoc.data().points || 0;
        if (currentPoints < totalPrice) throw new Error("Keys ไม่เพียงพอ กรุณาเติมเงิน");

        // หัก Keys
        transaction.update(userRef, { points: currentPoints - totalPrice });

        // บันทึกการเข้าถึงทีละตอนใน Bundle
        episodes.forEach((ep) => {
          const epRef = doc(db, `users/${userId}/purchasedEpisodes`, `${workId}_${ep.episodeId}`);
          transaction.set(epRef, {
            workId: workId,
            episodeId: ep.episodeId,
            price: ep.price, // ราคาเดิมก่อนลด เพื่อเก็บเป็นสถิติ
            purchasedAt: serverTimestamp()
          });
        });

        // บันทึกประวัติการใช้จ่ายรวม 1 รายการ
        transaction.set(transactionLogRef, {
          amount: totalPrice,
          type: "purchase", // 
          referenceId: workId,
          episodeId: "bundle_5", // ระบุว่าเป็น bundle
          createdAt: serverTimestamp()
        });
      });
      return { success: true };
    } catch (error) {
      console.error("Purchase Bundle Error:", error);
      return { success: false, error: error.message };
    }
  }
};
