import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export type LearningChecklistItem = {
  id: string
  user_id: string
  category: string
  title: string
  description: string
  is_completed: boolean
  sort_order: number
  subtasks: LearningSubtask[]
}
export type LearningSubtask = {
  id: string
  item_id: string
  user_id: string
  title: string
  is_completed: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}
export type NewLearningChecklistItem = { category: string; title: string; description?: string; is_completed?: boolean; sort_order?: number }
type NewItem = NewLearningChecklistItem
type Updates = Partial<Pick<LearningChecklistItem, "category" | "title" | "description" | "is_completed" | "sort_order">>

export function useLearningChecklist() {
  const { user } = useAuth()
  const [items, setItems] = useState<LearningChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    if (!user?.id) { setItems([]); setIsLoading(false); return }
    setIsLoading(true); setErrorMessage(null)
    const { data, error } = await supabase.from("learning_checklist_items").select("*").eq("user_id", user.id).order("sort_order").order("created_at")
    if (error) { setErrorMessage(error.message); setIsLoading(false); return }
    const rows = (data ?? []) as Omit<LearningChecklistItem, "subtasks">[]
    const { data: subtaskRows, error: subtaskError } = await supabase
      .from("learning_checklist_subtasks")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order")
      .order("created_at")
    if (subtaskError) { setErrorMessage(subtaskError.message); setIsLoading(false); return }
    const subtasks = (subtaskRows ?? []) as LearningSubtask[]
    setItems(rows.map(item => ({
      ...item,
      subtasks: subtasks.filter(subtask => subtask.item_id === item.id),
    })))
    setIsLoading(false)
  }, [user?.id])
  useEffect(() => { void loadItems() }, [loadItems])

  const createItem = async (input: NewItem) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { data, error } = await supabase.from("learning_checklist_items").insert([{ user_id: user.id, ...input }]).select("*").single()
    if (error) return { error: error.message }
    setItems(prev => [...prev, { ...(data as LearningChecklistItem), subtasks: [] }]); return { error: null }
  }
  const updateItem = async (id: string, updates: Updates) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { data, error } = await supabase.from("learning_checklist_items").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("*").single()
    if (error) return { error: error.message }
    setItems(prev => prev.map(item => item.id === id ? { ...(data as LearningChecklistItem), subtasks: item.subtasks ?? [] } : item)); return { error: null }
  }
  const deleteItem = async (id: string) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { error } = await supabase.from("learning_checklist_items").delete().eq("id", id).eq("user_id", user.id)
    if (error) return { error: error.message }
    setItems(prev => prev.filter(item => item.id !== id)); return { error: null }
  }
  const createSubtask = async (itemId: string, title: string) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const clean = title.trim()
    if (!clean) return { error: "Enter a subtask title." }
    const parent = items.find(item => item.id === itemId)
    const { data, error } = await supabase.from("learning_checklist_subtasks").insert([{ item_id: itemId, user_id: user.id, title: clean, sort_order: parent?.subtasks?.length ?? 0 }]).select("*").single()
    if (error) return { error: error.message }
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, subtasks: [...(item.subtasks ?? []), data as LearningSubtask] } : item))
    return { error: null }
  }
  const updateSubtask = async (itemId: string, subtaskId: string, updates: Partial<Pick<LearningSubtask, "title" | "is_completed">>) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { data, error } = await supabase.from("learning_checklist_subtasks").update(updates).eq("id", subtaskId).eq("item_id", itemId).eq("user_id", user.id).select("*").single()
    if (error) return { error: error.message }
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, subtasks: (item.subtasks ?? []).map(subtask => subtask.id === subtaskId ? data as LearningSubtask : subtask) } : item))
    return { error: null }
  }
  const deleteSubtask = async (itemId: string, subtaskId: string) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { error } = await supabase.from("learning_checklist_subtasks").delete().eq("id", subtaskId).eq("item_id", itemId).eq("user_id", user.id)
    if (error) return { error: error.message }
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, subtasks: (item.subtasks ?? []).filter(subtask => subtask.id !== subtaskId) } : item))
    return { error: null }
  }
  const addCategory = async (name: string) => {
    const clean = name.trim()
    if (!clean) return { error: "Enter a category name." }
    if (items.some(item => item.category.toLowerCase() === clean.toLowerCase())) return { error: "That category already exists." }
    return createItem({ category: clean, title: "New task", sort_order: items.length })
  }
  const categories = useMemo(() => {
    const values = new Set(items.map(item => item.category))
    const preferred = ["DSA", "Backend", "Maths", "Blogging", "AWS Certified Cloud Practitioner"]
    return [...preferred.filter(value => values.has(value)), ...[...values].filter(value => !preferred.includes(value)).sort()]
  }, [items])
  return { items, categories, isLoading, errorMessage, reload: loadItems, createItem, updateItem, deleteItem, createSubtask, updateSubtask, deleteSubtask, addCategory }
}
