const DEFAULT_WHATSAPP_NUMBERS = ["963936900205", "963930475775"];
const state = { prices: [], whatsappNumbers: [...DEFAULT_WHATSAPP_NUMBERS] };
const CATALOG_URL =
  "https://raw.githubusercontent.com/Ragnarsyria-code/coastways/site-data/docs/prices.json";
const CUSTOM_DESTINATION = "وجهة / معبر آخر — اكتبها يدوياً";
const AIRPORTS = ["مطار اللاذقية", "مطار دمشق", "مطار حلب", "مطار بيروت"];
const COAST_DESTINATIONS = [
  "اللاذقية",
  "جبلة",
  "القرداحة",
  "الحفة",
  "بانياس",
  "طرطوس",
  "صافيتا",
  "حمص",
  "دمشق",
  "حلب",
];
const BEIRUT_CROSSING_DESTINATIONS = [
  "اللاذقية عبر معبر جوسيه",
  "اللاذقية عبر معبر المصنع",
  "اللاذقية عبر معبر جسر قمار",
  "طرطوس عبر معبر جوسيه",
  "طرطوس عبر معبر المصنع",
  "طرطوس عبر معبر جسر قمار",
];
const BEIRUT_DESTINATIONS = [...BEIRUT_CROSSING_DESTINATIONS, ...COAST_DESTINATIONS];
const DEFAULT_VEHICLES = ["تكسي", "سوناتا", "أوبتيما", "جيب توسان", "فان"];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function loadCatalog() {
  const requests = [
    fetch("./prices.json", { cache: "no-store" }).then((response) => response.json()),
    fetch(`${CATALOG_URL}?v=${Date.now()}`, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Remote catalog unavailable");
      return response.json();
    }),
  ];
  const results = await Promise.allSettled(requests);
  const catalogs = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  if (!catalogs.length) throw new Error("Catalog unavailable");
  const catalog = catalogs.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))[0];
  state.prices = catalog.prices.map((price) => ({ ...price, stages: price.stages || 1 }));
  state.whatsappNumbers = unique(
    (catalog.whatsapp_numbers?.length ? catalog.whatsapp_numbers : [catalog.whatsapp])
      .map(normalizeWhatsapp)
      .filter(Boolean),
  );
  if (!state.whatsappNumbers.length) state.whatsappNumbers = [...DEFAULT_WHATSAPP_NUMBERS];
  populateAirports();
  updateWhatsappLinks();
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeWhatsapp(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `963${digits.slice(1)}` : digits;
}

function formatWhatsapp(value) {
  const digits = normalizeWhatsapp(value);
  return digits.startsWith("963") && digits.length === 12
    ? `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
    : `+${digits}`;
}

function setOptions(select, values, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>${values
    .map((value) => `<option value="${value}">${value}</option>`)
    .join("")}`;
  select.disabled = values.length === 0;
}

function stageLabel(stages) {
  return Number(stages) === 2 ? "مرحلتان — سيارتان" : "مرحلة واحدة — سيارة واحدة";
}

function setStageOptions(values) {
  const select = $("#stages");
  select.innerHTML = `<option value="">اختر عدد المراحل</option>${values
    .map((value) => `<option value="${value}">${stageLabel(value)}</option>`)
    .join("")}`;
  select.disabled = values.length === 0;
}

function populateAirports() {
  setOptions(
    $("#airport"),
    unique([...AIRPORTS, ...state.prices.map((item) => item.airport)]),
    "اختر المطار",
  );
}

function destinationValue() {
  return $("#destination").value === CUSTOM_DESTINATION
    ? $("#custom-destination").value.trim()
    : $("#destination").value;
}

function toggleCustomDestination() {
  const custom = $("#destination").value === CUSTOM_DESTINATION;
  $("#custom-destination-field").classList.toggle("hidden", !custom);
  $("#custom-destination").required = custom;
  if (!custom) $("#custom-destination").value = "";
}

function updateDestinations() {
  const airport = $("#airport").value;
  const prices = state.prices.filter((item) => item.airport === airport);
  const standardDestinations = airport === "مطار بيروت" ? BEIRUT_DESTINATIONS : COAST_DESTINATIONS;
  setOptions(
    $("#destination"),
    unique([...standardDestinations, ...prices.map((item) => item.destination), CUSTOM_DESTINATION]),
    "اختر الوجهة أو المعبر",
  );
  toggleCustomDestination();
  setStageOptions([]);
  setOptions($("#vehicle"), [], "اختر السيارة");
  updatePrice();
}

function updateStages() {
  toggleCustomDestination();
  setStageOptions($("#destination").value ? [1, 2] : []);
  setOptions($("#vehicle"), [], "اختر السيارة");
  updatePrice();
}

function updateVehicles() {
  const prices = state.prices.filter(
    (item) =>
      item.airport === $("#airport").value &&
      item.destination === destinationValue() &&
      item.stages === Number($("#stages").value),
  );
  setOptions(
    $("#vehicle"),
    unique([...prices.map((item) => item.vehicle), ...DEFAULT_VEHICLES]),
    "اختر السيارة",
  );
  updatePrice();
}

function selectedPrice() {
  const passengers = Number($("#passengers").value);
  return state.prices.find(
    (item) =>
      item.airport === $("#airport").value &&
      item.destination === destinationValue() &&
      item.stages === Number($("#stages").value) &&
      item.vehicle === $("#vehicle").value &&
      passengers >= item.min_passengers &&
      passengers <= item.max_passengers,
  );
}

function updatePrice() {
  const price = selectedPrice();
  const complete =
    $("#airport").value && destinationValue() && $("#stages").value && $("#vehicle").value;
  if (price) {
    $("#price-value").textContent = `$${Number(price.price).toLocaleString("en-US")}`;
    $("#price-note").textContent =
      `${price.vehicle} — ${stageLabel(price.stages)} — ${price.min_passengers}–${price.max_passengers} ركاب`;
    $("#price-box").classList.add("has-price");
  } else {
    $("#price-value").textContent = complete ? "حسب الطلب" : "—";
    $("#price-note").textContent = complete ? "سنرسل لك السعر عبر واتساب" : "اختر تفاصيل الرحلة";
    $("#price-box").classList.remove("has-price");
  }
  $("#submit-booking").disabled = !complete;
}

function updateWhatsappLinks() {
  $$("[data-whatsapp-link]").forEach((link) => {
    const index = Number(link.dataset.whatsappIndex || 0);
    const number = state.whatsappNumbers[index] || state.whatsappNumbers[0];
    link.href = `https://wa.me/${number}?text=${encodeURIComponent("مرحباً دروب الساحل، أريد الاستفسار عن رحلة.")}`;
  });
  $$("[data-whatsapp-number]").forEach((number) => {
    const index = Number(number.dataset.whatsappIndex || 0);
    number.textContent = formatWhatsapp(state.whatsappNumbers[index] || state.whatsappNumbers[0]);
  });
  $("#booking-whatsapp").innerHTML = state.whatsappNumbers
    .map((number, index) => `<option value="${number}">رقم واتساب ${index + 1} — ${formatWhatsapp(number)}</option>`)
    .join("");
}

function submitBooking(event) {
  event.preventDefault();
  const price = selectedPrice();
  const date = new Date($("#date").value);
  const dateText = new Intl.DateTimeFormat("ar-SY", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
  const lines = [
    "مرحباً دروب الساحل للسفر، أريد حجز رحلة:",
    "",
    `الاسم: ${$("#name").value}`,
    `الهاتف: ${$("#phone").value}`,
    `المطار: ${$("#airport").value}`,
    `الوجهة / المعبر: ${destinationValue()}`,
    `موديل / نوع السيارة: ${$("#vehicle").value}`,
    `عدد الركاب: ${$("#passengers").value}`,
    `طريقة الرحلة: ${stageLabel($("#stages").value)}`,
    `الموعد: ${dateText}`,
    `رقم الرحلة: ${$("#flight").value || "غير مذكور"}`,
    `سعر الرحلة كاملة: ${price ? `$${price.price}` : "حسب الطلب"}`,
    `ملاحظات: ${$("#notes").value || "لا يوجد"}`,
    "",
    "أرجو تأكيد توفر السيارة والحجز.",
  ];
  const whatsapp = $("#booking-whatsapp").value || state.whatsappNumbers[0];
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}

function setMinimumDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("#date").min = now.toISOString().slice(0, 16);
}

$("#airport").addEventListener("change", updateDestinations);
$("#destination").addEventListener("change", updateStages);
$("#custom-destination").addEventListener("input", updatePrice);
$("#stages").addEventListener("change", updateVehicles);
$("#vehicle").addEventListener("change", updatePrice);
$("#passengers").addEventListener("input", updatePrice);
$("#booking-form").addEventListener("submit", submitBooking);
setMinimumDate();
loadCatalog().catch(() => {
  $("#price-note").textContent = "تعذر تحميل الأسعار، تواصل معنا عبر واتساب";
  updateWhatsappLinks();
});
