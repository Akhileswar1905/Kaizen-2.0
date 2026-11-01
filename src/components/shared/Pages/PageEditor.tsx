import { useEffect, useRef, useState } from "react"
import {
  EditorContent,
  useEditor,
  useEditorState,
  type ChainedCommands,
  type Editor,
} from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TableKit } from "@tiptap/extension-table"
import Highlight from "@tiptap/extension-highlight"
import Placeholder from "@tiptap/extension-placeholder"
import {
  Bold,
  Code,
  Code2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Rows3,
  Strikethrough,
  Table,
  TextQuote,
  Trash2,
  Underline as UnderlineIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { resolveIcon } from "@/lib/workspace"
import { PAGE_TEMPLATES } from "@/lib/pageTemplates"

type Block = {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  keywords: string
  run: (chain: ChainedCommands) => ChainedCommands
}

const BLOCKS: Block[] = [
  {
    id: "text",
    label: "Text",
    hint: "Plain paragraph",
    icon: Pilcrow,
    keywords: "paragraph p",
    run: (c) => c.setParagraph(),
  },
  {
    id: "h1",
    label: "Heading 1",
    hint: "Large section heading",
    icon: Heading1,
    keywords: "title h1 #",
    run: (c) => c.setHeading({ level: 1 }),
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Medium section heading",
    icon: Heading2,
    keywords: "subtitle h2 ##",
    run: (c) => c.setHeading({ level: 2 }),
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Small section heading",
    icon: Heading3,
    keywords: "h3 ###",
    run: (c) => c.setHeading({ level: 3 }),
  },
  {
    id: "todo",
    label: "To-do list",
    hint: "Track tasks with checkboxes",
    icon: ListTodo,
    keywords: "task checkbox check todo",
    run: (c) => c.toggleTaskList(),
  },
  {
    id: "bullet",
    label: "Bulleted list",
    hint: "A simple bulleted list",
    icon: List,
    keywords: "unordered ul -",
    run: (c) => c.toggleBulletList(),
  },
  {
    id: "numbered",
    label: "Numbered list",
    hint: "A list with numbers",
    icon: ListOrdered,
    keywords: "ordered ol 1.",
    run: (c) => c.toggleOrderedList(),
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Capture a quote or callout",
    icon: TextQuote,
    keywords: "blockquote callout >",
    run: (c) => c.toggleBlockquote(),
  },
  {
    id: "code",
    label: "Code block",
    hint: "Monospaced code snippet",
    icon: Code2,
    keywords: "snippet pre ```",
    run: (c) => c.toggleCodeBlock(),
  },
  {
    id: "divider",
    label: "Divider",
    hint: "Visually separate sections",
    icon: Minus,
    keywords: "hr line separator ---",
    run: (c) => c.setHorizontalRule(),
  },
  {
    id: "table",
    label: "Table",
    hint: "A simple grid inside the page",
    icon: Table,
    keywords: "grid columns rows",
    run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
]

type SlashMenu = {
  query: string
  from: number
  to: number
  top: number
  left: number
}

const MENU_WIDTH = 288
const MENU_MAX_HEIGHT = 320

function findSlashCommand(
  editor: Editor,
  dismissedAt: number | null
): SlashMenu | null {
  const { selection } = editor.state
  if (!selection.empty) return null
  const { $from } = selection
  if ($from.parent.type.name === "codeBlock") return null
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼")
  const match = /(?:^|\s)\/([\w-]{0,24})$/.exec(before)
  if (!match) return null
  const from = $from.pos - match[1].length - 1
  if (from === dismissedAt) return null
  const coords = editor.view.coordsAtPos(from)
  const flipUp = coords.bottom + MENU_MAX_HEIGHT > window.innerHeight - 16
  return {
    query: match[1].toLowerCase(),
    from,
    to: $from.pos,
    top: flipUp
      ? Math.max(8, coords.top - MENU_MAX_HEIGHT - 6)
      : coords.bottom + 6,
    left: Math.max(
      8,
      Math.min(coords.left, window.innerWidth - MENU_WIDTH - 8)
    ),
  }
}

const selectEditorState = (e: Editor) => ({
  isEmpty: e.isEmpty,
  inTable: e.isActive("table"),
  bold: e.isActive("bold"),
  italic: e.isActive("italic"),
  underline: e.isActive("underline"),
  strike: e.isActive("strike"),
  code: e.isActive("code"),
  highlight: e.isActive("highlight"),
  link: e.isActive("link"),
})

const matchingBlocks = (query: string) =>
  BLOCKS.filter((block) =>
    `${block.label} ${block.keywords}`.toLowerCase().includes(query)
  )

export function PageEditor({
  initialHtml,
  onChange,
  placeholder = "Write something, or type “/” for blocks…",
  showTemplates = true,
  editable = true,
}: {
  initialHtml: string
  onChange: (html: string) => void
  placeholder?: string
  showTemplates?: boolean
  /** false renders the page read-only (shared links). */
  editable?: boolean
}) {
  const [menu, setMenu] = useState<SlashMenu | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const dismissedAt = useRef<number | null>(null)
  // The editor's key handler is created once, so it reads the live menu through a ref.
  const menuState = useRef({ menu, activeIndex, items: [] as Block[] })
  const items = menu ? matchingBlocks(menu.query) : []

  useEffect(() => {
    menuState.current = { menu, activeIndex, items }
  })

  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)

  const syncMenu = (editor: Editor) => {
    const next = findSlashCommand(editor, dismissedAt.current)
    if (!next) dismissedAt.current = null
    if (!next || menuState.current.menu?.query !== next.query) setActiveIndex(0)
    setMenu(next)
  }

  const runBlock = (editor: Editor, block: Block) => {
    const current = menuState.current.menu
    let chain = editor.chain().focus()
    if (current)
      chain = chain.deleteRange({ from: current.from, to: current.to })
    block.run(chain).run()
    setMenu(null)
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Highlight,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading"
            ? `Heading ${node.attrs.level}`
            : placeholder,
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: "kaizen-editor-content" },
      handleKeyDown: (_view, event) => {
        const {
          menu: open,
          activeIndex: index,
          items: options,
        } = menuState.current
        if (!open) return false
        if (event.key === "Escape") {
          dismissedAt.current = open.from
          setMenu(null)
          return true
        }
        if (!options.length) return false
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.key === "ArrowDown" ? 1 : -1
          setActiveIndex((index + step + options.length) % options.length)
          return true
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (editorRef.current) runBlock(editorRef.current, options[index])
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML())
      syncMenu(editor)
    },
    onSelectionUpdate: ({ editor }) => syncMenu(editor),
    onBlur: () => setMenu(null),
  })

  useEffect(() => {
    editorRef.current = editor
    onChangeRef.current = onChange
  })

  const trackedState = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? selectEditorState(e) : null),
  })
  // useEditorState only updates on the editor's first transaction, so read the
  // state directly until then (otherwise the editor would never render).
  const state = trackedState ?? (editor ? selectEditorState(editor) : null)

  if (!editor || !state) return null

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link URL", previous ?? "https://")
    if (url === null) return
    if (url.trim() === "")
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.trim() })
        .run()
  }

  const marks: {
    label: string
    icon: LucideIcon
    active: boolean
    run: () => void
  }[] = [
    {
      label: "Bold",
      icon: Bold,
      active: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: UnderlineIcon,
      active: state.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: state.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Inline code",
      icon: Code,
      active: state.code,
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Highlight",
      icon: Highlighter,
      active: state.highlight,
      run: () => editor.chain().focus().toggleHighlight().run(),
    },
    { label: "Link", icon: LinkIcon, active: state.link, run: setLink },
  ]

  const tableActions: {
    label: string
    icon: LucideIcon
    run: () => void
    danger?: boolean
  }[] = [
    {
      label: "Add row",
      icon: Rows3,
      run: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: "Add column",
      icon: Columns3,
      run: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      label: "Delete row",
      icon: Minus,
      run: () => editor.chain().focus().deleteRow().run(),
    },
    {
      label: "Delete column",
      icon: Minus,
      run: () => editor.chain().focus().deleteColumn().run(),
    },
    {
      label: "Delete table",
      icon: Trash2,
      run: () => editor.chain().focus().deleteTable().run(),
      danger: true,
    },
  ]

  const applyTemplate = (html: string) => {
    editor.commands.setContent(html, { emitUpdate: false })
    onChange(editor.getHTML())
    editor.commands.focus("end")
  }

  return (
    <div className="kaizen-editor relative">
      {showTemplates && state.isEmpty && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            Start from a template:
          </span>
          {PAGE_TEMPLATES.filter(
            (template) =>
              template.kind === "page" && template.id !== "blank-page"
          ).map((template) => {
            const TemplateIcon = resolveIcon(template.icon)
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.build().html ?? "")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <TemplateIcon className="h-3.5 w-3.5" /> {template.name}
              </button>
            )
          })}
        </div>
      )}

      {editable && state.inTable && (
        <div className="sticky top-2 z-10 mb-2 flex w-fit flex-wrap gap-1 rounded-xl border border-border/70 bg-card/95 p-1 shadow-sm backdrop-blur">
          {tableActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={action.run}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors hover:bg-muted",
                action.danger
                  ? "text-destructive"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <action.icon className="h-3.5 w-3.5" /> {action.label}
            </button>
          ))}
        </div>
      )}

      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: e, from, to }) =>
          e.isEditable &&
          from !== to &&
          !e.isActive("codeBlock") &&
          !e.isActive("table")
        }
        className="flex items-center gap-0.5 rounded-xl border border-border/70 bg-popover p-1 shadow-lg"
      >
        {marks.map((mark) => (
          <button
            key={mark.label}
            type="button"
            title={mark.label}
            aria-label={mark.label}
            onClick={mark.run}
            className={cn(
              "rounded-lg p-1.5 transition-colors hover:bg-muted",
              mark.active ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
          >
            <mark.icon className="h-4 w-4" />
          </button>
        ))}
      </BubbleMenu>

      <EditorContent editor={editor} />

      {menu && (
        <div
          role="listbox"
          aria-label="Insert block"
          className="fixed z-50 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
          style={{
            top: menu.top,
            left: menu.left,
            width: MENU_WIDTH,
            maxHeight: MENU_MAX_HEIGHT,
          }}
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No blocks match “{menu.query}”
            </p>
          ) : (
            <>
              <p className="px-2 pt-1.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Blocks
              </p>
              {items.map((block, index) => (
                <button
                  key={block.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runBlock(editor, block)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left",
                    index === activeIndex ? "bg-muted" : ""
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                    <block.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {block.label}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {block.hint}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
