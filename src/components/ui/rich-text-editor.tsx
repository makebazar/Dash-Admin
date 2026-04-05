"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import React, { useCallback, useEffect, useState } from "react";
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Code,
    Image as ImageIcon,
    Link as LinkIcon,
    Underline as UnderlineIcon,
    Strikethrough,
    Highlighter,
    Heading1,
    Heading2,
    Heading3,
    Pilcrow,
    Minus,
    Unlink,
    Code2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify
} from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
    value: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
    compactToolbar?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, className, compactToolbar = false }: RichTextEditorProps) {
    const [mounted, setMounted] = useState(false);
    const textPalette = ["#0f172a", "#334155", "#2563eb", "#16a34a", "#ca8a04", "#dc2626", "#9333ea"];
    const highlightPalette = ["#fef08a", "#bfdbfe", "#bbf7d0", "#fecaca", "#e9d5ff", "#fed7aa"];

    useEffect(() => {
        setMounted(true);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] }
            }),
            Underline,
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({
                types: ["heading", "paragraph"]
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-indigo-600 underline cursor-pointer"
                }
            }),
            Image.configure({
                HTMLAttributes: {
                    class: "rounded-lg max-w-full h-auto my-4"
                }
            }),
            Placeholder.configure({
                placeholder: placeholder || "Введите текст..."
            })
        ],
        content: value || "<p></p>",
        onUpdate: ({ editor: currentEditor }) => {
            onChange(currentEditor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose prose-slate max-w-none focus:outline-none min-h-[500px] py-4"
            }
        },
        immediatelyRender: false
    });

    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (value !== current) {
            editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
        }
    }, [editor, value]);

    const addImage = useCallback(() => {
        if (!editor) return;
        const input = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("accept", "image/*");
        input.click();

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.append("file", file);
            try {
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                const data = await res.json();
                if (data.url) {
                    editor.chain().focus().setImage({ src: data.url }).run();
                }
            } catch (error) {
                console.error("Image upload failed:", error);
            }
        };
    }, [editor]);

    const setLink = useCallback(() => {
        if (!editor) return;
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Введите URL", prev || "https://");
        if (url === null) return;
        const normalized = url.trim();
        if (!normalized) {
            editor.chain().focus().unsetLink().run();
            return;
        }
        editor.chain().focus().setLink({ href: normalized }).run();
    }, [editor]);

    const setTextColor = useCallback((color: string) => {
        if (!editor) return;
        editor.chain().focus().setColor(color).run();
    }, [editor]);

    const setHighlightColor = useCallback((color: string) => {
        if (!editor) return;
        editor.chain().focus().setHighlight({ color }).run();
    }, [editor]);

    if (!mounted || !editor) {
        return <div className="h-[520px] w-full bg-slate-50 animate-pulse rounded-md" />;
    }

    return (
        <div className={cn("relative w-full", className)}>
            <div
                className={cn(
                    "sticky top-0 z-20 mb-4 rounded-lg border bg-white/95 backdrop-blur",
                    compactToolbar ? "px-2 py-2" : "p-2"
                )}
            >
                <div
                    className={cn(
                        "flex items-center gap-1",
                        compactToolbar
                            ? "flex-nowrap overflow-x-auto whitespace-nowrap scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]"
                            : "flex-wrap"
                    )}
                >
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setParagraph().run()} className={cn("h-8 w-8 p-0", editor.isActive("paragraph") && "bg-slate-100")} title="Текст"><Pilcrow className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn("h-8 w-8 p-0", editor.isActive("heading", { level: 1 }) && "bg-slate-100")} title="H1"><Heading1 className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("h-8 w-8 p-0", editor.isActive("heading", { level: 2 }) && "bg-slate-100")} title="H2"><Heading2 className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn("h-8 w-8 p-0", editor.isActive("heading", { level: 3 }) && "bg-slate-100")} title="H3"><Heading3 className="h-4 w-4" /></Button>
                    <div className="mx-1 h-5 w-px bg-slate-200" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-slate-100")} title="Жирный"><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-slate-100")} title="Курсив"><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-slate-100")} title="Подчеркнутый"><UnderlineIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} className={cn("h-8 w-8 p-0", editor.isActive("strike") && "bg-slate-100")} title="Зачеркнутый"><Strikethrough className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleCode().run()} className={cn("h-8 w-8 p-0", editor.isActive("code") && "bg-slate-100")} title="Inline code"><Code className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHighlight().run()} className={cn("h-8 w-8 p-0", editor.isActive("highlight") && "bg-slate-100")} title="Выделение"><Highlighter className="h-4 w-4" /></Button>
                    <div className="flex items-center gap-1 px-1">
                        {textPalette.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={cn(
                                    "h-5 w-5 rounded-full border border-slate-300",
                                    editor.isActive("textStyle", { color }) && "ring-2 ring-indigo-500 ring-offset-1"
                                )}
                                style={{ backgroundColor: color }}
                                title="Цвет текста"
                                onClick={() => setTextColor(color)}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-1 px-1">
                        {highlightPalette.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={cn(
                                    "h-5 w-5 rounded-full border border-slate-300",
                                    editor.isActive("highlight", { color }) && "ring-2 ring-indigo-500 ring-offset-1"
                                )}
                                style={{ backgroundColor: color }}
                                title="Цвет выделения"
                                onClick={() => setHighlightColor(color)}
                            />
                        ))}
                    </div>
                    <div className="mx-1 h-5 w-px bg-slate-200" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "left" }) && "bg-slate-100")} title="Выровнять влево"><AlignLeft className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "center" }) && "bg-slate-100")} title="Выровнять по центру"><AlignCenter className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "right" }) && "bg-slate-100")} title="Выровнять вправо"><AlignRight className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign("justify").run()} className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "justify" }) && "bg-slate-100")} title="Выровнять по ширине"><AlignJustify className="h-4 w-4" /></Button>
                    <div className="mx-1 h-5 w-px bg-slate-200" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-slate-100")} title="Маркированный список"><List className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-slate-100")} title="Нумерованный список"><ListOrdered className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn("h-8 w-8 p-0", editor.isActive("blockquote") && "bg-slate-100")} title="Цитата"><Quote className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={cn("h-8 w-8 p-0", editor.isActive("codeBlock") && "bg-slate-100")} title="Блок кода"><Code2 className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="h-8 w-8 p-0" title="Разделитель"><Minus className="h-4 w-4" /></Button>
                    <div className="mx-1 h-5 w-px bg-slate-200" />
                    <Button type="button" variant="ghost" size="sm" onClick={setLink} className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-slate-100")} title="Ссылка"><LinkIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().unsetLink().run()} className="h-8 w-8 p-0" title="Убрать ссылку"><Unlink className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={addImage} className="h-8 w-8 p-0" title="Изображение"><ImageIcon className="h-4 w-4" /></Button>
                    <div className={cn("flex items-center gap-1", compactToolbar ? "pl-1" : "ml-auto")}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()} className="h-8 w-8 p-0" title="Отменить"><Undo className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()} className="h-8 w-8 p-0" title="Повторить"><Redo className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            <FloatingMenu editor={editor} options={{ placement: "left-start", strategy: "fixed" }}>
                <div className="flex items-center gap-1 rounded-lg border bg-white shadow-lg p-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("h-8 w-8 p-0", editor.isActive("heading", { level: 2 }) && "bg-slate-100")}><Heading2 className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-slate-100")}><List className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-slate-100")}><ListOrdered className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={addImage} className="h-8 w-8 p-0"><ImageIcon className="h-4 w-4" /></Button>
                </div>
            </FloatingMenu>

            <BubbleMenu editor={editor} options={{ placement: "top", strategy: "fixed" }}>
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-900 text-white shadow-2xl p-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("h-7 w-7 p-0 text-white hover:bg-slate-800 hover:text-white", editor.isActive("bold") && "bg-slate-700")}><Bold className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("h-7 w-7 p-0 text-white hover:bg-slate-800 hover:text-white", editor.isActive("italic") && "bg-slate-700")}><Italic className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn("h-7 w-7 p-0 text-white hover:bg-slate-800 hover:text-white", editor.isActive("underline") && "bg-slate-700")}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} className={cn("h-7 w-7 p-0 text-white hover:bg-slate-800 hover:text-white", editor.isActive("strike") && "bg-slate-700")}><Strikethrough className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={setLink} className={cn("h-7 w-7 p-0 text-white hover:bg-slate-800 hover:text-white", editor.isActive("link") && "bg-slate-700")}><LinkIcon className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHighlight().run()} className={cn("h-7 w-7 p-0 text-white hover:bg-slate-800 hover:text-white", editor.isActive("highlight") && "bg-slate-700")}><Highlighter className="h-3.5 w-3.5" /></Button>
                </div>
            </BubbleMenu>

            <div className={cn("rounded-lg border bg-white", compactToolbar ? "px-4 md:px-6" : "px-6")}>
                <EditorContent editor={editor} />
            </div>

            <style jsx global>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #cbd5e1;
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror {
                    min-height: 500px;
                }
                .ProseMirror img {
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                    transition: all 0.2s;
                    cursor: default;
                }
                .ProseMirror img.ProseMirror-selectednode {
                    outline: 3px solid #6366f1;
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
                }
            `}</style>
        </div>
    );
}
