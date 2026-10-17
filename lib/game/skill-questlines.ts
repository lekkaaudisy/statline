// Starter Skill questlines: short step-by-step questlines opened by Skill
// cards, two per Class. One step is given per day.
//
// Every step follows the safety rules: activity and skill only, no calorie,
// weight, fasting or body-size targets. Strength steps build up gradually
// and never ask for more than 30 minutes. Ranks stay at 1 to 3, so honour
// proof is always allowed.
import type { ClassId } from "./classes";
import type { EarnedStat } from "./stats";

export type SkillStep = { title: string; stat: EarnedStat; rank: number };

export type Questline = {
  id: string;
  classId: ClassId;
  name: string;
  summary: string;
  steps: readonly SkillStep[];
};

export const SKILL_QUESTLINES: readonly Questline[] = [
  // Fighter -------------------------------------------------------------------
  {
    id: "fighter-boxing",
    classId: "fighter",
    name: "Boxing Basics",
    summary: "Stance, footwork and your first combinations.",
    steps: [
      { stat: "strength", rank: 1, title: "Boxing Basics 1: stance and guard in front of a mirror, 10 minutes" },
      { stat: "strength", rank: 1, title: "Boxing Basics 2: footwork drill, step forward, back and to the side, 15 minutes" },
      { stat: "strength", rank: 2, title: "Boxing Basics 3: slow jab and cross on the air, 15 minutes, form first" },
      { stat: "intelligence", rank: 1, title: "Boxing Basics 4: watch a beginner technique video and write down 3 cues" },
      { stat: "strength", rank: 2, title: "Boxing Basics 5: shadowbox jab, cross, hook for 3 rounds of 2 minutes, with rests" },
      { stat: "strength", rank: 3, title: "Boxing Basics 6: film a 3-round shadowboxing session, or try a beginner class" },
    ],
  },
  {
    id: "fighter-runwalk",
    classId: "fighter",
    name: "Run-Walk Starter",
    summary: "From walking to 10 minutes of easy running.",
    steps: [
      { stat: "endurance", rank: 1, title: "Run-Walk 1: brisk walk for 20 minutes" },
      { stat: "strength", rank: 1, title: "Run-Walk 2: run 1 minute, walk 2 minutes, 5 times" },
      { stat: "speed", rank: 1, title: "Run-Walk 3: put 3 run days for this week in your calendar" },
      { stat: "strength", rank: 2, title: "Run-Walk 4: run 2 minutes, walk 2 minutes, 5 times" },
      { stat: "endurance", rank: 1, title: "Run-Walk 5: easy stretching for 10 minutes after a walk" },
      { stat: "strength", rank: 2, title: "Run-Walk 6: run 3 minutes, walk 1 minute, 5 times" },
      { stat: "strength", rank: 3, title: "Run-Walk 7: run 5 minutes, walk 1 minute, 4 times" },
      { stat: "strength", rank: 3, title: "Run-Walk 8: run 10 minutes at an easy pace without stopping" },
    ],
  },

  // Scholar -------------------------------------------------------------------
  {
    id: "scholar-memory",
    classId: "scholar",
    name: "Memory Toolkit",
    summary: "Flashcards, a memory palace and teaching it back.",
    steps: [
      { stat: "intelligence", rank: 1, title: "Memory Toolkit 1: pick a topic and make 15 flashcards" },
      { stat: "intelligence", rank: 1, title: "Memory Toolkit 2: review your cards and sort them into \"know\" and \"not yet\"" },
      { stat: "intelligence", rank: 2, title: "Memory Toolkit 3: review only the \"not yet\" cards, then add 10 new ones" },
      { stat: "intelligence", rank: 2, title: "Memory Toolkit 4: build a memory palace for a list of 7 items" },
      { stat: "intelligence", rank: 2, title: "Memory Toolkit 5: test yourself without notes and write down your score" },
      { stat: "intelligence", rank: 3, title: "Memory Toolkit 6: teach the topic to someone in 5 minutes" },
    ],
  },
  {
    id: "scholar-reading",
    classId: "scholar",
    name: "Read to Remember",
    summary: "Read one book with questions, notes and a summary.",
    steps: [
      { stat: "speed", rank: 1, title: "Read to Remember 1: choose a book and plan 5 reading slots this week" },
      { stat: "intelligence", rank: 1, title: "Read to Remember 2: skim the contents and write 3 questions you want answered" },
      { stat: "intelligence", rank: 2, title: "Read to Remember 3: read for 20 minutes and note any answers you find" },
      { stat: "intelligence", rank: 2, title: "Read to Remember 4: read for 20 minutes, then write a one-page summary" },
      { stat: "intelligence", rank: 3, title: "Read to Remember 5: share 3 takeaways with someone, or post them" },
    ],
  },

  // Builder -------------------------------------------------------------------
  {
    id: "builder-ship",
    classId: "builder",
    name: "Ship in Five",
    summary: "Cut a project down and finish it.",
    steps: [
      { stat: "speed", rank: 1, title: "Ship in Five 1: describe your project in one sentence and cut it to a weekend's work" },
      { stat: "speed", rank: 1, title: "Ship in Five 2: list 5 tasks, smallest first" },
      { stat: "intelligence", rank: 2, title: "Ship in Five 3: build the smallest task from your list" },
      { stat: "intelligence", rank: 2, title: "Ship in Five 4: show it to one person and ask for one note" },
      { stat: "speed", rank: 3, title: "Ship in Five 5: act on that note, then publish or show the finished piece" },
    ],
  },
  {
    id: "builder-tool",
    classId: "builder",
    name: "New Tool Sprint",
    summary: "Learn one new tool or technique and use it for real.",
    steps: [
      { stat: "intelligence", rank: 1, title: "New Tool Sprint 1: pick one tool or technique and find a beginner guide" },
      { stat: "intelligence", rank: 1, title: "New Tool Sprint 2: follow the guide for 20 minutes" },
      { stat: "intelligence", rank: 2, title: "New Tool Sprint 3: make a tiny practice piece with it" },
      { stat: "intelligence", rank: 2, title: "New Tool Sprint 4: make the practice piece again without the guide" },
      { stat: "intelligence", rank: 2, title: "New Tool Sprint 5: write a short how-to in your own words" },
      { stat: "speed", rank: 3, title: "New Tool Sprint 6: use the tool in your real project" },
    ],
  },

  // Professional --------------------------------------------------------------
  {
    id: "professional-focus",
    classId: "professional",
    name: "Focus Reset",
    summary: "Clear your plate and protect focus time.",
    steps: [
      { stat: "speed", rank: 1, title: "Focus Reset 1: list everything on your plate in 10 minutes" },
      { stat: "speed", rank: 1, title: "Focus Reset 2: pick your top 3 for the week" },
      { stat: "speed", rank: 2, title: "Focus Reset 3: one 25-minute focus block with notifications off" },
      { stat: "endurance", rank: 2, title: "Focus Reset 4: two focus blocks with a short walk between them" },
      { stat: "endurance", rank: 2, title: "Focus Reset 5: end-of-week review: what got done, moved or dropped" },
    ],
  },
  {
    id: "professional-story",
    classId: "professional",
    name: "Career Story",
    summary: "Turn your wins into a story you can tell.",
    steps: [
      { stat: "intelligence", rank: 1, title: "Career Story 1: write down 3 recent wins and their results" },
      { stat: "intelligence", rank: 2, title: "Career Story 2: turn one win into a 1-minute story: situation, action, result" },
      { stat: "speed", rank: 2, title: "Career Story 3: update your CV or profile with your wins" },
      { stat: "intelligence", rank: 2, title: "Career Story 4: practise your story out loud 3 times" },
      { stat: "intelligence", rank: 2, title: "Career Story 5: ask a colleague or friend for feedback on it" },
      { stat: "speed", rank: 3, title: "Career Story 6: send the application, pitch or request you have been holding" },
    ],
  },

  // Monk ----------------------------------------------------------------------
  {
    id: "monk-breath",
    classId: "monk",
    name: "Breath and Stillness",
    summary: "From 3 minutes of breathing to a 10-minute sit.",
    steps: [
      { stat: "endurance", rank: 1, title: "Breath and Stillness 1: 3 minutes of slow breathing" },
      { stat: "endurance", rank: 1, title: "Breath and Stillness 2: 5 minutes of counting breaths from 1 to 10" },
      { stat: "endurance", rank: 1, title: "Breath and Stillness 3: a 5-minute body scan" },
      { stat: "endurance", rank: 2, title: "Breath and Stillness 4: 8 minutes of sitting meditation" },
      { stat: "strength", rank: 1, title: "Breath and Stillness 5: a 10-minute mindful walk, no phone" },
      { stat: "endurance", rank: 2, title: "Breath and Stillness 6: 10 minutes of sitting meditation" },
      { stat: "intelligence", rank: 2, title: "Breath and Stillness 7: write what changed for you this week" },
    ],
  },
  {
    id: "monk-winddown",
    classId: "monk",
    name: "Evening Wind-Down",
    summary: "Build a calm routine for the hour before bed.",
    steps: [
      { stat: "speed", rank: 1, title: "Evening Wind-Down 1: pick a bedtime and set a reminder for it" },
      { stat: "endurance", rank: 1, title: "Evening Wind-Down 2: screens off 30 minutes before bed" },
      { stat: "speed", rank: 1, title: "Evening Wind-Down 3: write tomorrow's top 3 before bed" },
      { stat: "strength", rank: 1, title: "Evening Wind-Down 4: 10 minutes of light stretching before bed" },
      { stat: "endurance", rank: 2, title: "Evening Wind-Down 5: screens off 60 minutes before bed" },
      { stat: "endurance", rank: 2, title: "Evening Wind-Down 6: lights out at your bedtime, then note how you slept" },
    ],
  },

  // Leader --------------------------------------------------------------------
  {
    id: "leader-speak",
    classId: "leader",
    name: "Speak with Confidence",
    summary: "From a recorded intro to a short talk for a group.",
    steps: [
      { stat: "intelligence", rank: 1, title: "Speak with Confidence 1: record a 1-minute introduction and listen back" },
      { stat: "intelligence", rank: 1, title: "Speak with Confidence 2: write 3 notes on what to improve" },
      { stat: "intelligence", rank: 2, title: "Speak with Confidence 3: record it again using one of your notes" },
      { stat: "intelligence", rank: 2, title: "Speak with Confidence 4: give a 2-minute talk to a friend or family member" },
      { stat: "speed", rank: 2, title: "Speak with Confidence 5: share one idea or question in a meeting or class" },
      { stat: "intelligence", rank: 3, title: "Speak with Confidence 6: give a short talk or update to a group" },
    ],
  },
  {
    id: "leader-meeting",
    classId: "leader",
    name: "Run a Great Meeting",
    summary: "Agenda, time boxes, notes and follow-up.",
    steps: [
      { stat: "speed", rank: 1, title: "Run a Great Meeting 1: write an agenda with time boxes for your next meeting" },
      { stat: "speed", rank: 1, title: "Run a Great Meeting 2: send the agenda a day early" },
      { stat: "speed", rank: 2, title: "Run a Great Meeting 3: run the meeting and end on time" },
      { stat: "speed", rank: 2, title: "Run a Great Meeting 4: send notes with owners and dates within 2 hours" },
      { stat: "intelligence", rank: 2, title: "Run a Great Meeting 5: ask one attendee what to improve next time" },
    ],
  },
];

export function getQuestline(id: string): Questline | undefined {
  return SKILL_QUESTLINES.find((q) => q.id === id);
}

// The questlines a player's Classes can open: the main Class first.
export function questlinesForClasses(
  mainClass: ClassId,
  secondClass: ClassId | null,
): Questline[] {
  return [
    ...SKILL_QUESTLINES.filter((q) => q.classId === mainClass),
    ...SKILL_QUESTLINES.filter((q) => secondClass && q.classId === secondClass),
  ];
}

// The quest template id of a step (1-based), e.g. "skill-monk-breath-3".
export function stepTemplateId(questlineId: string, step: number): string {
  return `skill-${questlineId}-${step}`;
}
