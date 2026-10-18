/**
 * PostgREST `ilike` pattern. `.or()` splits its filter string on commas and
 * parentheses, so a raw term containing one would break the query — strip them.
 */
export function likePattern(term: string) {
  return `%${term.replace(/[(),]/g, '')}%`
}
