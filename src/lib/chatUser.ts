const MAX_NAME_PART_LENGTH = 24;
const MAX_USERNAME_LENGTH = 50;

const cleanNamePart = (value: string | null): string => {
  if (!value) return "";

  const normalized = value
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_PART_LENGTH);

  return normalized;
};

/**
 * Reads the display name supplied by the hosting site.
 * The app stores only the existing username field; no database changes are
 * needed for the separate URL parameters.
 */
export const getChatUserFromUrl = (): { fullName: string } => {
  if (typeof window === "undefined") return { fullName: "" };

  const params = new URLSearchParams(window.location.search);
  const firstName = cleanNamePart(params.get("first_name"));
  const familyName = cleanNamePart(params.get("family_name"));
  const fullName = [firstName, familyName]
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_USERNAME_LENGTH)
    .trim();

  return { fullName };
};