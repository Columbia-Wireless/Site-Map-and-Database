/**
 * Identifying a document, and recognising when two files are the same one.
 *
 * Carrier folders are not tidy. The same agreement is filed as both `.doc` and `.pdf`; one
 * amendment appears as three separately-numbered scans; a revision sits beside the draft it
 * replaced. Every one of those, taken at face value, adds a term set and a fee to the
 * schedule. These are the pure functions that let the pipeline tell them apart, and none of
 * them decides anything on its own — a filename produces a hint, never a fact.
 */

/**
 * SHA-256 of a file's bytes, lowercase hex.
 *
 * Identifies the file itself, so the same contract arriving twice under different names is
 * parsed once. Hashing reads bytes and extracts no content; it is not an ingestion path.
 */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer =
    bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;
  const digest = await crypto.subtle.digest('SHA-256', buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Word-processor lock files, e.g. `~$Amendment 3.docx`. */
export function isLockFile(fileName: string): boolean {
  return /(^|\/)~\$/.test(fileName);
}

const COPY_MARKERS = [
  /\s*\bcopy\b\s*\d*/gi,
  /\s*\(\d+\)\s*/g,
  /\s*-\s*copy\s*\d*/gi,
];

/**
 * A filename reduced to what identifies the instrument, so the same agreement filed as
 * `.doc` and `.pdf` produces one stem.
 *
 * Scan numbers are deliberately NOT stripped: `1st Amend952` and `1st Amend962` differ only
 * in those digits and may be two genuinely different instruments. Whether they are the same
 * is settled by comparing the parsed text, not the name.
 */
export function normalizeStem(fileName: string): string {
  let stem = fileName.split('/').pop() ?? fileName;
  stem = stem.replace(/^~\$/, '');
  stem = stem.replace(/\.[a-z0-9]{1,5}$/i, '');
  for (const marker of COPY_MARKERS) stem = stem.replace(marker, ' ');
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Document text reduced to comparable form. */
export function normalizeDocumentText(markdown: string): string {
  return markdown
    .toLowerCase()
    .replace(/\|/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SHINGLE_SIZE = 3;

function shingles(text: string): Set<string> {
  const words = text.split(' ').filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) {
    set.add(words.slice(i, i + SHINGLE_SIZE).join(' '));
  }
  // A document shorter than one shingle still needs to compare equal to itself.
  if (set.size === 0 && words.length > 0) set.add(words.join(' '));
  return set;
}

/**
 * Similarity of two documents, 0 to 1, as the Jaccard overlap of their three-word sequences.
 *
 * Chosen over the Levenshtein ratio already in `inconsistencyEngine`: that is O(n·m) and
 * these are hundred-kilobyte markdown documents. It stays where it belongs, on short names.
 */
export function textSimilarity(a: string, b: string): number {
  const left = shingles(normalizeDocumentText(a));
  const right = shingles(normalizeDocumentText(b));
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  for (const shingle of smaller) if (larger.has(shingle)) shared++;

  return shared / (left.size + right.size - shared);
}

/** At or above this, two documents in one agreement are the same instrument. */
export const NEAR_DUPLICATE_THRESHOLD = 0.92;

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
};

/**
 * An amendment number guessed from a filename.
 *
 * Advisory only. Filenames in these folders are written by whoever saved them, and disagree
 * with the instrument often enough that this is used solely to raise a conflict against the
 * number the document itself states.
 */
export function ordinalFromFileName(fileName: string): number | null {
  const stem = normalizeStem(fileName);

  const worded = stem.match(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth)\s+(amendment|amend)\b/
  );
  if (worded) return ORDINAL_WORDS[worded[1]];

  // The trailing `\d*` absorbs a scan number run onto the word, as in `1st Amend952.pdf`.
  const numbered = stem.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)\s*(?:amendment|amend)\d*\b/);
  if (numbered) return Number(numbered[1]);

  const trailing = stem.match(/\b(?:amendment|amend)\s+(\d{1,2})\b/);
  if (trailing) return Number(trailing[1]);

  // "A1", "A-2" as used in these folders for first and second amendments.
  const shorthand = stem.match(/\ba\s*(\d{1,2})\b/);
  if (shorthand) return Number(shorthand[1]);

  return null;
}

/**
 * Whether a filename suggests the document was never signed.
 *
 * A hint, never a verdict. Execution status is established from the document text; this
 * exists so a file named "redline" that the text reports as executed is questioned rather
 * than believed.
 */
export function draftHintFromFileName(fileName: string): boolean {
  const stem = normalizeStem(fileName);
  return /\b(redline|draft|need sig|needs sig|unsigned|for review|for discussion|comments|edits|markup)\b/.test(
    stem
  );
}

const LEGAL_SUFFIXES =
  /\b(llc|l l c|inc|incorporated|corp|corporation|company|co|lp|llp|ltd|limited|plc|holdings|group|communications|telecom|telecommunications|networks|network|services|usa|america|of america)\b/g;

/**
 * A party name reduced for comparison — legal suffixes and industry filler removed.
 *
 * "Level 3 Communications LLC" and "Level 3" are the same counterparty; "Teleport
 * Communications Group" and "Teleport" likewise. What survives is the distinguishing part
 * of the name, which is what a similarity score should be measuring.
 */
export function normalizeCarrierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STREET_ABBREVIATIONS: Record<string, string> = {
  st: 'street',
  str: 'street',
  ave: 'avenue',
  av: 'avenue',
  rd: 'road',
  dr: 'drive',
  blvd: 'boulevard',
  ln: 'lane',
  ct: 'court',
  pkwy: 'parkway',
  hwy: 'highway',
  ste: 'suite',
  apt: 'suite',
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  nw: 'northwest',
  ne: 'northeast',
  sw: 'southwest',
  se: 'southeast',
};

/** An address reduced for comparison, with the usual abbreviations spelled out. */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => STREET_ABBREVIATIONS[word] ?? word)
    .join(' ');
}

const STREET_TYPES = new Set([
  'street',
  'avenue',
  'road',
  'drive',
  'boulevard',
  'lane',
  'court',
  'parkway',
  'highway',
  'pike',
  'way',
  'place',
  'circle',
  'terrace',
  'plaza',
  'square',
  'trail',
  'row',
]);

const STATES = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks','ky','la',
  'me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny','nc','nd','oh','ok',
  'or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv','wi','wy','dc',
  'maryland','virginia','texas','california','newjersey','newyork','districtofcolumbia',
]);

const UNIT_MARKERS = new Set(['suite', 'unit', 'apt', 'floor', 'fl', 'rm', 'room']);

export interface ParsedAddress {
  /** Leading building number, e.g. "111" or "1015". Null for a building name. */
  houseNumber: string | null;
  /** Street name and type, e.g. "rockville pike". */
  street: string;
  unit: string | null;
  postcode: string | null;
  /** What is left after the street — usually the town. */
  locality: string;
  /** Whether a recognised street type ("pike", "drive") was found to split street from town. */
  hasStreetType: boolean;
}

/**
 * Splits an address into the parts that identify a property, so each can be weighed properly.
 *
 * Comparing whole address strings gets this data exactly backwards. "111 Hungerford Drive"
 * and "121 Hungerford Drive" are different buildings and differ by one character; "111
 * Rockville Pike" and "111 Hungerford Drive" are two frontages of the SAME building and
 * share almost nothing. The house number carries most of the signal and edit distance gives
 * it the least weight, so it has to be pulled out and compared on its own.
 */
export function parseAddress(address: string): ParsedAddress {
  const normalized = normalizeAddress(address);
  const tokens = normalized.split(' ').filter(Boolean);

  let houseNumber: string | null = null;
  if (tokens.length > 0 && /^\d+[a-z]?$/.test(tokens[0])) {
    houseNumber = tokens.shift() as string;
  }

  let postcode: string | null = null;
  const postcodeIndex = tokens.findIndex((t) => /^\d{5}$/.test(t));
  if (postcodeIndex >= 0) postcode = tokens.splice(postcodeIndex, 1)[0];

  let unit: string | null = null;
  const unitIndex = tokens.findIndex((t) => UNIT_MARKERS.has(t));
  if (unitIndex >= 0) {
    const value = tokens[unitIndex + 1];
    unit = value ?? null;
    tokens.splice(unitIndex, value ? 2 : 1);
  }

  const stateIndex = tokens.findIndex((t) => STATES.has(t));
  if (stateIndex >= 0) tokens.splice(stateIndex, 1);

  const typeIndex = tokens.findIndex((t) => STREET_TYPES.has(t));
  const street = typeIndex >= 0 ? tokens.slice(0, typeIndex + 1).join(' ') : tokens.join(' ');
  const locality = typeIndex >= 0 ? tokens.slice(typeIndex + 1).join(' ') : '';

  // A bare trailing number after the street is a suite, as in "Sunrise Valley Drive 100".
  if (!unit && typeIndex >= 0) {
    const trailing = tokens[typeIndex + 1];
    if (trailing && /^\d+$/.test(trailing)) unit = trailing;
  }

  return { houseNumber, street, unit, postcode, locality, hasStreetType: typeIndex >= 0 };
}

export type AddressComparison =
  | { verdict: 'same'; score: number }
  | { verdict: 'different'; reason: string }
  | { verdict: 'undecidable'; reason: string };

/** Below this, two street names are not the same street. */
const STREET_MATCH_FLOOR = 0.8;

/**
 * Compares two addresses structurally.
 *
 * Returns 'undecidable' rather than forcing a verdict, because two of the three cases in the
 * real data cannot be settled from text alone: the same building reached from two streets,
 * and a building named rather than numbered. Those are for the coordinates, or for a person.
 */
export function compareAddresses(a: string, b: string): AddressComparison {
  // A blank address is not "named rather than numbered" — it is missing data entirely, and
  // is not a candidate for anything. Confirmed as the root cause of phantom multi-property
  // ambiguity (2026-08-08): a site record with address '' returned 'undecidable' against
  // every document in the dataset regardless of that document's real address, because
  // neither side had a house number to compare. Settled here, before that check, so a
  // genuinely blank record can never again poison matching for an unrelated property.
  if (!a.trim() || !b.trim()) {
    return {
      verdict: 'different',
      reason: 'One of the two addresses is blank, so there is nothing to compare against.',
    };
  }

  const left = parseAddress(a);
  const right = parseAddress(b);

  if (left.postcode && right.postcode && left.postcode !== right.postcode) {
    return { verdict: 'different', reason: 'The postcodes differ.' };
  }

  if (left.houseNumber && right.houseNumber && left.houseNumber !== right.houseNumber) {
    return {
      verdict: 'different',
      reason: `Different building numbers (${left.houseNumber} and ${right.houseNumber}).`,
    };
  }

  if (!left.houseNumber || !right.houseNumber) {
    return {
      verdict: 'undecidable',
      reason: 'One of the two is named rather than numbered, so the text cannot settle it.',
    };
  }

  // Only split street from town when BOTH sides yielded a recognised street type. Otherwise
  // one side's "street" would carry the town and the other's would not, and comparing them
  // measures the difference in parsing rather than the difference in address.
  const symmetric = left.hasStreetType && right.hasStreetType;
  const leftStreet = symmetric ? left.street : `${left.street} ${left.locality}`.trim();
  const rightStreet = symmetric ? right.street : `${right.street} ${right.locality}`.trim();

  const streetScore = stringSimilarityLocal(leftStreet, rightStreet);
  if (streetScore >= STREET_MATCH_FLOOR) {
    const localityScore =
      symmetric && left.locality && right.locality
        ? stringSimilarityLocal(left.locality, right.locality)
        : 1;
    return { verdict: 'same', score: Math.min(streetScore, localityScore) };
  }

  return {
    verdict: 'undecidable',
    reason:
      `Same building number on different streets (${left.street} and ${right.street}). ` +
      'This is what two frontages of one building look like.',
  };
}

/**
 * Character-level similarity for short strings.
 *
 * Duplicated from `inconsistencyEngine` deliberately: importing it here would make the
 * identity module depend on the flag engine, and this file is meant to be the leaf that
 * everything else can use.
 */
function stringSimilarityLocal(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const previous = new Array(a.length + 1);
  for (let j = 0; j <= a.length; j++) previous[j] = j;

  for (let i = 1; i <= b.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const temp = previous[j];
      previous[j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? diagonal
          : Math.min(diagonal + 1, previous[j - 1] + 1, previous[j] + 1);
      diagonal = temp;
    }
  }

  return 1 - previous[a.length] / Math.max(a.length, b.length);
}

/**
 * A stable identity for the instrument a document represents, so two files describing the
 * same instrument collide regardless of what they are named.
 */
export function instrumentKey(parts: {
  role: string;
  ordinal: number | null;
  executionDate: string;
  lesseeName: string;
  baseRent: number | null;
}): string {
  return [
    parts.role,
    parts.ordinal ?? '-',
    parts.executionDate || '-',
    normalizeCarrierName(parts.lesseeName) || '-',
    parts.baseRent ?? '-',
  ].join('|');
}

const EARTH_RADIUS_METRES = 6371000;

/** Great-circle distance in metres. */
export function distanceMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}
