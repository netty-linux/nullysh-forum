/**
 * Helpers de Direct Message (DM) entre dois usuários.
 * channelId estável e ordenado: dm_{idMenor}__{idMaior}
 */

export function dmChannelId(userA: string, userB: string): string {
  const [a, b] = [userA, userB].slice().sort();
  return `dm_${a}__${b}`;
}

export function isDmChannel(channelId: string): boolean {
  return channelId.startsWith("dm_") && channelId.includes("__");
}

/** Retorna o outro participante da DM, ou null se o canal não for DM / não incluir meId. */
export function getDmPeerId(
  channelId: string,
  meId: string
): string | null {
  if (!isDmChannel(channelId)) return null;
  const rest = channelId.slice(3); // remove "dm_"
  const sep = rest.indexOf("__");
  if (sep === -1) return null;
  const id1 = rest.slice(0, sep);
  const id2 = rest.slice(sep + 2);
  if (id1 === meId) return id2;
  if (id2 === meId) return id1;
  return null;
}

/** O usuário participa desta DM? */
export function isParticipantOfDm(channelId: string, userId: string): boolean {
  return getDmPeerId(channelId, userId) !== null;
}
