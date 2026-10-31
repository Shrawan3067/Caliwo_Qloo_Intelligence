// react-native.config.js
// Exclude iOS-only libraries from Android autolinking to prevent native module load crashes.
module.exports = {
  dependencies: {
    'react-native-health': {
      platforms: {
        android: null, // iOS-only — has no android native code
      },
    },
  },
};

