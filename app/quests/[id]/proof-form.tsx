"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  PROOF_PHOTO_MAX_BYTES,
  PROOF_PHOTO_MAX_SIDE,
  SUMMARY_MAX_LENGTH,
  SUMMARY_MIN_LENGTH,
} from "@/lib/game/constants";
import { proofPhotoPath, type SelectableProof } from "@/lib/game/proof";
import { createClient } from "@/lib/supabase/client";
import { PROOF_BUCKET } from "@/lib/supabase/storage";
import { CardReveal } from "../../cards/card-reveal";
import { completeQuest, type CompleteResult } from "../actions";

type Option = { proof: SelectableProof; points: number; allowed: boolean };
type Choice = "photo" | "summary" | "honour";

const CHOICES: { id: Choice; proof: SelectableProof; name: string; detail: string }[] = [
  { id: "photo", proof: "evidence", name: "Photo", detail: "Evidence · 80%" },
  { id: "summary", proof: "evidence", name: "Written summary", detail: "Evidence · 80%" },
  { id: "honour", proof: "honour", name: "Honour check-off", detail: "Honour · 50%" },
];

// Shrinks a photo on the phone before upload: longest side 1600 px, JPEG.
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PROOF_PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/jpeg", 0.85),
  );
}

export function ProofForm({
  questId,
  userId,
  rank,
  statName,
  options,
  doubleXp,
}: {
  questId: string;
  userId: string;
  rank: number;
  statName: string;
  options: Option[];
  doubleXp: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState<Extract<CompleteResult, { ok: true }> | null>(null);

  const optionFor = (proof: SelectableProof) => options.find((o) => o.proof === proof)!;

  function submit() {
    if (!choice) return;
    setError(null);
    startTransition(async () => {
      let photoPath: string | null = null;
      if (choice === "photo") {
        if (!photo) {
          setError("Choose a photo first.");
          return;
        }
        let blob: Blob;
        try {
          blob = await shrinkPhoto(photo);
        } catch {
          setError("This photo could not be read. Try another one, or write a summary.");
          return;
        }
        if (blob.size > PROOF_PHOTO_MAX_BYTES) {
          setError("This photo is too large. Try another one.");
          return;
        }
        photoPath = proofPhotoPath(userId, questId, Date.now());
        const { error: uploadError } = await createClient()
          .storage.from(PROOF_BUCKET)
          .upload(photoPath, blob, { contentType: "image/jpeg" });
        if (uploadError) {
          setError("The photo did not upload. Check your connection and try again.");
          return;
        }
      }
      const result = await completeQuest({
        questId,
        proof: CHOICES.find((c) => c.id === choice)!.proof,
        summary: choice === "summary" ? summary : null,
        photoPath,
      });
      if (result.ok) setCleared(result);
      else setError(result.error);
    });
  }

  if (cleared) {
    return (
      <CardReveal
        {...cleared}
        onClose={() => {
          router.push("/quests");
          router.refresh();
        }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-sm tracking-[0.15em] text-accent">CHOOSE YOUR PROOF</h2>
      {doubleXp && (
        <p className="text-sm font-semibold text-gold">Double XP active: this quest counts twice.</p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Proof type</legend>
        {CHOICES.map((c) => {
          const option = optionFor(c.proof);
          const selected = choice === c.id;
          return (
            <label
              key={c.id}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-[10px] border px-4 py-3 ${
                !option.allowed
                  ? "border-track text-muted"
                  : selected
                    ? "border-accent bg-accent/10"
                    : "border-line"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="proof"
                  value={c.id}
                  disabled={!option.allowed}
                  checked={selected}
                  onChange={() => setChoice(c.id)}
                  className="size-5 accent-[#5ed1f0]"
                />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{c.name}</span>
                  <span className="text-xs text-muted">
                    {option.allowed ? c.detail : `Not allowed for rank ${rank} quests`}
                  </span>
                </span>
              </span>
              <span className={option.allowed ? "text-sm text-accent" : "text-sm"}>
                +{option.points} {statName}
              </span>
            </label>
          );
        })}
      </fieldset>

      {choice === "photo" && (
        <label className="flex flex-col gap-2 text-sm text-muted">
          A photo of what you did. Only you can see it.
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="min-h-11 text-sm text-foreground file:mr-3 file:min-h-11 file:rounded-md file:border file:border-line file:bg-track file:px-3 file:text-foreground"
          />
        </label>
      )}

      {choice === "summary" && (
        <label className="flex flex-col gap-2 text-sm text-muted">
          What did you do? At least {SUMMARY_MIN_LENGTH} characters.
          <textarea
            value={summary}
            maxLength={SUMMARY_MAX_LENGTH}
            rows={4}
            onChange={(e) => setSummary(e.target.value)}
            className="rounded-md border border-accent/30 bg-background p-3 text-base text-foreground focus:border-accent focus:outline-none"
          />
          <span className="text-xs">
            {summary.trim().length} / {SUMMARY_MAX_LENGTH}
          </span>
        </label>
      )}

      {choice === "honour" && (
        <p className="text-sm text-muted">
          You confirm you did this quest. Honour proof gives half points.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-gold">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!choice || pending}
        onClick={submit}
        className="min-h-11 rounded-[10px] border border-accent bg-[#0f2230] font-display text-[15px] font-semibold tracking-wider text-foreground disabled:opacity-40"
      >
        {pending ? "SENDING PROOF" : "SUBMIT PROOF"}
      </button>
    </section>
  );
}
