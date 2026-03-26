

## Plan: Regenerate Voiceover with Original Script and Correct Timing

### What needs to happen

7 specific requirements from your prompt:

1. **Voiceover script** — the exact text you provided, optimised for the video length (~177s)
2. **Pause** after "...interplay of texture, light, and artisanal craftsmanship."
3. **Anniversary line** — "Next June, Maison Affluency will be celebrating its 10 years anniversary..."
4. **Second pause** after the anniversary line
5. **Closing line** — "Synonymous with exceptional craftsmanship, Maison Affluency is ready to embrace the upcoming decade in style!"
6. **Outro slide text** — already correct: "Maison Affluency at One Grange Garden Singapore" (verified in OutroCard component, line 231)
7. **Voiceover ends before the last slide** — silence during the outro for dramatic effect

### Technical Steps

**Step 1 — Generate voiceover with Microsoft Edge TTS (SoniaNeural, -5% speed)**

Use `edge-tts` with SSML to insert `<break time="2500ms"/>` pauses at the two specified points. The full SSML script:

```
Welcome to Maison Affluency Singapore, an immersive environment where couture furniture and collectible design of some of the world's best design ateliers and workshops cohabit. Located at 1 Grange Garden, in Singapore District 9, professionals and design connoisseurs can find the perfect pieces they are looking for to elevate their interiors. From Jeremy Maxwell Wintrebert and Pierre Bonnefille to Hervé van der Straeten and Thierry Lemaire, this is a unique curated venue where emerging talents and design masters congregate. This experiential residence represents a harmonious dialogue between Eastern aesthetics and Western modernism, where each space has been thoughtfully crafted to showcase the interplay of texture, light, and artisanal craftsmanship.

[2.5s pause]

Next June, Maison Affluency will be celebrating its 10 years anniversary, anchoring its unique curating approach to the South East Asian vernacular.

[2.0s pause]

Synonymous with exceptional craftsmanship, Maison Affluency is ready to embrace the upcoming decade in style!
```

Voice: `en-GB-SoniaNeural`, rate: `-5%` (natural, unhurried pace per your preference).

**Step 2 — Check voiceover duration**

Measure the generated audio with `ffprobe`. Target: voiceover should end ~3s before the outro card begins (around frame 5236 of 5316 total = ~174.5s mark). If too long/short, adjust rate slightly.

**Step 3 — Mix audio**

Combine the voiceover (volume 0.9) with the looped ambient track (volume 0.25) using `ffmpeg`. Voiceover starts after the intro card (~2.3s delay).

**Step 4 — Remux with video + compress**

Take the existing rendered video frames and combine with the new mixed audio. Compress to ~30-40 MB using `libx264 -crf 28 -preset slow` with `-movflags +faststart`.

**Step 5 — Update remotion source**

Replace `remotion/public/audio/voiceover.mp3` with the new file and adjust `VOICEOVER_DUR_FRAMES` in `MainVideo.tsx` to match the actual audio duration.

### What's already correct (no changes needed)

- Outro card text: "at One Grange Garden Singapore" (line 231) — already matches requirement 6
- Video scenes, transitions, ambient music — all unchanged
- TTS engine: Microsoft Edge TTS SoniaNeural — as you specified

