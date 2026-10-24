export type RosterRow = {
  name: string;
  admissionNumber: string;
};

const headerLine =
  /^(?:no\.?|#|name|student name|learner name|admission(?: no\.?| number)?|adm(?:ission)? no\.?|class|grade|subject|term|year)(?:\s|$)/i;

export function parseRosterText(text: string): RosterRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\|+|\|+$/g, "").trim())
    .filter((line) => line && !headerLine.test(line))
    .map((line) => {
      const rowText = line.replace(/^\d{1,3}[.)]\s*/, "");
      const columns = rowText
        .split(/\s*\|\s*|\t+|\s*[,;]\s*/)
        .map((column) => column.trim())
        .filter(Boolean);

      if (columns.length > 1) {
        const withoutOrdinal =
          /^\d{1,2}[.)]?$/.test(columns[0])
            ? columns.slice(1)
            : columns;
        const numberIndex = withoutOrdinal.findIndex((column) =>
          /\d/.test(column),
        );
        const nameColumns =
          numberIndex >= 0
            ? withoutOrdinal.filter((_, index) => index !== numberIndex)
            : withoutOrdinal.slice(0, 1);
        const name = nameColumns
          .join(" ")
          .replace(/^\d{1,3}[.)]?\s+/, "")
          .trim();
        const admissionNumber =
          numberIndex >= 0
            ? withoutOrdinal[numberIndex]
            : withoutOrdinal.slice(1).join(" ");
        return { name, admissionNumber };
      }

      const normalized = rowText
        .replace(/^\d{1,2}\s+(?=\d{3,}\b|[A-Za-z])/, "")
        .trim();
      const admission = normalized.match(
        /\b(?=[A-Z0-9/-]*\d)[A-Z0-9]+(?:[-/][A-Z0-9]+)*\b/i,
      );
      if (!admission)
        return { name: normalized, admissionNumber: "" };

      return {
        name: normalized.replace(admission[0], "").trim(),
        admissionNumber: admission[0],
      };
    })
    .filter((row) => row.name.length > 0);
}
