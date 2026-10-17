// The six Classes and the example goals offered for each during onboarding.
// Goals are about activity and skill only: no body-size or diet goals.

export const CLASSES = [
  "fighter",
  "scholar",
  "builder",
  "professional",
  "monk",
  "leader",
] as const;
export type ClassId = (typeof CLASSES)[number];

export function isClassId(value: unknown): value is ClassId {
  return CLASSES.includes(value as ClassId);
}

export const CLASS_INFO: Record<
  ClassId,
  { name: string; tagline: string; exampleGoals: readonly string[] }
> = {
  fighter: {
    name: "Fighter",
    tagline: "Train the body: sport, movement and physical skill.",
    exampleGoals: [
      "Run 5 km without stopping",
      "Do 20 push-ups in a row with good form",
      "Train a martial art or sport 3 times a week",
      "Learn a full beginner routine (yoga, calisthenics or kata)",
      "Hike a trail I have never done",
    ],
  },
  scholar: {
    name: "Scholar",
    tagline: "Learn on purpose: study, reading and languages.",
    exampleGoals: [
      "Finish one non-fiction book a month",
      "Complete an online course",
      "Learn 500 words of a new language",
      "Prepare for an exam",
      "Write a weekly summary of what I learned",
    ],
  },
  builder: {
    name: "Builder",
    tagline: "Make things: projects, code and crafts.",
    exampleGoals: [
      "Ship a small side project",
      "Build my personal website",
      "Finish a DIY or craft project",
      "Publish a simple app",
      "Make one new thing every week",
    ],
  },
  professional: {
    name: "Professional",
    tagline: "Grow your career: work, focus and skills that pay.",
    exampleGoals: [
      "Prepare for a promotion review",
      "Land a new job",
      "Plan every workday the night before",
      "Earn a work certification",
      "Make my first sale from a side business",
    ],
  },
  monk: {
    name: "Monk",
    tagline: "Steady the mind: rest, routine and calm.",
    exampleGoals: [
      "Meditate 10 minutes a day",
      "Keep a steady bedtime on weeknights",
      "Cut phone screen time to under 2 hours a day",
      "Journal every evening",
      "Build a calm morning routine",
    ],
  },
  leader: {
    name: "Leader",
    tagline: "Lead people: speaking, organising and teaching.",
    exampleGoals: [
      "Lead a project at work or school",
      "Give a talk or presentation",
      "Organise a monthly meetup",
      "Mentor someone",
      "Speak up in every meeting",
    ],
  },
};
