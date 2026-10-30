/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
import { Platform } from "react-native";
import api from "@/src/lib/api";

let AppleHealthKit: any = null;
if (Platform.OS === 'ios') {
  try {
    AppleHealthKit = require('react-native-health').default;
  } catch (e) {}
}

let HealthConnect: any = null;
if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
  } catch (e) {}
}

export async function requestSleepPermission(): Promise<boolean> {
  if (Platform.OS === "ios" && AppleHealthKit) {
    return new Promise((resolve) => {
      const permissions = {
        permissions: {
          read: [AppleHealthKit.Constants.Permissions.SleepAnalysis]
        }
      };
      AppleHealthKit.initHealthKit(permissions, (err: string) => {
        resolve(!err);
      });
    });
  }
  if (Platform.OS === "android" && HealthConnect) {
    try {
      const isInitialized = await HealthConnect.initialize();
      if (!isInitialized) return false;
      await HealthConnect.requestPermission([
        { accessType: 'read', recordType: 'SleepSession' }
      ]);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function syncSleep(): Promise<boolean> {
  let sleepHours = 0;

  if (Platform.OS === "ios" && AppleHealthKit) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 1); // check last 24h
    
    sleepHours = await new Promise<number>((resolve) => {
      const opts = { startDate: start.toISOString(), endDate: end.toISOString() };
      AppleHealthKit.getSleepSamples(opts, (err: any, results: any) => {
        if (err || !results) {
          resolve(0);
          return;
        }
        // AppleHealthKit returns multiple samples (e.g. AsleepCore, AsleepDeep, InBed)
        // Let's sum up actual asleep times
        let totalMinutes = 0;
        results.forEach((sample: any) => {
          if (sample.value === "ASLEEP" || sample.value.includes("Asleep")) {
            const s = new Date(sample.startDate).getTime();
            const e = new Date(sample.endDate).getTime();
            totalMinutes += (e - s) / 60000;
          }
        });
        resolve(Math.round(totalMinutes / 60 * 10) / 10);
      });
    });
  } else if (Platform.OS === "android" && HealthConnect) {
     // Mock Android Health Connect logic due to complex API
     sleepHours = 0;
  }

  if (sleepHours > 0) {
    try {
      await api.post("/sleep/log", { hours: sleepHours });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
