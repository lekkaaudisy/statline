"use client";

import { useState, useTransition, type ReactNode } from "react";
import { CLASS_INFO, CLASSES, type ClassId } from "@/lib/game/classes";
import { DAILY_MINUTES_OPTIONS, GOAL_MAX_LENGTH } from "@/lib/game/constants";
import { goalError, QUESTIONS, type Answers } from "@/lib/game/onboarding";
import { STAT_INFO } from "@/lib/game/stats";
import { completeOnboarding } from "./actions";

type Minutes = (typeof DAILY_MINUTES_OPTIONS)[number];

// The screens in order: intro, Class, second Class, goal, time, one per
// question, then finish.
const STEPS = [
  "intro",
  "class",
  "second",
  "goal",
  "minutes",
  ...QUESTIONS.map((q) => q.id),
  "finish",
];
const FIRST_QUESTION_STEP = STEPS.indexOf(QUESTIONS[0].id);

const MINUTES_HINTS: Record<Minutes, string> = {
  15: "A small daily push",
  30: "A steady daily session",
  60: "A serious daily block",
};

const optionClass = (selected: boolean) =>
  `block min-h-11 w-full rounded-md border px-4 py-3 text-left text-base ${
    selected
      ? "border-accent bg-accent/10 text-foreground"
      : "border-accent/25 text-foreground"
  }`;
const primaryButton =
  "min-h-11 w-full rounded-md bg-accent font-display font-bold uppercase tracking-wider text-background disabled:opacity-40";
const secondaryButton =
  "min-h-11 w-full rounded-md border border-accent/40 font-display text-sm font-medium uppercase tracking-wider text-accent";

export function OnboardingFlow({ displayName }: { displayName: string }) {
  const [step, setStep] = useState(0);
  const [mainClass, setMainClass] = useState<ClassId | null>(null);
  const [secondClass, setSecondClass] = useState<ClassId | null>(null);
  const [exampleGoal, setExampleGoal] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [usingCustomGoal, setUsingCustomGoal] = useState(false);
  const [dailyMinutes, setDailyMinutes] = useState<Minutes | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const goal = usingCustomGoal ? customGoal : (exampleGoal ?? "");
  const currentGoalError = goalError(goal);
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  function chooseMainClass(id: ClassId) {
    if (id !== mainClass) {
      // Example goals belong to a Class, so a new Class clears the old pick.
      setExampleGoal(null);
      if (secondClass === id) setSecondClass(null);
    }
    setMainClass(id);
  }

  function answer(questionId: string, option: number) {
    setAnswers((a) => ({ ...a, [questionId]: option }));
    next();
  }

  function finish() {
    setError(null);
    startSaving(async () => {
      const result = await completeOnboarding({
        mainClass,
        secondClass,
        goal,
        dailyMinutes,
        answers,
      });
      if (result?.error) setError(result.error);
    });
  }

  const id = STEPS[step];
  const question = QUESTIONS.find((q) => q.id === id);
  let screen: ReactNode;

  if (id === "intro") {
    screen = (
      <Panel label="System notice" title={`Player detected: ${displayName}`}>
        <div className="space-y-3 text-base text-foreground">
          <p>
            Statline turns real effort into quests, and quests into stats.
          </p>
          <p>
            Before your first quest, the System needs to know who you are and
            where you are starting from.
          </p>
          <p className="text-muted">
            This takes about 3 minutes. Answer honestly: your first week of
            quests will check these answers.
          </p>
        </div>
        <Footer>
          <button type="button" onClick={next} className={primaryButton}>
            Begin
          </button>
        </Footer>
      </Panel>
    );
  } else if (id === "class") {
    screen = (
      <Panel label="Step 1" title="Choose your Class">
        <p className="text-base text-muted">
          Your Class shapes most of your quests. You can change it once per
          season, and you keep your stats.
        </p>
        <div className="mt-4 space-y-2">
          {CLASSES.map((c) => (
            <ClassOption
              key={c}
              id={c}
              selected={mainClass === c}
              onSelect={() => chooseMainClass(c)}
            />
          ))}
        </div>
        <Footer>
          <button
            type="button"
            onClick={next}
            disabled={!mainClass}
            className={primaryButton}
          >
            Next
          </button>
          <button type="button" onClick={back} className={secondaryButton}>
            Back
          </button>
        </Footer>
      </Panel>
    );
  } else if (id === "second") {
    screen = (
      <Panel label="Step 2" title="Second Class (optional)">
        <p className="text-base text-muted">
          A second Class adds some variety to your quests. You can skip this.
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            aria-pressed={secondClass === null}
            onClick={() => setSecondClass(null)}
            className={optionClass(secondClass === null)}
          >
            <span className="font-display font-bold tracking-wide">None</span>
          </button>
          {CLASSES.filter((c) => c !== mainClass).map((c) => (
            <ClassOption
              key={c}
              id={c}
              selected={secondClass === c}
              onSelect={() => setSecondClass(c)}
            />
          ))}
        </div>
        <Footer>
          <button type="button" onClick={next} className={primaryButton}>
            Next
          </button>
          <button type="button" onClick={back} className={secondaryButton}>
            Back
          </button>
        </Footer>
      </Panel>
    );
  } else if (id === "goal" && mainClass) {
    screen = (
      <Panel label="Step 3" title="Choose one goal">
        <p className="text-base text-muted">
          Your weekly main quest is built from this goal.
        </p>
        <div className="mt-4 space-y-2">
          {CLASS_INFO[mainClass].exampleGoals.map((g) => {
            const selected = !usingCustomGoal && exampleGoal === g;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setUsingCustomGoal(false);
                  setExampleGoal(g);
                }}
                className={optionClass(selected)}
              >
                {g}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={usingCustomGoal}
            onClick={() => setUsingCustomGoal(true)}
            className={optionClass(usingCustomGoal)}
          >
            Write my own
          </button>
        </div>
        {usingCustomGoal && (
          <label className="mt-4 block text-sm font-medium text-muted">
            Your goal
            <input
              type="text"
              value={customGoal}
              maxLength={GOAL_MAX_LENGTH}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="Something you want to do or learn"
              autoFocus
              className="mt-1 block min-h-11 w-full rounded-md border border-accent/30 bg-background px-3 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
            {customGoal.trim() && currentGoalError && (
              <span role="alert" className="mt-2 block text-sm text-gold">
                {currentGoalError}
              </span>
            )}
          </label>
        )}
        <Footer>
          <button
            type="button"
            onClick={next}
            disabled={Boolean(currentGoalError)}
            className={primaryButton}
          >
            Next
          </button>
          <button type="button" onClick={back} className={secondaryButton}>
            Back
          </button>
        </Footer>
      </Panel>
    );
  } else if (id === "minutes") {
    screen = (
      <Panel label="Step 4" title="Daily time">
        <p className="text-base text-muted">
          How much time can you give your quests on a normal day?
        </p>
        <div className="mt-4 space-y-2">
          {DAILY_MINUTES_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={dailyMinutes === m}
              onClick={() => setDailyMinutes(m)}
              className={optionClass(dailyMinutes === m)}
            >
              <span className="block font-display text-lg font-bold tracking-wide">
                {m} minutes
              </span>
              <span className="block text-sm text-muted">
                {MINUTES_HINTS[m]}
              </span>
            </button>
          ))}
        </div>
        <Footer>
          <button
            type="button"
            onClick={next}
            disabled={!dailyMinutes}
            className={primaryButton}
          >
            Next
          </button>
          <button type="button" onClick={back} className={secondaryButton}>
            Back
          </button>
        </Footer>
      </Panel>
    );
  } else if (question) {
    const number = step - FIRST_QUESTION_STEP + 1;
    screen = (
      <Panel
        label={`Question ${number} of ${QUESTIONS.length} · ${STAT_INFO[question.stat].name}`}
        title={question.text}
        smallTitle
      >
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              aria-pressed={answers[question.id] === index}
              onClick={() => answer(question.id, index)}
              className={optionClass(answers[question.id] === index)}
            >
              {option}
            </button>
          ))}
        </div>
        <Footer>
          <button type="button" onClick={back} className={secondaryButton}>
            Back
          </button>
        </Footer>
      </Panel>
    );
  } else {
    screen = (
      <Panel label="Analysis complete" title="Your starting point is ready">
        <dl className="space-y-3 text-base">
          <Summary label="Class">
            {mainClass && CLASS_INFO[mainClass].name}
            {secondClass && ` + ${CLASS_INFO[secondClass].name}`}
          </Summary>
          <Summary label="Goal">{goal.trim()}</Summary>
          <Summary label="Daily time">{dailyMinutes} minutes</Summary>
        </dl>
        <p className="mt-4 text-base text-muted">
          Your grades start as provisional. Your first week of quests will
          calibrate them.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-gold">
            {error}
          </p>
        )}
        <Footer>
          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className={primaryButton}
          >
            {saving ? "Please wait" : "Open status window"}
          </button>
          <button
            type="button"
            onClick={back}
            disabled={saving}
            className={secondaryButton}
          >
            Back
          </button>
        </Footer>
      </Panel>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div
        className="mb-4 h-1 w-full overflow-hidden rounded-full bg-panel"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={0}
        aria-valuemax={STEPS.length - 1}
        aria-valuenow={step}
      >
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
      {screen}
    </div>
  );
}

function Panel({
  label,
  title,
  smallTitle = false,
  children,
}: {
  label: string;
  title: string;
  smallTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-accent/40 bg-panel p-6 shadow-[0_0_24px_rgba(94,209,240,0.12)]">
      <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent">
        {label}
      </p>
      <h1
        className={`mt-2 mb-4 font-display font-bold tracking-wide text-foreground ${
          smallTitle ? "text-xl" : "text-3xl"
        }`}
      >
        {title}
      </h1>
      {children}
    </section>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="mt-6 space-y-2">{children}</div>;
}

function ClassOption({
  id,
  selected,
  onSelect,
}: {
  id: ClassId;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={optionClass(selected)}
    >
      <span className="block font-display font-bold tracking-wide">
        {CLASS_INFO[id].name}
      </span>
      <span className="block text-sm text-muted">{CLASS_INFO[id].tagline}</span>
    </button>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
