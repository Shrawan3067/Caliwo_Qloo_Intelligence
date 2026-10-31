#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const frontendRoot = path.join(__dirname, '..');

// 1. Patch Permissions.java in expo-modules-core
const permissionsFile = path.join(
  frontendRoot,
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/interfaces/permissions/Permissions.java'
);
if (fs.existsSync(permissionsFile)) {
  let content = fs.readFileSync(permissionsFile, 'utf8');
  if (content.includes('getPermissionsWithPermissionsManager(permissionsManager, new Promise() {')) {
    content = content.replace(
      'getPermissionsWithPermissionsManager(permissionsManager, new Promise() {',
      'getPermissionsWithPermissionsManager(permissionsManager, (expo.modules.core.Promise) new Promise() {'
    ).replace(
      'askForPermissionsWithPermissionsManager(permissionsManager, new Promise() {',
      'askForPermissionsWithPermissionsManager(permissionsManager, (expo.modules.core.Promise) new Promise() {'
    );
    fs.writeFileSync(permissionsFile, content, 'utf8');
    console.log('Successfully patched Permissions.java in expo-modules-core.');
  }
}

// 2. Patch build.gradle in expo-modules-core
const coreBuildGradle = path.join(
  frontendRoot,
  'node_modules/expo-modules-core/android/build.gradle'
);
if (fs.existsSync(coreBuildGradle)) {
  let content = fs.readFileSync(coreBuildGradle, 'utf8');
  if (!content.includes('compile${variantName}Kotlin')) {
    const hook = `
afterEvaluate {
  tasks.matching { it.name.startsWith("compile") && it.name.endsWith("JavaWithJavac") }.configureEach { javaTask ->
    def variantName = javaTask.name.replace("compile", "").replace("JavaWithJavac", "")
    def kotlinTaskName = "compile\${variantName}Kotlin"
    if (tasks.findByName(kotlinTaskName)) {
      javaTask.dependsOn(tasks.named(kotlinTaskName))
      try {
        javaTask.classpath += files(tasks.named(kotlinTaskName).get().destinationDirectory)
      } catch (Throwable ignored) {
        try {
          javaTask.classpath += files(tasks.named(kotlinTaskName).get().destinationDir)
        } catch (Throwable ignored2) {}
      }
    }
  }
}
`;
    content += hook;
    fs.writeFileSync(coreBuildGradle, content, 'utf8');
    console.log('Successfully patched build.gradle in expo-modules-core.');
  }
}

// 3. Ensure hermesc symlink
const hermesTargetDir = path.join(frontendRoot, 'node_modules/react-native/sdks/hermesc/osx-bin');
const hermesBinary = path.join(frontendRoot, 'node_modules/hermes-compiler/hermesc/osx-bin/hermesc');
if (fs.existsSync(hermesBinary)) {
  if (!fs.existsSync(hermesTargetDir)) {
    fs.mkdirSync(hermesTargetDir, { recursive: true });
  }
  const destBinary = path.join(hermesTargetDir, 'hermesc');
  if (!fs.existsSync(destBinary)) {
    try {
      fs.copyFileSync(hermesBinary, destBinary);
      fs.chmodSync(destBinary, 0o755);
      console.log('Successfully installed hermesc binary.');
    } catch (e) {
      console.warn('Could not copy hermesc:', e.message);
    }
  }
}

