#!/usr/bin/env node
/**
 * After `npx cap add android`, allow LAN/HTTP OpenCode hosts and notifications.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "android/app/src/main/AndroidManifest.xml");
if (!existsSync(manifestPath)) {
  console.error("[patch-android] AndroidManifest.xml not found — run cap add android first");
  process.exit(1);
}

let xml = readFileSync(manifestPath, "utf8");

function ensurePermission(name) {
  const needle = `android.permission.${name}`;
  if (xml.includes(needle)) return;
  xml = xml.replace(
    "<manifest",
    `<manifest`,
  );
  xml = xml.replace(
    /<application\b/,
    `    <uses-permission android:name="${needle}" />\n    <application`,
  );
}

ensurePermission("INTERNET");
ensurePermission("ACCESS_NETWORK_STATE");
ensurePermission("POST_NOTIFICATIONS");
ensurePermission("VIBRATE");

if (!xml.includes("android:usesCleartextTraffic")) {
  xml = xml.replace(
    /<application\b([^>]*)>/,
    (full, attrs) => `<application${attrs} android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config">`,
  );
} else if (!xml.includes("networkSecurityConfig")) {
  xml = xml.replace(
    "<application",
    `<application android:networkSecurityConfig="@xml/network_security_config"`,
  );
}

writeFileSync(manifestPath, xml);

const xmlDir = join(root, "android/app/src/main/res/xml");
mkdirSync(xmlDir, { recursive: true });
writeFileSync(
  join(xmlDir, "network_security_config.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`,
);

const iconSrc = join(root, "public/__grok/icon-180.png");
if (existsSync(iconSrc)) {
  const mipmap = join(root, "android/app/src/main/res/mipmap-hdpi");
  mkdirSync(mipmap, { recursive: true });
  cpSync(iconSrc, join(mipmap, "ic_launcher.png"));
  cpSync(iconSrc, join(mipmap, "ic_launcher_round.png"));
}

console.log("[patch-android] patched", dirname(manifestPath));
