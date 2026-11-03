import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dumbbell,
  Trophy,
  Plus,
  Timer,
  Target,
  Loader2,
  ChevronLeft,
  Shield,
  BookOpen,
  Tv,
  CheckCircle2,
} from "lucide-react"
import { format } from "date-fns"
import { useGamification } from "@/contexts/GamificationContext"

// HARD MODE TUNING: Reduced exercise point multipliers across all ranks by 40-50%
const XP_MULTIPLIERS: Record<string, number> = {
  // E-Rank (Fundamentals) - Previous baseline was 1.0
  "Push-ups": 0.5,
  Squats: 0.5,
  Lunges: 0.5,
  Plank: 0.2,
  "Wall Sits": 0.4,
  "Inverted Rows": 0.6,

  // D-Rank (Intermediate) - Previous baseline was ~1.2 - 1.5
  "Diamond Push-ups": 0.7,
  Dips: 0.7,
  "Chin-ups": 0.8,
  "Pull-ups": 0.9,
  "Pike Push-ups": 0.9,
  "Bulgarian Split Squats": 0.8,
  "Hollow Body Hold": 0.4,

  // C-Rank (Advanced) - Previous baseline was ~1.5 - 1.8
  "Archer Push-ups": 1.0,
  "Explosive Pull-ups": 1.1,
  "Pistol Squats": 1.1,
  "Shrimp Squats": 1.1,
  "Straight Bar Dips": 1.0,
  "L-Sit": 0.9,

  // B-Rank (Elite) - Previous baseline was ~2.0 - 2.5
  "Muscle-ups": 1.5,
  "Handstand Push-ups": 1.5,
  "Front Lever Raises": 1.4,
  "Typewriter Pull-ups": 1.2,
  "Dragon Flags": 1.3,

  // A-Rank (Mastery) - Previous baseline was ~2.5 - 4.0
  "One-Arm Push-ups": 1.8,
  "One-Arm Pull-ups": 2.4,
  "Front Lever Hold": 1.5,
  "Human Flag": 2.0,
  Planche: 2.5,
}

const RANK_GROUPS = {
  "E-Rank (Fundamentals)": [
    "Push-ups",
    "Squats",
    "Lunges",
    "Plank",
    "Wall Sits",
    "Inverted Rows",
  ],
  "D-Rank (Intermediate)": [
    "Diamond Push-ups",
    "Dips",
    "Chin-ups",
    "Pull-ups",
    "Pike Push-ups",
    "Bulgarian Split Squats",
    "Hollow Body Hold",
  ],
  "C-Rank (Advanced)": [
    "Archer Push-ups",
    "Explosive Pull-ups",
    "Pistol Squats",
    "Shrimp Squats",
    "Straight Bar Dips",
    "L-Sit",
  ],
  "B-Rank (Elite)": [
    "Muscle-ups",
    "Handstand Push-ups",
    "Front Lever Raises",
    "Typewriter Pull-ups",
    "Dragon Flags",
  ],
  "A-Rank (Mastery)": [
    "One-Arm Push-ups",
    "One-Arm Pull-ups",
    "Front Lever Hold",
    "Human Flag",
    "Planche",
  ],
}

const TIMED_EXERCISES = [
  "Plank",
  "Wall Sits",
  "Hollow Body Hold",
  "L-Sit",
  "Front Lever Hold",
  "Human Flag",
  "Planche",
]

interface GuideItem {
  description: string
  muscles: string[]
  cues: string[]
  steps: string[] // Added for step-by-step instructions
  videoUrl?: string
}

const EXERCISE_GUIDES: Record<string, GuideItem> = {
  "Push-ups": {
    description: "The foundation of all horizontal pressing power.",
    muscles: ["Chest", "Triceps", "Anterior Deltoids", "Core"],
    cues: [
      "Rigid straight line from head to heels.",
      "Brace core and glutes.",
      "Elbows at 45-degree angle.",
    ],
    steps: [
      "Place your hands slightly wider than shoulder-width apart on the floor.",
      "Extend your legs straight back, balancing on the balls of your feet to enter a high plank position.",
      "Lower your body by bending your elbows until your chest nearly touches the ground.",
      "Push through your palms to return to the starting layout while maintaining a rigid spine.",
    ],
    videoUrl: "https://www.youtube.com/embed/IODxDxX7oi4",
  },
  Squats: {
    description: "Foundation of lower body kinetic chain output.",
    muscles: ["Quadriceps", "Glutes", "Adductors", "Core"],
    cues: [
      "Drive knees outward.",
      "Maintain neutral spine.",
      "Explode through heels.",
    ],
    steps: [
      "Stand with your feet shoulder-width apart, toes pointing slightly outward.",
      "Inhale, engage your core, and drop your hips back and down as if sitting into a chair.",
      "Descend until your thighs are parallel to or below the floor.",
      "Exhale and drive through your heels to stand back up into a full lockout configuration.",
    ],
    videoUrl: "https://www.youtube.com/embed/UXbPVIGU0Jc",
  },
  Lunges: {
    description: "Unilateral stability and leg strength building.",
    muscles: ["Quadriceps", "Glutes", "Hamstrings"],
    cues: [
      "Keep torso vertical.",
      "Front knee tracking over toes.",
      "Controlled descent.",
    ],
    steps: [
      "Stand tall with feet hip-width apart and hands resting on hips.",
      "Take a controlled step forward with your working leg.",
      "Lower your hips until your rear knee points toward the floor and your front knee forms a 90-degree angle.",
      "Push forcefully off your front foot to return to the clean standing start layout.",
    ],
    videoUrl: "https://www.youtube.com/embed/Z2n58m2i4jg",
  },
  Plank: {
    description: "Isometric pillar check for core stability.",
    muscles: ["Rectus Abdominis", "Obliques", "Transverse Abdominis"],
    cues: ["Protract shoulders.", "Posterior pelvic tilt.", "Squeeze quads."],
    steps: [
      "Place your forearms on the floor, parallel to each other, with elbows directly beneath your shoulders.",
      "Extend your legs straight back to create a continuous straight body line from head to heels.",
      "Actively tuck your pelvis inward and protract your shoulder blades upward away from the ground.",
      "Hold this strict mechanical lock position while maintaining deep, controlled breathing patterns.",
    ],
    videoUrl: "https://www.youtube.com/embed/pSHjTRCQxIw",
  },
  "Wall Sits": {
    description: "Endurance static hold for knee and quad integrity.",
    muscles: ["Quadriceps", "Glutes"],
    cues: [
      "Keep thighs parallel to floor.",
      "Back flat against wall.",
      "Breathe steadily.",
    ],
    steps: [
      "Press your back completely flat against a sturdy wall layout.",
      "Slide down the surface while stepping your feet forward until your knees create a strict 90-degree angle.",
      "Ensure your thighs are parallel to the floor and your knees align directly over your ankles.",
      "Maintain your hands away from your knees, keeping full isolation tension on the quads.",
    ],
    videoUrl: "https://www.youtube.com/embed/F-k5P140d3E",
  },
  "Inverted Rows": {
    description: "Horizontal pulling foundation for upper back thickness.",
    muscles: ["Rhomboids", "Lats", "Biceps"],
    cues: [
      "Keep chest proud.",
      "Pull elbows toward ribs.",
      "Full scapular retraction.",
    ],
    steps: [
      "Position yourself underneath a low bar or suspension setup and grab it with an overhand grip.",
      "Extend your legs completely outward, pulling your body up into a straight line hanging stance.",
      "Pull your chest up cleanly to meet the bar by driving your elbows aggressively down behind your ribs.",
      "Lower yourself smoothly back down into full arm extension without sagging your lower spine.",
    ],
    videoUrl: "https://www.youtube.com/embed/e21gW0aYt7U",
  },
  "Diamond Push-ups": {
    description: "Triceps-dominant pressing variation.",
    muscles: ["Triceps", "Inner Chest", "Deltoids"],
    cues: [
      "Hands in diamond shape.",
      "Keep elbows close to body.",
      "Full range of motion.",
    ],
    steps: [
      "Set up a standard push-up platform, but place your index fingers and thumbs together to form a diamond shape.",
      "Lower your chest down cleanly until it lightly taps the back of your hands.",
      "Keep your elbows locked tightly against the sides of your ribcage to prevent shoulder strain.",
      "Explode upward through your palms, emphasizing triceps recruitment.",
    ],
    videoUrl: "https://www.youtube.com/embed/J0DnG1_S92I",
  },
  Dips: {
    description: "Superior isolation for triceps and lower pectorals.",
    muscles: ["Triceps", "Chest", "Anterior Deltoids"],
    cues: [
      "Keep shoulders depressed.",
      "Forward lean for chest.",
      "Lock out elbows.",
    ],
    steps: [
      "Mount the parallel bars with your arms completely locked and shoulders depressed away from your ears.",
      "Inhale and lower your body by bending at the elbows, tilting your torso slightly forward.",
      "Descend smoothly until your shoulders track just below elbow level.",
      "Press out powerfully back to the top lockout point while actively stabilizing your lower body.",
    ],
    videoUrl: "https://www.youtube.com/embed/wjUmnrzES4I",
  },
  "Chin-ups": {
    description: "Vertical pull with increased biceps engagement.",
    muscles: ["Biceps", "Lats", "Brachialis"],
    cues: ["Supinated grip.", "Full extension at bottom.", "Chest to bar."],
    steps: [
      "Grab the pull-up bar with an underhand (supinated) grip, hands spaced shoulder-width apart.",
      "Begin from a dead hang position with your arms fully extended and shoulder blades stretched out.",
      "Pull your torso upward by sinking your elbows toward your pockets, keeping your chest leading.",
      "Clear your chin over the top bar line before executing a controlled, smooth descent.",
    ],
    videoUrl: "https://www.youtube.com/embed/brxkoP_sZ1g",
  },
  "Pull-ups": {
    description: "Primary vertical pulling test of absolute strength.",
    muscles: ["Lats", "Biceps", "Rhomboids", "Core"],
    cues: [
      "Scapular depression.",
      "Drive elbows to hips.",
      "Clean chin clearance.",
    ],
    steps: [
      "Hang from the bar using an overhand (pronated) grip slightly wider than shoulder width.",
      "Depress your scapula downward first to cleanly engage your back muscles before the arms bend.",
      "Pull your chest directly toward the bar by driving your elbows aggressively down into your sides.",
      "Lower yourself at a controlled tempo until you reach a full dead hang baseline.",
    ],
    videoUrl: "https://www.youtube.com/embed/eGo4IYlbE5g",
  },
  "Pike Push-ups": {
    description: "Foundational shoulder and overhead pressing power.",
    muscles: ["Deltoids", "Upper Chest", "Triceps"],
    cues: [
      "Hips high (inverted V).",
      "Head moves forward of hands.",
      "Control descent.",
    ],
    steps: [
      "Assume a high push-up layout, then walk your feet closer to your hands to drive your hips high into an inverted 'V' geometry.",
      "Lower your head forward down in a diagonal path, creating a tripod pattern with your hands.",
      "Lightly touch the crown of your head to the floor.",
      "Push back up diagonally along that same clean track to re-extend your shoulders and core.",
    ],
    videoUrl: "https://www.youtube.com/embed/mk5r9t1j1_4",
  },
  "Bulgarian Split Squats": {
    description: "Extreme unilateral leg development and balance.",
    muscles: ["Quadriceps", "Glutes"],
    cues: ["Elevated rear foot.", "Chest upright.", "Deep hip flexion."],
    steps: [
      "Place the top of your trailing foot flat onto an elevated bench or step behind you.",
      "Step your working lead foot out far enough so your front knee doesn't pass far beyond your toes during depth transition.",
      "Lower your back knee directly toward the floor in a strict single-leg structural drop.",
      "Drive up via your lead heel back to full elevation while preserving a vertical spine.",
    ],
    videoUrl: "https://www.youtube.com/embed/v2Y4s1Y4v6A",
  },
  "Hollow Body Hold": {
    description: "Core compression strength essential for advanced levers.",
    muscles: ["Abs", "Obliques", "Hip Flexors"],
    cues: [
      "Lower back pressed to floor.",
      "Shoulders and legs elevated.",
      "Total body tension.",
    ],
    steps: [
      "Lie down flat on your back with legs straight out and arms extended back past your head.",
      "Contract your abs aggressively to glue your lower back flat to the surface, removing any spacing underneath.",
      "Lift your shoulder blades and feet a few inches off the floor simultaneously.",
      "Point your toes and lock out your knees, compressing your core structure into a static shape.",
    ],
    videoUrl: "https://www.youtube.com/embed/vF_W9a-m9Xo",
  },
  "Archer Push-ups": {
    description: "Unilateral weight shifting for chest and shoulder strength.",
    muscles: ["Chest", "Deltoids", "Core"],
    cues: [
      "Full extension of non-working arm.",
      "Deep range of motion.",
      "Keep core stabilized.",
    ],
    steps: [
      "Adopt a wide hand setup on the floor, with fingers pointed slightly outward.",
      "Lower your weight entirely over to one side, bending that working arm's elbow completely.",
      "Keep your non-working opposite arm completely locked out straight as it slides outward.",
      "Press through the loaded hand back up to center before cycling over to the other side.",
    ],
    videoUrl: "https://www.youtube.com/embed/wJKLatFY-aU",
  },
  "Explosive Pull-ups": {
    description: "Power output training for pulling movements.",
    muscles: ["Lats", "Upper Back", "Biceps"],
    cues: ["Aggressive pull.", "High velocity.", "Full control."],
    steps: [
      "Hang with an overhand grip, maintaining a highly engaged hollow body alignment.",
      "Fire your nervous system to pull down against the bar with maximum velocity.",
      "Aim to pull your chest or upper waist to bar level using momentum-free kinetic power.",
      "Catch yourself smoothly at the peak and decelerate the descent back down safely.",
    ],
    videoUrl: "https://www.youtube.com/embed/i0WJ5vC9L00",
  },
  "Pistol Squats": {
    description: "Mastery of unilateral balance and absolute knee stability.",
    muscles: ["Quadriceps", "Glutes", "Hamstrings"],
    cues: [
      "Keep non-working leg clear.",
      "Drive through mid-foot.",
      "Upright torso.",
    ],
    steps: [
      "Stand on one foot while lifting your opposite leg straight out in front of your body.",
      "Extend your arms forward for balance, then slowly drop your hips back onto your single heel.",
      "Descend into a full single-leg squat depth, keeping your forward foot hovering above the floor.",
      "Drive through the mid-foot of your planted leg to recover to a crisp vertical position.",
    ],
    videoUrl: "https://www.youtube.com/embed/2eH3t9rK_fQ",
  },
  "Shrimp Squats": {
    description: "Dynamic unilateral balance for leg development.",
    muscles: ["Glutes", "Quadriceps"],
    cues: ["Hold rear foot.", "Touch knee to floor.", "Maintain balance."],
    steps: [
      "Stand on one leg, bend your trailing leg behind you, and grab that foot with your hand.",
      "Slowly lower your hips downward, hinging forward slightly to maintain your active center of mass.",
      "Lightly tap your back knee to the floor without resting your weight down.",
      "Drive through your front foot to stand back up, tracking your knee securely.",
    ],
    videoUrl: "https://www.youtube.com/embed/L13-e40YmG8",
  },
  "Straight Bar Dips": {
    description: "Functional upper body pushing strength on a straight bar.",
    muscles: ["Triceps", "Chest", "Shoulders"],
    cues: ["Keep bar centered.", "Full lockout.", "Stabilize core."],
    steps: [
      "Support yourself on top of a single straight bar with arms fully straight and core highly tensed.",
      "Lean your upper chest slightly over the bar as you bend your elbows back out of the way.",
      "Lower yourself down cleanly until your lower chest or upper abdomen touches the bar surface.",
      "Press your frame away from the bar using full raw chest and triceps authority back to mechanical lockout.",
    ],
    videoUrl: "https://www.youtube.com/embed/gB-eH49Nn1U",
  },
  "L-Sit": {
    description: "Core compression and hip flexor strength endurance.",
    muscles: ["Abs", "Hip Flexors", "Triceps"],
    cues: [
      "Legs parallel to ground.",
      "Shoulders depressed.",
      "Hard protraction.",
    ],
    steps: [
      "Sit flat on the ground or press down on parallettes with hands placed close to your hips.",
      "Depress your shoulders downward hard, lifting your entire torso and butt up off the ground.",
      "Engage your hip flexors and abs to lift your legs straight forward parallel to the floor.",
      "Lock out your knees completely and point your toes, fighting to hold the 'L' shape configuration.",
    ],
    videoUrl: "https://www.youtube.com/embed/w253Fw6041A",
  },
  "Muscle-ups": {
    description:
      "Elite dynamic execution converting pulling velocity into pushing leverage.",
    muscles: ["Lats", "Chest", "Triceps", "Core"],
    cues: [
      "Hollow body swing.",
      "Explosive sternum pull.",
      "Aggressive transition.",
    ],
    steps: [
      "Initiate a clean hollow body style kip swing underneath a straight bar setup.",
      "At the peak of the backswing, execute an explosive diagonal pull to fling your ribs up over the bar.",
      "Quickly snap your head and shoulders forward over the bar to transition into the deep dip pocket.",
      "Press out your triceps smoothly to complete the top structural lockout phase.",
    ],
    videoUrl: "https://www.youtube.com/embed/g2J_S-3-qS4",
  },
  "Handstand Push-ups": {
    description: "Gravity-defying vertical pressing mastery.",
    muscles: ["Deltoids", "Triceps", "Traps"],
    cues: [
      "Wall support or free standing.",
      "Brace core for stability.",
      "Controlled descent.",
    ],
    steps: [
      "Kick up into a clean, vertical handstand against a wall layout or freestanding space.",
      "Brace your core muscles rigidly to avoid letting your lower back arch out into a banana curve.",
      "Lower your body systematically by bending your elbows until your head gently targets the floor.",
      "Press the world away through your palms to return to full overhead lockout alignment.",
    ],
    videoUrl: "https://www.youtube.com/embed/KEfazWGOUok",
  },
  "Front Lever Raises": {
    description: "Dynamic progression for elite isometric back strength.",
    muscles: ["Lats", "Core", "Shoulders"],
    cues: [
      "Straight arm engagement.",
      "Full range of motion.",
      "Controlled tempo.",
    ],
    steps: [
      "Hang from a bar with a solid overhand grip, locking your elbows down completely.",
      "Without bending your arms, leverage your lats to pull your entire straight body line up toward the ceiling.",
      "Continue raising your body until your hips reach bar level and your frame is perfectly horizontal.",
      "Lower your frame back down to a dead hang smoothly over a controlled eccentric tempo.",
    ],
    videoUrl: "https://www.youtube.com/embed/W9l6-i0n0XQ",
  },
  "Typewriter Pull-ups": {
    description: "Unilateral weight shifting under high-load tension.",
    muscles: ["Lats", "Biceps"],
    cues: ["Hold top position.", "Shift side to side.", "Maintain tension."],
    steps: [
      "Execute a standard wide overhand pull-up, drawing your upper chest right to bar level.",
      "While keeping your chin cleanly over the bar, shift your entire body horizontally toward your right hand.",
      "Extend your left arm completely straight across the bar as your weight reloads onto the right lat.",
      "Slide back across to the center or the left side smoothly before lowering yourself down.",
    ],
    videoUrl: "https://www.youtube.com/embed/kR2U2b9f3Xg",
  },
  "Dragon Flags": {
    description: "Total core annihilation and spinal stability mastery.",
    muscles: ["Abs", "Lats", "Glutes"],
    cues: [
      "Lock hands behind head.",
      "Keep body as one plank.",
      "Slow eccentric.",
    ],
    steps: [
      "Lie back on a flat bench and securely anchor your hands behind your head on the bench edges.",
      "Kick your feet up high and raise your entire torso, balancing your weight on your upper traps/shoulders.",
      "Squeeze your glutes, abs, and legs together to turn your body into a single unbending plank line.",
      "Lower your straight body line down slowly until it skims just above the bench, then pull back up.",
    ],
    videoUrl: "https://www.youtube.com/embed/6Lar9utB5ZU",
  },
  "One-Arm Push-ups": {
    description: "Ultimate horizontal pressing stability test.",
    muscles: ["Chest", "Shoulders", "Core"],
    cues: [
      "Wide stance for balance.",
      "Body square to floor.",
      "Controlled descent.",
    ],
    steps: [
      "Set up a standard push-up stance but split your feet out wide to act as stability outriggers.",
      "Place your working hand centered under your chest and place your non-working arm tucked behind your back.",
      "Lower your torso smoothly, rotating slightly to balance but keeping your chest close to square with the floor.",
      "Fire your pectoral and oblique structures to drive straight back up to complete arm lockout.",
    ],
    videoUrl: "https://www.youtube.com/embed/vH2s41u2Wq4",
  },
  "One-Arm Pull-ups": {
    description: "Absolute pinnacle of vertical pulling strength.",
    muscles: ["Lats", "Biceps", "Forearms"],
    cues: ["Active hang.", "Engage scapula.", "Vertical drive."],
    steps: [
      "Hang from the bar using only one arm, securing a crush grip on the steel frame.",
      "Engage your shoulder blade downwards into a powerful active single-arm hang position.",
      "Pull your body upwards with extreme intent, bringing your opposite shoulder up toward the bar layout.",
      "Drive your working elbow down hard against your side until your chin clears the bar.",
    ],
    videoUrl: "https://www.youtube.com/embed/rR171h0xH-4",
  },
  "Front Lever Hold": {
    description: "The core strength test for absolute back dominance.",
    muscles: ["Lats", "Core", "Lower Back"],
    cues: ["Arms locked.", "Full body line.", "Shoulder depression."],
    steps: [
      "Hang under the bar with straight arms and draw your knees up to check your initial shoulder torque.",
      "Extend both legs straight out horizontally while forcing your arms to push down hard against the bar.",
      "Depress your shoulder blades and squeeze your glutes to maintain your feet, hips, and chest in one parallel line.",
      "Freeze all kinetic motion, holding your body fully horizontal against gravity's pull.",
    ],
    videoUrl: "https://www.youtube.com/embed/69sxB5FBR6o",
  },
  "Human Flag": {
    description: "Mastery of gravity and core-shoulder lateral leverage.",
    muscles: ["Obliques", "Lats", "Shoulders"],
    cues: ["Push top hand/pull bottom.", "Core rigid.", "Body perpendicular."],
    steps: [
      "Take a wide vertical grip on a vertical pole setup, matching a top overhand pull position with a lower push brace.",
      "Pull aggressively with your upper arm while throwing massive overhead pressing energy into the bottom arm.",
      "Kick your legs sideways out off the floor, engaging your lateral obliques to maintain tracking.",
      "Hold your spine and legs completely straight out, perpendicular to the vertical anchor fixture.",
    ],
    videoUrl: "https://www.youtube.com/embed/DtraL3XSrtQ",
  },
  Planche: {
    description: "Absolute center-of-mass dominance and shoulder leverage.",
    muscles: ["Deltoids", "Chest", "Serratus"],
    cues: ["Locked elbows.", "Intense forward lean.", "Deep protraction."],
    steps: [
      "Place your hands on the ground or parallettes, turning your wrists slightly outward for wrist safety.",
      "Protract your shoulder blades aggressively to form a rounded upper back dome pattern.",
      "Lean your entire body weight significantly forward, shifting your center of mass directly over your hands.",
      "Float your toes cleanly off the ground as your body achieves a horizontal plane alignment, keeping arms totally straight.",
    ],
    videoUrl: "https://www.youtube.com/embed/3m4a3T2R8Xw",
  },
}

interface ExerciseLog {
  id: string
  name: string
  reps: number
  sets: number
  rest_seconds: number
  xp_earned: number
  created_at: string
}

interface WorkoutTrackerProps {
  onBack: () => void
}

export function WorkoutTracker({ onBack }: WorkoutTrackerProps) {
  const { user } = useAuth()
  const [view, setView] = useState<"tracker" | "codex">("tracker")
  const [selectedCodexExercise, setSelectedCodexExercise] =
    useState<string>("Push-ups")

  const [exercises, setExercises] = useState<ExerciseLog[]>([])
  const [strengthPoints, setStrengthPoints] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: "",
    reps: "",
    sets: "",
    rest: "90",
    duration: "",
  })

  const { triggerGamificationEvent } = useGamification()

  const isCurrentExerciseTimed = useMemo(
    () => TIMED_EXERCISES.includes(form.name),
    [form.name]
  )

  const exerciseStats = useMemo(() => {
    const stats: Record<
      string,
      { pb: number; totalVolume: number; lastDate: string }
    > = {}
    exercises.forEach((ex) => {
      if (!stats[ex.name])
        stats[ex.name] = { pb: 0, totalVolume: 0, lastDate: "" }
      const volume = ex.sets * ex.reps
      stats[ex.name].pb = Math.max(stats[ex.name].pb, ex.reps)
      stats[ex.name].totalVolume += volume
      stats[ex.name].lastDate = ex.created_at
    })
    return stats
  }, [exercises])

  useEffect(() => {
    if (user) fetchUserData()
  }, [user])

  const fetchUserData = async () => {
    setIsLoading(true)

    const { data: logsData, error: logsError } = await supabase
      .from("calisthenics_logs")
      .select("*")
      .order("created_at", { ascending: false })
    if (!logsError && logsData) setExercises(logsData)

    const { data: statsData, error: statsError } = await supabase
      .from("player_stats")
      .select("strength")
      .eq("user_id", user?.id)
      .maybeSingle()

    if (!statsError && statsData) {
      setStrengthPoints(statsData.strength || 0)
    }

    setIsLoading(false)
  }

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.sets || !user) return
    if (isCurrentExerciseTimed && !form.duration) return
    if (!isCurrentExerciseTimed && !form.reps) return

    setIsSubmitting(true)
    const multiplier = XP_MULTIPLIERS[form.name] || 1.0
    const targetVolume = isCurrentExerciseTimed
      ? Number(form.duration)
      : Number(form.reps)
    const calculatedXp = Math.round(
      targetVolume * Number(form.sets) * multiplier
    )

    const newLog = {
      user_id: user.id,
      name: form.name,
      sets: Number(form.sets),
      reps: targetVolume,
      rest_seconds: Number(form.rest),
      xp_earned: calculatedXp,
    }

    const { data: logResult, error: logError } = await supabase
      .from("calisthenics_logs")
      .insert([newLog])
      .select()
      .single()

    if (!logError && logResult) {
      setExercises([logResult, ...exercises])

      const finalStrengthPoints = strengthPoints + calculatedXp

      const { error: statsError } = await supabase.from("player_stats").upsert(
        {
          user_id: user.id,
          strength: finalStrengthPoints,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

      triggerGamificationEvent({
        type: "EXERCISE_ADDED",
        amount: calculatedXp,
      })

      if (!statsError) {
        setStrengthPoints(finalStrengthPoints)
      } else {
        console.error("Tracking error on player_stats updates:", statsError)
      }

      setForm({ name: "", reps: "", sets: "", rest: "90", duration: "" })
    }
    setIsSubmitting(false)
  }

  const currentLevel = Math.floor(Math.sqrt(strengthPoints / 100)) + 1
  const xpForNextLevel = Math.pow(currentLevel, 2) * 100
  const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100
  const progressPct =
    strengthPoints === 0
      ? 0
      : ((strengthPoints - xpForCurrentLevel) /
          (xpForNextLevel - xpForCurrentLevel)) *
        100

  const getExerciseRank = (name: string) => {
    if (RANK_GROUPS["A-Rank (Mastery)"].includes(name))
      return "text-destructive border-destructive/30 bg-destructive/5"
    if (RANK_GROUPS["B-Rank (Elite)"].includes(name))
      return "text-amber-500 border-amber-500/30 bg-amber-500/5"
    if (RANK_GROUPS["C-Rank (Advanced)"].includes(name))
      return "text-primary border-primary/30 bg-primary/5"
    return "text-muted-foreground border-border bg-muted/20"
  }

  const activeGuideData = useMemo(() => {
    return (
      EXERCISE_GUIDES[selectedCodexExercise] || {
        description:
          "Tactical telemetry missing from mainframe matrix database. Execute protocol clean form.",
        muscles: ["Full Body Compound Synchronization"],
        cues: [
          "Maintain balanced center-of-mass gravity alignment.",
          "Brace baseline muscle fibers cleanly.",
        ],
        steps: [
          "Initialize baseline interface configuration position.",
          "Execute mechanical motion pattern under strict kinetic control.",
        ],
      }
    )
  }, [selectedCodexExercise])

  if (isLoading) {
    return (
      <div className="flex min-h-screen justify-center p-4 sm:p-6 md:p-8">
        <div className="h-96 w-full max-w-5xl animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex min-h-screen justify-center bg-background p-4 font-sans text-foreground sm:p-6 md:p-8">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header Control Unit */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 shrink-0 rounded-xl border-border/60 transition-all hover:bg-muted/50 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="flex min-w-0 items-center gap-3">
              <div className="kaizen-page-heading-icon"><Dumbbell /></div>
              <div><h1 className="kaizen-page-heading-title">Physical Conditioning</h1>
              <p className="kaizen-page-heading-description">Hypertrophy protocol and strength tracking.</p></div>
            </div>
          </div>

          {/* View Toggler Tabs */}
          <div className="flex h-10 items-center rounded-xl border border-border/30 bg-muted/40 p-1">
            <Button
              variant={view === "tracker" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("tracker")}
              className="h-8 rounded-lg px-4 text-xs font-semibold transition-all"
            >
              <Target className="mr-1.5 h-3.5 w-3.5" /> Tracker
            </Button>
            <Button
              variant={view === "codex" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("codex")}
              className="h-8 rounded-lg px-4 text-xs font-semibold transition-all"
            >
              <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Codex Guide
            </Button>
          </div>
        </header>

        {view === "tracker" ? (
          <>
            {/* Level Banner tied directly to Player Stats table context */}
            <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl space-y-1.5">
                  <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                    <Trophy className="h-4 w-4 text-foreground/60" />
                    System Strength: Level {currentLevel}
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {exercises.length > 0
                      ? "Hypertrophy protocols optimal. Maintain consistency for progressive overload and muscle adaptations."
                      : "Awaiting initial combat data to formulate progression trajectories."}
                  </p>
                </div>
                <div className="w-full shrink-0 rounded-xl border border-border/40 bg-muted/10 p-4 sm:w-64">
                  <div className="mb-2 flex justify-between text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    <span>STR Progression</span>
                    <span className="font-mono font-semibold text-foreground">
                      {strengthPoints} / {xpForNextLevel}
                    </span>
                  </div>
                  <Progress
                    value={progressPct}
                    className="h-1.5 bg-muted transition-all duration-1000"
                  />
                </div>
              </div>
            </div>

            {/* Exercise Mastery Index */}
            <div className="space-y-4 pt-4">
              <h3 className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Exercise Mastery Index
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(exerciseStats).map(([name, data]) => {
                  const timed = TIMED_EXERCISES.includes(name)
                  return (
                    <Card
                      key={name}
                      className="border border-border/50 bg-card/50"
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-bold">
                            {name}
                          </span>
                          <div
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
                              getExerciseRank(name)
                            )}
                          >
                            PB: {data.pb}
                            {timed ? "s" : " Reps"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>
                              {timed ? "Total Duration" : "Total Volume"}
                            </span>
                            <span className="font-mono font-bold">
                              {data.totalVolume}
                              {timed ? "s" : " reps"}
                            </span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{
                                width: `${Math.min((data.totalVolume / (timed ? 1200 : 500)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Input Form Card */}
            <Card className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold tracking-wider text-foreground uppercase">
                    Log Execution
                  </span>
                </div>
                <form
                  onSubmit={handleAddExercise}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-12"
                >
                  <div className="space-y-1.5 sm:col-span-5">
                    <label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Exercise Matrix
                    </label>
                    <Select
                      value={form.name}
                      onValueChange={(value) =>
                        setForm({ ...form, name: value })
                      }
                      required
                    >
                      <SelectTrigger className="border-border/60 bg-muted/20 text-sm focus:ring-1 focus:ring-primary/25">
                        <SelectValue placeholder="Select active protocol..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {Object.entries(RANK_GROUPS).map(
                          ([groupLabel, items]) => (
                            <SelectGroup key={groupLabel}>
                              <SelectLabel className="mb-1 flex items-center gap-1 border-b border-border/30 pt-2 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase">
                                <Shield className="inline h-3 w-3 opacity-60" />{" "}
                                {groupLabel}
                              </SelectLabel>
                              {items.map((exerciseName) => (
                                <SelectItem
                                  key={exerciseName}
                                  value={exerciseName}
                                  className="text-xs"
                                >
                                  {exerciseName}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Sets
                    </label>
                    <Input
                      type="number"
                      value={form.sets}
                      onChange={(e) =>
                        setForm({ ...form, sets: e.target.value })
                      }
                      placeholder="0"
                      min="1"
                      className="border-border/60 bg-muted/20 text-center font-mono text-sm focus-visible:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {isCurrentExerciseTimed ? "Duration" : "Reps"}
                    </label>
                    {isCurrentExerciseTimed ? (
                      <Input
                        type="number"
                        value={form.duration}
                        onChange={(e) =>
                          setForm({ ...form, duration: e.target.value })
                        }
                        placeholder="Secs"
                        min="1"
                        className="border-border/60 bg-muted/20 text-center font-mono text-sm focus-visible:ring-primary/20"
                        required
                      />
                    ) : (
                      <Input
                        type="number"
                        value={form.reps}
                        onChange={(e) =>
                          setForm({ ...form, reps: e.target.value })
                        }
                        placeholder="0"
                        min="1"
                        className="border-border/60 bg-muted/20 text-center font-mono text-sm focus-visible:ring-primary/20"
                        required
                      />
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-3">
                    <label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      Rest (Sec)
                    </label>
                    <Input
                      type="number"
                      value={form.rest}
                      onChange={(e) =>
                        setForm({ ...form, rest: e.target.value })
                      }
                      placeholder="90"
                      min="0"
                      className="border-border/60 bg-muted/20 text-center font-mono text-sm focus-visible:ring-primary/20"
                      required
                    />
                  </div>

                  <Button
                    disabled={isSubmitting}
                    type="submit"
                    className="mt-1 h-10 w-full font-semibold sm:col-span-12"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Commit to Matrix
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Combat History Logs */}
            <div className="space-y-4">
              <h3 className="px-1 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Combat Log History
              </h3>
              {exercises.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 text-center">
                  <p className="text-xs font-semibold tracking-tight text-muted-foreground/70">
                    No conditioning records found.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {exercises.map((ex) => {
                    const timed = TIMED_EXERCISES.includes(ex.name)
                    return (
                      <Card
                        key={ex.id}
                        className="group relative overflow-hidden border border-border/40 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border/80"
                      >
                        <CardContent className="flex h-full flex-col justify-between space-y-5 px-5 pt-5 pb-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-3xl font-black tracking-tighter text-foreground opacity-15 select-none">
                                +{ex.xp_earned}
                              </span>
                              <span className="rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                {ex.created_at
                                  ? format(
                                      new Date(ex.created_at),
                                      "MMM dd, HH:mm"
                                    )
                                  : "Syncing..."}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground">
                                {ex.name}
                              </h3>
                              <p className="font-mono text-xs leading-relaxed text-muted-foreground/80">
                                {ex.sets} Sets × {ex.reps}
                                {timed ? "s Hold" : " Reps"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between border-t border-border/30 pt-3">
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                              <Timer className="h-3.5 w-3.5" />
                              {ex.rest_seconds}s Rest
                            </div>
                            <span className="text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase">
                              XP
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Condition Codex Guide Layer UI */
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
            {/* Left Column: Navigation Directory */}
            <div className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-2 md:col-span-4">
              {Object.entries(RANK_GROUPS).map(([groupLabel, items]) => (
                <div key={groupLabel} className="space-y-1.5">
                  <span className="block px-1 text-[10px] font-extrabold tracking-widest text-muted-foreground/70 uppercase">
                    {groupLabel}
                  </span>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const isActive = selectedCodexExercise === item
                      return (
                        <button
                          key={item}
                          onClick={() => setSelectedCodexExercise(item)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all",
                            isActive
                              ? "border-foreground bg-foreground font-bold text-background shadow-sm"
                              : "border-border/50 bg-card/50 text-foreground hover:bg-muted/40"
                          )}
                        >
                          <span>{item}</span>
                          <span className="font-mono text-[10px] opacity-60">
                            ×{XP_MULTIPLIERS[item]?.toFixed(1)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Execution Information Display */}
            <div className="space-y-6 md:col-span-8">
              <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
                {/* Interactive Dynamic Media Frame Container */}
                <div className="group relative flex aspect-video w-full items-center justify-center border-b border-border/40 bg-muted/30">
                  {activeGuideData.videoUrl ? (
                    <iframe
                      src={activeGuideData.videoUrl}
                      title={`${selectedCodexExercise} Form Guide`}
                      className="h-full w-full object-cover"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="space-y-3 p-6 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-foreground/5 text-muted-foreground">
                        <Tv className="h-5 w-5 animate-pulse opacity-70" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold tracking-wider text-foreground uppercase">
                          Media Frame Holo-Link
                        </p>
                        <p className="mx-auto max-w-xs text-[11px] text-muted-foreground">
                          Drop an embed link or a loop GIF inside{" "}
                          <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                            EXERCISE_GUIDES["{selectedCodexExercise}"].videoUrl
                          </code>{" "}
                          to initialize active telemetry projection.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <CardContent className="space-y-6 p-6">
                  {/* Title Header metadata block */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold tracking-tight text-foreground">
                        {selectedCodexExercise}
                      </h2>
                      <div
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[9px] font-black tracking-widest uppercase",
                          getExerciseRank(selectedCodexExercise)
                        )}
                      >
                        XP Modifier: {XP_MULTIPLIERS[selectedCodexExercise]}x
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {activeGuideData.description}
                    </p>
                  </div>

                  {/* Targeted Muscle Structural Groupings */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      Targeted Fibers
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeGuideData.muscles.map((muscle) => (
                        <span
                          key={muscle}
                          className="rounded-lg border border-border/40 bg-muted px-2.5 py-1 text-xs font-medium"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Step-by-Step Instructions Matrix */}
                  <div className="space-y-3 pt-2">
                    <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      Execution Steps
                    </span>
                    <div className="space-y-2.5">
                      {activeGuideData.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex gap-3 text-xs leading-relaxed text-foreground/90"
                        >
                          <span className="font-mono font-bold text-muted-foreground/80">
                            {(idx + 1).toString().padStart(2, "0")}.
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Execution Mechanics / Form Cues Checkpoints */}
                  <div className="space-y-3 pt-2">
                    <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      Execution Matrix Cues
                    </span>
                    <div className="space-y-2.5">
                      {activeGuideData.cues.map((cue, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 text-xs leading-relaxed text-foreground/90"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{cue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
