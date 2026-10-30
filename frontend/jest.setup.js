/* eslint-disable no-undef */
import "@testing-library/jest-native/extend-expect";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock react-native Purchases / RevenueCat
jest.mock("react-native-purchases", () => ({
  default: {
    configure: jest.fn().mockResolvedValue(undefined),
    setLogLevel: jest.fn().mockResolvedValue(undefined),
    logIn: jest.fn().mockResolvedValue({ customerInfo: {} }),
    logOut: jest.fn().mockResolvedValue({ customerInfo: {} }),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    getOfferings: jest.fn().mockResolvedValue({ current: null, all: {} }),
    purchasePackage: jest.fn().mockResolvedValue({ customerInfo: { entitlements: { active: {} } } }),
    restorePurchases: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    syncPurchases: jest.fn().mockResolvedValue(undefined),
    addCustomerInfoUpdateListener: jest.fn(),
    LOG_LEVEL: { DEBUG: "DEBUG" },
  },
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));
