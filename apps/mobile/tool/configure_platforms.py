"""
Adds the permissions Rafeeq needs to the platform folders that `flutter create` generates.
Safe to run more than once.

    flutter create . --project-name rafeeq --org sa.bidec --platforms android,ios
    python3 tool/configure_platforms.py

Android: location (last known location, Qibla), camera (bag tags, group QR), Bluetooth
scan/advertise (nearby finder), vibration, and package visibility for sms:/tel: links.
iOS: usage descriptions for the same, and the URL schemes the app opens.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

ANDROID_PERMISSIONS = [
    '<uses-permission android:name="android.permission.INTERNET"/>',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>',
    '<uses-permission android:name="android.permission.CAMERA"/>',
    '<uses-permission android:name="android.permission.VIBRATE"/>',
    '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation"/>',
    '<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE"/>',
    '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>',
    '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>',
    '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30"/>',
    '<uses-feature android:name="android.hardware.bluetooth_le" android:required="false"/>',
    '<uses-feature android:name="android.hardware.camera" android:required="false"/>',
]

ANDROID_QUERIES = """    <queries>
        <intent><action android:name="android.intent.action.SENDTO"/><data android:scheme="sms"/></intent>
        <intent><action android:name="android.intent.action.DIAL"/><data android:scheme="tel"/></intent>
        <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="https"/></intent>
        <intent><action android:name="android.intent.action.TTS_SERVICE"/></intent>
    </queries>
"""

IOS_KEYS = {
    "NSLocationWhenInUseUsageDescription": "Rafeeq shares your location with your travel group if you get lost, and shows the Qibla.",
    "NSCameraUsageDescription": "Rafeeq scans bag tags and group QR codes.",
    "NSBluetoothAlwaysUsageDescription": "Rafeeq uses Bluetooth so your family can find you nearby without internet.",
    "NSBluetoothPeripheralUsageDescription": "Rafeeq uses Bluetooth so your family can find you nearby without internet.",
}
IOS_SCHEMES = ["sms", "tel", "https"]


def android() -> bool:
    path = os.path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(path):
        print("android/ not found: run flutter create first", file=sys.stderr)
        return False
    xml = open(path, encoding="utf-8").read()
    missing = [p for p in ANDROID_PERMISSIONS if re.search(r'android:name="([^"]+)"', p).group(1) not in xml]
    if missing:
        xml = re.sub(r"(<manifest[^>]*>\n)", lambda m: m.group(1) + "".join(f"    {p}\n" for p in missing), xml, count=1)
    if "<queries>" not in xml:
        xml = xml.replace("</manifest>", ANDROID_QUERIES + "</manifest>")
    open(path, "w", encoding="utf-8").write(xml)
    print(f"Android: {len(missing)} permissions added")
    return True


def ios() -> bool:
    path = os.path.join(ROOT, "ios", "Runner", "Info.plist")
    if not os.path.exists(path):
        print("ios/ not found: run flutter create first", file=sys.stderr)
        return False
    plist = open(path, encoding="utf-8").read()
    added = 0
    insert = ""
    for k, v in IOS_KEYS.items():
        if f"<key>{k}</key>" not in plist:
            insert += f"\t<key>{k}</key>\n\t<string>{v}</string>\n"
            added += 1
    if "<key>LSApplicationQueriesSchemes</key>" not in plist:
        insert += "\t<key>LSApplicationQueriesSchemes</key>\n\t<array>\n" + "".join(f"\t\t<string>{s}</string>\n" for s in IOS_SCHEMES) + "\t</array>\n"
    if insert:
        idx = plist.rfind("</dict>")
        plist = plist[:idx] + insert + plist[idx:]
    open(path, "w", encoding="utf-8").write(plist)
    print(f"iOS: {added} usage descriptions added")
    return True


if __name__ == "__main__":
    ok = android() & ios()
    sys.exit(0 if ok else 1)
