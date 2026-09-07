import fs from "node:fs";
import path from "node:path";

const gradlePath = path.resolve("src-tauri/gen/android/app/build.gradle.kts");
if (!fs.existsSync(gradlePath)) throw new Error(`找不到 Android Gradle 設定：${gradlePath}`);

let source = fs.readFileSync(gradlePath, "utf8");
if (source.includes('create("release")')) process.exit(0);

source = `import java.io.FileInputStream\nimport java.util.Properties\n${source}`;
const buildTypesMarker = "    buildTypes {";
if (!source.includes(buildTypesMarker)) throw new Error("找不到 buildTypes，無法加入 Android 簽署設定。");

const signingBlock = `    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["password"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
            storeType = keystoreProperties["storeType"] as String
        }
    }

`;
source = source.replace(buildTypesMarker, signingBlock + buildTypesMarker);
source = source.replace('        getByName("release") {', '        getByName("release") {\n            signingConfig = signingConfigs.getByName("release")');
fs.writeFileSync(gradlePath, source);

