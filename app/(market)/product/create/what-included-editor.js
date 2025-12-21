'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useCallback } from 'react'

const WhatIncludedEditor = ({ value, onChange, error, disabled = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    immediatelyRender: false,
    editable: !disabled,
  })

  const setLink = useCallback(() => {
    if (!editor) return
    
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    // cancelled
    if (url === null) {
      return
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) {
    return null
  }

  const buttonBase =
    'p-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200'
  const activeBg = 'bg-gray-200 dark:bg-slate-700'

  return (
    <div
      className={`border rounded-md bg-white dark:bg-slate-900 ${
        error ? 'border-red-500' : 'border-gray-200 dark:border-slate-700'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-slate-800 p-2 flex flex-wrap gap-1 bg-gray-50 dark:bg-slate-900/70 rounded-t-md">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run() || disabled}
          className={`${buttonBase} ${
            editor.isActive('bold') ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Bold size={16} />
        </button>
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run() || disabled}
          className={`${buttonBase} ${
            editor.isActive('italic') ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Italic size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1 self-center" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${buttonBase} ${
            editor.isActive('bulletList') ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <List size={16} />
        </button>
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${buttonBase} ${
            editor.isActive('orderedList') ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <ListOrdered size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1 self-center" />

        <button
          type="button"
          onClick={setLink}
          className={`${buttonBase} ${
            editor.isActive('link') ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <LinkIcon size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-slate-700 mx-1 self-center" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`${buttonBase} ${
            editor.isActive({ textAlign: 'left' }) ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <AlignLeft size={16} />
        </button>
        
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`${buttonBase} ${
            editor.isActive({ textAlign: 'center' }) ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <AlignCenter size={16} />
        </button>
        
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`${buttonBase} ${
            editor.isActive({ textAlign: 'right' }) ? activeBg : ''
          } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
    </div>
  )
}

export default WhatIncludedEditor