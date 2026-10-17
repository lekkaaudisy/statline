// Proof: how much of a quest's points each kind of proof earns, which proof
// a quest allows, and checking what the user sends.
import {
  HONOUR_MAX_RANK,
  PROOF_WEIGHTS,
  SUMMARY_MAX_LENGTH,
  SUMMARY_MIN_LENGTH,
} from "./constants";

export const PROOF_TYPES = ["auto", "crew", "evidence", "honour"] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

// Proof the user can choose in the MVP. Auto (data) needs integrations, and
// crew confirmation arrives with Crew-lite.
export const SELECTABLE_PROOFS = ["evidence", "honour"] as const satisfies readonly ProofType[];
export type SelectableProof = (typeof SELECTABLE_PROOFS)[number];

export function isSelectableProof(value: unknown): value is SelectableProof {
  return SELECTABLE_PROOFS.includes(value as SelectableProof);
}

export const PROOF_INFO: Record<ProofType, { name: string; detail: string }> = {
  auto: { name: "Auto", detail: "From your data" },
  crew: { name: "Crew", detail: "Confirmed by a crewmate" },
  evidence: { name: "Evidence", detail: "A photo or a short summary" },
  honour: { name: "Honour", detail: "Self check-off" },
};

// Points awarded for a quest's gain with this proof, rounded.
export function proofPoints(gain: number, proof: ProofType): number {
  return Math.round(gain * PROOF_WEIGHTS[proof]);
}

// Honour proof is never allowed for difficulty rank 5 or higher.
export function honourAllowed(rank: number): boolean {
  return rank <= HONOUR_MAX_RANK;
}

// The proof types a new quest of this rank accepts in the MVP.
export function allowedProofs(rank: number): SelectableProof[] {
  return honourAllowed(rank) ? ["evidence", "honour"] : ["evidence"];
}

export type ProofSubmission = {
  proof: SelectableProof;
  summary: string | null;
  photoPath: string | null;
};

// Checks a proof against the quest. Returns an error message, or null when
// the proof is fine. `userId` is used to make sure a photo is the user's own.
export function proofError(
  submission: ProofSubmission,
  quest: { rank: number; allowedProofs: readonly string[] },
  userId: string,
): string | null {
  const { proof, summary, photoPath } = submission;
  if (proof === "honour" && !honourAllowed(quest.rank)) {
    return `Honour proof is not allowed for rank ${quest.rank} quests. Add a photo or a summary.`;
  }
  if (!quest.allowedProofs.includes(proof)) {
    return "This quest does not accept that proof.";
  }
  if (proof === "honour") {
    return summary || photoPath ? "Honour proof has no photo or summary." : null;
  }

  if (!summary && !photoPath) return "Add a photo or write a short summary.";
  if (summary !== null) {
    const length = summary.trim().length;
    if (length < SUMMARY_MIN_LENGTH) {
      return `Write at least ${SUMMARY_MIN_LENGTH} characters about what you did.`;
    }
    if (length > SUMMARY_MAX_LENGTH) {
      return `Keep your summary to ${SUMMARY_MAX_LENGTH} characters or fewer.`;
    }
  }
  if (photoPath !== null && !isOwnPhotoPath(photoPath, userId)) {
    return "That photo could not be found. Try uploading it again.";
  }
  return null;
}

// Proof photos live in a folder named after the user: "<user id>/<file>".
export function isOwnPhotoPath(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  return (
    path.startsWith(prefix) &&
    path.length > prefix.length &&
    !path.slice(prefix.length).includes("/") &&
    !path.includes("..")
  );
}

export function proofPhotoPath(userId: string, questId: string, time: number): string {
  return `${userId}/${questId}-${time}.jpg`;
}
