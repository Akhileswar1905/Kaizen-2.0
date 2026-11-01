import { addDays, format } from "date-fns"
import {
  newId,
  type CustomPageContent,
  type CustomPageKind,
  type TableColumn,
  type TrackerContent,
} from "@/lib/workspace"

export type PageTemplate = {
  id: string
  name: string
  description: string
  icon: string
  kind: Exclude<CustomPageKind, "notes" | "checklist">
  /** Apps do something; documents are free-form pages you fill in. */
  group: "app" | "document"
  build: () => CustomPageContent
}

const todo = (items: string[]) =>
  `<ul data-type="taskList">${items.map((item) => `<li data-type="taskItem" data-checked="false"><p>${item}</p></li>`).join("")}</ul>`

const column = (
  name: string,
  type: TableColumn["type"],
  options?: string[]
): TableColumn => ({
  id: newId(),
  name,
  type,
  ...(options ? { options } : {}),
})

const table = (
  columns: TableColumn[],
  rows: Record<string, string | number | boolean | null>[] = []
): CustomPageContent => ({
  table: {
    columns,
    rows: rows.map((row) => ({
      id: newId(),
      cells: Object.fromEntries(
        columns.map((col) => [col.id, row[col.name] ?? null])
      ),
    })),
  },
})

const board = (
  columns: string[],
  cards: [number, string][] = []
): CustomPageContent => {
  const cols = columns.map((title) => ({ id: newId(), title }))
  return {
    board: {
      columns: cols,
      cards: cards.map(([index, title]) => ({
        id: newId(),
        columnId: cols[index].id,
        title,
      })),
    },
  }
}

const tracker = (
  unit: string,
  goal: number,
  steps: number[]
): CustomPageContent => ({
  tracker: { unit, goal, steps, log: {} } satisfies TrackerContent,
})

const inDays = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd")

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ---- Apps
  {
    id: "journal",
    name: "Daily journal",
    description: "One entry a day with mood, prompts and streaks",
    icon: "NotebookPen",
    kind: "journal",
    group: "app",
    build: () => ({ journal: { entries: {} } }),
  },
  {
    id: "water",
    name: "Water intake",
    description: "Glasses a day with quick-add and a goal",
    icon: "GlassWater",
    kind: "tracker",
    group: "app",
    build: () => tracker("glasses", 8, [1]),
  },
  {
    id: "reading",
    name: "Reading time",
    description: "Minutes read each day",
    icon: "BookOpen",
    kind: "tracker",
    group: "app",
    build: () => tracker("minutes", 30, [10, 15, 30]),
  },
  {
    id: "steps",
    name: "Step counter",
    description: "Daily steps against a target",
    icon: "Footprints",
    kind: "tracker",
    group: "app",
    build: () => tracker("steps", 8000, [500, 1000, 2500]),
  },
  {
    id: "meditation",
    name: "Meditation",
    description: "Mindful minutes per day",
    icon: "Flower2",
    kind: "tracker",
    group: "app",
    build: () => tracker("minutes", 10, [5, 10, 20]),
  },
  {
    id: "custom-tracker",
    name: "Custom tracker",
    description: "Count anything, with your own unit and goal",
    icon: "Gauge",
    kind: "tracker",
    group: "app",
    build: () => tracker("times", 1, [1]),
  },
  {
    id: "goals",
    name: "Goals",
    description: "Goals broken into milestones, with deadlines",
    icon: "Target",
    kind: "goals",
    group: "app",
    build: () => ({
      goals: {
        goals: [
          {
            id: newId(),
            title: "Example: Run a 5K",
            why: "Feel fitter and have more energy",
            due: inDays(60),
            createdAt: new Date().toISOString(),
            milestones: [
              { id: newId(), title: "Run 1K without stopping", done: false },
              { id: newId(), title: "Run 3K", done: false },
              { id: newId(), title: "Sign up for a race", done: false },
            ],
          },
        ],
      },
    }),
  },
  {
    id: "countdown",
    name: "Countdowns",
    description: "Days left until the things you're waiting for",
    icon: "Hourglass",
    kind: "countdown",
    group: "app",
    build: () => ({
      countdown: {
        events: [{ id: newId(), title: "Next holiday", date: inDays(30) }],
      },
    }),
  },
  {
    id: "birthdays",
    name: "Birthdays",
    description: "Yearly dates that repeat automatically",
    icon: "Cake",
    kind: "countdown",
    group: "app",
    build: () => ({ countdown: { events: [], yearlyByDefault: true } }),
  },
  {
    id: "flashcards",
    name: "Flashcards",
    description: "Study cards with spaced repetition",
    icon: "Layers",
    kind: "flashcards",
    group: "app",
    build: () => ({
      flashcards: {
        cards: [
          {
            id: newId(),
            front: "What does Kaizen mean?",
            back: "Continuous improvement through small, steady changes.",
            box: 1,
            due: inDays(0),
          },
          {
            id: newId(),
            front: "How does spaced repetition work?",
            back: "Cards you know come back less often; cards you miss come back sooner.",
            box: 1,
            due: inDays(0),
          },
        ],
      },
    }),
  },

  // ---- Documents
  {
    id: "blank-page",
    name: "Blank page",
    description: "Write freely. Type / for blocks",
    icon: "FileText",
    kind: "page",
    group: "document",
    build: () => ({ html: "" }),
  },
  {
    id: "todo",
    name: "To-do list",
    description: "A simple list of tasks to tick off",
    icon: "ListTodo",
    kind: "page",
    group: "document",
    build: () => ({ html: `<h2>To do</h2>${todo(["", ""])}<h2>Done</h2>` }),
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Agenda, notes and action items",
    icon: "Users",
    kind: "page",
    group: "document",
    build: () => ({
      html: `<p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ol><li><p></p></li></ol><h2>Notes</h2><p></p><h2>Action items</h2>${todo([""])}`,
    }),
  },
  {
    id: "weekly-plan",
    name: "Weekly plan",
    description: "Goals for the week, day by day",
    icon: "CalendarRange",
    kind: "page",
    group: "document",
    build: () => ({
      html: `<h2>Goals this week</h2>${todo(["", ""])}${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Weekend"].map((day) => `<h3>${day}</h3>${todo([""])}`).join("")}`,
    }),
  },
  {
    id: "project-plan",
    name: "Project plan",
    description: "Overview, milestones and risks",
    icon: "Rocket",
    kind: "page",
    group: "document",
    build: () => ({
      html: `<h2>Overview</h2><p></p><h2>Goals</h2><ul><li><p></p></li></ul><h2>Milestones</h2>${todo(["", ""])}<h2>Risks &amp; open questions</h2><ul><li><p></p></li></ul>`,
    }),
  },
  {
    id: "blank-table",
    name: "Table",
    description: "A blank database with typed columns",
    icon: "Table2",
    kind: "table",
    group: "document",
    build: () =>
      table(
        [
          column("Name", "text"),
          column("Notes", "text"),
          column("Done", "checkbox"),
        ],
        [{}, {}]
      ),
  },
  {
    id: "reading-list",
    name: "Reading list",
    description: "Books with status and rating",
    icon: "BookMarked",
    kind: "table",
    group: "document",
    build: () =>
      table(
        [
          column("Title", "text"),
          column("Author", "text"),
          column("Status", "select", ["To read", "Reading", "Finished"]),
          column("Rating", "number"),
          column("Finished on", "date"),
        ],
        [{ Status: "To read" }]
      ),
  },
  {
    id: "kanban",
    name: "Kanban board",
    description: "To do, in progress, done",
    icon: "SquareKanban",
    kind: "board",
    group: "document",
    build: () =>
      board(
        ["To do", "In progress", "Done"],
        [[0, "Drag me to another column"]]
      ),
  },
  {
    id: "content-pipeline",
    name: "Content pipeline",
    description: "Ideas through to published",
    icon: "Sparkles",
    kind: "board",
    group: "document",
    build: () => board(["Ideas", "Drafting", "Editing", "Published"]),
  },
]

/** Name used when the user doesn't type one. */
export const defaultTitle = (template: PageTemplate) =>
  template.id === "blank-page"
    ? "Untitled page"
    : template.id === "blank-table"
      ? "Untitled table"
      : template.name
