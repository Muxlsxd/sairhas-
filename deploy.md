# สายรหัส (Code Line) - Deployment Guide

ระบบจับคู่พี่น้อง APE/TME แบบไม่ระบุตัวตน
Frontend: `sairhas.html` | Backend: Google Apps Script + Google Sheets

---

## 1. สร้าง Google Sheet

### 1.1 สร้าง Spreadsheet ใหม่
1. ไปที่ [sheets.google.com](https://sheets.google.com)
2. สร้าง Spreadsheet ใหม่ ชื่อ `สายรหัส_Data`
3. Copy **Spreadsheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```

### 1.2 สร้าง Tabs (3 tabs)
| Tab Name | Columns (Row 1) |
|----------|-----------------|
| `pairs` | `pair_key` `y2_id` `y1_id` `reveal_at` `status` `picked_at` |
| `seniors` | `y2_id` `name` `faculty` `max_picks` `current_picks` |
| `messages` | `id` `pair_key` `from_id` `content` `type` `sent_at` `read_at` |

> **Tip**: รันฟังก์ชัน `testSetup()` ใน Apps Script จะสร้าง tabs + headers ให้อัตโนมัติ

---

## 2. ตั้งค่า Google Apps Script

### 2.1 เปิด Apps Script
1. ใน Spreadsheet → Extensions → Apps Script
2. ลบโค้ดเดิม วางโค้ดจาก `gas-backend.gs`
3. Save (Ctrl+S) ตั้งชื่อโปรเจกต์ `สายรหัส_Backend`

### 2.2 Deploy as Web App
1. Deploy → New deployment
2. Type: **Web App**
3. Execute as: **Me** (your account)
4. Who has access: **Anyone** (important for frontend to call)
5. Deploy → Copy **Web App URL**

### 2.3 ตั้งค่า URL ใน Frontend
แก้ไข `sairhas.html` บรรทัด `CONFIG.GAS_URL`:
```javascript
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  // ...
};
```

---

## 3. เพิ่มข้อมูลทดสอบ (Optional)

### 3.1 Pre-match คู่ที่รู้จักแล้ว
ใน Apps Script Console รัน:
```javascript
adminPreMatchPairs([
  ['68070507606', '69070509606', '2026-08-15 18:00'],
  ['68070507607', '69070509607', '2026-08-15 18:00'],
]);
```

### 3.2 เพิ่มน้องที่ยังไม่มีพี่ (ให้พี่เลือก)
```javascript
adminAddUnpairedJuniors([
  ['69070508123'],
  ['69070508456'],
  ['69070508789'],
]);
```

---

## 4. Deploy Frontend (GitHub Pages - ฟรี)

### 4.1 สร้าง GitHub Repo
1. ไป [github.com/new](https://github.com/new)
2. Repo name: `sairhas` (public)
3. ไม่ต้องเพิ่ม README/.gitignore

### 4.2 Upload ไฟล์
```bash
git clone https://github.com/YOUR_USERNAME/sairhas.git
cd sairhas
cp /path/to/sairhas.html ./index.html
git add index.html
git commit -m "Add frontend"
git push
```

### 4.3 เปิด GitHub Pages
1. Settings → Pages
2. Source: Deploy from a branch → `main` / `(root)`
3. Save → รอ 1-2 นาที
4. URL: `https://YOUR_USERNAME.github.io/sairhas/`

---

## 5. ทดสอบระบบ

### 5.1 Demo Mode
- เปิดเว็บ → กด "ทดสอบโหมดสาธิต"
- เข้าสู่หน้า Chat ได้เลย (ใช้ ID: 68070507606)

### 5.2 Real Mode
- กรอกรหัส 13 หลัก จริง (ปี 68 หรือ 69)
- กด "เชื่อมต่อสายรหัส" → ยืนยัน
- **Y2 (Senior)**: เห็นหน้า "เลือกน้อง" → กดเลือก
- **Y1 (Junior)**: เห็นหน้า "รอพี่มาคว้า"
- เมื่อจับคู่แล้ว → เข้าสู่ Chat

---

## 6. โครงสร้างข้อมูล (Reference)

### pairs tab
| pair_key | y2_id | y1_id | reveal_at | status | picked_at |
|----------|-------|-------|-----------|--------|-----------|
| 070507606 | 68070507606 | 69070509606 | 2026-08-15 18:00 | matched | 2026-07-28... |
| 070508123 | | 69070508123 | | unpaired | |

### seniors tab
| y2_id | name | faculty | max_picks | current_picks |
|-------|------|---------|-----------|---------------|
| 68070507606 | X4N3Z | APE/TME | 3 | 1 |

### messages tab
| id | pair_key | from_id | content | type | sent_at | read_at |
|----|----------|---------|---------|------|---------|---------|
| uuid | 070507606 | 68070507606 | เรียนรู้หลักการก่อน | advice | 2026-07-28T14:25:00Z | |

---

## 7. Parser Logic (Frontend + Backend ต้องตรงกัน)

```javascript
function parseStudentId(id) {
  const s = String(id).trim().replace(/\D/g, '');
  // รองรับทั้ง 11 หลัก (APE pattern) และ 13 หลัก
  if (s.length === 11) {  // Pattern: YY(2) + CCCCCC(6) + SSS(3) = 11
    return {
      year: s.slice(0, 2),           // '68' | '69'
      core: s.slice(2, 8),           // 6 หลัก = คณะ/สาขา (อาจต่างปีกัน)
      suffix: s.slice(8, 11),        // 3 หลัก = ลำดับในสาขา (ใช้จับคู่)
      pairKey: s.slice(8, 11),       // ใช้ suffix 3 หลักสุดท้ายเป็น pair key
      role: s.startsWith('68') ? 'Y2' : s.startsWith('69') ? 'Y1' : null,
      full: s
    };
  }
  if (s.length === 13) {  // Pattern: YY + CCCCCC + VV + SSS
    return {
      year: s.slice(0, 2),
      core: s.slice(2, 8),
      variable: s.slice(8, 10),
      suffix: s.slice(10, 13),
      pairKey: s.slice(10, 13),
      role: s.startsWith('68') ? 'Y2' : s.startsWith('69') ? 'Y1' : null,
      full: s
    };
  }
  return null;
}

// Example APE:
// 68070507606 → {year:'68', core:'070507', suffix:'606', pairKey:'606', role:'Y2'}
// 69070509606 → {year:'69', core:'070509', suffix:'606', pairKey:'606', role:'Y1'}
// → PAIR MATCH by suffix '606'
```

---

## 8. API Endpoints (GAS)

| Action | Params | Returns |
|--------|--------|---------|
| `verifyStudentId` | `student_id` | `{ok, pair?, parsed?}` |
| `getPairByKey` | `pair_key` | `{ok, pair}` |
| `getAvailableJuniors` | - | `{ok, juniors[]}` |
| `pickJunior` | `y2_id`, `y1_id` | `{ok, pair_key}` |
| `sendMessage` | `pair_key`, `from_id`, `content`, `type` | `{ok, message}` |
| `getThread` | `pair_key` | `{ok, messages[]}` |
| `getCountdown` | `pair_key` | `{ok, reveal_at}` |

---

## 9. Troubleshooting

| ปัญหา | วิธีแก้ |
|--------|---------|
| CORS error | Deploy GAS ใหม่: Who has access = **Anyone** |
| "Script function not found" | Save โค้ด GAS ใหม่ Deploy ใหม่ (New deployment) |
| Sheet ไม่มี tabs | รัน `testSetup()` ใน Apps Script Console |
| น้องไม่ขึ้นในรายการ | เช็ค `pairs` tab: status=`unpaired`, y2_id ว่าง |
| พี่เลือกน้องไม่ได้ | เช็ค `seniors` tab: current_picks < max_picks |
| Countdown ไม่แสดง | เช็ค `reveal_at` format: `2026-08-15 18:00` (Asia/Bangkok) |

---

## 10. Production Checklist

- [ ] GAS Web App: Execute as Me, Anyone access
- [ ] Frontend `GAS_URL` ตรงกับ Deployment ID
- [ ] Sheet tabs: pairs, seniors, messages (headers ถูกต้อง)
- [ ] Reveal date ตั้งใน `pairs.reveal_at` (ISO format หรือ `YYYY-MM-DD HH:mm`)
- [ ] Test ทั้ง Y2 และ Y1 flow
- [ ] GitHub Pages deploy สำเร็จ
- [ ] HTTPS ทำงาน (GitHub Pages ให้ SSL ฟรี)

---

## 11. Customization

### เปลี่ยนสี (Pastel palette)
แก้ใน `:root` ของ `sairhas.html`:
```css
:root {
  --primary: #a8c0e8;      /* ฟ้าอ่อน */
  --accent: #f0c8a8;       /* ส้มอ่อน */
  --success: #a8d8b8;      /* เขียวอ่อน */
  --warning: #f0e0a8;      /* เหลืองอ่อน */
  --error: #f0a8a8;        /* แดงอ่อน */
}
```

### เปลี่ยนจำนวนน้องสูงสุดต่อพี่
- ใน `gas-backend.gs`: `MAX_PICKS_PER_SENIOR` (default 3)
- หรือตั้งใน `seniors.max_picks` column ต่อคน

### เพิ่มประเภทข้อความ
1. เพิ่มใน `validTypes` array (GAS)
2. เพิ่ม chip ใน HTML
3. เพิ่ม CSS `.type-xxx` class

---

## 12. Support

- **Issues**: GitHub Issues ของ repo
- **Logs**: Apps Script → Executions (ดู error logs)
- **Sheet**: เปิดตรวจสอบข้อมูลได้ทุกเมื่อ

---

*Generated for KMUTT APE/TME — สายรหัส 2026*