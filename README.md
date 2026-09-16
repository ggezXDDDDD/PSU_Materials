# 🏛️ PSU Materials Portal & Study Hub

ศูนย์รวมงาน LMS, การบ้าน, ควิซเก็บคะแนน, ปฏิทินสอบ และเอกสารประกอบการเรียนครบวงจร  
ภาควิชาวิศวกรรมวัสดุ (Materials Engineering) มหาวิทยาลัยสงขลานครินทร์ (PSU)

🌐 **เข้าสู่เว็บไซต์ออนไลน์ได้ตลอด 24 ชั่วโมง:**  
👉 **[https://ggezxddddd.github.io/PSU_Materials/](https://ggezxddddd.github.io/PSU_Materials/)**

---

## ✨ ไฮไลท์ฟีเจอร์เด่น (Key Features)

- 📋 **LMS Master Hub:** รวบรวมงานที่ต้องส่ง ควิซเก็บคะแนน รายงาน และการสอบ ครบทุกวิชา พร้อมระบบกรองแยกรายวิชาและสถานะงานแบบเรียลไทม์
- 🔄 **Auto-Sync Engine:** เชื่อมต่อและดึงข้อมูลงานล่าสุดจาก PSU LMS (`lms.psu.ac.th`) พร้อมคำนวณคะแนนและแจ้งเตือนงานด่วน
- 📱 **Everywhere & 24/7:** ออกแบบให้รองรับการใช้งานสมบูรณ์แบบบนคอมพิวเตอร์, iPhone, iPad, และ Android (สามารถ Add to Home Screen ได้ทันที)
- 📚 **File & Slide Library:** คลังสไลด์บรรยาย ชีทสรุป และเอกสารคำสอนจัดหมวดหมู่แยก PDF/PowerPoint ครบทุกวิชา
- 🎨 **iOS 27 Liquid Glass UI:** ดีไซน์กระจกแก้วหรูหรา ลื่นไหลระดับ 60/120 FPS พร้อม Dark Mode และ Full-Screen RGB Rainbow Overdrive Mode

---

## 📁 โครงสร้างโฟลเดอร์หลังจัดระเบียบ (Clean Directory Structure)

### การแบ่งหน้าตามหน้าที่

- `index.html`: หน้าเริ่มต้นและทางลัดหลัก
- `courses.html`: รายวิชาทั้งหมด พร้อมทางเข้าเอกสาร งาน และสรุปของแต่ละวิชา
- `pages/<วิชา>.html`: เอกสารและสไลด์ประกอบการเรียน
- `pages/<วิชา>_tasks.html`: งานของวิชานั้นและลิงก์ส่งงาน
- `pages/<วิชา>_summary.html`: สรุปเนื้อหาและแบบฝึกหัดทบทวน
- `tasks.html`: ค้นหาและกรองงานรวมทุกวิชา
- `calendar.html`: กำหนดส่งและวันสอบในมุมมองปฏิทิน
- `liquid-glass.html`: พื้นที่โฟกัส จับเวลา และจดบันทึก

ทุกหน้าของ Portal ใช้เมนูและการค้นหาทางลัดร่วมกัน กด ⌘ K / Ctrl K เพื่อค้นหาหน้าและรายวิชา บนมือถือใช้เมนูด้านล่างเพื่อสลับหน้าหลัก รายวิชา งาน และปฏิทิน

```text
PSU_Materials/
├── 🌐 index.html                       # 🏠 หน้าเว็บหลัก (คงไว้ที่ Root เพื่อรักษา URL เดิม)
├── 🌐 login.html / tasks.html          # 🔐 หน้าเข้าสู่ระบบและศูนย์รวมงาน
├── 🌐 calendar.html / liquid-glass.html # 📅 ปฏิทินและ Liquid Workspace
├── ⚙️ server.py / dev.py               # เซิร์ฟเวอร์และตัวเรียกสำหรับรันในเครื่อง
├── 📖 README.md                        # คู่มือการใช้งานและโครงสร้างระบบ
│
├── 📁 assets/                          # 🎨 ไฟล์หน้าเว็บที่ใช้ร่วมกัน
│   ├── 📁 css/                         # ธีม Liquid Glass และ CSS กลาง
│   ├── 📁 js/                          # Authentication, PWA และระบบ Animation
│   └── 📁 icons/                       # ไอคอนเว็บไซต์และ PWA
│
├── 📁 01_วิชาเอก_Materials/             # 📚 คลังเอกสารและสไลด์วิชาเอกวัสดุศาสตร์
│   ├── 📁 01_โลหะวิทยา_Metallurgy/
│   │   ├── 📁 01_สไลด์_PDF/             # สไลด์ Unit 1 - 10 (PDF อ่านง่าย)
│   │   ├── 📁 02_สไลด์_PowerPoint/      # สไลด์ Unit 1 - 10 (PPTX ไฟล์นำเสนอ)
│   │   ├── 📁 03_แบบฝึกหัดและเฉลย/      # แบบฝึกหัดระนาบผลึก + เฉลยละเอียด
│   │   └── 📁 04_ประมวลรายวิชาและสื่อ/   # ประมวลรายวิชา + วิดีโอสาธิต Gas Atomization
│   │
│   ├── 📁 02_พอลิเมอร์_Polymer/
│   │   ├── 📁 01_สไลด์และเลกเชอร์/       # Basic properties, Chemical reactions, etc.
│   │   ├── 📁 02_เอกสารคำสอน/           # คำสอน อ.สิริญญา, อ.ชวนพิศ
│   │   ├── 📁 03_สรุปเตรียมสอบ/         # สรุปเนื้อหาเตรียมสอบ
│   │   └── 📁 04_ประมวลรายวิชา/         # Course outline
│   │
│   └── 📁 03_เซรามิก_Ceramics/
│       ├── 📁 01_สไลด์และเลกเชอร์/       # Lecture I-III, Forming, Glazing, etc.
│       └── 📁 02_ประมวลรายวิชาและบทความ/  # Course syllabus, บทความประกอบ
│
├── 📁 02_วิชาศึกษาทั่วไป_GenEd/          # 🎓 โฟลเดอร์เตรียมไว้สำหรับวิชาทั่วไป
│   ├── 📁 ชีววิทยา_Biotechnology/
│   ├── 📁 ปฏิบัติการชีววิทยา_Biolab/
│   ├── 📁 สิ่งแวดล้อม_GreenLove/
│   └── 📁 ความมั่นคงไซเบอร์_Cybersecurity/
│
├── 📁 pages/                           # 🌐 หน้าเอกสาร งาน และสรุป แยกตามรายวิชา
│   ├── ceramic.html                    # หน้ารายวิชาเซรามิกเบื้องต้น (315-201)
│   ├── metallurgy.html                 # หน้ารายวิชาโลหะวิทยา 1 (316-221)
│   ├── polymer.html                    # หน้ารายวิชาพอลิเมอร์เบื้องต้น (342-201)
│   ├── biology.html                    # หน้ารายวิชาชีววิทยา (315-201G7)
│   ├── biolab.html                     # หน้ารายวิชาปฏิบัติการชีววิทยา
│   ├── greenlove.html                  # หน้ารายวิชา GreenLove (200-103)
│   ├── cybersecurity.html              # หน้ารายวิชาความมั่นคงปลอดภัยไซเบอร์
│   ├── other_courses.html              # หน้ารายวิชาศึกษาทั่วไป (GE Courses)
│   └── สรุปพอลิเมอร์_เตรียมสอบ.html    # สรุปเจาะลึกพอลิเมอร์เตรียมสอบ
│
├── 📁 data/                            # 📂 โฟลเดอร์เก็บข้อมูลระบบ
│   ├── tasks_live.json                 # แคชรายการงานและการบ้านล่าสุดที่ซิงค์จาก LMS
│   └── ตารางเรียน_1_2569.ics           # ไฟล์ปฏิทินตารางเรียน (นำเข้า Apple/Google Calendar ได้)
│
├── 📁 scripts/                         # 📂 โฟลเดอร์เครื่องมือและระบบอัตโนมัติ
│   ├── sync_lms_engine.py              # เอนจินดึงข้อมูลจาก PSU LMS และ Push ขึ้น GitHub
│   ├── verify_links.py                 # ตรวจลิงก์ภายในก่อนเผยแพร่
│   └── 📁 launchers/
│       └── update_lms.command          # ปุ่มลัดดับเบิลคลิกเพื่อซิงค์ LMS
│
├── 📁 tests/                           # 🧪 ชุดตรวจระบบยืนยันตัวตน
├── 📁 worker/                          # ☁️ Authentication Worker สำหรับระบบ Cloud
└── 📁 runtime/                         # 🔒 ไฟล์ที่เกิดตอนรันในเครื่อง (ไม่อัปขึ้น Git)
    ├── sessions.json                   # Session ฝั่งเซิร์ฟเวอร์
    ├── server_secret                   # Secret เฉพาะเครื่อง
    └── 📁 logs/                        # ประวัติการซิงค์ LMS
```

> หน้า HTML หลักยังอยู่ตำแหน่งเดิมเพื่อให้ URL บน GitHub Pages และลิงก์ที่บันทึกไว้ใช้งานต่อได้ ส่วนไฟล์ชั่วคราวจากการรันระบบจะรวมอยู่ใน `runtime/` และถูกตัดออกจาก Git อัตโนมัติ

---

## 🚀 วิธีการซิงค์ข้อมูลล่าสุดจาก LMS

1. **ดับเบิลคลิกที่ไฟล์:** `scripts/launchers/update_lms.command`
2. ระบบจะดึงข้อมูลจาก Safari ที่ล็อกอิน LMS ไว้ นำมาประมวลผล อัปเดตหน้าเว็บ และ Push ขึ้น GitHub ให้อัตโนมัติใน 5 วินาที
3. หน้าเว็บทั้งบนเครื่องและบนมือถือจะได้รับการอัปเดตทันทีครับ!

## 🤖 Android debug APK

เว็บและ Android ใช้ source เดียวกันผ่าน Capacitor โดยไม่แยกหน้าเว็บอีกชุดหนึ่ง

```bash
bun install
bun run android:sync
cd android && ./gradlew assembleDebug
```

ต้องมี JDK 21 และ Android SDK สำหรับการ build ในเครื่อง ส่วน GitHub Actions จะสร้าง artifact ชื่อ `PSU-Materials-debug-apk` เมื่อ push การเปลี่ยนแปลงที่เกี่ยวข้องกับ Android หรือสั่งรัน workflow ด้วยตนเอง

### Live Reload บน Android (development only)

Web layer (HTML/CSS/JS) ใช้ source เดียวกับเว็บ, PWA และ Android ส่วน native จะเปลี่ยนเฉพาะเมื่อเพิ่ม plugin, permission, manifest หรือ native configuration เท่านั้น จึงไม่ต้องสร้าง APK ใหม่ทุกครั้งที่แก้ UI

แนะนำ USB เพราะไม่เปิด development server ไปยังเครือข่าย:

1. เปิด USB debugging และเสียบ Android กับเครื่องพัฒนา
2. Terminal แรก: `bun run dev:lan`
3. Terminal ที่สอง: `bun run android:live:usb`
4. หลัง app เปิดแล้ว แก้ HTML/CSS/JS และ reload app เพื่อเห็นผลทันทีโดยไม่ต้อง download/install APK ใหม่

ทางเลือก Wi-Fi: ให้มือถือและเครื่องพัฒนาอยู่ Wi-Fi เดียวกัน แล้วใช้ `bun run android:live:lan` แทน USB

คำสั่ง Live Reload สร้าง development app ที่ชี้ไปยัง server ชั่วคราวเท่านั้น; ห้ามใช้เป็น production build. หากต้องกลับไปเป็น bundled app ให้ใช้ `bun run android:sync` แล้ว build APK ปกติอีกครั้ง. เวอร์ชันใน `package.json` คือ native app version; web layer ยังใช้ source เดียวกันและยังไม่มี OTA updater.

---

_สร้างและพัฒนาด้วย Antigravity AI Coding Assistant 🚀_
