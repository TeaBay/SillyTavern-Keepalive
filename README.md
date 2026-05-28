# SillyTavern Keep Alive (Mobile)

A SillyTavern extension that prevents Android Chrome from suspending the SillyTavern tab when you switch apps, so that long generations finish even when SillyTavern is in the background.

## The Problem

Mobile Chrome suspends background tabs aggressively. When you tap "Send" in SillyTavern and switch to another app to wait, Chrome often kills the in-flight LLM request, leaving you with no reply or a truncated one.

## How It Works

Chrome exempts tabs that are "playing audible media" from background suspension. This extension plays a stream of imperceptible white-noise pulses (~40ms burst every 5s, ~1.5% amplitude) over an `<audio>` element so:

- Chrome shows the tab speaker icon ✅
- Android shows the media session in the notification shade ✅
- The tab survives in the background ✅
- Human ear and phone speaker barely register anything 🤫

A near-silent (~-66 dB) white-noise background runs between pulses to keep Chrome's audio detector happy. Pure silence does not work (Chrome treats a silent audio stream as no audio).

## Install

In SillyTavern:

1. Open the Extensions panel (wand icon)
2. Click **Install extension**
3. Paste this repo's URL:
   ```
   https://github.com/TeaBay/SillyTavern-Keepalive
   ```
4. After install, **tap anywhere or send a message once** to activate (browser autoplay policy requires a user gesture)
5. Check that your Chrome tab now shows a 🔊 speaker icon

## Verify It Works

1. Start a long generation
2. Switch to another app
3. Wait the expected time
4. Return to SillyTavern — the reply should be complete

If the tab dies anyway: check that the speaker icon was actually present before switching. If not, the audio gesture has not fired yet — tap once more in SillyTavern first.

## Tuning (in-UI)

Open the **Extensions panel** (wand icon) and scroll to **Keep Alive (Mobile)**. Four sliders:

| Setting | Default | Effect |
|---|---|---|
| Pulse amplitude | 0.015 | How loud each burst is. Lower = quieter. |
| Background floor | 0.0005 | Continuous low-level noise between pulses. **Do not set to 0** — Chrome will treat the stream as silent and stop exempting the tab. |
| Pulse duration (s) | 0.04 | How long each burst lasts. |
| Pulse interval (s) | 5 | Gap between bursts. Larger = quieter perceived activity. |

Click **Apply** to regenerate the audio with new settings. Settings persist across reloads.

If you can still hear it: lower pulse amplitude (try `0.005`) or pulse duration (try `0.02`), or raise pulse interval (try `10`).

If keepalive stops working (tab gets suspended): raise background floor to `0.001` or `0.002` — Chrome's silence detector might have flagged your stream.

## Limitations

- Only tested on Android Chrome. iOS Safari has different audio / background policies and may not exempt tabs the same way.
- If your phone uses an aggressive battery-saver ROM (Xiaomi MIUI, Huawei EMUI, OnePlus OxygenOS with deep optimisation), it may still kill Chrome itself in the background regardless of audio status. Whitelist Chrome in the OS battery settings.
- Wake Lock is requested when available, but Android often releases it on screen off.

## Safety

- No network calls.
- No external resources downloaded.
- Audio is generated in-browser at runtime — no audio files bundled.
- Does not touch chats, settings, or API keys.
- Disable the extension at any time from the Extensions panel.

## License

MIT — see [LICENSE](LICENSE).
