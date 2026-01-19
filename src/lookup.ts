import { LexUserType } from "@atproto/lexicon";
import * as v from "valibot";
import { LexiconInput } from "./types";

/** Symbol for phantom type to preserve lexicon types */
const LexiconsType = Symbol("LexiconsType");

/**
 * A lookup object that holds lexicons for cross-reference resolution and caches results.
 * The generic parameter preserves type information about the lexicons for proper type inference.
 */
export interface Lookup<
  Lexicons extends readonly LexiconInput[] = readonly LexiconInput[],
> {
  /** @internal */
  _lexiconMap: Map<string, { id: string; defs: Record<string, LexUserType> }>;
  /** @internal - cache keyed by format */
  _caches: {
    sdk: Map<string, v.GenericSchema>;
    wire: Map<string, v.GenericSchema>;
  };
  /** @internal - phantom type to preserve lexicon types */
  [LexiconsType]?: Lexicons;
}

/**
 * Create a lookup for resolving cross-lexicon references.
 * The lookup caches converted schemas for reuse and preserves type information.
 *
 * @example
 * ```ts
 * const lookup = createLookup(strongRef, postLexicon, likeLexicon)
 *
 * const post = lexiconToValibot(postLexicon, { lookup })
 * const like = lexiconToValibot(likeLexicon, { lookup })
 * ```
 */
export function createLookup<const Lexicons extends readonly LexiconInput[]>(
  ...lexicons: Lexicons
): Lookup<Lexicons> {
  const lexiconMap = new Map<
    string,
    { id: string; defs: Record<string, LexUserType> }
  >();

  for (const lexicon of lexicons) {
    lexiconMap.set(lexicon.id, {
      id: lexicon.id,
      defs: lexicon.defs as Record<string, LexUserType>,
    });
  }

  return {
    _lexiconMap: lexiconMap,
    _caches: {
      sdk: new Map<string, v.GenericSchema>(),
      wire: new Map<string, v.GenericSchema>(),
    },
  };
}
