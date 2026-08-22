const state = { prices: [], whatsapp: "963999597094" };
const CATALOG_URL =
  "https://raw.githubusercontent.com/Ragnarsyria-code/coastways/site-data/docs/prices.json";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function loadCatalog() {
  let response;
  try {
    response = await fetch(`${CATALOG_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Remote catalog unavailable");
  } catch {
    response = await fetch("./prices.json", { cache: "no-store" });
  }
  const catalog = await response.json();
  state.prices = catalog.prices.map((price) => ({ ...price, stages: price.stages || 1 }));
  state.whatsapp = catalog.whatsapp;
  populateAirports();
  updateWhatsappLinks();
}

function unique(values) {
  return [...new Set(values)];
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
  setOptions($("#airport"), unique(state.prices.map((item) => item.airport)), "اختر المطار");
}

function updateDestinations() {
  const prices = state.prices.filter((item) => item.airport === $("#airport").value);
  setOptions($("#destination"), unique(prices.map((item) => item.destination)), "اختر الوجهة أو المعبر");
  setStageOptions([]);
  setOptions($("#vehicle"), [], "اختر السيارة");
  updatePrice();
}

function updateStages() {
  const prices = state.prices.filter(
    (item) => item.airport === $("#airport").value && item.destination === $("#destination").value,
  );
  setStageOptions(unique(prices.map((item) => item.stages)).sort());
  setOptions($("#vehicle"), [], "اختر السيارة");
  updatePrice();
}

function updateVehicles() {
  const prices = state.prices.filter(
    (item) =>
      item.airport === $("#airport").value &&
      item.destination === $("#destination").value &&
      item.stages === Number($("#stages").value),
  );
  setOptions($("#vehicle"), unique(prices.map((item) => item.vehicle)), "اختر السيارة");
  updatePrice();
}

function selectedPrice() {
  const passengers = Number($("#passengers").value);
  return state.prices.find(
    (item) =>
      item.airport === $("#airport").value &&
      item.destination === $("#destination").value &&
      item.stages === Number($("#stages").value) &&
      item.vehicle === $("#vehicle").value &&
      passengers >= item.min_passengers &&
      passengers <= item.max_passengers,
  );
}

function updatePrice() {
  const price = selectedPrice();
  const complete =
    $("#airport").value && $("#destination").value && $("#stages").value && $("#vehicle").value;
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
    link.href = `https://wa.me/${state.whatsapp}?text=${encodeURIComponent("مرحباً دروب الساحل، أريد الاستفسار عن رحلة.")}`;
  });
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
    `الوجهة / المعبر: ${$("#destination").value}`,
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
  window.open(`https://wa.me/${state.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
}

function setMinimumDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("#date").min = now.toISOString().slice(0, 16);
}

$("#airport").addEventListener("change", updateDestinations);
$("#destination").addEventListener("change", updateStages);
$("#stages").addEventListener("change", updateVehicles);
$("#vehicle").addEventListener("change", updatePrice);
$("#passengers").addEventListener("input", updatePrice);
$("#booking-form").addEventListener("submit", submitBooking);
setMinimumDate();
loadCatalog().catch(() => {
  $("#price-note").textContent = "تعذر تحميل الأسعار، تواصل معنا عبر واتساب";
  updateWhatsappLinks();
});
