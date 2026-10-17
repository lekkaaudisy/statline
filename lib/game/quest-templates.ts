// The hand-written quest library (no AI generation yet). Every template
// follows the safety rules: activity and skill only, no calorie, weight,
// fasting or body-size targets, and no scored virtues.
//
// Placeholders, filled in when a quest is built:
//   {m}        minutes for this quest (difficulty rank x time available)
//   {sessions} sessions in the week (main quests)
//   {goal}     the user's goal (main quests)
import type { ClassId } from "./classes";
import type { EarnedStat } from "./stats";

export type QuestTemplate = {
  id: string;
  stat: EarnedStat;
  title: string;
};

// Daily and side quest templates for each Class. These count toward the
// Class share of quests (about 60%).
export const CLASS_TEMPLATES: Record<ClassId, readonly QuestTemplate[]> = {
  fighter: [
    { id: "fighter-1", stat: "strength", title: "{m} minutes of your sport or training, warm-up included" },
    { id: "fighter-2", stat: "strength", title: "Practise one movement skill for {m} minutes (footwork, a kata, a balance drill)" },
    { id: "fighter-3", stat: "strength", title: "Brisk walk or easy jog for {m} minutes" },
    { id: "fighter-4", stat: "strength", title: "Bodyweight circuit for {m} minutes at a pace you can still talk at" },
    { id: "fighter-5", stat: "strength", title: "Learn one new drill or combination and practise it for {m} minutes" },
    { id: "fighter-6", stat: "strength", title: "Mobility and stretching routine, {m} minutes" },
    { id: "fighter-7", stat: "endurance", title: "Cool down and stretch for 10 minutes after training" },
    { id: "fighter-8", stat: "endurance", title: "Log how you feel after today's session: energy, soreness, sleep" },
    { id: "fighter-9", stat: "endurance", title: "Lights out at your planned time to recover for training" },
    { id: "fighter-10", stat: "intelligence", title: "Watch a technique video for your sport and write down 3 cues" },
    { id: "fighter-11", stat: "speed", title: "Plan this week's training sessions in your calendar" },
    { id: "fighter-12", stat: "speed", title: "Pack your training bag the night before and start on time" },
  ],
  scholar: [
    { id: "scholar-1", stat: "intelligence", title: "Study your course or exam material for {m} minutes" },
    { id: "scholar-2", stat: "intelligence", title: "Read for {m} minutes, then write a 3-line summary" },
    { id: "scholar-3", stat: "intelligence", title: "Make 10 flashcards from today's material and review them" },
    { id: "scholar-4", stat: "intelligence", title: "Explain one idea you learned today in your own words, out loud or in writing" },
    { id: "scholar-5", stat: "intelligence", title: "Practice questions or past-paper problems for {m} minutes" },
    { id: "scholar-6", stat: "intelligence", title: "Practise your language or skill for {m} minutes" },
    { id: "scholar-7", stat: "speed", title: "Plan tomorrow's study block: topic, start time, end time" },
    { id: "scholar-8", stat: "speed", title: "Start your study session within 5 minutes of the planned time" },
    { id: "scholar-9", stat: "speed", title: "Finish one chapter or course module you have started" },
    { id: "scholar-10", stat: "endurance", title: "Review yesterday's notes for {m} minutes" },
    { id: "scholar-11", stat: "endurance", title: "Phone in another room for one full study block" },
    { id: "scholar-12", stat: "strength", title: "Take a {m}-minute walk between study blocks" },
  ],
  builder: [
    { id: "builder-1", stat: "intelligence", title: "Build for {m} minutes on the hardest open part of your project" },
    { id: "builder-2", stat: "intelligence", title: "Learn one new tool or technique for {m} minutes and try it" },
    { id: "builder-3", stat: "intelligence", title: "Study how someone built something similar and note 3 ideas" },
    { id: "builder-4", stat: "intelligence", title: "Show your progress to one person and ask for one piece of feedback" },
    { id: "builder-5", stat: "speed", title: "Ship one small piece: a feature, a part or a fix" },
    { id: "builder-6", stat: "speed", title: "Write tomorrow's 3 project tasks, smallest first" },
    { id: "builder-7", stat: "speed", title: "Finish a task you started earlier this week" },
    { id: "builder-8", stat: "endurance", title: "Work on your project for {m} minutes, even a small step" },
    { id: "builder-9", stat: "endurance", title: "Write a short build log: what you did, what is next" },
    { id: "builder-10", stat: "endurance", title: "Tidy your workspace or files for 10 minutes, then stop" },
    { id: "builder-11", stat: "strength", title: "Take a {m}-minute walk away from the screen or bench" },
  ],
  professional: [
    { id: "professional-1", stat: "speed", title: "Do your most important work task before noon" },
    { id: "professional-2", stat: "speed", title: "Plan tomorrow's workday in 10 minutes before you finish today" },
    { id: "professional-3", stat: "speed", title: "Do one {m}-minute focus block with notifications off" },
    { id: "professional-4", stat: "speed", title: "Send the message or email you have been putting off" },
    { id: "professional-5", stat: "speed", title: "Clear your task list down to one next action per item" },
    { id: "professional-6", stat: "intelligence", title: "Work on a skill for your goal (course, certification) for {m} minutes" },
    { id: "professional-7", stat: "intelligence", title: "Read one article or chapter in your field and note one idea to use" },
    { id: "professional-8", stat: "intelligence", title: "Update your CV or portfolio with one recent result" },
    { id: "professional-9", stat: "endurance", title: "Take a real lunch break away from your desk" },
    { id: "professional-10", stat: "endurance", title: "Stop work at your planned finish time" },
    { id: "professional-11", stat: "strength", title: "Walk for {m} minutes during your workday" },
  ],
  monk: [
    { id: "monk-1", stat: "endurance", title: "Meditate for {m} minutes" },
    { id: "monk-2", stat: "endurance", title: "Lights out at your planned bedtime" },
    { id: "monk-3", stat: "endurance", title: "Journal for {m} minutes this evening" },
    { id: "monk-4", stat: "endurance", title: "No phone for the first 30 minutes after waking" },
    { id: "monk-5", stat: "endurance", title: "Screen-free hour before bed" },
    { id: "monk-6", stat: "endurance", title: "Slow breathing exercise for 5 minutes" },
    { id: "monk-7", stat: "speed", title: "Do your morning routine in order, no skipping" },
    { id: "monk-8", stat: "speed", title: "Set tomorrow's 3 priorities before bed" },
    { id: "monk-9", stat: "strength", title: "Slow walk outside for {m} minutes, phone away" },
    { id: "monk-10", stat: "strength", title: "Gentle yoga or stretching for {m} minutes" },
    { id: "monk-11", stat: "intelligence", title: "Read a calm book (philosophy, nature, poetry) for {m} minutes" },
    { id: "monk-12", stat: "intelligence", title: "Write down one thing you learned about yourself today" },
  ],
  leader: [
    { id: "leader-1", stat: "speed", title: "Speak up at least once in a meeting or group conversation" },
    { id: "leader-2", stat: "speed", title: "Send the agenda or plan for your next group session" },
    { id: "leader-3", stat: "speed", title: "Follow up on one promise you made to your team" },
    { id: "leader-4", stat: "speed", title: "Make one decision you have been delaying and tell the people it affects" },
    { id: "leader-5", stat: "intelligence", title: "Prepare talking points for your next meeting or talk" },
    { id: "leader-6", stat: "intelligence", title: "Practise your talk out loud for {m} minutes" },
    { id: "leader-7", stat: "intelligence", title: "Read about leadership or communication for {m} minutes and note one idea" },
    { id: "leader-8", stat: "intelligence", title: "Teach one thing you know to someone for {m} minutes" },
    { id: "leader-9", stat: "endurance", title: "Block time in your calendar for deep work, and keep it" },
    { id: "leader-10", stat: "endurance", title: "Write a short weekly review: what went well, what to fix" },
    { id: "leader-11", stat: "strength", title: "Walk-and-think or walking meeting for {m} minutes" },
  ],
};

// The balance pool, shared by every Class: the other 40% of quests.
export const BALANCE_TEMPLATES: readonly QuestTemplate[] = [
  { id: "balance-strength-1", stat: "strength", title: "Walk for {m} minutes" },
  { id: "balance-strength-2", stat: "strength", title: "Easy bodyweight basics (squats, push-ups, planks) for {m} minutes" },
  { id: "balance-strength-3", stat: "strength", title: "Stretch for {m} minutes" },
  { id: "balance-speed-1", stat: "speed", title: "Finish your most important task before lunch" },
  { id: "balance-speed-2", stat: "speed", title: "Write tomorrow's 3 tasks before bed" },
  { id: "balance-speed-3", stat: "speed", title: "{m}-minute focus block on something you have put off" },
  { id: "balance-endurance-1", stat: "endurance", title: "Lights out at your planned bedtime" },
  { id: "balance-endurance-2", stat: "endurance", title: "Screen-free {m} minutes before bed" },
  { id: "balance-endurance-3", stat: "endurance", title: "Keep one habit you care about today" },
  { id: "balance-intelligence-1", stat: "intelligence", title: "Read for {m} minutes" },
  { id: "balance-intelligence-2", stat: "intelligence", title: "Learn something new for {m} minutes and write one line about it" },
  { id: "balance-intelligence-3", stat: "intelligence", title: "Practise a skill for {m} minutes" },
];

// The stat each Class's main quest trains.
export const CLASS_MAIN_STAT: Record<ClassId, EarnedStat> = {
  fighter: "strength",
  scholar: "intelligence",
  builder: "intelligence",
  professional: "speed",
  monk: "endurance",
  leader: "speed",
};

const GOAL_WEEK = 'Goal week: {sessions} sessions of {m} minutes on "{goal}"';

// Weekly main quests, built from the goal. Two per Class.
export const MAIN_TEMPLATES: Record<ClassId, readonly QuestTemplate[]> = {
  fighter: [
    { id: "main-fighter-1", stat: "strength", title: GOAL_WEEK },
    { id: "main-fighter-2", stat: "strength", title: 'Train {sessions} days this week toward "{goal}", with at least 2 rest days' },
  ],
  scholar: [
    { id: "main-scholar-1", stat: "intelligence", title: GOAL_WEEK },
    { id: "main-scholar-2", stat: "intelligence", title: 'Study on {sessions} days this week toward "{goal}"' },
  ],
  builder: [
    { id: "main-builder-1", stat: "intelligence", title: GOAL_WEEK },
    { id: "main-builder-2", stat: "intelligence", title: 'Build on {sessions} days this week toward "{goal}" and show one result' },
  ],
  professional: [
    { id: "main-professional-1", stat: "speed", title: GOAL_WEEK },
    { id: "main-professional-2", stat: "speed", title: 'Complete {sessions} focus blocks this week toward "{goal}"' },
  ],
  monk: [
    { id: "main-monk-1", stat: "endurance", title: GOAL_WEEK },
    { id: "main-monk-2", stat: "endurance", title: 'Keep your practice on {sessions} days this week toward "{goal}"' },
  ],
  leader: [
    { id: "main-leader-1", stat: "speed", title: GOAL_WEEK },
    { id: "main-leader-2", stat: "speed", title: 'Take {sessions} leadership actions this week toward "{goal}"' },
  ],
};

// Fills in a template's placeholders.
export function fillTitle(
  title: string,
  values: { minutes?: number; sessions?: number; goal?: string },
): string {
  return title
    .replaceAll("{m}", String(values.minutes ?? ""))
    .replaceAll("{sessions}", String(values.sessions ?? ""))
    .replaceAll("{goal}", values.goal ?? "");
}

export function usesMinutes(template: QuestTemplate): boolean {
  return template.title.includes("{m}");
}
