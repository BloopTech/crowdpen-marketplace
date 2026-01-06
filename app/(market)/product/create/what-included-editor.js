"use client";

import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

const WhatIncludedEditor = ({ value, onChange, error, disabled = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    immediatelyRender: false,
    editable: !disabled,
  });

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState("");

  const openLinkModal = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    setLinkValue(previousUrl || "");
    setLinkError("");
    setIsLinkModalOpen(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const trimmed = linkValue.trim();
    if (!trimmed) {
      setLinkError("Please enter a link.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setLinkError("Link must start with https://");
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();
    setIsLinkModalOpen(false);
  }, [editor, linkValue]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkModalOpen(false);
  }, [editor]);

  if (!editor) {
    return null;
  }

  const buttonBase =
    "p-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200";
  const activeBg = "bg-gray-200 dark:bg-slate-700";

  return (
    <div
      className={`border rounded-md bg-white dark:bg-slate-900 ${
        error ? "border-red-500" : "border-gray-200 dark:border-slate-700"
      } ${disabled ? "opacity-50" : ""}`}
    >
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-slate-800 p-2 flex flex-wrap gap-1 bg-gray-50 dark:bg-slate-900/70 rounded-t-md">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={
            !editor.can().chain().focus().toggleBold().run() || disabled
          }
          className={`${buttonBase} ${
            editor.isActive("bold") ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <Bold size={16} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={
            !editor.can().chain().focus().toggleItalic().run() || disabled
          }
          className={`${buttonBase} ${
            editor.isActive("italic") ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <Italic size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1 self-center" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${buttonBase} ${
            editor.isActive("bulletList") ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={disabled}
        >
          <List size={16} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${buttonBase} ${
            editor.isActive("orderedList") ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={disabled}
        >
          <ListOrdered size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1 self-center" />

        <button
          type="button"
          onClick={openLinkModal}
          className={`${buttonBase} ${
            editor.isActive("link") ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={disabled}
        >
          <LinkIcon size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1 self-center" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`${buttonBase} ${
            editor.isActive({ textAlign: "left" }) ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={disabled}
        >
          <AlignLeft size={16} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`${buttonBase} ${
            editor.isActive({ textAlign: "center" }) ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={disabled}
        >
          <AlignCenter size={16} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`${buttonBase} ${
            editor.isActive({ textAlign: "right" }) ? activeBg : ""
          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          disabled={disabled}
        >
          <AlignRight size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <div className="p-4 min-h-[120px] bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-b-md">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none focus-within:outline-none text-gray-900 dark:text-slate-100 [&_.ProseMirror]:outline-none [&_.ProseMirror]:m-0 [&_.ProseMirror]:p-0 [&_.ProseMirror]:border-none [&_.ProseMirror]:min-h-[80px]"
        />
      </div>

      <Dialog
        open={isLinkModalOpen}
        onOpenChange={(open) => {
          setIsLinkModalOpen(open);
          if (!open) {
            setLinkValue("");
            setLinkError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
            <DialogDescription>
              Provide a full URL starting with https://
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-foreground">URL</label>
            <Input
              autoFocus
              type="url"
              placeholder="https://websitelink.com"
              value={linkValue}
              onChange={(e) => {
                setLinkValue(e.target.value);
                if (linkError) setLinkError("");
              }}
            />
            {linkError ? (
              <p className="text-xs text-red-500">{linkError}</p>
            ) : null}
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
              >
                Cancel
              </Button>
              {editor?.isActive("link") ? (
                <Button type="button" variant="outline" onClick={removeLink}>
                  Remove link
                </Button>
              ) : null}
            </div>
            <Button type="button" onClick={applyLink}>
              Save link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatIncludedEditor;
