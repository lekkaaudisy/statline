// Placement quests for the calibration week. Every template follows the
// safety rules: activity and skill only, no calorie, weight, fasting or
// body-size targets, and no scored virtues.
//
// Placeholders, filled in when a quest is built:
//   {m}     minutes for this quest
//   {goal}  the user's goal
import type { ClassId } from "./classes";
import type { QuestTemplate } from "./quest-templates";

// One stat placement quest per onboarding question. Each stat's placement
// quest tests the habit from whichever of its two questions scored lower.
export const QUESTION_PLACEMENTS: Record<string, QuestTemplate> = {
  S1: { id: "placement-S1", stat: "strength", title: "Get {m} minutes of activity that makes you breathe harder (brisk walk, sport, cycling)" },
  S2: { id: "placement-S2", stat: "strength", title: "One strength or movement skill session of {m} minutes (push-ups, yoga, climbing, dance)" },
  P1: { id: "placement-P1", stat: "speed", title: "Plan 3 tasks this morning and finish all 3 by the end of the day" },
  P2: { id: "placement-P2", stat: "speed", title: "Pick one thing you have put off and finish it today" },
  E1: { id: "placement-E1", stat: "endurance", title: "Lights out at a set time tonight, giving yourself 7 hours of sleep" },
  E2: { id: "placement-E2", stat: "endurance", title: "Keep one habit you care about today and note that you did it" },
  I1: { id: "placement-I1", stat: "intelligence", title: "Learn something on purpose for {m} minutes (a book, a course, a skill)" },
  I2: { id: "placement-I2", stat: "intelligence", title: "Finish one short lesson, chapter or tutorial and write 2 lines on what you learned" },
};

// Placement quests from the Class goal: three per Class, used in order
// (the first always, the others for 30 and 60 minutes a day).
export const GOAL_PLACEMENTS: Record<ClassId, readonly QuestTemplate[]> = {
  fighter: [
    { id: "placement-fighter-1", stat: "strength", title: '{m} minutes of training toward "{goal}", warm-up included' },
    { id: "placement-fighter-2", stat: "speed", title: 'Plan your next 3 sessions toward "{goal}" in your calendar' },
    { id: "placement-fighter-3", stat: "endurance", title: 'After training for "{goal}", stretch for 10 minutes and log how you feel' },
  ],
  scholar: [
    { id: "placement-scholar-1", stat: "intelligence", title: '{m} minutes of focused study toward "{goal}"' },
    { id: "placement-scholar-2", stat: "speed", title: 'Write this week\'s study plan for "{goal}" and do the first session' },
    { id: "placement-scholar-3", stat: "intelligence", title: 'Explain one thing you learned for "{goal}" in your own words, in writing' },
  ],
  builder: [
    { id: "placement-builder-1", stat: "intelligence", title: '{m} minutes of building toward "{goal}"' },
    { id: "placement-builder-2", stat: "speed", title: 'Break "{goal}" into 3 next steps and finish the first one' },
    { id: "placement-builder-3", stat: "intelligence", title: 'Show one small result toward "{goal}": a photo, a link or a note' },
  ],
  professional: [
    { id: "placement-professional-1", stat: "speed", title: '{m}-minute focus block toward "{goal}"' },
    { id: "placement-professional-2", stat: "speed", title: 'Finish one task toward "{goal}" before midday' },
    { id: "placement-professional-3", stat: "intelligence", title: 'Learn one thing that helps with "{goal}" and write it down' },
  ],
  monk: [
    { id: "placement-monk-1", stat: "endurance", title: '{m} minutes of your practice toward "{goal}"' },
    { id: "placement-monk-2", stat: "endurance", title: 'Practise for "{goal}" at a time you set in advance, and note how it went' },
    { id: "placement-monk-3", stat: "intelligence", title: 'Read or watch something about "{goal}" and note one idea to try' },
  ],
  leader: [
    { id: "placement-leader-1", stat: "speed", title: '{m} minutes on one action toward "{goal}"' },
    { id: "placement-leader-2", stat: "speed", title: 'Plan this week\'s 3 key actions toward "{goal}"' },
    { id: "placement-leader-3", stat: "intelligence", title: 'Ask one person for feedback on "{goal}" and write down what you learned' },
  ],
};
