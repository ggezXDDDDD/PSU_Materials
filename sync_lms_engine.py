#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSU Materials Portal - LMS Auto Sync Engine
Fetches assignments and quizzes from lms.psu.ac.th via active Safari session.
Updates tasks_live.json and index.html with real-time deadlines and submission statuses.
Includes local HTTP server mode for one-click sync directly from the web browser.
"""

import os
import sys
import re
import json
import time
import threading
import subprocess
from html import unescape
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

PORTAL_DIR = "/Users/kongpop/Desktop/PSU_Materials"
INDEX_HTML = os.path.join(PORTAL_DIR, "index.html")
TASKS_JSON = os.path.join(PORTAL_DIR, "tasks_live.json")
LOG_FILE = os.path.join(PORTAL_DIR, "sync.log")
SERVER_PORT = 25690

# Registered Courses
COURSES = [
    {"id": "1553", "code": "316-221", "name": "โลหะวิทยา 1 (Metallurgy)", "tag": "metal", "icon": "⚙️", "page": "metallurgy.html"},
    {"id": "1552", "code": "315-201", "name": "เซรามิกเบื้องต้น (Ceramics)", "tag": "ceram", "icon": "🏺", "page": "ceramic.html"},
    {"id": "4312", "code": "342-201", "name": "พอลิเมอร์เบื้องต้น (Polymer)", "tag": "poly", "icon": "🧪", "page": "polymer.html"},
    {"id": "1513", "code": "200-103", "name": "GreenLove (ชีวิตพอเพียงและสิ่งแวดล้อม)", "tag": "greenlove", "icon": "🌿", "page": "greenlove.html"},
    {"id": "10228", "code": "315-201G7", "name": "Life in the Future (Biotechnology)", "tag": "bio", "icon": "🔬", "page": "biology.html"},
    {"id": "12285", "code": "B03-001", "name": "Cybersecurity (ความมั่นคงไซเบอร์)", "tag": "cyber", "icon": "🛡️", "page": "cybersecurity.html"},
    {"id": "572", "code": "820-100", "name": "Save Earth Save Us", "tag": "other", "icon": "📚", "page": "other_courses.html"},
    {"id": "10210", "code": "950-102", "name": "ชีวิตที่ดี (Good Life)", "tag": "other", "icon": "📚", "page": "other_courses.html"},
    {"id": "11943", "code": "388-100", "name": "Health for All", "tag": "other", "icon": "📚", "page": "other_courses.html"},
    {"id": "6134", "code": "ENG-SELF", "name": "English Self-Learning", "tag": "other", "icon": "📚", "page": "other_courses.html"}
]

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{ts}] {msg}"
    print(formatted)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(formatted + "\n")
    except Exception:
        pass

def send_macos_notification(title, message):
    try:
        clean_title = title.replace('"', '\\"')
        clean_msg = message.replace('"', '\\"')
        script = f'display notification "{clean_msg}" with title "{clean_title}" sound name "Glass"'
        subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    except Exception as e:
        log(f"Notification error: {e}")

def check_safari_running():
    res = subprocess.run(["pgrep", "-x", "Safari"], capture_output=True, text=True)
    return bool(res.stdout.strip())

def fetch_safari_html(url, wait_sec=2.6):
    ascript = f'''
    tell application "Safari"
        set origWindow to window 1
        set newTab to make new tab at end of tabs of origWindow with properties {{URL:"{url}"}}
        delay {wait_sec}
        set pageSource to source of newTab
        close newTab
        return pageSource
    end tell
    '''
    res = subprocess.run(["osascript", "-e", ascript], capture_output=True, text=True)
    if res.returncode == 0:
        return res.stdout
    return ""

def reload_safari_portal():
    ascript = '''
    tell application "Safari"
        repeat with w in windows
            repeat with t in tabs of w
                if (URL of t as string) contains "PSU_Materials/index.html" then
                    set URL of t to (URL of t as string)
                    return "reloaded"
                end if
            end repeat
        end repeat
    end tell
    '''
    subprocess.run(["osascript", "-e", ascript], capture_output=True, text=True)

def map_course(cid, raw_name=""):
    for c in COURSES:
        if str(c["id"]) == str(cid):
            return c
        if c["code"].lower() in raw_name.lower():
            return c
    raw_lower = raw_name.lower()
    if "poly" in raw_lower or "พอลิเมอร์" in raw_lower:
        return COURSES[2]
    if "ceram" in raw_lower or "เซรามิก" in raw_lower:
        return COURSES[1]
    if "metal" in raw_lower or "โลหะ" in raw_lower:
        return COURSES[0]
    if "green" in raw_lower:
        return COURSES[3]
    if "cyber" in raw_lower or "ไซเบอร์" in raw_lower:
        return COURSES[5]
    if "bio" in raw_lower or "ชีว" in raw_lower:
        return COURSES[4]
    
    return {
        "id": cid or "other",
        "code": "GEN",
        "name": raw_name or "รายวิชาทั่วไป",
        "tag": "other",
        "icon": "📚",
        "page": "other_courses.html"
    }

def parse_upcoming_calendar(html):
    tasks = []
    if not html:
        return tasks

    blocks = html.split('<div data-type="event"')
    for b in blocks[1:]:
        tag_end = b.find('>')
        tag_attrs = b[:tag_end]
        content = b[tag_end+1:]

        title_m = re.search(r'data-event-title="([^"]+)"', tag_attrs)
        cid_m = re.search(r'data-course-id="([^"]+)"', tag_attrs)
        comp_m = re.search(r'data-event-component="([^"]+)"', tag_attrs)
        type_m = re.search(r'data-event-eventtype="([^"]+)"', tag_attrs)
        event_id_m = re.search(r'data-event-id="([^"]+)"', tag_attrs)

        title = unescape(title_m.group(1)) if title_m else ""
        cid = cid_m.group(1) if cid_m else ""
        comp = comp_m.group(1) if comp_m else "mod_assign"
        event_id = event_id_m.group(1) if event_id_m else ""

        time_m = re.search(r'title="When"[^>]*></i>\s*</div>\s*<div[^>]*>(.*?)</div>', content, re.DOTALL)
        time_str = re.sub(r'<[^>]+>', '', time_m.group(1)).strip() if time_m else ""

        course_m = re.search(r'title="Course"[^>]*></i>\s*</div>\s*<div[^>]*><a[^>]*>([^<]+)</a>', content)
        raw_course_name = course_m.group(1).strip() if course_m else ""

        desc_m = re.search(r'class="description-content[^"]*">\s*(.*?)\s*</div>', content, re.DOTALL)
        desc_str = re.sub(r'<[^>]+>', ' ', desc_m.group(1)).strip() if desc_m else ""

        url_m = re.search(r'href="(https://lms\.psu\.ac\.th/mod/[^"]+)"', content)
        action_url = url_m.group(1) if url_m else ""
        action_url = action_url.replace('&amp;', '&')

        cinfo = map_course(cid, raw_course_name)

        is_quiz = "quiz" in comp or "quiz" in action_url or "สอบ" in title.lower() or "quiz" in title.lower()
        is_urgent = any(kw in time_str.lower() for kw in ["today", "tomorrow", "วันนี้", "พรุ่งนี้", "monday, 14", "tuesday, 15", "wednesday, 16"])

        clean_title = re.sub(r'\s+is due$', '', title, flags=re.IGNORECASE)

        task = {
            "id": f"lms_ev_{event_id}" if event_id else f"lms_{cid}_{abs(hash(title))%1000000}",
            "title": clean_title,
            "course_id": cid,
            "course_code": cinfo["code"],
            "course_name": cinfo["name"],
            "course_tag": cinfo["tag"],
            "course_icon": cinfo["icon"],
            "course_page": cinfo["page"],
            "due_date": time_str,
            "description": desc_str,
            "url": action_url,
            "is_quiz": is_quiz,
            "is_urgent": is_urgent,
            "status": "quiz" if is_quiz else "pending",
            "status_text": "ควิซเปิดสอบ" if is_quiz else "ยังไม่ส่ง",
            "points": "มีคะแนนเก็บ",
            "type_label": "ควิซ / Quiz" if is_quiz else "การบ้าน / Assignment"
        }
        tasks.append(task)

    return tasks

def parse_course_assign_table(cid, course_name, html):
    tasks = []
    if not html:
        return tasks
    
    cinfo = map_course(cid, course_name)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
    for r in rows:
        link_m = re.search(r'<a[^>]*href="([^"]*mod/assign/view\.php\?id=(\d+))"[^>]*>(.*?)</a>', r)
        if not link_m:
            continue
        
        assign_url = link_m.group(1).replace('&amp;', '&')
        assign_id = link_m.group(2)
        assign_title = unescape(re.sub(r'<[^>]+>', '', link_m.group(3)).strip())

        cols = re.findall(r'<td[^>]*>(.*?)</td>', r, re.DOTALL)
        due_str = ""
        status_str = "ยังไม่ส่ง"
        status_code = "pending"

        for col in cols:
            clean_col = re.sub(r'<[^>]+>', '', col).strip()
            if any(m in clean_col.lower() for m in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]):
                due_str = clean_col
            if "submitted for grading" in clean_col.lower() or "ส่งแล้ว" in clean_col:
                status_str = "ส่งแล้ว (Submitted)"
                status_code = "submitted"
            elif "graded" in clean_col.lower() or "ให้คะแนนแล้ว" in clean_col:
                status_str = "ตรวจแล้ว (Graded)"
                status_code = "graded"

        task = {
            "id": f"assign_{assign_id}",
            "title": assign_title,
            "course_id": cid,
            "course_code": cinfo["code"],
            "course_name": cinfo["name"],
            "course_tag": cinfo["tag"],
            "course_icon": cinfo["icon"],
            "course_page": cinfo["page"],
            "due_date": due_str or "ตามที่ผู้สอนกำหนด",
            "description": f"งานมอบหมายในระบบ LMS ({cinfo['name']})",
            "url": assign_url,
            "is_quiz": False,
            "is_urgent": "october 2026" in due_str.lower() or "กันยายน" in due_str or "ตุลาคม" in due_str,
            "status": status_code,
            "status_text": status_str,
            "points": "มีคะแนนเก็บ",
            "type_label": "การบ้าน / Assignment"
        }
        tasks.append(task)
    return tasks

def render_assignment_card(task):
    tag = task.get("course_tag", "other")
    icon = task.get("course_icon", "📚")
    code = task.get("course_code", "")
    name = task.get("course_name", "")
    title = task.get("title", "ชื่องาน")
    due = task.get("due_date", "ไม่ระบุวันส่ง")
    desc = task.get("description", "")
    url = task.get("url", "https://lms.psu.ac.th")
    page = task.get("course_page", "index.html")
    status = task.get("status", "pending")
    is_urgent = task.get("is_urgent", False)
    points = task.get("points", "")

    border_color = "#ef4444" if (is_urgent and status in ["pending", "quiz"]) else "#3b82f6"
    if status == "submitted":
        border_color = "#10b981"
    elif status == "graded":
        border_color = "#8b5cf6"

    if status == "submitted":
        status_html = '<span class="status-pill status-submitted">✅ ส่งแล้ว</span>'
    elif status == "graded":
        status_html = '<span class="status-pill status-graded">📊 มีคะแนนแล้ว</span>'
    elif status == "quiz":
        status_html = '<span class="status-pill status-pending" style="background:rgba(245, 158, 11, 0.15); color:#d97706; border:1px solid rgba(245, 158, 11, 0.3);">🎯 ควิซเปิดอยู่</span>'
    elif is_urgent:
        status_html = '<span class="status-pill status-pending">🔥 ต้องทำด่วน</span>'
    else:
        status_html = '<span class="status-pill status-pending">ยังไม่ส่ง</span>'

    points_html = f'<span class="status-pill" style="background:rgba(239, 68, 68, 0.12); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3); font-weight:800;">{points}</span>' if points else ''
    search_terms = f"{code} {name} {title} {due} {desc}".lower()

    card_html = f'''
        <div class="assignment-card" 
             data-course="{tag}" 
             data-status="{status}" 
             data-search="{search_terms}"
             style="border-left: 5px solid {border_color};">
          <div class="assign-top-row">
            <span class="assign-course-tag tag-{tag}">{icon} {code} {name}</span>
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              {points_html}
              {status_html}
            </div>
          </div>
          <div class="assign-title">{title}</div>
          {f'<div class="assign-prompt-box"><strong>รายละเอียด:</strong> {desc}</div>' if desc else ''}
          <div class="assign-meta-grid">
            <div class="assign-meta-item"><span><strong>กำหนดส่ง:</strong> {due}</span></div>
            <div class="assign-meta-item"><span><strong>สถานะ:</strong> {task.get("status_text", "ยังไม่ส่ง")}</span></div>
            <div class="assign-meta-item"><span><strong>ประเภท:</strong> {task.get("type_label", "งานมอบหมาย")}</span></div>
          </div>
          <div class="assign-actions-row">
            <a href="{page}" class="btn-page-link">ดูหน้าวิชา</a>
            <a href="{url}" target="_blank" class="btn-lms-link" style="background:{border_color};">เปิดใน LMS</a>
            <button class="tool-btn" onclick="navigator.clipboard.writeText('{url}'); alert('คัดลอกลิงก์ LMS เรียบร้อย!');">คัดลอกลิงก์</button>
          </div>
        </div>
    '''
    return card_html.strip()

def update_index_html(tasks):
    if not os.path.exists(INDEX_HTML):
        log(f"Error: {INDEX_HTML} not found!")
        return False

    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        html = f.read()

    def sort_key(t):
        is_urg = 0 if t.get("is_urgent", False) else 1
        stat_order = {"pending": 0, "quiz": 1, "submitted": 2, "graded": 3}.get(t.get("status"), 4)
        return (is_urg, stat_order)

    sorted_tasks = sorted(tasks, key=sort_key)
    cards_html = "\n\n".join([render_assignment_card(t) for t in sorted_tasks])

    total_count = len(sorted_tasks)
    pending_count = sum(1 for t in sorted_tasks if t.get("status") in ["pending", "quiz"])
    quiz_count = sum(1 for t in sorted_tasks if t.get("is_quiz", False) or t.get("status") == "quiz")
    submitted_count = sum(1 for t in sorted_tasks if t.get("status") == "submitted")
    graded_count = sum(1 for t in sorted_tasks if t.get("status") == "graded")

    # 1. Replace #home-assign-list content
    idx = html.find('id="home-assign-list"')
    if idx != -1:
        tag_end = html.find('>', idx) + 1
        close_section = html.find('</section>', tag_end)
        if close_section != -1:
            html = html[:tag_end] + f"\n{cards_html}\n      </div>\n    " + html[close_section:]

    # 2. Update Header Badge numbers
    html = re.sub(
        r'🔥\s*ต้องทำ\s*/\s*ยังไม่ส่ง:\s*\d+\s*งาน',
        f'🔥 ต้องทำ / ยังไม่ส่ง: {pending_count} งาน',
        html
    )
    html = re.sub(
        r'รวม\s*\d+\s*รายการในระบบ',
        f'รวม {total_count} รายการในระบบ',
        html
    )
    html = re.sub(
        r'รวบรวมงานที่ต้องส่ง.*?\(ทั้งหมด\s*\d+\s*รายการ\)',
        f'รวบรวมงานที่ต้องส่ง ควิซเก็บคะแนน รายงาน และการสอบ ครบทุกวิชา (ทั้งหมด {total_count} รายการ)',
        html
    )

    # 3. Update Course Filter Counts on #course-filter-bar
    poly_c = sum(1 for t in sorted_tasks if t.get("course_tag") == "poly")
    ceram_c = sum(1 for t in sorted_tasks if t.get("course_tag") in ["ceram", "ceramic"])
    metal_c = sum(1 for t in sorted_tasks if t.get("course_tag") == "metal")
    bio_c = sum(1 for t in sorted_tasks if t.get("course_tag") == "bio")
    green_c = sum(1 for t in sorted_tasks if t.get("course_tag") == "greenlove")
    cyber_c = sum(1 for t in sorted_tasks if t.get("course_tag") == "cyber")
    biolab_c = sum(1 for t in sorted_tasks if t.get("course_tag") == "biolab")
    other_c = sum(1 for t in sorted_tasks if t.get("course_tag") in ["other", "goodlife", "thinking"])

    html = re.sub(r'🌟\s*ทั้งหมดทุกวิชา\s*\(\d+\)', f'🌟 ทั้งหมดทุกวิชา ({total_count})', html)
    html = re.sub(r'🧪\s*พอลิเมอร์\s*\(\d+\)', f'🧪 พอลิเมอร์ ({poly_c})', html)
    html = re.sub(r'🏺\s*เซรามิก\s*\(\d+\)', f'🏺 เซรามิก ({ceram_c})', html)
    html = re.sub(r'⚙️\s*โลหะวิทยา\s*\(\d+\)', f'⚙️ โลหะวิทยา ({metal_c})', html)
    html = re.sub(r'🧬\s*ชีววิทยา\s*\(\d+\)', f'🧬 ชีววิทยา ({bio_c})', html)
    html = re.sub(r'🌱\s*GreenLove\s*\(\d+\)', f'🌱 GreenLove ({green_c})', html)
    html = re.sub(r'💻\s*Cybersecurity\s*\(\d+\)', f'💻 Cybersecurity ({cyber_c})', html)
    html = re.sub(r'🔬\s*Lab ชีวะ\s*\(\d+\)', f'🔬 Lab ชีวะ ({biolab_c})', html)
    html = re.sub(r'🧠\s*วิชาอื่นๆ\s*\(\d+\)', f'🧠 วิชาอื่นๆ ({other_c})', html)

    # 4. Update Status Filter Counts
    html = re.sub(r'ทั้งหมด\s*\(\d+\)', f'ทั้งหมด ({total_count})', html)
    html = re.sub(r'ต้องทำด่วน\s*/\s*ยังไม่ส่ง\s*\(\d+\)', f'ต้องทำด่วน / ยังไม่ส่ง ({pending_count})', html)
    html = re.sub(r'ควิซทั้งหมด\s*\(\d+\)', f'ควิซทั้งหมด ({quiz_count})', html)
    html = re.sub(r'ส่งแล้ว\s*\(\d+\)', f'ส่งแล้ว ({submitted_count})', html)
    html = re.sub(r'มีคะแนนแล้ว\s*\(\d+\)', f'มีคะแนนแล้ว ({graded_count})', html)

    html = html.replace("setCourseFilter('ceramic', this)", "setCourseFilter('ceram,ceramic', this)")

    with open(INDEX_HTML, "w", encoding="utf-8") as f:
        f.write(html)

    log(f"✓ Updated index.html successfully with {total_count} tasks (Pending: {pending_count})")
    return True

def run_sync(is_background=False):
    log("==================================================")
    log("🚀 Starting PSU LMS Sync Engine...")
    log("==================================================")

    if not check_safari_running():
        msg = "⚠️ Safari ไม่ได้เปิดอยู่ กรุณาเปิด Safari และล็อกอิน LMS ทิ้งไว้ครับ"
        log(msg)
        if not is_background:
            print(f"\n{msg}\n")
        return False

    old_task_ids = set()
    existing_tasks = []
    if os.path.exists(TASKS_JSON):
        try:
            with open(TASKS_JSON, "r", encoding="utf-8") as f:
                existing_tasks = json.load(f)
                old_task_ids = {t["id"] for t in existing_tasks}
        except Exception:
            pass

    all_tasks = []
    seen_ids = set()

    # 1. Fetch Upcoming Calendar
    log("1/4 Fetching Upcoming Calendar from LMS...")
    cal_html = fetch_safari_html("https://lms.psu.ac.th/calendar/view.php?view=upcoming", wait_sec=2.8)
    upcoming_tasks = parse_upcoming_calendar(cal_html)
    log(f"  ✓ Found {len(upcoming_tasks)} upcoming deadlines in calendar")
    for t in upcoming_tasks:
        if t["id"] not in seen_ids:
            all_tasks.append(t)
            seen_ids.add(t["id"])

    # 2. Fetch Core Material Engineering Courses
    core_urls = [
        ("4312", "พอลิเมอร์ 342-201", "https://lms.psu.ac.th/mod/assign/index.php?id=4312"),
        ("1552", "เซรามิก 315-201", "https://lms.psu.ac.th/mod/assign/index.php?id=1552"),
        ("1553", "โลหะวิทยา 316-221", "https://lms.psu.ac.th/mod/assign/index.php?id=1553")
    ]

    log("2/4 Fetching assignments for core courses (Polymer, Ceramic, Metallurgy)...")
    for cid, cname, url in core_urls:
        html = fetch_safari_html(url, wait_sec=2.2)
        course_tasks = parse_course_assign_table(cid, cname, html)
        log(f"  ✓ Found {len(course_tasks)} items in {cname}")
        for t in course_tasks:
            dedup_key = f"{cid}_{t['title']}"
            if t["id"] not in seen_ids and dedup_key not in seen_ids:
                all_tasks.append(t)
                seen_ids.add(t["id"])
                seen_ids.add(dedup_key)

    # 3. Check for New Tasks
    new_tasks = [t for t in all_tasks if t["id"] not in old_task_ids]
    log(f"3/4 Total synced tasks: {len(all_tasks)} (New tasks: {len(new_tasks)})")

    # 4. Save to JSON cache
    with open(TASKS_JSON, "w", encoding="utf-8") as f:
        json.dump(all_tasks, f, ensure_ascii=False, indent=2)

    # 5. Update index.html
    update_index_html(all_tasks)

    # 6. Notifications & Reload
    if new_tasks and old_task_ids:
        first_title = new_tasks[0]['title']
        notif_body = f"พบงานใหม่: {first_title}" if len(new_tasks) == 1 else f"พบงานใหม่ {len(new_tasks)} รายการในระบบ!"
        send_macos_notification("PSU LMS: มีงานใหม่เข้ามา! 📋", notif_body)
    elif is_background:
        pass

    if not is_background:
        reload_safari_portal()
        print("\n==================================================")
        print("  🎉 อัปเดตข้อมูลจาก PSU LMS สำเร็จเรียบร้อย!")
        print(f"  📋 งานทั้งหมดในระบบ: {len(all_tasks)} รายการ")
        print(f"  🔥 งานที่ต้องทำด่วน/ยังไม่ส่ง: {sum(1 for t in all_tasks if t.get('status') in ['pending', 'quiz'])} รายการ")
        if new_tasks and old_task_ids:
            print(f"  ✨ งานที่เพิ่มเข้ามาใหม่: {len(new_tasks)} รายการ")
        print("  🌐 รีเฟรชหน้าเว็บใน Safari ให้เรียบร้อยแล้วครับ")
        print("==================================================\n")

    return True

# -------------------------------------------------------------
# Tiny Background HTTP Server for Web-Triggered Sync
# -------------------------------------------------------------
class SyncHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/sync":
            log("🌐 Web UI triggered instant sync via http://127.0.0.1:25690/sync")
            success = run_sync(is_background=True)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            res = {"status": "ok" if success else "safari_offline"}
            self.wfile.write(json.dumps(res).encode("utf-8"))
        elif self.path == "/ping":
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"alive"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def log_message(self, format, *args):
        pass

def start_server_daemon():
    log(f"Starting LMS Sync Background Server on http://127.0.0.1:{SERVER_PORT}...")
    server = HTTPServer(("127.0.0.1", SERVER_PORT), SyncHandler)
    
    # Background periodic auto-sync thread
    def periodic_worker():
        while True:
            time.sleep(21600)  # Every 6 hours
            log("Running periodic 6-hour scheduled sync...")
            run_sync(is_background=True)
            
    t = threading.Thread(target=periodic_worker, daemon=True)
    t.start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Server stopped.")

if __name__ == "__main__":
    if "--serve" in sys.argv:
        start_server_daemon()
    else:
        is_bg = "--background" in sys.argv
        run_sync(is_background=is_bg)
