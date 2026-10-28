'use client';

import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { cn } from '@/lib/utils';

import { PROSE_CLASSES } from '../prose';
import { isSafeHref, type RichTextDoc } from '../rich-text';

type Props = {
  id: string;
  /** id of the visible <label>-like element naming this editor */
  labelId: string;
  initialContent: RichTextDoc | null;
  /** Receives Tiptap JSON, or null when the document is empty. Validated server-side. */
  onChange: (value: JSONContent | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string | undefined;
};

/**
 * Tiptap editor limited to the nodes the reader can render (see rich-text.ts):
 * no code blocks, no images, only H2/H3 (the article title is the H1).
 */
export function RichTextEditor({ id, labelId, initialContent, onChange, onBlur, invalid = false, describedBy }: Props) {
  const t = useTranslations('admin.editor');

  const editor = useEditor({
    immediatelyRender: false, // SSR-safe: render the editor only on the client
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          protocols: ['http', 'https', 'mailto'],
          isAllowedUri: (url) => isSafeHref(url),
        },
      }),
      Placeholder.configure({ placeholder: t('placeholder') }),
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        class: cn(PROSE_CLASSES, 'min-h-72 px-4 py-3 outline-none'),
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? null : current.getJSON()),
    onBlur: () => onBlur?.(),
  });

  // Keep ARIA state in sync after mount (editorProps.attributes are applied once).
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    dom.setAttribute('aria-invalid', String(invalid));
    if (describedBy) dom.setAttribute('aria-describedby', describedBy);
    else dom.removeAttribute('aria-describedby');
  }, [editor, invalid, describedBy]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-input bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
        invalid && 'border-destructive',
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const t = useTranslations('admin.editor');

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            underline: current.isActive('underline'),
            strike: current.isActive('strike'),
            h2: current.isActive('heading', { level: 2 }),
            h3: current.isActive('heading', { level: 3 }),
            bulletList: current.isActive('bulletList'),
            orderedList: current.isActive('orderedList'),
            blockquote: current.isActive('blockquote'),
            link: current.isActive('link'),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  });

  if (!editor || !state) return <div className="h-11 border-b bg-muted/50" aria-hidden />;

  const chain = () => editor.chain().focus();

  const editLink = () => {
    const current: unknown = editor.getAttributes('link').href;
    const input = window.prompt(t('linkPrompt'), typeof current === 'string' ? current : 'https://');
    if (input === null) return;
    const href = input.trim();
    if (href === '') {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!isSafeHref(href)) {
      window.alert(t('linkInvalid'));
      return;
    }
    chain().extendMarkRange('link').setLink({ href }).run();
  };

  const groups: { label: string; icon: LucideIcon; active?: boolean; disabled?: boolean; run: () => void }[][] = [
    [
      { label: t('bold'), icon: Bold, active: state.bold, run: () => chain().toggleBold().run() },
      { label: t('italic'), icon: Italic, active: state.italic, run: () => chain().toggleItalic().run() },
      { label: t('underline'), icon: Underline, active: state.underline, run: () => chain().toggleUnderline().run() },
      { label: t('strike'), icon: Strikethrough, active: state.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { label: t('heading2'), icon: Heading2, active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { label: t('heading3'), icon: Heading3, active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { label: t('bulletList'), icon: List, active: state.bulletList, run: () => chain().toggleBulletList().run() },
      { label: t('orderedList'), icon: ListOrdered, active: state.orderedList, run: () => chain().toggleOrderedList().run() },
      { label: t('blockquote'), icon: Quote, active: state.blockquote, run: () => chain().toggleBlockquote().run() },
      { label: t('horizontalRule'), icon: Minus, run: () => chain().setHorizontalRule().run() },
      { label: t('link'), icon: Link2, active: state.link, run: editLink },
    ],
    [
      { label: t('undo'), icon: Undo2, disabled: !state.canUndo, run: () => chain().undo().run() },
      { label: t('redo'), icon: Redo2, disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ];

  return (
    <div role="toolbar" aria-label={t('toolbar')} className="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-1.5">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 border-r pr-1 last:border-r-0">
          {group.map(({ label, icon: Icon, active, disabled, run }) => (
            <button
              key={label}
              type="button"
              onClick={run}
              disabled={disabled}
              title={label}
              aria-label={label}
              aria-pressed={active === undefined ? undefined : active}
              className={cn(
                'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40',
                active && 'bg-card text-primary shadow-xs',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
