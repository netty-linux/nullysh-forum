import { interestOverlap } from "./catalog";
import type { User, UserPublic } from "./types";

export type MentorshipMatch = {
  user: UserPublic;
  score: number;
  sharedInterests: string[];
  reason: string;
  role: "mentor" | "mentee" | "peer";
};

type Person = User | UserPublic;

function toPublic(u: Person): UserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u as User;
  return rest as UserPublic;
}

/**
 * Match de mentoria:
 * - se você busca mentoria → prioriza quem oferece e tem interesses em comum
 * - se você oferece → prioriza quem busca e tem overlap
 * - senão → peers com interesses/objetivos parecidos
 */
export function computeMentorshipMatches(
  me: Person,
  all: Person[],
  limit = 12
): MentorshipMatch[] {
  const meInterests = me.interests ?? [];
  const meGoals = me.goals ?? [];
  const meTopics = me.mentorTopics?.length ? me.mentorTopics : meInterests;

  const others = all.filter((u) => u.id !== me.id);

  const scored: MentorshipMatch[] = others.map((other) => {
    const sharedInterests = interestOverlap(
      meInterests,
      other.interests ?? []
    );
    const topicOverlap = interestOverlap(
      meTopics,
      other.mentorTopics?.length
        ? other.mentorTopics
        : other.interests ?? []
    );

    let score = sharedInterests.length * 3 + topicOverlap.length * 2;
    let role: MentorshipMatch["role"] = "peer";
    let reason = "Interesses em comum";

    if (me.seekingMentorship && other.offeringMentorship) {
      score += 8 + topicOverlap.length * 3;
      role = "mentor";
      reason =
        topicOverlap.length > 0
          ? `Pode te mentorar em ${topicOverlap.slice(0, 3).join(", ")}`
          : "Oferece mentoria e tem perfil alinhado";
    } else if (me.offeringMentorship && other.seekingMentorship) {
      score += 8 + topicOverlap.length * 3;
      role = "mentee";
      reason =
        topicOverlap.length > 0
          ? `Busca mentoria em ${topicOverlap.slice(0, 3).join(", ")}`
          : "Busca mentoria e combina com o que você oferece";
    } else if (sharedInterests.length > 0) {
      reason = `Vocês compartilham: ${sharedInterests.slice(0, 3).join(", ")}`;
    }

    // Bônus se objetivos mencionam tags do outro
    const goalText = meGoals.join(" ").toLowerCase();
    for (const tag of other.interests ?? []) {
      if (goalText.includes(tag.toLowerCase())) score += 2;
    }

    if (other.isVerified) score += 1;
    if (other.isVip) score += 1;

    return {
      user: toPublic(other),
      score,
      sharedInterests,
      reason,
      role,
    };
  });

  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
