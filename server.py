import os
import re
import json
import csv
import glob
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import imageio_ffmpeg
from yt_dlp import YoutubeDL

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
CSV_FILE = os.path.join(BASE_DIR, "captions.csv")
METADATA_FILE = os.path.join(BASE_DIR, "metadata.json")
URLS_FILE = os.path.join(BASE_DIR, "urls.txt")

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

app = FastAPI(title="Clips Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve downloads directly for streaming video playback
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")

def load_metadata():
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_metadata(data):
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def sync_csv(data):
    fieldnames = ["caption_and_hashtags"]
    with open(CSV_FILE, "w", newline="", encoding="utf-8-sig") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for item in data.values():
            writer.writerow({
                "caption_and_hashtags": item.get("caption_and_hashtags", "")
            })

def detect_sport_category(text: str) -> str:
    text_lower = text.lower()
    # Check WNBA first
    if any(k in text_lower for k in [
        "wnba", "caitlin clark", "caitlin", "angel reese", "fever", 
        "sophie cunningham", "cunningham", "aces", "liberty", 
        "sheldon", "mabrey", "women's basketball"
    ]):
        return "WNBA"
    # NFL / American Football
    if any(k in text_lower for k in [
        "nfl", "touchdown", "quarterback", "superbowl", "chiefs", 
        "mahomes", "football", "patriots", "packers", "eagles", 
        "cowboys", "49ers", "interception"
    ]):
        return "NFL"
    # Soccer / MLS / Football
    if any(k in text_lower for k in [
        "soccer", "mls", "messi", "ronaldo", "inter miami", "premier league", 
        "champions league", "fifa", "laliga", "golazo", "hat-trick"
    ]):
        return "Soccer"
    # NBA / Men's Basketball
    if any(k in text_lower for k in [
        "nba", "lebron", "curry", "lakers", "celtics", "warriors", 
        "dunk", "basketball", "baller", "playmaker", "giannis", "doncic"
    ]):
        return "NBA"
    return "WNBA"  # Default fallback if sport is basketball-themed

def number_to_words(n: int) -> str:
    units = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
             "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", 
             "seventeen", "eighteen", "nineteen"]
    tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
    
    if 0 <= n < 20:
        return units[n]
    elif 20 <= n < 100:
        return tens[n // 10] + ("_" + units[n % 10] if n % 10 != 0 else "")
    elif 100 <= n < 1000:
        rem = n % 100
        return units[n // 100] + "_hundred" + (("_" + number_to_words(rem)) if rem != 0 else "")
    elif 1000 <= n < 1000000:
        rem = n % 1000
        return number_to_words(n // 1000) + "_thousand" + (("_" + number_to_words(rem)) if rem != 0 else "")
    return str(n)

def get_next_filename_base(output_dir: str) -> str:
    today_str = datetime.now().strftime("%Y%m%d")
    count = 1
    while os.path.exists(os.path.join(output_dir, f"{today_str}_{number_to_words(count)}.mp4")):
        count += 1
    return f"{today_str}_{number_to_words(count)}"

def init_existing_clips():
    metadata = load_metadata()
    video_files = glob.glob(os.path.join(DOWNLOADS_DIR, "*.mp4"))
    updated = False
    
    # Read existing captions.csv lines if available
    csv_captions = []
    if os.path.exists(CSV_FILE):
        try:
            with open(CSV_FILE, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    text = row.get("caption_and_hashtags", "").strip()
                    if text:
                        csv_captions.append(text)
        except Exception:
            pass

    for idx, fpath in enumerate(video_files):
        fname = os.path.basename(fpath)
        video_id = os.path.splitext(fname)[0]
        # Skip if already tracked by filename or video_id
        if any(item.get("video_filename") == fname or item.get("id") == video_id for item in metadata.values()):
            continue
        matched_text = csv_captions[idx] if idx < len(csv_captions) else ""
        hashtags = re.findall(r"#\w+", matched_text)
        clean_cap = re.sub(r"#\w+", "", matched_text).strip()
        
        metadata[video_id] = {
            "id": video_id,
            "url": f"https://www.instagram.com/reel/{video_id}/",
            "video_filename": fname,
            "video_url": f"/downloads/{fname}",
            "uploader": "",
            "category": detect_sport_category(matched_text),
            "caption": clean_cap or "Imported Instagram clip",
            "hashtags": hashtags,
            "hashtag_str": " ".join(hashtags),
            "caption_and_hashtags": matched_text,
            "file_size": os.path.getsize(fpath),
            "created_at": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
        }
        updated = True
                
    if updated:
        save_metadata(metadata)

init_existing_clips()

class DownloadRequest(BaseModel):
    url: str
    category: Optional[str] = None

class UpdateCaptionRequest(BaseModel):
    id: str
    caption: str
    hashtag_str: str
    category: Optional[str] = None

@app.get("/api/clips")
def get_clips():
    metadata = load_metadata()
    # Filter to only existing files
    clips = []
    for item in metadata.values():
        fpath = os.path.join(DOWNLOADS_DIR, item.get("video_filename", ""))
        if os.path.exists(fpath):
            item["file_size"] = os.path.getsize(fpath)
            clips.append(item)
    # Sort newest first
    clips.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return clips

@app.post("/api/download")
def download_clip(req: DownloadRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    filename_base = get_next_filename_base(DOWNLOADS_DIR)
    fname = f"{filename_base}.mp4"

    ydl_opts = {
        "outtmpl": os.path.join(DOWNLOADS_DIR, f"{filename_base}.%(ext)s"),
        "format": "bv*+ba/b",
        "merge_output_format": "mp4",
        "ffmpeg_location": ffmpeg_path,
        "continuedl": True,
        "nooverwrites": False,
        "quiet": True,
    }
    
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info.get("id", "")
            raw_caption = info.get("description") or ""
            uploader = info.get("uploader", "")
            
            hashtags = re.findall(r"#\w+", raw_caption)
            hashtag_str = " ".join(hashtags)
            clean_caption = re.sub(r"#\w+", "", raw_caption).strip()
            
            if clean_caption and hashtag_str:
                caption_and_hashtags = f"{clean_caption}\n\n{hashtag_str}"
            elif clean_caption:
                caption_and_hashtags = clean_caption
            else:
                caption_and_hashtags = hashtag_str

            video_file = os.path.join(DOWNLOADS_DIR, fname)
            
            # Detect or apply sport category
            sport_category = req.category or detect_sport_category(f"{clean_caption} {hashtag_str}")

            metadata = load_metadata()
            clip_data = {
                "id": video_id,
                "url": url,
                "video_filename": fname,
                "video_url": f"/downloads/{fname}",
                "uploader": uploader,
                "category": sport_category,
                "caption": clean_caption,
                "hashtags": hashtags,
                "hashtag_str": hashtag_str,
                "caption_and_hashtags": caption_and_hashtags,
                "file_size": os.path.getsize(video_file) if os.path.exists(video_file) else 0,
                "created_at": datetime.now().isoformat(),
            }
            metadata[video_id] = clip_data
            save_metadata(metadata)
            sync_csv(metadata)
            
            # Also append to urls.txt if not already there
            if os.path.exists(URLS_FILE):
                with open(URLS_FILE, "r", encoding="utf-8") as f:
                    existing_urls = [line.strip() for line in f if line.strip()]
                if url not in existing_urls:
                    with open(URLS_FILE, "a", encoding="utf-8") as f:
                        f.write(f"\n{url}")
                        
            return clip_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update-caption")
def update_caption(req: UpdateCaptionRequest):
    metadata = load_metadata()
    if req.id not in metadata:
        raise HTTPException(status_code=404, detail="Clip not found")
        
    clean_caption = req.caption.strip()
    hashtag_str = req.hashtag_str.strip()
    hashtags = re.findall(r"#\w+", hashtag_str)
    
    if clean_caption and hashtag_str:
        caption_and_hashtags = f"{clean_caption}\n\n{hashtag_str}"
    elif clean_caption:
        caption_and_hashtags = clean_caption
    else:
        caption_and_hashtags = hashtag_str
        
    metadata[req.id]["caption"] = clean_caption
    metadata[req.id]["hashtag_str"] = hashtag_str
    metadata[req.id]["hashtags"] = hashtags
    metadata[req.id]["caption_and_hashtags"] = caption_and_hashtags
    if req.category:
        metadata[req.id]["category"] = req.category
    
    save_metadata(metadata)
    sync_csv(metadata)
    return metadata[req.id]

@app.delete("/api/clips/{video_id}")
def delete_clip(video_id: str):
    metadata = load_metadata()
    if video_id in metadata:
        fpath = os.path.join(DOWNLOADS_DIR, metadata[video_id].get("video_filename", ""))
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
            except Exception:
                pass
        del metadata[video_id]
        save_metadata(metadata)
        sync_csv(metadata)
        return {"status": "deleted", "id": video_id}
    raise HTTPException(status_code=404, detail="Clip not found")

# Serve built frontend if dist exists
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        target_path = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.exists(target_path) and os.path.isfile(target_path):
            return FileResponse(target_path)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Page not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)

