#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'TopicSubscriptionModule.android.js'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
    content = content.replace(
      "import { requireNativeModule } from 'expo-modules-core';",
      "import { requireOptionalNativeModule } from 'expo-modules-core';"
    ).replace(
      "export default requireNativeModule('ExpoTopicSubscriptionModule');",
      "export default requireOptionalNativeModule('ExpoTopicSubscriptionModule') || { addListener: () => {}, removeListeners: () => {}, subscribeToTopicAsync: () => Promise.resolve(null), unsubscribeFromTopicAsync: () => Promise.resolve(null) };"
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched TopicSubscriptionModule.android.js for Expo Go compatibility.');
  }
}
