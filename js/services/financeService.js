// js/services/financeService.js

export const financeService = {
    /**
     * คำนวณระดับส่วนแบ่งรายได้ (Revenue Share Tier) แบบ Step-up
     * ตามยอดรายได้สะสมของนักเขียน (Lifetime Earnings)
     */
    calculateRevenueShareTier(lifetimeEarnings) {
        if (lifetimeEarnings < 50000) {
            return { id: 'standard', name: 'Standard Writer', share: 70, next: 50000, nextName: 'Gold (75%)' };
        }
        if (lifetimeEarnings < 150000) {
            return { id: 'gold', name: 'Gold Writer', share: 75, next: 150000, nextName: 'Platinum (80%)' };
        }
        if (lifetimeEarnings < 500000) {
            return { id: 'platinum', name: 'Platinum Writer', share: 80, next: 500000, nextName: 'Diamond (85%)' };
        }
        return { id: 'diamond', name: 'Diamond Writer <i class="fa-solid fa-gem ml-1"></i>', share: 85, next: null, nextName: 'MAX' };
    },

    /**
     * คำนวณรายได้สุทธิ (Net Revenue) หลังหักค่าส่วนแบ่งให้ Creator แล้ว
     * สูตร: ยอดเงินรวม * (ส่วนแบ่งเปอร์เซ็นต์ / 100)
     */
    calculateCreatorShare(grossRevenue, currentTierSharePercent) {
        return grossRevenue * (currentTierSharePercent / 100);
    }
};