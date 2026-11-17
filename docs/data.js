export const DEFAULT_WHATSAPP_NUMBERS = ["963936900205", "963930475775"];

export const AIRPORTS = Object.freeze([
  {
    id: "airport-latakia",
    type: "airport",
    nameAr: "مطار اللاذقية",
    nameEn: "Latakia Airport",
    code: "LTK",
    value: "مطار اللاذقية",
  },
  {
    id: "airport-damascus",
    type: "airport",
    nameAr: "مطار دمشق",
    nameEn: "Damascus International Airport",
    code: "DAM",
    value: "مطار دمشق",
  },
  {
    id: "airport-aleppo",
    type: "airport",
    nameAr: "مطار حلب",
    nameEn: "Aleppo International Airport",
    code: "ALP",
    value: "مطار حلب",
  },
  {
    id: "airport-beirut",
    type: "airport",
    nameAr: "مطار بيروت",
    nameEn: "Beirut–Rafic Hariri Airport",
    code: "BEY",
    value: "مطار بيروت",
  },
]);

export const CITIES = Object.freeze(
  [
    ["latakia", "اللاذقية", "Latakia"],
    ["jableh", "جبلة", "Jableh"],
    ["qardaha", "القرداحة", "Qardaha"],
    ["al-haffah", "الحفة", "Al-Haffah"],
    ["baniyas", "بانياس", "Baniyas"],
    ["tartus", "طرطوس", "Tartus"],
    ["safita", "صافيتا", "Safita"],
    ["homs", "حمص", "Homs"],
    ["damascus", "دمشق", "Damascus"],
    ["aleppo", "حلب", "Aleppo"],
  ].map(([id, nameAr, nameEn]) => ({
    id: `city-${id}`,
    type: "city",
    nameAr,
    nameEn,
    value: nameAr,
  })),
);

export const BORDER_ROUTES = Object.freeze(
  [
    ["latakia-jousieh", "اللاذقية عبر معبر جوسيه", "Latakia via Jousieh"],
    ["latakia-masnaa", "اللاذقية عبر معبر المصنع", "Latakia via Al Masnaa"],
    [
      "latakia-jisr-qmar",
      "اللاذقية عبر معبر جسر قمار",
      "Latakia via Jisr Qmar",
    ],
    ["tartus-jousieh", "طرطوس عبر معبر جوسيه", "Tartus via Jousieh"],
    ["tartus-masnaa", "طرطوس عبر معبر المصنع", "Tartus via Al Masnaa"],
    ["tartus-jisr-qmar", "طرطوس عبر معبر جسر قمار", "Tartus via Jisr Qmar"],
  ].map(([id, nameAr, nameEn]) => ({
    id: `border-${id}`,
    type: "border",
    nameAr,
    nameEn,
    value: nameAr,
  })),
);

export const LOCATIONS = Object.freeze([
  ...AIRPORTS,
  ...CITIES,
  ...BORDER_ROUTES,
]);

export const VEHICLES = Object.freeze([
  {
    id: "taxi",
    value: "تكسي",
    className: "Standard",
    title: "تكسي",
    description: "خيار عملي للرحلات الخاصة",
    image: "./assets/hero-car.webp",
    luggageCapacity: null,
  },
  {
    id: "sonata",
    value: "سوناتا",
    className: "Comfort",
    title: "سوناتا",
    description: "سيدان مريحة للتنقّل بين المدن",
    image: "./assets/hero-car.webp",
    luggageCapacity: null,
  },
  {
    id: "optima",
    value: "أوبتيما",
    className: "Premium",
    title: "أوبتيما",
    description: "سيدان خاصة للرحلات الطويلة",
    image: "./assets/hero-car.webp",
    luggageCapacity: null,
  },
  {
    id: "tucson",
    value: "جيب توسان",
    className: "SUV",
    title: "جيب توسان",
    description: "مركبة مرتفعة ورحبة",
    image: "./assets/hero-car.webp",
    luggageCapacity: null,
  },
  {
    id: "van",
    value: "فان",
    className: "Van",
    title: "فان",
    description: "للعائلات والمجموعات",
    image: "./assets/hero-fleet.webp",
    luggageCapacity: null,
  },
]);

export const POPULAR_ROUTE_KEYS = Object.freeze([
  ["مطار دمشق", "اللاذقية"],
  ["مطار حلب", "اللاذقية"],
  ["مطار بيروت", "طرطوس"],
  ["مطار اللاذقية", "اللاذقية"],
]);

export const LOYALTY_MODEL = Object.freeze({
  enabled: false,
  tiers: ["Classic", "Silver", "Gold", "Platinum"],
  futureCapabilities: ["trips", "points", "tier", "rewards"],
});

export function createBooking() {
  return {
    origin: null,
    destination: null,
    stages: 1,
    date: "",
    time: "",
    flightNumber: "",
    passengers: 2,
    luggage: 2,
    vehicle: "",
    passenger: {
      fullName: "",
      countryCode: "+963",
      phone: "",
      whatsapp: "",
      notes: "",
    },
    recipient: DEFAULT_WHATSAPP_NUMBERS[0],
  };
}

export function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `963${digits.slice(1)}` : digits;
}

export function formatWhatsapp(value) {
  const digits = normalizeWhatsapp(value);
  return digits.startsWith("963") && digits.length === 12
    ? `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
    : `+${digits}`;
}

export function stageLabel(value) {
  return Number(value) === 2
    ? "مرحلتان — تبديل السيارة عند المعبر"
    : "مرحلة واحدة — نفس السيارة";
}
