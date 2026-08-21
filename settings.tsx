/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Jalolek and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Forms, SearchableSelect } from "@webpack/common";

const UnicodeEmojiUrls = findByPropsLazy("getURL", "filterUnsupportedEmojis");

/** Discord Twemoji flag surrogates for each TTS language. */
export const LANG_FLAGS: Record<string, string> = {
    "en-US": "🇺🇸",
    "en-GB": "🇬🇧",
    "pl-PL": "🇵🇱",
    "de-DE": "🇩🇪",
    "fr-FR": "🇫🇷",
    "es-ES": "🇪🇸",
    "it-IT": "🇮🇹",
    "pt-BR": "🇧🇷",
    "pt-PT": "🇵🇹",
    "nl-NL": "🇳🇱",
    "ru-RU": "🇷🇺",
    "uk-UA": "🇺🇦",
    "cs-CZ": "🇨🇿",
    "sk-SK": "🇸🇰",
    "sv-SE": "🇸🇪",
    "nb-NO": "🇳🇴",
    "da-DK": "🇩🇰",
    "fi-FI": "🇫🇮",
    "ja-JP": "🇯🇵",
    "ko-KR": "🇰🇷",
    "zh-CN": "🇨🇳",
    "zh-TW": "🇹🇼",
    "ar-SA": "🇸🇦",
    "tr-TR": "🇹🇷",
    "hi-IN": "🇮🇳",
};

export function getFlagUrl(langCode: string): string {
    const emoji = LANG_FLAGS[langCode];
    if (!emoji) return "";
    try {
        return UnicodeEmojiUrls.getURL(emoji) || "";
    } catch {
        return "";
    }
}

export function FlagImage({ langCode, size = 16 }: { langCode: string; size?: number; }) {
    const src = getFlagUrl(langCode);
    const emoji = LANG_FLAGS[langCode];
    if (src) {
        return (
            <img
                src={src}
                alt=""
                aria-hidden="true"
                width={size}
                height={size}
                style={{ display: "block", objectFit: "contain" }}
            />
        );
    }
    if (emoji) {
        return <span style={{ fontSize: size - 2, lineHeight: 1 }}>{emoji}</span>;
    }
    return null;
}

export const LANGUAGE_OPTIONS = [
    { label: "English (US)", value: "en-US" },
    { label: "English (UK)", value: "en-GB" },
    { label: "Polish", value: "pl-PL" },
    { label: "German", value: "de-DE" },
    { label: "French", value: "fr-FR" },
    { label: "Spanish", value: "es-ES" },
    { label: "Italian", value: "it-IT" },
    { label: "Portuguese (BR)", value: "pt-BR" },
    { label: "Portuguese (PT)", value: "pt-PT" },
    { label: "Dutch", value: "nl-NL" },
    { label: "Russian", value: "ru-RU" },
    { label: "Ukrainian", value: "uk-UA" },
    { label: "Czech", value: "cs-CZ" },
    { label: "Slovak", value: "sk-SK" },
    { label: "Swedish", value: "sv-SE" },
    { label: "Norwegian", value: "nb-NO" },
    { label: "Danish", value: "da-DK" },
    { label: "Finnish", value: "fi-FI" },
    { label: "Japanese", value: "ja-JP" },
    { label: "Korean", value: "ko-KR" },
    { label: "Chinese (Simplified)", value: "zh-CN" },
    { label: "Chinese (Traditional)", value: "zh-TW" },
    { label: "Arabic", value: "ar-SA" },
    { label: "Turkish", value: "tr-TR" },
    { label: "Hindi", value: "hi-IN" },
] as const;

export type LanguageCode = typeof LANGUAGE_OPTIONS[number]["value"];

function normalizeLanguages(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string" && v.length > 0);
    }

    if (typeof value === "string" && value.trim()) {
        return value.split(",").map(part => {
            const trimmed = part.trim();
            const colon = trimmed.lastIndexOf(":");
            return colon > 0 ? trimmed.slice(colon + 1).trim() : trimmed;
        }).filter(Boolean);
    }

    return ["en-US", "pl-PL"];
}

export function getSelectedLanguages() {
    const codes = normalizeLanguages(settings.store.languages);
    return codes.map(code => ({
        code,
        label: LANGUAGE_OPTIONS.find(o => o.value === code)?.label ?? code,
        flag: LANG_FLAGS[code] ?? "",
    }));
}

function LanguagesDropdown() {
    const { languages } = settings.use(["languages"]);
    const value = normalizeLanguages(languages);

    return (
        <section>
            <Forms.FormTitle>Languages</Forms.FormTitle>
            <SearchableSelect
                multi
                options={[...LANGUAGE_OPTIONS]}
                value={value}
                placeholder="Select languages"
                maxVisibleItems={8}
                closeOnSelect={false}
                renderOptionPrefix={opt => <FlagImage langCode={String(opt.value)} size={18} />}
                onChange={v => {
                    settings.store.languages = Array.isArray(v) ? v : [v];
                }}
            />
        </section>
    );
}

export const settings = definePluginSettings({
    languages: {
        type: OptionType.COMPONENT,
        component: LanguagesDropdown,
        default: ["en-US", "pl-PL"] as string[],
    },
});
