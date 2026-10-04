# MagicSync Free Tools

MagicSync includes a collection of free tools for creating and editing content. These tools are available at `/app/tools` or `/tools` and can be used without a paid plan.

---

## Image Editor

![Image Editor](/img/guide/tool-image-editor.png)

The Image Editor lets you edit images directly in your browser. You can crop, draw, add text, apply templates, and adjust colors.

**Use it for:**
- Cropping photos for social media
- Adding text overlays
- Applying templates
- Adjusting colors and filters

**Example:** Create a promotional image for a sale by uploading a product photo, adding a headline, and exporting it in the right dimensions.

**Try it here:** `/tools/image-editor`

---

## Flutter Clipper

![Flutter Clipper](/img/guide/tool-flutter-clipper.png)

The Flutter Clipper generates code for clipping images into custom shapes in Flutter apps. It is useful for mobile developers who want non-rectangular image layouts.

**Use it for:**
- Creating custom image shapes
- Generating Flutter clip code
- Prototyping UI components

**Example:** Generate a star-shaped clip path for a profile picture in a Flutter app.

**Try it here:** `/tools/flutter-clipper`

---

## Video Silence Remover

![Video Silence Remover](/img/guide/tool-video-silence-remover.png)

The Video Silence Remover automatically detects and removes silent sections from videos. This helps produce tighter, more engaging video content.

**Use it for:**
- Removing dead air from recordings
- Speeding up video editing
- Preparing content for YouTube or TikTok

**Example:** Upload a screen recording with long pauses and download a version with the silence removed.

**Try it here:** `/tools/video-silence-remover`

---

## Text Behind Image

![Text Behind Image](/img/guide/tool-text-behind-image.png)

Text Behind Image places text behind foreground objects in a photo, creating a layered visual effect.

**Use it for:**
- Posters and cover images
- Social media graphics
- Creative typography

**Example:** Place the word "ADVENTURE" behind a mountain range so the text appears integrated into the scene.

**Try it here:** `/tools/text-behind-image-free`

---

## Audio Transcription

![Audio Transcription](/img/guide/tool-audio-transcription.png)

Audio Transcription converts speech from audio or video files into text. It supports multiple languages and includes timestamps.

**Use it for:**
- Transcribing interviews
- Creating captions
- Converting podcasts into articles

**Example:** Upload a recorded meeting and receive a full transcript with timestamps.

**Try it here:** `/tools/audio-transcription`

---

## Audio Player

![Audio Player](/img/guide/tool-audio-player.png)

The Audio Player plays audio files in the browser and displays a waveform visualization. It supports direct file uploads and Bunny CDN links.

**Use it for:**
- Playing audio clips
- Visualizing waveforms
- Embedding audio on a website

**Example:** Upload a podcast episode and share the player with your audience.

**Try it here:** `/tools/audio-player`

---

## Podcast Player

![Podcast Player](/img/guide/tool-podcast.png)

The Podcast Player lets you discover and listen to podcasts. It includes a global player, search, and favorites.

**Use it for:**
- Discovering new podcasts
- Listening while browsing
- Saving favorite episodes

**Example:** Search for "machine learning" and listen to episodes directly in the app.

**Try it here:** `/tools/podcast`

---

## Carousel Creator

![Carousel Creator](/img/guide/tool-carousel-creator.png)

The Carousel Creator designs multi-slide Instagram carousels with templates and one-click export.

**Try it here:** `/tools/carousel-creator`

---

## Menu Board

![Menu Board](/img/guide/tool-menu-board.png)

The Menu Board builds display menu boards for restaurant screens with a shareable public link.

**Try it here:** `/tools/menu-board`

---

## OG Image Generator

![OG Image Generator](/img/guide/tool-og-image-generator.png)

The OG Image Generator creates Open Graph preview images for links shared on social platforms.

**Try it here:** `/tools/og-image-generator`

---

## Video Cropper

![Video Cropper](/img/video-cropper.png)

The Video Cropper is a browser-based video editor. It supports cropping, subtitles, multi-camera switching, audio mixing, and keyframe animations.

**Bring your own source** — three ways in:
- **Browse** a local MP4/WebM/MOV file
- **Load** a direct `.mp4` link, which the browser plays as-is
- **Download** a video page URL (YouTube, Vimeo, …) — the server resolves it
  with yt-dlp and streams the bytes straight to your browser. The video is never
  written to the asset library or the database, so your browser holds the only
  copy. Download can take up to a minute and is capped at 200MB. Videos are
  fetched as H.264 + AAC so every browser can decode them; a source that only
  publishes AV1 (some Facebook reels) is re-encoded server-side, which adds
  another minute or so before the download starts streaming.

**Use it for:**
- Cropping videos for different platforms
- Adding subtitles
- Mixing audio tracks
- Creating vertical videos for TikTok or Reels

**Example:** Download a YouTube video, crop it to 9:16 for TikTok, add subtitles, and export.

**Try it here:** `/app/tools/video-cropper`

---

## Text to Speech

![Text to Speech](/img/text-to-speech.png)

Text to Speech converts written text into spoken audio. It supports multiple languages and voices, runs in the browser, and allows downloads.

**Use it for:**
- Creating voiceovers
- Generating audio content
- Accessibility

**Example:** Type a script, select a voice and language, and generate an audio file for a video.

**Try it here:** `/app/tools/text-to-speech`

---

## Tool Directory

![Tool Directory](/img/guide/tools-index.png)

| Tool | Description | Path |
|------|-------------|------|
| Image Editor | Edit images, add text, apply templates | `/tools/image-editor` |
| Flutter Clipper | Generate Flutter clip-path code | `/tools/flutter-clipper` |
| Video Silence Remover | Remove silent sections from videos | `/tools/video-silence-remover` |
| Text Behind Image | Place text behind objects in images | `/tools/text-behind-image-free` |
| Audio Transcription | Convert speech to text | `/tools/audio-transcription` |
| Audio Player | Play audio with waveform visualization | `/tools/audio-player` |
| Podcast Player | Discover and listen to podcasts | `/tools/podcast` |
| Carousel Creator | Design multi-slide Instagram carousels | `/tools/carousel-creator` |
| Menu Board | Build display menu boards | `/tools/menu-board` |
| OG Image Generator | Generate Open Graph preview images | `/tools/og-image-generator` |
| Video Cropper | Crop, subtitle, and edit videos | `/app/tools/video-cropper` |
| Text to Speech | Convert text to spoken audio | `/app/tools/text-to-speech` |

---

## Getting Started

All tools are available from the tools page:

```
/app/tools
```

Or visit the public tools page:

```
/tools
```

No installation or paid plan is required to use the free tools.
