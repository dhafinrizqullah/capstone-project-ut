/**
 * A weighing as typed by an operator, in kilograms.
 *
 * The scale reads "2,3 kg" (id-ID), but a keyboard usually offers the dot: both
 * separators mean the same thing here, because a single weighing never carries a
 * thousands separator. Unparseable input comes back as 0, which callers reject —
 * never as a silently different weight.
 */
export function parseWeightKg(text: string): number {
  const kg = Number(text.trim().replace(',', '.'))
  return Number.isFinite(kg) && kg > 0 ? kg : 0
}
