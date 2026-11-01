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
    // New users start with an empty checklist and build their own tracks.
    setItems((data ?? []) as LearningChecklistItem[]); setIsLoading(false)
  }, [user?.id])
  useEffect(() => { void loadItems() }, [loadItems])

  const createItem = async (input: NewItem) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { data, error } = await supabase.from("learning_checklist_items").insert([{ user_id: user.id, ...input }]).select("*").single()
    if (error) return { error: error.message }
    setItems(prev => [...prev, data as LearningChecklistItem]); return { error: null }
  }
  const updateItem = async (id: string, updates: Updates) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { data, error } = await supabase.from("learning_checklist_items").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("*").single()
    if (error) return { error: error.message }
    setItems(prev => prev.map(item => item.id === id ? data as LearningChecklistItem : item)); return { error: null }
  }
  const deleteItem = async (id: string) => {
    if (!user?.id) return { error: "Sign in to edit your checklist." }
    const { error } = await supabase.from("learning_checklist_items").delete().eq("id", id).eq("user_id", user.id)
    if (error) return { error: error.message }
    setItems(prev => prev.filter(item => item.id !== id)); return { error: null }
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
  return { items, categories, isLoading, errorMessage, reload: loadItems, createItem, updateItem, deleteItem, addCategory }
}
