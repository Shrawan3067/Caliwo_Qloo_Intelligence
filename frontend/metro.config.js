// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const os = require('os');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// If METRO_CACHE_ROOT is explicitly defined and exists/writable, use it;
// otherwise retain Expo's native high-performance BinaryFileStore
if (process.env.METRO_CACHE_ROOT) {
  try {
    const { FileStore } = require('metro-cache');
    const root = process.env.METRO_CACHE_ROOT;
    fs.mkdirSync(path.join(root, 'cache'), { recursive: true });
    config.cacheStores = [
      new FileStore({ root: path.join(root, 'cache') }),
    ];
  } catch (_err) {
    // Path inaccessible (e.g. Docker path on host machine) -> use default Expo BinaryFileStore
  }
}

// Utilize available CPU cores instead of choking bundler to 2 workers
const availableCores = os.cpus()?.length || 4;
config.maxWorkers = Math.max(availableCores - 1, 4);

// Prefer react-native entry points over browser/main —
// prevents bundling browser-only code paths in native builds.
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Exclude unused platform-specific files and test directories without blowing away Expo defaults
const defaultBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList ? [config.resolver.blockList] : [];

config.resolver.blockList = [
  ...defaultBlockList,
  /node_modules\/.*\/__tests__\/.*/,
  /node_modules\/.*\/example\/.*/,
  /node_modules\/.*\/examples\/.*/,
];

module.exports = config;
