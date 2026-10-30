import { create } from 'zustand';

interface UIState {
  isPaywallVisible: boolean;
  setPaywallVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isPaywallVisible: false,
  setPaywallVisible: (visible) => set({ isPaywallVisible: visible }),
}));
