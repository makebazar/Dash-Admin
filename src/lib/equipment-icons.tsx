import type { ComponentType, SVGProps } from "react";
import {
    Box,
    Gamepad,
    Gamepad2,
    Glasses,
    Headphones,
    Keyboard,
    Monitor,
    MousePointer2,
    Square,
    Tv,
    Wrench,
} from "lucide-react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function PcTowerIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
            <path d="M9.5 7h5" />
            <circle cx="12" cy="17.5" r="1" />
            <path d="M10 12h4" />
        </svg>
    );
}

function GamingChairIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M9 5a3 3 0 0 1 6 0v4a3 3 0 0 1-6 0V5Z" />
            <path d="M8 13h8a2 2 0 0 1 2 2v1H6v-1a2 2 0 0 1 2-2Z" />
            <path d="M12 16v3.5" />
            <path d="M9 16 7 20" />
            <path d="M15 16 17 20" />
            <path d="M8 20.5h8" />
        </svg>
    );
}

const ICON_MAP: Record<string, IconComponent> = {
    "pc-tower": PcTowerIcon,
    "gaming-chair": GamingChairIcon,
    monitor: Monitor,
    mouse: MousePointer2,
    keyboard: Keyboard,
    headphones: Headphones,
    "gamepad-2": Gamepad2,
    gamepad: Gamepad,
    tv: Tv,
    glasses: Glasses,
    square: Square,
    box: Box,
    wrench: Wrench,
};

const LEGACY_TYPE_ICON_MAP: Record<string, string> = {
    PC: "pc-tower",
    MONITOR: "monitor",
    MOUSE: "mouse",
    KEYBOARD: "keyboard",
    HEADSET: "headphones",
    CONSOLE: "gamepad-2",
    GAMEPAD: "gamepad",
    TV: "tv",
    VR_HEADSET: "glasses",
    MOUSEPAD: "square",
    CHAIR: "gaming-chair",
};

export const EQUIPMENT_ICON_OPTIONS = [
    { value: "pc-tower", label: "Системный блок" },
    { value: "gaming-chair", label: "Игровое кресло" },
    { value: "mouse", label: "Мышь" },
    { value: "keyboard", label: "Клавиатура" },
    { value: "headphones", label: "Наушники" },
    { value: "gamepad-2", label: "Консоль" },
    { value: "gamepad", label: "Геймпад" },
    { value: "tv", label: "ТВ" },
    { value: "glasses", label: "VR" },
    { value: "square", label: "Коврик" },
    { value: "box", label: "Коробка" },
    { value: "wrench", label: "Инструмент" },
];

export function resolveEquipmentIconKey(type?: string | null, typeIcon?: string | null) {
    if (type && LEGACY_TYPE_ICON_MAP[type]) return LEGACY_TYPE_ICON_MAP[type];
    if (typeIcon && ICON_MAP[typeIcon]) return typeIcon;
    return "wrench";
}

export function renderEquipmentIcon(
    type?: string | null,
    typeIcon?: string | null,
    className = "h-4 w-4"
) {
    const iconKey = resolveEquipmentIconKey(type, typeIcon);
    const Icon = ICON_MAP[iconKey] || Wrench;
    return <Icon className={className} />;
}
