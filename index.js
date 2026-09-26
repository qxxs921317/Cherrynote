import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types, getRequestHeaders } from "../../../../script.js";

const EXT_NAME = "cherry-note-extension"; // 저장 데이터 호환을 위해 내부 키는 유지 (표시 이름만 Aggressive Notepad로 변경)
const SAVE_DELAY_MS = 1000;
const NOTE_TAG = "system_override_note";

const ICON_THEMES = [
    { id: "cherry", label: "🍒 체리", emoji: "🍒" },
    { id: "white", label: "📝 심플 화이트", emoji: "📝" },
    { id: "memo", label: "🗒️ 메모지", emoji: "🗒️" },
    { id: "dark", label: "🖊️ 미니멀 다크", emoji: "🖊️" },
    { id: "mint", label: "🌿 민트 리프", emoji: "🌿" },
    { id: "butterfly", label: "🦋 버터플라이", emoji: "🦋" },
    { id: "shootingstar", label: "🌠 슈팅스타", emoji: "🌠" },
    { id: "galaxy", label: "🌌 갤럭시", emoji: "🌌" },
    { id: "arcade", label: "🕹️ 픽셀 체리 카트리지", html: () => PX.cherry(18) },
    { id: "pastelos", label: "💿 파스텔 OS 미니창", html: () => `<span class="cn-ic-po-bar"><i></i><i></i></span><span class="cn-ic-po-body">${PX.heart("#f27bb0", 14, false)}</span>` },
    { id: "classic", label: "🪟 클래식 98 버튼", html: () => PX.note(20) },
    { id: "digi", label: "📁 디지 스티커 폴더", html: () => PX.folder(18) },
    { id: "dual", label: "🎮 핑크 듀얼 게임기", html: () => `<span class="cn-ic-du-scr">${PX.heart("#f07ab4", 5, false)}</span><span class="cn-ic-du-hinge"></span><span class="cn-ic-du-scr"></span>` },
    { id: "letter", label: "💌 러브레터 봉투", html: () => PX.envelope(20, "#fbd6c2") },
];

const PANEL_THEMES = [
    { id: "pink", label: "🍒 체리 핑크" },
    { id: "mint", label: "🌿 민트" },
    { id: "lavender", label: "💜 라벤더" },
    { id: "dark", label: "🌙 미드나잇" },
    { id: "sunset", label: "🌅 선셋" },
    { id: "white", label: "🤍 심플 화이트 메모" },
    { id: "arcade", label: "🕹️ 체리 아케이드 (픽셀)" },
    { id: "pastelos", label: "💿 파스텔 OS (픽셀)" },
    { id: "classic", label: "🪟 클래식 다이얼로그 (픽셀)" },
    { id: "digi", label: "📁 디지 스티커 (픽셀)" },
    { id: "dual", label: "🎮 핑크 듀얼 (픽셀)" },
    { id: "letter", label: "💌 러브레터 (픽셀)" },
];

// ---------- 픽셀 아이콘 (SVG) ----------

const PX_HEART_RECTS = '<rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="2" height="1"/><rect x="0" y="1" width="7" height="2"/><rect x="1" y="3" width="5" height="1"/><rect x="2" y="4" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/>';

const PX = {
    heart: (fill, w = 14, highlight = true) =>
        `<svg class="cn-px" width="${w}" height="${Math.round((w * 6) / 7)}" viewBox="0 0 7 6" shape-rendering="crispEdges" fill="${fill}" aria-hidden="true">${PX_HEART_RECTS}${highlight ? '<rect x="1" y="1" width="1" height="1" fill="#ffffff"/>' : ""}</svg>`,
    halfHeart: (fill, empty, w = 14) =>
        `<svg class="cn-px" width="${w}" height="${Math.round((w * 6) / 7)}" viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true"><g fill="${fill}"><rect x="1" y="0" width="2" height="1"/><rect x="0" y="1" width="4" height="2"/><rect x="1" y="3" width="3" height="1"/><rect x="2" y="4" width="2" height="1"/><rect x="3" y="5" width="1" height="1"/></g><g fill="${empty}"><rect x="4" y="0" width="2" height="1"/><rect x="4" y="1" width="3" height="2"/><rect x="4" y="3" width="2" height="1"/><rect x="4" y="4" width="1" height="1"/></g></svg>`,
    x: (fill, w = 10) =>
        `<svg class="cn-px" width="${w}" height="${w}" viewBox="0 0 5 5" shape-rendering="crispEdges" fill="${fill}" aria-hidden="true"><rect x="0" y="0" width="1" height="1"/><rect x="4" y="0" width="1" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="1" y="3" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="0" y="4" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/></svg>`,
    arrow: (dir, w = 7) =>
        `<svg class="cn-px" width="${w}" height="${Math.round((w * 3) / 5)}" viewBox="0 0 5 3" shape-rendering="crispEdges" fill="#ffffff" aria-hidden="true">${dir === "up"
            ? '<rect x="2" y="0" width="1" height="1"/><rect x="1" y="1" width="3" height="1"/><rect x="0" y="2" width="5" height="1"/>'
            : '<rect x="0" y="0" width="5" height="1"/><rect x="1" y="1" width="3" height="1"/><rect x="2" y="2" width="1" height="1"/>'}</svg>`,
    cherry: (w = 18) =>
        `<svg class="cn-px" width="${w}" height="${w}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><g fill="#7bd389"><rect x="7" y="0" width="3" height="1"/><rect x="8" y="1" width="2" height="1"/></g><g fill="#2f7a47"><rect x="6" y="1" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="4" y="3" width="1" height="2"/><rect x="3" y="5" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="3" width="1" height="2"/></g><g fill="#ff4d8d"><rect x="2" y="6" width="3" height="1"/><rect x="1" y="7" width="5" height="3"/><rect x="2" y="10" width="3" height="1"/><rect x="7" y="5" width="3" height="1"/><rect x="6" y="6" width="5" height="3"/><rect x="7" y="9" width="3" height="1"/></g><g fill="#d12e6f"><rect x="5" y="8" width="1" height="2"/><rect x="4" y="10" width="1" height="1"/><rect x="10" y="7" width="1" height="2"/><rect x="9" y="9" width="1" height="1"/></g><g fill="#ffffff"><rect x="2" y="7" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/></g></svg>`,
    note: (w = 20) =>
        `<svg class="cn-px" width="${w}" height="${w}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="1" width="8" height="10" fill="#3a2d4a"/><rect x="2" y="2" width="6" height="8" fill="#ffffff"/><g fill="#f06fae"><rect x="3" y="4" width="4" height="1"/><rect x="3" y="6" width="4" height="1"/><rect x="3" y="8" width="2" height="1"/></g><g fill="#ff8cc0"><rect x="9" y="2" width="2" height="1"/><rect x="8" y="3" width="2" height="1"/><rect x="7" y="4" width="2" height="1"/><rect x="6" y="5" width="2" height="1"/></g><rect x="10" y="2" width="1" height="1" fill="#c2186e"/><rect x="5" y="6" width="1" height="1" fill="#3a2d4a"/></svg>`,
    sparkle: (fill, w = 12) =>
        `<svg class="cn-px" width="${w}" height="${w}" viewBox="0 0 7 7" shape-rendering="crispEdges" fill="${fill}" aria-hidden="true"><rect x="3" y="0" width="1" height="7"/><rect x="0" y="3" width="7" height="1"/><rect x="2" y="2" width="3" height="3"/></svg>`,
    folder: (w = 18) =>
        `<svg class="cn-px" width="${w}" height="${Math.round((w * 10) / 12)}" viewBox="0 0 12 10" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="5" height="2" fill="#f07ab4"/><rect x="0" y="2" width="12" height="8" fill="#f7a8cc"/><rect x="0" y="9" width="12" height="1" fill="#d46b9f"/><g fill="#ffffff"><rect x="4" y="4" width="2" height="1"/><rect x="7" y="4" width="2" height="1"/><rect x="4" y="5" width="5" height="1"/><rect x="5" y="6" width="3" height="1"/><rect x="6" y="7" width="1" height="1"/></g></svg>`,
    envelope: (w = 19, inner = "#fff7f2") =>
        `<svg class="cn-px" width="${w}" height="${Math.round((w * 9) / 13)}" viewBox="0 0 13 9" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="13" height="9" fill="#b0564a"/><rect x="1" y="1" width="11" height="7" fill="${inner}"/><g fill="#b0564a"><rect x="1" y="1" width="1" height="1"/><rect x="11" y="1" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="10" y="2" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="9" y="3" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="8" y="4" width="1" height="1"/></g><g fill="#e0404f"><rect x="5" y="4" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/><rect x="5" y="5" width="3" height="1"/><rect x="6" y="6" width="1" height="1"/></g></svg>`,
    bow: (w = 22) =>
        `<svg class="cn-px" width="${w}" height="${Math.round((w * 7) / 11)}" viewBox="0 0 11 7" shape-rendering="crispEdges" aria-hidden="true"><g fill="#f29bb0"><rect x="0" y="0" width="2" height="1"/><rect x="0" y="1" width="3" height="1"/><rect x="0" y="2" width="4" height="2"/><rect x="0" y="4" width="3" height="1"/><rect x="0" y="5" width="2" height="1"/><rect x="9" y="0" width="2" height="1"/><rect x="8" y="1" width="3" height="1"/><rect x="7" y="2" width="4" height="2"/><rect x="8" y="4" width="3" height="1"/><rect x="9" y="5" width="2" height="1"/></g><g fill="#c9667f"><rect x="4" y="2" width="3" height="2"/><rect x="4" y="4" width="1" height="2"/><rect x="6" y="4" width="1" height="2"/><rect x="3" y="6" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/></g></svg>`,
    star: (w = 27) =>
        `<svg class="cn-px" width="${w}" height="${w}" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true"><g fill="#f7c95b"><rect x="4" y="0" width="1" height="2"/><rect x="3" y="2" width="3" height="1"/><rect x="0" y="3" width="9" height="1"/><rect x="1" y="4" width="7" height="1"/><rect x="2" y="5" width="5" height="2"/><rect x="1" y="7" width="3" height="1"/><rect x="5" y="7" width="3" height="1"/><rect x="1" y="8" width="2" height="1"/><rect x="6" y="8" width="2" height="1"/></g><rect x="4" y="3" width="1" height="1" fill="#fff4cf"/></svg>`,
    dpad: (w = 44) =>
        `<svg class="cn-px" width="${w}" height="${w}" viewBox="0 0 14 14" shape-rendering="crispEdges" aria-hidden="true"><rect x="4" y="0" width="6" height="14" fill="#d98bb1"/><rect x="0" y="4" width="14" height="6" fill="#d98bb1"/><rect x="5" y="1" width="4" height="12" fill="#ffffff"/><rect x="1" y="5" width="12" height="4" fill="#ffffff"/><rect x="6" y="6" width="2" height="2" fill="#f3c6da"/></svg>`,
    cd: () =>
        '<svg class="cn-px" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#e6e0ff" stroke="#a99be6" stroke-width="1.5"/><circle cx="13" cy="13" r="8" fill="#fbe3f1"/><circle cx="13" cy="13" r="3.5" fill="#ffffff" stroke="#a99be6" stroke-width="1.5"/></svg>',
};

// ---------- 패널 템플릿 (테마마다 마크업이 다름) ----------
// 공통으로 꼭 있어야 하는 id: cherry-note-char-name / cherry-note-textarea / cherry-note-status / cherry-note-save-btn
// .cn-close = 패널 닫기, .cn-expand = 입력창 크게/작게
// .cn-count-score / .cn-count-chars / .cn-inject-bar = 글자 수 표시

const NOTE_PLACEHOLDER = "여기 적으면 진짜 맨 끝에 강제로 박아넣어요...";
const TEXTAREA_HTML = `<textarea id="cherry-note-textarea" placeholder="${NOTE_PLACEHOLDER}"></textarea>`;
const INJECT_SEGMENTS = 10;
const CHARS_PER_SEGMENT = 30;

function formatTime(d = new Date()) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

const PANEL_TEMPLATES = {
    default: {
        html: () => `
            <div id="cherry-note-header">
                <span id="cherry-note-char-name">📝</span>
                <span id="cherry-note-close" class="cn-close">✕</span>
            </div>
            ${TEXTAREA_HTML}
            <div id="cherry-note-footer">
                <span id="cherry-note-status"></span>
                <button id="cherry-note-save-btn" title="저장하기">💾</button>
            </div>`,
        name: (n) => `📝 ${n}`,
        saved: () => "저장됨 ✓",
    },
    arcade: {
        html: () => `
            <div class="cn-ar-top">
                <span class="cn-ar-spacer"></span>
                <span class="cn-ar-dots">${PX.heart("#ffe3f0", 10, false)}${PX.heart("#ffe3f0", 12, false)}${PX.heart("#ffe3f0", 10, false)}</span>
                <button class="cn-ar-close cn-close" title="닫기">${PX.x("#ffffff", 10)}</button>
            </div>
            <div class="cn-ar-screen">
                <div id="cherry-note-header" class="cn-ar-hud">
                    <span class="cn-ar-name">${PX.cherry(18)}<span id="cherry-note-char-name"></span></span>
                    <span class="cn-ar-hearts">${PX.heart("#e83e8c")}${PX.heart("#e83e8c")}<span class="cn-ar-heart-full">${PX.heart("#e83e8c")}</span><span class="cn-ar-heart-half">${PX.halfHeart("#e83e8c", "#fbd1e4")}</span></span>
                </div>
                ${TEXTAREA_HTML}
                <div id="cherry-note-footer" class="cn-ar-foot">
                    <span id="cherry-note-status"></span>
                    <span class="cn-ar-score">SCORE: <span class="cn-count-score">000000</span></span>
                </div>
                <div class="cn-ar-ground"></div>
            </div>
            <div class="cn-ar-controls">
                <span class="cn-ar-dpad"><span>${PX.arrow("up")}</span><span>${PX.arrow("down")}</span></span>
                <span class="cn-ar-grill"><i></i><i></i><i></i><i></i><i></i></span>
                <button id="cherry-note-save-btn" title="저장하기">${PX.heart("#ffe0ef", 21)}</button>
            </div>`,
        name: (n) => n,
        saved: () => "♥ SAVED!",
        retro: true,
    },
    pastelos: {
        html: () => `
            <div id="cherry-note-header" class="cn-po-titlebar">
                <span class="cn-po-title">${PX.heart("#f27bb0", 14)}<b>Note.exe</b></span>
                <span class="cn-po-winbtns">
                    <button class="cn-po-wb cn-close" title="최소화"><i class="cn-po-min"></i></button>
                    <button class="cn-po-wb cn-expand" title="크게/작게"><i class="cn-po-max"></i></button>
                    <button class="cn-po-wb cn-close" title="닫기">${PX.x("#4b3f99", 8)}</button>
                </span>
            </div>
            <div class="cn-po-body">
                <div class="cn-po-now">
                    ${PX.cd()}
                    <span class="cn-po-nowtext"><span class="cn-po-label">NOW EDITING</span><span id="cherry-note-char-name"></span></span>
                    <span class="cn-po-eq"><i></i><i></i><i></i><i></i><i></i></span>
                </div>
                <div class="cn-po-field">${TEXTAREA_HTML}</div>
                <div class="cn-po-inject">
                    <span class="cn-po-label">INJECT</span>
                    <span class="cn-inject-bar">${"<i></i>".repeat(INJECT_SEGMENTS)}</span>
                    <span class="cn-count-chars">0자</span>
                </div>
            </div>
            <div id="cherry-note-footer" class="cn-po-foot">
                <span id="cherry-note-status"></span>
                <button id="cherry-note-save-btn" title="저장하기">Save ${PX.heart("#f27bb0", 10, false)}</button>
            </div>`,
        name: (n) => `${n} ♡`,
        saved: () => `♡ 자동 저장됨 · ${formatTime()}`,
        keepStatus: true,
        retro: true,
    },
    classic: {
        html: () => `
            <div id="cherry-note-header" class="cn-cd-titlebar">
                <span class="cn-cd-title">MEMO MODE</span>
                <button class="cn-cd-x cn-close" title="닫기">${PX.x("#1d1b22", 10)}</button>
            </div>
            <div class="cn-cd-body">
                <div class="cn-cd-msg">
                    ${PX.note(36)}
                    <span class="cn-cd-msgtext"><b id="cherry-note-char-name"></b><span class="cn-cd-sub">다음 요청 맨 끝에 강제 주입돼요.</span></span>
                </div>
                ${TEXTAREA_HTML}
                <div id="cherry-note-footer" class="cn-cd-foot">
                    <span id="cherry-note-status"></span>
                    <span class="cn-cd-btns">
                        <button id="cherry-note-save-btn" class="cn-cd-btn cn-cd-default" title="저장하기"><u>S</u>ave</button>
                        <button class="cn-cd-btn cn-close" title="닫기"><u>C</u>lose</button>
                    </span>
                </div>
            </div>`,
        name: (n) => `${n} 전용 메모`,
        saved: () => "저장됨",
        retro: true,
    },
    digi: {
        html: () => `
            <div class="cn-dg-win">
                <div id="cherry-note-header" class="cn-dg-titlebar">
                    <span class="cn-dg-title">DIGI NOTE.EXE</span>
                    <span class="cn-dg-winbtns">
                        <button class="cn-dg-wb cn-close" title="최소화"><i class="cn-dg-min"></i></button>
                        <button class="cn-dg-wb cn-expand" title="크게/작게"><i class="cn-dg-max"></i></button>
                        <button class="cn-dg-wb cn-close" title="닫기">${PX.x("#8e5a7a", 7)}</button>
                    </span>
                </div>
                <div class="cn-dg-body">
                    <div class="cn-dg-row">
                        <span class="cn-dg-tag">${PX.sparkle("#ffffff", 12)}<span id="cherry-note-char-name"></span></span>
                        <span class="cn-dg-hearts">${PX.heart("#f28ab8")}${PX.heart("#9fa8f0")}${PX.heart("#f3dfb8")}</span>
                    </div>
                    ${TEXTAREA_HTML}
                    <div class="cn-dg-load">
                        <span class="cn-dg-loadtext">&gt; LOADING CUTENESS... <span class="cn-count-chars">0자</span></span>
                        <div class="cn-dg-bar"><div class="cn-progress-fill"></div></div>
                    </div>
                </div>
                <div id="cherry-note-footer" class="cn-dg-foot">
                    <span id="cherry-note-status"></span>
                    <span class="cn-dg-btns">
                        <button class="cn-dg-btn cn-close" title="닫기">CLOSE</button>
                        <button id="cherry-note-save-btn" class="cn-dg-btn cn-dg-primary" title="저장하기">SAVE</button>
                    </span>
                </div>
            </div>`,
        name: (n) => n,
        saved: () => "♥ SAVED!",
        retro: true,
    },
    dual: {
        html: () => `
            <div class="cn-du-top">
                <span class="cn-du-spk"><i></i><i></i><i></i><i></i><i></i><i></i></span>
                <div class="cn-du-bezel">
                    <div id="cherry-note-header" class="cn-du-screen">
                        <div class="cn-du-line"><span class="cn-du-label">PLAYER 1</span><span id="cherry-note-status"></span></div>
                        <span id="cherry-note-char-name"></span>
                        <div class="cn-du-line"><span class="cn-du-label">MEMO</span><span class="cn-count-score">000000</span></div>
                    </div>
                </div>
                <span class="cn-du-spk"><i></i><i></i><i></i><i></i><i></i><i></i></span>
            </div>
            <div class="cn-du-hinge">
                <span class="cn-du-slot"></span>
                <span class="cn-du-mic"><i></i>MIC</span>
                <span class="cn-du-leds"><i></i><i></i></span>
            </div>
            <div class="cn-du-bottom">
                <div class="cn-du-bezel">${TEXTAREA_HTML}</div>
                <div id="cherry-note-footer" class="cn-du-controls">
                    ${PX.dpad(44)}
                    <span class="cn-du-legend"><span><i></i>A  SAVE</span><span><i></i>B  CLOSE</span></span>
                    <div class="cn-du-abxy">
                        <span></span><span class="cn-du-key">X</span><span></span>
                        <span class="cn-du-key">Y</span><span></span>
                        <button id="cherry-note-save-btn" class="cn-du-a" title="저장하기 (A)">A</button>
                        <span></span><button class="cn-du-b cn-close" title="닫기 (B)">B</button><span></span>
                    </div>
                </div>
            </div>`,
        name: (n) => n,
        saved: () => "♥ SAVED",
        retro: true,
    },
    letter: {
        html: () => `
            <div class="cn-lt-pearls cn-lt-pearls-top"><span class="cn-lt-bow-l">${PX.bow(22)}</span><span class="cn-lt-bow-r">${PX.bow(22)}</span></div>
            <div id="cherry-note-header" class="cn-lt-titlebar">
                <span class="cn-lt-title">${PX.envelope(19)}<span class="cn-lt-titletext">LOVE LETTER -&nbsp;<span id="cherry-note-char-name"></span></span></span>
                <span class="cn-lt-winbtns">
                    <button class="cn-lt-wb cn-close" title="최소화"><i class="cn-lt-min"></i></button>
                    <button class="cn-lt-wb cn-expand" title="크게/작게"><i class="cn-lt-max"></i></button>
                    <button class="cn-lt-wb cn-close" title="닫기">${PX.x("#5e2e26", 8)}</button>
                </span>
            </div>
            <div class="cn-lt-menu"><span>File</span><span>Edit</span><span>Message</span><span>Insert</span><span>Help</span></div>
            <div class="cn-lt-body">
                <div class="cn-lt-paper">${TEXTAREA_HTML}</div>
                <div class="cn-lt-pearls"></div>
                <span class="cn-lt-status">✉ <span class="cn-count-chars">0자</span> <span id="cherry-note-status"></span></span>
            </div>
            <div id="cherry-note-footer" class="cn-lt-toolbar">
                ${PX.envelope(33)}
                ${PX.bow(33)}
                <span class="cn-lt-stamp">${PX.heart("#ffffff", 14, false)}</span>
                ${PX.star(27)}
                <button id="cherry-note-save-btn" class="cn-lt-floppy" title="저장하기"><span class="cn-lt-shutter"><i></i></span><span class="cn-lt-label">SAVE</span></button>
            </div>`,
        name: (n) => n,
        saved: () => `· Draft saved ${formatTime()}`,
        keepStatus: true,
        retro: true,
    },
};

function getPanelTemplate(themeId) {
    return PANEL_TEMPLATES[themeId] || PANEL_TEMPLATES.default;
}

const DEFAULT_CONFIG = {
    iconTheme: "cherry",
    panelTheme: "pink",
    floatingEnabled: true,
};

let saveTimer = null;
let currentAvatar = null; // 현재 메모가 속한 캐릭터의 아바타 파일명
let isDirty = false;
let currentNoteBlock = ""; // <system_override_note>로 감싼, 주입 준비된 텍스트
let charNameState = { kind: "none", name: "" }; // 헤더에 표시할 이름 상태 (테마별 포맷용)

// ---------- 설정(테마/플로팅 on-off) 헬퍼 ----------

function getConfig() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = {};
    }
    if (!extension_settings[EXT_NAME].config) {
        extension_settings[EXT_NAME].config = { ...DEFAULT_CONFIG };
    }
    // 이전 버전 호환: 누락된 필드 채워넣기
    extension_settings[EXT_NAME].config = { ...DEFAULT_CONFIG, ...extension_settings[EXT_NAME].config };
    return extension_settings[EXT_NAME].config;
}

function saveConfig() {
    saveSettingsDebounced();
}

// ---------- 저장소: user files (data/<user>/user/files/) ----------
// 메모는 settings.json이 아니라 캐릭터별 JSON 파일로 따로 저장한다.
// settings.json에는 테마 설정(config)만 남음.

const FILE_PREFIX = "cherrynote_";

// 짧은 53비트 해시 (파일명 충돌 방지용)
function hashString(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// 아바타 파일명 -> 안전한 파일명 (영문/숫자만 남기고 + 해시)
function noteFileName(avatar) {
    const readable = avatar.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    return `${FILE_PREFIX}${readable ? readable + "_" : ""}${hashString(avatar)}.json`;
}

function toBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}

async function readNoteFile(avatar) {
    const res = await fetch(`/user/files/${noteFileName(avatar)}`, {
        method: "GET",
        cache: "no-store",
        headers: getRequestHeaders(),
    });
    if (res.status === 404) return "";
    if (!res.ok) throw new Error(`읽기 실패 (HTTP ${res.status})`);
    const data = await res.json();
    return typeof data?.text === "string" ? data.text : "";
}

async function writeNoteFile(avatar, text, { keepalive = false } = {}) {
    const name = noteFileName(avatar);

    // 메모를 다 지웠으면 파일도 삭제 (빈 파일 쌓이지 않게)
    if (!text) {
        const res = await fetch("/api/files/delete", {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({ path: `user/files/${name}` }),
            keepalive,
        });
        if (!res.ok && res.status !== 404) throw new Error(`삭제 실패 (HTTP ${res.status})`);
        return;
    }

    const payload = JSON.stringify({ v: 1, avatar, text, updatedAt: new Date().toISOString() });
    const res = await fetch("/api/files/upload", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({ name, data: toBase64Utf8(payload) }),
        keepalive,
    });
    if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
}

// 쓰기 요청이 순서 뒤바뀌지 않게 한 줄로 세움
let writeChain = Promise.resolve();
function queueWrite(avatar, text, opts) {
    const job = writeChain.then(() => writeNoteFile(avatar, text, opts));
    writeChain = job.catch(() => {});
    return job;
}

// 예전 버전(settings.json 안의 notes) -> 파일로 1회 이전
async function migrateLegacyNotes() {
    const legacy = extension_settings[EXT_NAME]?.notes;
    if (!legacy || typeof legacy !== "object") return;

    const entries = Object.entries(legacy);
    let failed = 0;
    for (const [avatar, text] of entries) {
        try {
            if (text) await queueWrite(avatar, text);
            delete legacy[avatar];
        } catch (e) {
            failed++;
            console.error(`[Aggressive Notepad] 메모 이전 실패 (${avatar}):`, e);
        }
    }

    if (failed === 0) {
        delete extension_settings[EXT_NAME].notes;
    }
    saveSettingsDebounced();
    console.log(`[Aggressive Notepad] settings.json -> user files 이전: ${entries.length - failed}/${entries.length}개 완료`);
}

function getCurrentAvatar() {
    const context = getContext();
    // 그룹챗은 미지원
    if (context.groupId) {
        return null;
    }
    const character = context.characters?.[context.characterId];
    return character?.avatar || null;
}

// ---------- 프롬프트 주입 (진짜 맨 끝 강제 삽입) ----------
// setExtensionPrompt(depth 기반)는 ST가 히스토리를 "조립하는 단계"에 참여하는 방식이라
// 그 뒤에 Post-History Instructions(Jailbreak)나 다른 확장이 더 붙으면 밀려남.
// 그래서 여기서는 API로 보내기 직전, 완전히 조립된 최종 프롬프트를 가로채서
// 배열/문자열 맨 끝에 직접 붙인다.

function buildNoteBlock(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return "";
    return `<${NOTE_TAG}>\n${trimmed}\n</${NOTE_TAG}>`;
}

function updateNoteBlock(text) {
    currentNoteBlock = buildNoteBlock(text);
}

function isInjectionAllowed() {
    // 그룹챗 미지원 + 메모 없으면 스킵
    const context = getContext();
    if (context.groupId) return false;
    if (!currentNoteBlock) return false;
    return true;
}

// Chat Completion (Gemini/Vertex, Claude API, OpenAI 등 채팅형 API 연결)
async function onChatCompletionPromptReady(eventData) {
    try {
        if (!eventData || eventData.dryRun) return;
        await loadingPromise;
        if (!isInjectionAllowed()) return;
        if (!Array.isArray(eventData.chat)) return;

        eventData.chat.push({ role: "system", content: currentNoteBlock });
        console.log(`[Aggressive Notepad] chat-completion 맨 끝에 주입됨 (len=${currentNoteBlock.length})`);
    } catch (e) {
        console.error("[Aggressive Notepad] chat-completion 주입 실패:", e);
    }
}

// Text Completion (KoboldAI, 로컬 모델, 텍스트 완성형 API 연결)
async function onTextCompletionPromptReady(eventData) {
    try {
        if (!eventData) return;
        await loadingPromise;
        if (!isInjectionAllowed()) return;

        if (typeof eventData.prompt === "string") {
            eventData.prompt = eventData.prompt + "\n" + currentNoteBlock + "\n";
            console.log(`[Aggressive Notepad] text-completion 맨 끝에 주입됨 (len=${currentNoteBlock.length})`);
        }
    } catch (e) {
        console.error("[Aggressive Notepad] text-completion 주입 실패:", e);
    }
}

function registerInjectionHooks() {
    if (event_types.CHAT_COMPLETION_PROMPT_READY) {
        eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
    } else {
        console.warn("[Aggressive Notepad] CHAT_COMPLETION_PROMPT_READY 이벤트를 찾을 수 없음 - Chat Completion 주입이 동작하지 않을 수 있음");
    }

    // ST 버전에 따라 이름이 다를 수 있어 후보를 순서대로 시도
    const textEventName = event_types.GENERATE_AFTER_COMBINE_PROMPTS
        || event_types.TEXT_COMPLETION_PROMPT_READY
        || event_types.GENERATE_AFTER_DATA;

    if (textEventName) {
        eventSource.on(textEventName, onTextCompletionPromptReady);
    } else {
        console.warn("[Aggressive Notepad] Text Completion용 이벤트를 찾지 못함 - 콘솔에서 event_types 이름 확인 필요");
    }
}

// ---------- 저장 로직 (자동저장 + 수동저장 겸용, 안전장치 포함) ----------

// 입력창 내용은 항상 "currentAvatar"(불러올 때 정해진 캐릭터)의 메모.
// 캐릭터가 바뀌면 입력창을 갈아끼우기 "전에" flush 하므로 엉뚱한 캐릭터에 덮어쓰지 않음.
function doSave(showFeedback = true, { keepalive = false } = {}) {
    const avatar = currentAvatar;
    if (!avatar || isLoading) {
        isDirty = false;
        return Promise.resolve();
    }

    const text = $("#cherry-note-textarea").val() || "";
    if (avatar === getCurrentAvatar()) {
        updateNoteBlock(text);
    }
    isDirty = false;
    $("#cherry-note-panel").removeClass("cn-dirty");

    return queueWrite(avatar, text, { keepalive })
        .then(() => {
            if (showFeedback && avatar === currentAvatar) showSavedFeedback();
        })
        .catch((e) => {
            console.error("[Aggressive Notepad] 저장 실패:", e);
            if (avatar === currentAvatar) {
                isDirty = true; // 다음 입력/닫기 때 다시 시도
                $("#cherry-note-panel").addClass("cn-dirty");
                showStatus("⚠ 저장 실패", true);
            }
        });
}

function scheduleAutoSave() {
    isDirty = true;
    $("#cherry-note-panel").addClass("cn-dirty");
    if (saveTimer) {
        clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
        saveTimer = null;
        doSave(true);
    }, SAVE_DELAY_MS);
}

function flushPendingSave(opts) {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (isDirty) {
        return doSave(false, opts);
    }
    return Promise.resolve();
}

function showStatus(text, keep = false) {
    const $status = $("#cherry-note-status");
    $status.stop(true, true).text(text).css("opacity", 1);
    if (!keep) {
        $status.delay(1000).animate({ opacity: 0 }, 400);
    }
}

function showSavedFeedback() {
    const tpl = getPanelTemplate(getConfig().panelTheme);
    showStatus(tpl.saved(), !!tpl.keepStatus);
}

// ---------- 캐릭터 이름 / 글자 수 표시 ----------

function renderCharName() {
    const $name = $("#cherry-note-char-name");
    if (charNameState.kind === "group") {
        $name.text("그룹챗은 지원되지 않아요");
    } else if (charNameState.kind === "char") {
        $name.text(getPanelTemplate(getConfig().panelTheme).name(charNameState.name));
    } else {
        $name.text("캐릭터를 선택해주세요");
    }
}

function updateCounter() {
    const len = ($("#cherry-note-textarea").val() || "").length;
    $("#cherry-note-panel .cn-count-score").text(String(len).padStart(6, "0"));
    $("#cherry-note-panel .cn-count-chars").text(`${len}자`);
    const filled = len === 0 ? 0 : Math.min(INJECT_SEGMENTS, Math.ceil(len / CHARS_PER_SEGMENT));
    $("#cherry-note-panel .cn-inject-bar i").each((i, el) => {
        el.classList.toggle("on", i < filled);
    });
    const pct = Math.min(100, (len / (INJECT_SEGMENTS * CHARS_PER_SEGMENT)) * 100);
    $("#cherry-note-panel .cn-progress-fill").css("width", `${pct}%`);
}

// ---------- 캐릭터/챗 전환 시 메모 불러오기 ----------

let isLoading = false;
let loadingPromise = Promise.resolve();
let loadToken = 0;

function loadNoteForCurrentCharacter() {
    loadingPromise = loadNoteInternal();
    return loadingPromise;
}

async function loadNoteInternal() {
    // 이전 캐릭터의 대기중인 저장을 먼저 확정 (입력창 갈아끼우기 전에!)
    flushPendingSave();

    const myToken = ++loadToken;
    const avatar = getCurrentAvatar();
    currentAvatar = avatar;

    const isGroup = avatar === null && !!getContext().groupId;

    // 이름은 바로 표시
    if (isGroup) {
        charNameState = { kind: "group", name: "" };
    } else {
        const context = getContext();
        const character = context.characters?.[context.characterId];
        charNameState = character?.name ? { kind: "char", name: character.name } : { kind: "none", name: "" };
    }
    renderCharName();
    $("#cherry-note-panel").removeClass("cn-dirty");
    $("#cherry-note-status").stop(true, true).text("").css("opacity", 0);

    updateNoteBlock("");
    $("#cherry-note-textarea").val("");

    let text = "";
    if (avatar) {
        isLoading = true;
        $("#cherry-note-textarea").prop("disabled", true);
        $("#cherry-note-save-btn").prop("disabled", true);
        let failed = false;
        try {
            text = await readNoteFile(avatar);
        } catch (e) {
            failed = true;
            console.error("[Aggressive Notepad] 메모 불러오기 실패:", e);
        }
        // 기다리는 사이 다른 캐릭터로 넘어갔으면 이 결과는 버림
        if (myToken !== loadToken) return;
        isLoading = false;
        if (failed) {
            // 못 불러온 상태에서 입력하면 기존 메모를 빈 내용으로 덮어쓸 수 있으니 잠가둠
            setGroupChatState(true);
            showStatus("⚠ 불러오기 실패 (새로고침 해주세요)", true);
            return;
        }
    }

    $("#cherry-note-textarea").val(text);
    setGroupChatState(isGroup || !avatar);
    updateCounter();

    if (isGroup) {
        charNameState = { kind: "group", name: "" };
    } else {
        const context = getContext();
        const character = context.characters?.[context.characterId];
        charNameState = character?.name ? { kind: "char", name: character.name } : { kind: "none", name: "" };
    }

    updateNoteBlock(isGroup ? "" : text);
}

function setGroupChatState(disabled) {
    $("#cherry-note-textarea").prop("disabled", disabled);
    $("#cherry-note-save-btn").prop("disabled", disabled);
    $("#cherry-note-panel").toggleClass("cherry-note-disabled", disabled);
}

// ---------- 드래그 가능한 플로팅 아이콘 ----------

function makeDraggable($el, storageKey, onTap) {
    let isDragging = false;
    let didDrag = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    const DRAG_THRESHOLD = 8;

    function onPointerDown(e) {
        isDragging = true;
        didDrag = false;
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX;
        startY = point.clientY;
        const rect = $el[0].getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!isDragging) return;
        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) didDrag = true;

        let newX = origX + dx;
        let newY = origY + dy;

        const maxX = window.innerWidth - $el.outerWidth();
        const maxY = window.innerHeight - $el.outerHeight();
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        $el.css({ left: `${newX}px`, top: `${newY}px`, right: "auto", bottom: "auto" });
    }

    function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;

        if (didDrag) {
            const rect = $el[0].getBoundingClientRect();
            localStorage.setItem(storageKey, JSON.stringify({ x: rect.left, y: rect.top }));
        } else {
            // 이동이 거의 없었으면 탭으로 간주 (touchstart에서 preventDefault했기 때문에
            // 브라우저가 만들어주는 합성 click 이벤트를 모바일에서는 기대할 수 없어서 직접 처리)
            onTap?.();
        }
    }

    $el.on("mousedown touchstart", onPointerDown);
    $(document).on("mousemove touchmove", onPointerMove);
    $(document).on("mouseup touchend", onPointerUp);
}

function clampToViewport($el, x, y) {
    const maxX = Math.max(0, window.innerWidth - $el.outerWidth());
    const maxY = Math.max(0, window.innerHeight - $el.outerHeight());
    return {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
    };
}

function restorePosition($el, storageKey, defaultRight = 20, defaultBottom = 90) {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            const { x, y } = JSON.parse(saved);
            const clamped = clampToViewport($el, x, y);
            $el.css({ left: `${clamped.x}px`, top: `${clamped.y}px`, right: "auto", bottom: "auto" });
            return;
        } catch (e) { /* fallthrough */ }
    }
    $el.css({ right: `${defaultRight}px`, bottom: `${defaultBottom}px` });
}

function reclampIconToViewport($el, storageKey) {
    // right/bottom 기본값으로 있는 경우(left/top 미설정)는 애초에 반응형이라 스킵
    if ($el.css("left") === "auto") return;
    const rect = $el[0].getBoundingClientRect();
    const clamped = clampToViewport($el, rect.left, rect.top);
    $el.css({ left: `${clamped.x}px`, top: `${clamped.y}px` });
    localStorage.setItem(storageKey, JSON.stringify({ x: clamped.x, y: clamped.y }));
}

// ---------- 테마 적용 ----------

function applyIconTheme(themeId) {
    const $icon = $("#cherry-note-icon");
    const theme = ICON_THEMES.find((t) => t.id === themeId) || ICON_THEMES[0];
    $icon.attr("data-icon-theme", theme.id);
    if (theme.html) {
        $icon.html(theme.html());
    } else {
        $icon.text(theme.emoji);
    }
}

function applyPanelTheme(themeId) {
    const $panel = $("#cherry-note-panel");
    const $oldTa = $("#cherry-note-textarea");

    // 마크업을 갈아끼우기 전에 현재 상태 보존
    const hadContent = $oldTa.length > 0;
    const text = $oldTa.val() || "";
    const disabled = $oldTa.prop("disabled") || false;

    const tpl = getPanelTemplate(themeId);
    $panel.attr("data-theme", themeId);
    $panel.removeClass("cn-expanded");
    $panel.toggleClass("cn-retro", !!tpl.retro);
    $panel.html(tpl.html());

    if (hadContent) {
        $("#cherry-note-textarea").val(text);
    }
    $("#cherry-note-textarea").prop("disabled", disabled);
    $("#cherry-note-save-btn").prop("disabled", disabled);
    $("#cherry-note-status").css("opacity", 0);

    renderCharName();
    updateCounter();

    if (!$panel.hasClass("cherry-note-hidden")) {
        positionPanelNearIcon();
    }
}

function applyFloatingVisibility(enabled) {
    const $icon = $("#cherry-note-icon");
    const $panel = $("#cherry-note-panel");
    if (enabled) {
        $icon.removeClass("cherry-note-force-hidden");
    } else {
        $icon.addClass("cherry-note-force-hidden");
        $panel.addClass("cherry-note-hidden"); // 아이콘 끄면 패널도 닫아둠
    }
}

function applyAllThemes() {
    const config = getConfig();
    applyIconTheme(config.iconTheme);
    applyPanelTheme(config.panelTheme);
    applyFloatingVisibility(config.floatingEnabled);
}

// ---------- 확장 설정 패널(테마 선택 / 플로팅 on-off) ----------

function buildSettingsPanel() {
    const config = getConfig();

    const iconOptions = ICON_THEMES.map(
        (t) => `<option value="${t.id}" ${t.id === config.iconTheme ? "selected" : ""}>${t.label}</option>`
    ).join("");

    const panelOptions = PANEL_THEMES.map(
        (t) => `<option value="${t.id}" ${t.id === config.panelTheme ? "selected" : ""}>${t.label}</option>`
    ).join("");

    const html = `
    <div class="cherry-note-settings-block">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🍒 Aggressive Notepad</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="cherry-note-settings-inner">
                    <label for="cherry-note-icon-theme-select">플로팅 아이콘 디자인</label>
                    <select id="cherry-note-icon-theme-select" class="text_pole">${iconOptions}</select>

                    <label for="cherry-note-panel-theme-select">패널 테마 (저장 버튼 색상 포함)</label>
                    <select id="cherry-note-panel-theme-select" class="text_pole">${panelOptions}</select>
                </div>
            </div>
        </div>
    </div>
    `;

    const $target = $("#extensions_settings2").length ? $("#extensions_settings2") : $("#extensions_settings");
    $target.append(html);

    $("#cherry-note-icon-theme-select").on("change", function () {
        const themeId = $(this).val();
        getConfig().iconTheme = themeId;
        saveConfig();
        applyIconTheme(themeId);
    });

    $("#cherry-note-panel-theme-select").on("change", function () {
        const themeId = $(this).val();
        getConfig().panelTheme = themeId;
        saveConfig();
        applyPanelTheme(themeId);
    });
}

// ---------- 상단 요술봉(확장) 메뉴에 ON/OFF 토글 항목 추가 ----------

function buildExtensionsMenuToggle() {
    const config = getConfig();

    const html = `
    <div id="cherry-note-menu-toggle" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span id="cherry-note-menu-toggle-label">Notepad: ${config.floatingEnabled ? "ON" : "OFF"}</span>
    </div>
    `;

    $("#extensionsMenu").append(html);

    $("#cherry-note-menu-toggle").on("click", () => {
        const cfg = getConfig();
        const enabled = !cfg.floatingEnabled;
        cfg.floatingEnabled = enabled;
        saveConfig();
        applyFloatingVisibility(enabled);
        $("#cherry-note-menu-toggle-label").text(`Notepad: ${enabled ? "ON" : "OFF"}`);
    });
}

// ---------- UI 생성 ----------

function buildUI() {
    const html = `
    <div id="cherry-note-icon" title="Aggressive Notepad">🍒</div>
    <div id="cherry-note-panel" class="cherry-note-hidden"></div>
    `;
    $("body").append(html);

    const $icon = $("#cherry-note-icon");
    const $panel = $("#cherry-note-panel");

    restorePosition($icon, "cherry-note-icon-pos");

    function togglePanel() {
        $panel.toggleClass("cherry-note-hidden");
        if (!$panel.hasClass("cherry-note-hidden")) {
            positionPanelNearIcon();
        }
    }

    makeDraggable($icon, "cherry-note-icon-pos", togglePanel);

    // 패널 내부는 테마 바뀔 때마다 새로 그려지므로 이벤트는 위임으로 연결
    $panel.on("click", ".cn-close", () => {
        $panel.addClass("cherry-note-hidden");
    });

    $panel.on("click", ".cn-expand", () => {
        $panel.toggleClass("cn-expanded");
        positionPanelNearIcon();
    });

    $panel.on("input", "#cherry-note-textarea", () => {
        updateCounter();
        scheduleAutoSave();
    });

    $panel.on("click", "#cherry-note-save-btn", () => {
        doSave(true);
    });

    // 창 크기 변할 때 아이콘/패널이 화면 밖으로 안 나가게
    $(window).on("resize", () => {
        reclampIconToViewport($icon, "cherry-note-icon-pos");
        if (!$panel.hasClass("cherry-note-hidden")) {
            positionPanelNearIcon();
        }
    });

    applyAllThemes();
}

function positionPanelNearIcon() {
    const $icon = $("#cherry-note-icon");
    const $panel = $("#cherry-note-panel");
    const iconRect = $icon[0].getBoundingClientRect();

    const panelW = $panel.outerWidth();
    const panelH = $panel.outerHeight();

    let left = iconRect.left - panelW - 12;
    let top = iconRect.top - panelH + iconRect.height;

    // 왼쪽 공간이 부족하면 아이콘 오른쪽에
    if (left < 8) {
        left = iconRect.left + iconRect.width + 12;
    }
    // 오른쪽으로도 넘치면 화면 안으로 밀어넣기
    if (left + panelW > window.innerWidth - 8) {
        left = window.innerWidth - panelW - 8;
    }
    // 위쪽으로 넘치면 아래로
    if (top < 8) {
        top = 8;
    }
    if (top + panelH > window.innerHeight - 8) {
        top = window.innerHeight - panelH - 8;
    }

    $panel.css({ left: `${left}px`, top: `${top}px` });
}

// ---------- 초기화 ----------

jQuery(async () => {
    buildUI();
    buildSettingsPanel();
    buildExtensionsMenuToggle();
    registerInjectionHooks();

    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadNoteForCurrentCharacter();
    });

    eventSource.on(event_types.APP_READY, () => {
        loadNoteForCurrentCharacter();
    });

    // 페이지 떠날 때 / 앱 전환(모바일) 때 마지막 저장 보장
    window.addEventListener("beforeunload", () => {
        flushPendingSave({ keepalive: true });
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            flushPendingSave({ keepalive: true });
        }
    });

    // 예전 settings.json 메모 -> 파일로 이전 후 최초 로드
    try {
        await migrateLegacyNotes();
    } catch (e) {
        console.error("[Aggressive Notepad] 메모 이전 중 오류:", e);
    }
    loadNoteForCurrentCharacter();
});
