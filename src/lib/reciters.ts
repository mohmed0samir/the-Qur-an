import type { Reciter } from "../types";

export const RECITERS: Reciter[] = [
  { id: "ar.alafasy", name: "مشاري بن راشد العفاسي", englishName: "Mishary Alafasy" },
  { id: "ar.abdurrahmaansudais", name: "عبد الرحمن السديس", englishName: "Abdurrahman Al-Sudais" },
  { id: "ar.husary", name: "محمود خليل الحصري", englishName: "Mahmoud Al-Husary" },
  { id: "ar.minshawi", name: "محمد صديق المنشاوي", englishName: "Muhammad Al-Minshawi" },
  { id: "ar.ahmedajamy", name: "أحمد بن علي العجمي", englishName: "Ahmed Al-Ajamy" }
];

export const DEFAULT_RECITER = RECITERS[0].id;

export function isKnownReciter(id: string | null | undefined): id is string {
  return !!id && RECITERS.some((r) => r.id === id);
}

export function reciterName(id: string): string {
  return RECITERS.find((r) => r.id === id)?.name ?? id;
}
