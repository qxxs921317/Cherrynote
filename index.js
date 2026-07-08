import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const EXT_NAME = "cherry-note-extension"; // 저장 데이터 호환을 위해 내부 키는 유지 (표시 이름만 Aggressive Notepad로 변경)
const SAVE_DELAY_MS = 1000;
const NOTE_TAG = "system_override_note";

let saveTimer = null;
let currentAvatar = null; // 현재 메모가 속한 캐릭터의 아바타 파일명
let isDirty = false;
let currentNoteBlock = ""; // <system_override_note>로 감싼, 주입 준비된 텍스트

// ---------- 저장소 헬퍼 ----------

function getNotesStore() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = {};
    }
    if (!extension_settings[EXT_NAME].notes) {
        extension_settings[EXT_NAME].notes = {};
    }
    return extension_settings[EXT_NAME].notes;
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
function onChatCompletionPromptReady(eventData) {
    try {
        if (!eventData || eventData.dryRun) return;
        if (!isInjectionAllowed()) return;
        if (!Array.isArray(eventData.chat)) return;

        eventData.chat.push({ role: "system", content: currentNoteBlock });
        console.log(`[Aggressive Notepad] chat-completion 맨 끝에 주입됨 (len=${currentNoteBlock.length})`);
    } catch (e) {
        console.error("[Aggressive Notepad] chat-completion 주입 실패:", e);
    }
}

// Text Completion (KoboldAI, 로컬 모델, 텍스트 완성형 API 연결)
function onTextCompletionPromptReady(eventData) {
    try {
        if (!eventData) return;
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

function doSave(showFeedback = true) {
    // 저장 시점에 캐릭터가 바뀌어있진 않은지 다시 한번 확인
    const avatarNow = getCurrentAvatar();
    if (!avatarNow || avatarNow !== currentAvatar) {
        // 캐릭터가 이미 전환된 상태 -> 엉뚱한 캐릭터에 덮어쓰는 것을 방지하고 저장 취소
        isDirty = false;
        return;
    }

    const text = $("#cherry-note-textarea").val();
    const notes = getNotesStore();
    notes[avatarNow] = text;
    saveSettingsDebounced();
    updateNoteBlock(text);
    isDirty = false;

    if (showFeedback) {
        showSavedFeedback();
    }
}

function scheduleAutoSave() {
    isDirty = true;
    if (saveTimer) {
        clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
        saveTimer = null;
        doSave(true);
    }, SAVE_DELAY_MS);
}

function flushPendingSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (isDirty) {
        doSave(false);
    }
}

function showSavedFeedback() {
    const $status = $("#cherry-note-status");
    $status.stop(true, true).text("저장됨 ✓").css("opacity", 1);
    $status.delay(1000).animate({ opacity: 0 }, 400);
}

// ---------- 캐릭터/챗 전환 시 메모 불러오기 ----------

function loadNoteForCurrentCharacter() {
    // 이전 캐릭터의 대기중인 저장을 먼저 확정
    flushPendingSave();

    const avatar = getCurrentAvatar();
    currentAvatar = avatar;

    const isGroup = avatar === null && !!getContext().groupId;
    const notes = getNotesStore();
    const text = avatar ? (notes[avatar] || "") : "";

    $("#cherry-note-textarea").val(text);
    setGroupChatState(isGroup);

    const nameEl = $("#cherry-note-char-name");
    if (isGroup) {
        nameEl.text("그룹챗은 지원되지 않아요");
    } else {
        const context = getContext();
        const character = context.characters?.[context.characterId];
        nameEl.text(character?.name ? `📝 ${character.name}` : "캐릭터를 선택해주세요");
    }

    updateNoteBlock(isGroup ? "" : text);
}

function setGroupChatState(isGroup) {
    $("#cherry-note-textarea").prop("disabled", isGroup);
    $("#cherry-note-save-btn").prop("disabled", isGroup);
    $("#cherry-note-panel").toggleClass("cherry-note-disabled", isGroup);
}

// ---------- 드래그 가능한 플로팅 아이콘 ----------

function makeDraggable($el, storageKey) {
    let isDragging = false;
    let didDrag = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

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
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;

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
        const rect = $el[0].getBoundingClientRect();
        localStorage.setItem(storageKey, JSON.stringify({ x: rect.left, y: rect.top }));
    }

    $el.on("mousedown touchstart", onPointerDown);
    $(document).on("mousemove touchmove", onPointerMove);
    $(document).on("mouseup touchend", onPointerUp);

    // 클릭과 드래그 구분해서 반환 (드래그 직후엔 클릭 무시)
    return () => didDrag;
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

// ---------- UI 생성 ----------

function buildUI() {
    const html = `
    <div id="cherry-note-icon" title="Aggressive Notepad">🍒</div>
    <div id="cherry-note-panel" class="cherry-note-hidden">
        <div id="cherry-note-header">
            <span id="cherry-note-char-name">📝</span>
            <span id="cherry-note-close">✕</span>
        </div>
        <textarea id="cherry-note-textarea" placeholder="여기 적으면 진짜 맨 끝에 강제로 박아넣어요..."></textarea>
        <div id="cherry-note-footer">
            <span id="cherry-note-status"></span>
            <button id="cherry-note-save-btn">저장하기 💾</button>
        </div>
    </div>
    `;
    $("body").append(html);

    const $icon = $("#cherry-note-icon");
    const $panel = $("#cherry-note-panel");

    restorePosition($icon, "cherry-note-icon-pos");

    const wasDragged = makeDraggable($icon, "cherry-note-icon-pos");

    $icon.on("click", () => {
        if (wasDragged()) return; // 드래그 끝난 직후 클릭 이벤트 무시
        $panel.toggleClass("cherry-note-hidden");
        if (!$panel.hasClass("cherry-note-hidden")) {
            positionPanelNearIcon();
        }
    });

    $("#cherry-note-close").on("click", () => {
        $panel.addClass("cherry-note-hidden");
    });

    $("#cherry-note-textarea").on("input", () => {
        scheduleAutoSave();
    });

    $("#cherry-note-save-btn").on("click", () => {
        doSave(true);
    });

    // 창 크기 변할 때 아이콘/패널이 화면 밖으로 안 나가게
    $(window).on("resize", () => {
        reclampIconToViewport($icon, "cherry-note-icon-pos");
        if (!$panel.hasClass("cherry-note-hidden")) {
            positionPanelNearIcon();
        }
    });
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
    registerInjectionHooks();

    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadNoteForCurrentCharacter();
    });

    eventSource.on(event_types.APP_READY, () => {
        loadNoteForCurrentCharacter();
    });

    // 페이지 떠날 때 마지막 저장 보장
    window.addEventListener("beforeunload", () => {
        flushPendingSave();
    });

    // 최초 로드 시점
    loadNoteForCurrentCharacter();
});
