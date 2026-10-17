"use server";

import { redirect } from "next/navigation";
import { gradeToPoints } from "@/lib/game/grades";
import {
  answersToProvisionalGrades,
  validateOnboarding,
} from "@/lib/game/onboarding";
import { STATS } from "@/lib/game/stats";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

// Saves the finished onboarding, then opens the status window.
export async function completeOnboarding(
  input: unknown,
): Promise<OnboardingState> {
  const result = validateOnboarding(input);
  if (!result.ok) return { error: result.error };
  const { mainClass, secondClass, goal, dailyMinutes, answers } = result.value;

  const grades = answersToProvisionalGrades(answers);
  const points = Object.fromEntries(
    STATS.map((stat) => [stat, gradeToPoints(grades[stat])]),
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_main_class: mainClass,
    p_second_class: secondClass,
    p_goal: goal,
    p_daily_minutes: dailyMinutes,
    p_answers: answers,
    p_points: points,
  });

  // Finished in another tab already: just show the status window.
  if (error && !error.message.includes("already complete")) {
    return { error: "The System could not save your answers. Try again." };
  }
  redirect("/");
}
