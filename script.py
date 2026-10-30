import csv
import os
import re
import glob
from datetime import datetime
import imageio_ffmpeg
from yt_dlp import YoutubeDL

# ============================================================
# CONFIG
# ============================================================

INPUT_FILE = "urls.txt"
OUTPUT_DIR = "downloads"
CSV_FILE = "captions.csv"

# Get FFmpeg bundled with imageio-ffmpeg
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

print("FFmpeg:", ffmpeg_path)

# Create download directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

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


# ============================================================
# READ URLS
# ============================================================

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    urls = [
        line.strip()
        for line in f
        if line.strip()
    ]

print(f"Found {len(urls)} URLs")


# ============================================================
# YT-DLP BASE OPTIONS
# ============================================================

base_opts = {
    # Best video + audio
    "format": "bv*+ba/b",

    # Merge video + audio into MP4
    "merge_output_format": "mp4",

    # Tell yt-dlp where FFmpeg is
    "ffmpeg_location": ffmpeg_path,

    # Continue partial downloads
    "continuedl": True,

    # Don't overwrite existing files
    "nooverwrites": True,

    "quiet": False,
}


# ============================================================
# CSV
# ============================================================

fieldnames = [
    "caption_and_hashtags",
]


# ============================================================
# DOWNLOAD
# ============================================================

with open(
    CSV_FILE,
    "w",
    newline="",
    encoding="utf-8-sig"
) as csvfile:

    writer = csv.DictWriter(
        csvfile,
        fieldnames=fieldnames
    )

    writer.writeheader()

    for index, url in enumerate(urls, start=1):

        print("\n" + "=" * 70)
        print(f"[{index}/{len(urls)}] Processing")
        print(url)
        print("=" * 70)

        try:
            # Generate target filename: <YYYYMMDD>_<count-in-words>
            filename_base = get_next_filename_base(OUTPUT_DIR)
            ydl_opts = dict(base_opts)
            ydl_opts["outtmpl"] = os.path.join(OUTPUT_DIR, f"{filename_base}.%(ext)s")

            with YoutubeDL(ydl_opts) as ydl:
                # Download + extract metadata
                info = ydl.extract_info(
                    url,
                    download=True
                )

                video_id = info.get("id", "")
                raw_caption = info.get("description") or ""

                # Extract hashtags and clean caption
                hashtags = re.findall(r"#\w+", raw_caption)
                hashtag_str = " ".join(hashtags)
                clean_caption = re.sub(r"#\w+", "", raw_caption).strip()

                # Combined ready-to-copy text with caption and hashtags together
                if clean_caption and hashtag_str:
                    caption_and_hashtags = f"{clean_caption}\n\n{hashtag_str}"
                elif clean_caption:
                    caption_and_hashtags = clean_caption
                else:
                    caption_and_hashtags = hashtag_str

                # Expected merged MP4 filename
                video_file = os.path.join(OUTPUT_DIR, f"{filename_base}.mp4")

                # Write to CSV (only column 1)
                writer.writerow({
                    "caption_and_hashtags": caption_and_hashtags,
                })

                csvfile.flush()

                print("\n✅ SUCCESS")
                print("Video   :", video_file)
                print("Caption :", clean_caption)
                print("Hashtags:", hashtag_str)

            except Exception as e:

                error_message = str(e)

                print("\n❌ FAILED")
                print(error_message)

                writer.writerow({
                    "caption_and_hashtags": "",
                })

                csvfile.flush()


# ============================================================
# DONE
# ============================================================

print("\n" + "=" * 70)
print("DONE")
print("=" * 70)
print("Videos:", OUTPUT_DIR)
print("CSV   :", CSV_FILE)
