/**
 * Unit tests for the pure data/logic layer (no DOM, no network).
 * Run with `npm test`.
 *
 * The Arabic strings below are *test inputs* (single word forms and clearly
 * artificial sentences). No Quran verses are generated here.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  BASMALA,
  displayAyahText,
  normalizeArabic,
  stripBasmalaPrefix,
  toArabicIndic,
  toAsciiDigits
} from "../src/lib/arabic";
import { ApiError, fetchJson } from "../src/lib/api";
import {
  FormatError,
  checkAudioMatchesText,
  parseAudio,
  parseFullQuran,
  parseJuzText,
  parseSurahList,
  parseSurahText
} from "../src/lib/parse";
import { buildIndex, searchAyahs, searchSurahs } from "../src/lib/search";
import type { Surah } from "../src/types";

/* ---------- helpers ---------- */

function surahMeta(number: number, name: string, numberOfAyahs: number) {
  return { number, name, englishName: `S${number}`, englishNameTranslation: "", numberOfAyahs, revelationType: "Meccan" };
}

function envelope(data: unknown) {
  return { code: 200, status: "OK", data };
}

/* ---------- arabic ---------- */

describe("normalizeArabic", () => {
  it("removes diacritics and unifies spelling variants", () => {
    assert.equal(normalizeArabic("ٱلرَّحْمَٰنِ"), "الرحمن");
    assert.equal(normalizeArabic("ٱلصَّلَوٰةَ"), normalizeArabic("الصلاة"));
    assert.equal(normalizeArabic("رَحْمَةً"), normalizeArabic("رحمة"));
    assert.equal(normalizeArabic("مُوسَىٰ"), normalizeArabic("موسى"));
    assert.equal(normalizeArabic("أَحَدٌ"), normalizeArabic("احد"));
  });

  it("splits the joined Uthmani vocative like normal spelling", () => {
    assert.equal(normalizeArabic("يَٰٓأَيُّهَا"), normalizeArabic("يا أيها"));
  });

  it("collapses whitespace", () => {
    assert.equal(normalizeArabic("  كلمة   اخرى "), "كلمه اخري");
  });
});

describe("digits", () => {
  it("round-trips", () => {
    assert.equal(toArabicIndic(255), "٢٥٥");
    assert.equal(toAsciiDigits("٢٥٥"), "255");
  });
});

describe("Basmala handling", () => {
  it("hides a glued Basmala only when it is exactly the Basmala", () => {
    assert.equal(stripBasmalaPrefix(`${BASMALA} نص تجريبي`), "نص تجريبي");
    assert.equal(stripBasmalaPrefix("نص تجريبي آخر هنا"), "نص تجريبي آخر هنا");
    assert.equal(stripBasmalaPrefix("بسم الله الرحمن"), "بسم الله الرحمن");
  });

  it("keeps the Basmala in Al-Fatihah (it is ayah 1) and never touches other ayahs", () => {
    assert.equal(displayAyahText(1, 1, BASMALA), BASMALA);
    assert.equal(displayAyahText(2, 1, `${BASMALA} نص`), "نص");
    assert.equal(displayAyahText(9, 1, "نص تجريبي"), "نص تجريبي");
    assert.equal(displayAyahText(2, 2, `${BASMALA} نص`), `${BASMALA} نص`);
  });
});

/* ---------- search ---------- */

const source = {
  surahs: [surahMeta(1, "سُورَةُ ٱلتَّجْرِبَةِ", 3)] as Surah[],
  ayahs: [
    { surahNumber: 1, ayahNumber: 1, text: `${BASMALA} ٱلرَّحْمَٰنُ عَلَّمَ` },
    { surahNumber: 1, ayahNumber: 2, text: "وَرَحْمَةٌ وَنُورٌ" },
    { surahNumber: 1, ayahNumber: 3, text: "ٱلصَّلَوٰةَ وَٱلْحَمْدُ" }
  ]
};

describe("searchAyahs", () => {
  const index = buildIndex(source);

  it("indexes the first ayah without the glued Basmala (surah 1 keeps it)", () => {
    assert.equal(index[0].text.includes("ٱلرَّحِيمِ"), true);
  });

  it("'exact' matches complete words only; 'partial' matches inside words only", () => {
    const exact = searchAyahs(index, "الرحمن", "exact").matches;
    assert.deepEqual(exact.map((m) => m.ayahNumber), [1]);

    const partialRahm = searchAyahs(index, "رحم", "partial").matches;
    assert.deepEqual(partialRahm.map((m) => m.ayahNumber), [1, 2]);

    assert.equal(searchAyahs(index, "رحم", "exact").matches.length, 0);
    assert.deepEqual(searchAyahs(index, "رحم", "all").matches.map((m) => m.ayahNumber), [1, 2]);
  });

  it("filters give distinct results", () => {
    const all = searchAyahs(index, "رحمة", "all").matches.length;
    const exact = searchAyahs(index, "رحمة", "exact").matches.length;
    const partial = searchAyahs(index, "رحمة", "partial").matches.length;
    assert.equal(all, 1);
    assert.equal(exact, 0);
    assert.equal(partial, 1);
  });

  it("matches regardless of diacritics and highlights the original word with its marks", () => {
    const [hit] = searchAyahs(index, "الصلاة", "all").matches;
    assert.ok(hit);
    const [[s, e]] = hit.ranges;
    assert.equal(hit.text.slice(s, e), "ٱلصَّلَوٰةَ");
  });

  it("falls back to 'all words present' for multi-word queries with no phrase match", () => {
    const out = searchAyahs(index, "نور رحمة", "all");
    assert.equal(out.wordsFallback, true);
    assert.deepEqual(out.matches.map((m) => m.ayahNumber), [2]);
  });

  it("returns nothing for an empty query", () => {
    assert.equal(searchAyahs(index, "   ", "all").matches.length, 0);
  });
});

describe("searchSurahs", () => {
  const surahs: Surah[] = [
    surahMeta(1, "سُورَةُ ٱلْفَاتِحَةِ", 7),
    surahMeta(2, "سُورَةُ ٱلْبَقَرَةِ", 286),
    surahMeta(3, "سُورَةُ آلِ عِمۡرَانَ", 200)
  ];

  it("finds by name with or without article, 'سورة' prefix and diacritics", () => {
    assert.deepEqual(searchSurahs(surahs, "بقرة").map((m) => m.surah.number), [2]);
    assert.deepEqual(searchSurahs(surahs, "البقرة").map((m) => m.surah.number), [2]);
    assert.deepEqual(searchSurahs(surahs, "سورة الفاتحة").map((m) => m.surah.number), [1]);
  });

  it("finds by number, including Arabic-Indic digits", () => {
    assert.deepEqual(searchSurahs(surahs, "3").map((m) => m.surah.number), [3]);
    assert.deepEqual(searchSurahs(surahs, "٢").map((m) => m.surah.number), [2]);
  });

  it("finds by English name", () => {
    assert.deepEqual(searchSurahs(surahs, "s2").map((m) => m.surah.number), [2]);
  });
});

/* ---------- parsing / validation ---------- */

describe("payload validation", () => {
  const ayahs = [1, 2, 3].map((n) => ({ number: 100 + n, numberInSurah: n, text: `آية ${n}`, juz: 1, page: 1, sajda: false }));

  it("accepts a well-formed surah and rejects a mismatching one", () => {
    const raw = envelope({ ...surahMeta(5, "سورة", 3), ayahs });
    assert.equal(parseSurahText(raw, 5).ayahs.length, 3);
    assert.throws(() => parseSurahText(raw, 6), FormatError);
  });

  it("rejects incomplete or non-sequential surahs", () => {
    assert.throws(() => parseSurahText(envelope({ ...surahMeta(5, "سورة", 4), ayahs }), 5), FormatError);
    const shuffled = [ayahs[1], ayahs[0], ayahs[2]];
    assert.throws(() => parseSurahText(envelope({ ...surahMeta(5, "سورة", 3), ayahs: shuffled }), 5), FormatError);
  });

  it("rejects error envelopes and garbage", () => {
    assert.throws(() => parseSurahList({ code: 500, data: "boom" }), FormatError);
    assert.throws(() => parseSurahList("nope"), FormatError);
    assert.throws(() => parseSurahList(envelope([])), FormatError);
  });

  it("parses a juz with per-ayah surahs and keeps each ayah's own surah number", () => {
    const juzAyahs = [
      { number: 7, numberInSurah: 7, text: "أ", juz: 1, page: 1, sajda: false, surah: surahMeta(1, "الأولى", 7) },
      { number: 8, numberInSurah: 1, text: "ب", juz: 1, page: 2, sajda: false, surah: surahMeta(2, "الثانية", 286) }
    ];
    const parsed = parseJuzText(envelope({ number: 1, ayahs: juzAyahs }), 1);
    assert.deepEqual(parsed.map((a) => a.surahNumber), [1, 2]);
    assert.throws(() => parseJuzText(envelope({ number: 2, ayahs: juzAyahs }), 1), FormatError);
  });

  it("matches audio to text by global ayah number, not by position", () => {
    const text = [1, 2, 3].map((n) => ({
      number: 100 + n, numberInSurah: n, text: "x", surahNumber: 5, surahName: "s", juz: 1, page: 1, sajda: false
    }));
    const good = parseAudio(envelope({ ayahs: [3, 1, 2].map((n) => ({ number: 100 + n, audio: `https://a/${n}.mp3` })) }));
    assert.equal(checkAudioMatchesText(text, good), null);

    const wrongSet = parseAudio(envelope({ ayahs: [1, 2, 4].map((n) => ({ number: 100 + n, audio: `https://a/${n}.mp3` })) }));
    assert.notEqual(checkAudioMatchesText(text, wrongSet), null);

    const short = parseAudio(envelope({ ayahs: [1, 2].map((n) => ({ number: 100 + n, audio: `https://a/${n}.mp3` })) }));
    assert.notEqual(checkAudioMatchesText(text, short), null);
  });

  it("rejects audio with non-http urls", () => {
    assert.throws(() => parseAudio(envelope({ ayahs: [{ number: 1, audio: "javascript:alert(1)" }] })), FormatError);
  });

  it("validates the complete Quran payload size", () => {
    assert.throws(() => parseFullQuran(envelope({ surahs: [] })), FormatError);
  });

  it("accepts the full-Quran payload where surahs have no numberOfAyahs", () => {
    // 114 surahs totalling 6236 ayahs (real counts are not needed, only the total).
    const surahs = Array.from({ length: 114 }, (_, i) => {
      const n = i === 113 ? 6236 - 113 * 54 : 54;
      return {
        number: i + 1, name: `س${i + 1}`, englishName: "x", englishNameTranslation: "", revelationType: "Meccan",
        ayahs: Array.from({ length: n }, (_, k) => ({ number: k + 1, text: "نص", numberInSurah: k + 1 }))
      };
    });
    const parsed = parseFullQuran(envelope({ surahs }));
    assert.equal(parsed.ayahs.length, 6236);
    assert.equal(parsed.surahs[0].numberOfAyahs, 54);
  });
});

/* ---------- fetchJson ---------- */

describe("fetchJson", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    globalThis.fetch = impl as typeof fetch;
  }

  it("returns parsed JSON", async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    assert.deepEqual(await fetchJson("https://x/ok"), { ok: 1 });
  });

  it("retries once on 5xx and then succeeds", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      return calls === 1 ? new Response("err", { status: 503 }) : new Response("{}", { status: 200 });
    });
    await fetchJson("https://x/retry");
    assert.equal(calls, 2);
  });

  it("does not retry 4xx", async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      return new Response("nf", { status: 404 });
    });
    await assert.rejects(fetchJson("https://x/404"), (e: unknown) => e instanceof ApiError && e.kind === "http" && e.status === 404);
    assert.equal(calls, 1);
  });

  it("times out", async () => {
    mockFetch((_url, init) => new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("a", "AbortError")))));
    await assert.rejects(fetchJson("https://x/slow", { timeoutMs: 30, retries: 0 }), (e: unknown) => e instanceof ApiError && e.kind === "timeout");
  });

  it("aborts on request and does not retry", async () => {
    let calls = 0;
    mockFetch((_url, init) => {
      calls++;
      return new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("a", "AbortError"))));
    });
    const ctrl = new AbortController();
    const p = fetchJson("https://x/abort", { signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 20);
    await assert.rejects(p, (e: unknown) => e instanceof ApiError && e.kind === "aborted");
    assert.equal(calls, 1);
  });

  it("reports malformed JSON as a format error", async () => {
    mockFetch(async () => new Response("<html>", { status: 200 }));
    await assert.rejects(fetchJson("https://x/bad"), FormatError);
  });
});
