# المصحف — القرآن الكريم (React + TypeScript + Vite)

- `npm install` ثم `npm run dev` للتشغيل، `npm run build` للبناء، `npm run lint` لفحص الأنواع، `npm test` لاختبارات المنطق.
- البيانات: نص عثماني وتلاوات من `api.alquran.cloud` (edition: `quran-uthmani`)، والتفسير من `api.quran-tafseer.com`. لا توجد مفاتيح API في الواجهة.
- لا يُعدَّل نص القرآن أبداً؛ يُخفى فقط تكرار البسملة الملصقة بالآية الأولى عند العرض (انظر `src/lib/arabic.ts`).
