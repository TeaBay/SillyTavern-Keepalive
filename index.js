// Keep Alive (Mobile) v1.2 — Customisable.
//
// Plays a stream of brief white-noise pulses over an <audio> element so Android Chrome
// treats the tab as "active media" and skips background suspension.
//
// VERIFY: after one tap/send, Chrome shows the tab speaker icon. Speaker icon = exempt.

import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const EXT_NAME = 'keepalive';
const DEFAULTS = {
    pulseAmp: 0.015,
    bgAmp: 0.0005,
    pulseDurationS: 0.04,
    pulseIntervalS: 5,
};

let audio = null;
let wakeLock = null;
let started = false;
let currentUrl = null;

function getSettings() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = {};
    const s = extension_settings[EXT_NAME];
    for (const k of Object.keys(DEFAULTS)) {
        const n = Number(s[k]);
        if (!Number.isFinite(n) || n < 0) s[k] = DEFAULTS[k];
    }
    return s;
}

function makeNoiseWavUrl(seconds) {
    const s = getSettings();
    const sampleRate = 44100;
    const numSamples = sampleRate * seconds;
    const bytesPerSample = 2;
    const dataSize = numSamples * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); w(8, 'WAVE');
    w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * bytesPerSample, true);
    dv.setUint16(32, bytesPerSample, true); dv.setUint16(34, 16, true);
    w(36, 'data'); dv.setUint32(40, dataSize, true);
    const maxVal = 32767;
    const pulseSamples = Math.max(1, Math.floor(sampleRate * s.pulseDurationS));
    const intervalSamples = Math.max(pulseSamples + 1, Math.floor(sampleRate * s.pulseIntervalS));
    for (let i = 0; i < numSamples; i++) {
        const phase = i % intervalSamples;
        const amp = phase < pulseSamples ? s.pulseAmp : s.bgAmp;
        const noise = (Math.random() * 2) - 1;
        const v = Math.max(-maxVal, Math.min(maxVal, Math.round(noise * amp * maxVal)));
        dv.setInt16(44 + i * 2, v, true);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function rebuildAudio() {
    const prev = currentUrl;
    currentUrl = makeNoiseWavUrl(60);
    if (audio) {
        const wasPlaying = !audio.paused;
        audio.src = currentUrl;
        audio.loop = true;
        if (wasPlaying) audio.play().catch(() => {});
    }
    if (prev) URL.revokeObjectURL(prev);
}

async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
    catch (e) { /* optional */ }
}

const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

function markMediaSession() {
    try {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'SillyTavern',
            artist: 'Keep-alive (background)',
            album: 'Connection keeper',
            artwork: [{ src: ICON, sizes: 'any', type: 'image/png' }],
        });
        navigator.mediaSession.playbackState = 'playing';
        const keep = () => { try { if (audio && audio.paused) audio.play(); } catch (e) {} navigator.mediaSession.playbackState = 'playing'; };
        navigator.mediaSession.setActionHandler('play', keep);
        navigator.mediaSession.setActionHandler('pause', keep);
        navigator.mediaSession.setActionHandler('stop', keep);
    } catch (e) { /* optional */ }
}

async function start() {
    try {
        if (!audio) {
            if (!currentUrl) currentUrl = makeNoiseWavUrl(60);
            audio = new Audio(currentUrl);
            audio.loop = true;
            audio.volume = 1.0;
        }
        if (audio.paused) await audio.play();
        markMediaSession();
        if (!started) { started = true; console.log('[keepalive] active — noise-pulse playing; look for the tab SPEAKER ICON'); }
    } catch (e) {
        console.warn('[keepalive] audio blocked, will retry on next tap', e);
    }
    requestWakeLock();
}

const SETTINGS_HTML = `
<div class="keepalive-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Keep Alive (Mobile)</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <small>Plays imperceptible white-noise pulses so Android Chrome keeps the tab alive in the background. Click Apply to regenerate the audio with the new settings.</small>
            <label for="ka_pulse_amp">Pulse amplitude (0–1, default 0.015)</label>
            <input id="ka_pulse_amp" type="number" min="0" max="1" step="0.001" class="text_pole">
            <label for="ka_bg_amp">Background floor (0–0.01, default 0.0005; 0 may break exemption)</label>
            <input id="ka_bg_amp" type="number" min="0" max="0.01" step="0.0001" class="text_pole">
            <label for="ka_pulse_dur">Pulse duration in seconds (default 0.04)</label>
            <input id="ka_pulse_dur" type="number" min="0.01" max="1" step="0.01" class="text_pole">
            <label for="ka_pulse_int">Pulse interval in seconds (default 5)</label>
            <input id="ka_pulse_int" type="number" min="1" max="60" step="1" class="text_pole">
            <div style="margin-top:8px;">
                <input id="ka_apply" type="button" class="menu_button" value="Apply">
                <input id="ka_reset" type="button" class="menu_button" value="Reset to defaults">
            </div>
        </div>
    </div>
</div>
`;

function bindUI() {
    const s = getSettings();
    const $panel = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
    if (!$panel.length) {
        setTimeout(bindUI, 1000);
        return;
    }
    if ($('#ka_pulse_amp').length) return;

    $panel.append(SETTINGS_HTML);
    $('#ka_pulse_amp').val(s.pulseAmp);
    $('#ka_bg_amp').val(s.bgAmp);
    $('#ka_pulse_dur').val(s.pulseDurationS);
    $('#ka_pulse_int').val(s.pulseIntervalS);

    $('#ka_apply').on('click', () => {
        const next = {
            pulseAmp: parseFloat($('#ka_pulse_amp').val()),
            bgAmp: parseFloat($('#ka_bg_amp').val()),
            pulseDurationS: parseFloat($('#ka_pulse_dur').val()),
            pulseIntervalS: parseFloat($('#ka_pulse_int').val()),
        };
        Object.assign(extension_settings[EXT_NAME], next);
        saveSettingsDebounced();
        rebuildAudio();
        console.log('[keepalive] settings applied', next);
    });

    $('#ka_reset').on('click', () => {
        Object.assign(extension_settings[EXT_NAME], DEFAULTS);
        saveSettingsDebounced();
        $('#ka_pulse_amp').val(DEFAULTS.pulseAmp);
        $('#ka_bg_amp').val(DEFAULTS.bgAmp);
        $('#ka_pulse_dur').val(DEFAULTS.pulseDurationS);
        $('#ka_pulse_int').val(DEFAULTS.pulseIntervalS);
        rebuildAudio();
        console.log('[keepalive] reset to defaults');
    });
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') start(); });
window.addEventListener('pageshow', () => start());
window.addEventListener('focus', () => start());
['click', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, start, { passive: true }));

jQuery(async () => {
    getSettings();
    bindUI();
});

console.log('[keepalive] v1.2 loaded — tap once (or send a message) to activate; configure in Extensions panel');
