/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Jalolek and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { migratePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, Menu, React } from "@webpack/common";
import type { MouseEvent, ReactElement } from "react";

import { FlagImage, getSelectedLanguages, settings } from "./settings";

migratePluginSettings("TTS Advanced", "TtsAdvanced", "SpeakMessageLanguages");

const SPEAK_IDS = ["speak-message", "speak-message-item", "message-speak"] as const;

/** Discord DeviceSettingsStore for Speak Message / TTS rate. */
const TtsStore = findByPropsLazy("speechRate", "currentMessage");

let currentUtterance: SpeechSynthesisUtterance | null = null;

function getMessageContent(message: Message) {
    return message.content
        || message.messageSnapshots?.[0]?.message.content
        || message.embeds?.find(embed => embed.type === "auto_moderation_message")?.rawDescription
        || "";
}

function getDiscordSpeechRate() {
    try {
        const rate = TtsStore?.speechRate;
        if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) return rate;
    } catch { /* module missing */ }
    return 1;
}

function getVoiceForLang(lang: string) {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    if (!voices.length) return undefined;

    const exact = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;

    const prefix = lang.split("-")[0].toLowerCase();
    return voices.find(v => v.lang.toLowerCase().startsWith(prefix + "-"))
        ?? voices.find(v => v.lang.toLowerCase().startsWith(prefix));
}

function speakInLanguage(text: string, lang?: string, message?: Message) {
    if (!text || typeof window.speechSynthesis === "undefined") return;

    window.speechSynthesis.cancel();

    // Notify Discord that we're speaking a message
    if (message) {
        FluxDispatcher.dispatch({
            type: "SPEAKING_MESSAGE",
            messageId: message.id,
            channelId: message.channel_id
        });
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = getDiscordSpeechRate();

    if (lang) {
        utterance.lang = lang;
        const voice = getVoiceForLang(lang);
        if (voice) utterance.voice = voice;
    }

    // Notify Discord when speech finishes
    utterance.onend = () => {
        FluxDispatcher.dispatch({ type: "STOP_SPEAKING" });
        currentUtterance = null;
    };

    utterance.onerror = () => {
        FluxDispatcher.dispatch({ type: "STOP_SPEAKING" });
        currentUtterance = null;
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
    if (currentUtterance) {
        window.speechSynthesis.cancel();
        FluxDispatcher.dispatch({ type: "STOP_SPEAKING" });
        currentUtterance = null;
    }
}

function labelText(label: unknown): string {
    return typeof label === "string" ? label : "";
}

function isStopSpeakingItem(item: ReactElement<any> | null | undefined) {
    const id = item?.props?.id;
    if (typeof id === "string" && id.includes("stop")) return true;

    const label = labelText(item?.props?.label);
    return /stop\s*speak/i.test(label);
}

function isSpeakMessageItem(item: ReactElement<any> | null | undefined) {
    if (!item?.props || isStopSpeakingItem(item)) return false;

    const id = item.props.id;
    if (typeof id === "string") {
        if (SPEAK_IDS.includes(id as typeof SPEAK_IDS[number])) return true;
        if (id.includes("speak") && !id.includes("stop")) return true;
    }

    return /^speak(\s+message)?$/i.test(labelText(item.props.label));
}

function findSpeakMessageSlot(children: Array<ReactElement<any> | null>) {
    for (const id of SPEAK_IDS) {
        const group = findGroupChildrenByChildId(id, children);
        if (!group) continue;
        const idx = group.findIndex(c => c?.props?.id === id);
        if (idx !== -1 && !isStopSpeakingItem(group[idx])) return { group, idx };
    }

    const fuzzyGroup = findGroupChildrenByChildId("speak", children, true);
    if (fuzzyGroup) {
        const idx = fuzzyGroup.findIndex(isSpeakMessageItem);
        if (idx !== -1) return { group: fuzzyGroup, idx };
    }

    const walk = (nodes: Array<ReactElement<any> | null | undefined>): { group: Array<ReactElement<any> | null | undefined>; idx: number; } | null => {
        for (const node of nodes) {
            if (node == null) continue;

            if (Array.isArray(node)) {
                const found = walk(node);
                if (found) return found;
            }

            if (isSpeakMessageItem(node)) {
                return { group: nodes, idx: nodes.indexOf(node) };
            }

            let next = node.props?.children;
            if (!next) continue;
            if (!Array.isArray(next)) {
                next = [next];
                node.props.children = next;
            }
            const found = walk(next);
            if (found) return found;
        }
        return null;
    };

    return walk(children);
}

function makeSpeakMenuItem(original: ReactElement<any>, message: Message) {
    const langs = getSelectedLanguages();
    const content = getMessageContent(message);
    const originalAction = original.props.action as ((e: MouseEvent) => void) | undefined;

    const runDefault = (e?: MouseEvent) => {
        // Check if we're currently speaking - if so, stop instead of starting
        if (window.speechSynthesis?.speaking || currentUtterance) {
            stopSpeech();
            return;
        }

        if (originalAction) {
            originalAction((e ?? { preventDefault() { }, stopPropagation() { } }) as MouseEvent);
            return;
        }
        if (content) speakInLanguage(content, undefined, message);
    };

    if (!langs.length) {
        return React.cloneElement(original, {
            action: runDefault,
        });
    }

    return (
        <Menu.MenuItem
            id={original.props.id ?? "speak-message"}
            key={original.key ?? original.props.id ?? "speak-message"}
            label={original.props.label ?? "Speak Message"}
            icon={original.props.icon}
            leadingAccessory={original.props.leadingAccessory}
            action={runDefault}
        >
            {langs.map(lang => (
                <Menu.MenuItem
                    id={`vc-speak-lang-${lang.code}`}
                    key={`vc-speak-lang-${lang.code}`}
                    label={
                        <Flex alignItems="center" gap="0.5em">
                            <FlagImage langCode={lang.code} size={16} />
                            {lang.label}
                        </Flex>
                    }
                    action={() => {
                        if (!content) {
                            runDefault();
                            return;
                        }
                        speakInLanguage(content, lang.code, message);
                    }}
                />
            ))}
        </Menu.MenuItem>
    );
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const message = props?.message as Message | undefined;
    if (!message) return;

    const slot = findSpeakMessageSlot(children);
    if (!slot) return;

    const { group, idx } = slot;
    const original = group[idx];
    if (!original) return;

    group[idx] = makeSpeakMenuItem(original, message);
};

export default definePlugin({
    name: "TTS Advanced",
    description: "Speak Message language submenu",
    authors: [{ name: "Jalolek", id: 1156907087431991306n }],
    tags: ["Accessibility", "TTS"],
    settings,

    contextMenus: {
        message: messageContextMenuPatch,
    },
});
