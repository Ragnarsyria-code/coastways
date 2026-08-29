import {
  AIRPORTS,
  BORDER_ROUTES,
  CITIES,
  DEFAULT_WHATSAPP_NUMBERS,
  LOCATIONS,
  POPULAR_ROUTE_KEYS,
  VEHICLES,
  createBooking,
  formatWhatsapp,
  normalizeWhatsapp,
  stageLabel,
} from "./data.js?v=20260829-1";
import { flightTrackingService } from "./services/flight-tracking.js?v=20260829-1";

const CATALOG_URL =
  "https://raw.githubusercontent.com/Ragnarsyria-code/coastways/site-data/docs/prices.json";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  booking: createBooking(),
  currentStep: 0,
  pickerTarget: "origin",
  prices: [],
  whatsappNumbers: [...DEFAULT_WHATSAPP_NUMBERS],
};

function unique(values) {
  return [...new Set(values)];
}

function escapeHtml(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => characters[character],
  );
}

function normalizeSearch(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .trim();
}

function currency(value) {
  return `$${Number(value).toLocaleString("en-US")}`;
}

function todayValue(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value, style = "long") {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("ar-SY", {
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: style === "short" ? undefined : "numeric",
  }).format(date);
}

function pricingContext() {
  const { origin, destination } = state.booking;
  if (!origin || !destination) return null;
  if (origin.type === "airport") {
    return { airport: origin.value, destination: destination.value };
  }
  if (destination.type === "airport") {
    return { airport: destination.value, destination: origin.value };
  }
  return null;
}

function routePrices() {
  const context = pricingContext();
  if (!context) return [];
  return state.prices.filter(
    (item) =>
      item.airport === context.airport &&
      item.destination === context.destination &&
      Number(item.stages || 1) === Number(state.booking.stages),
  );
}

function selectedPrice() {
  return routePrices().find(
    (item) =>
      item.vehicle === state.booking.vehicle &&
      state.booking.passengers >= Number(item.min_passengers) &&
      state.booking.passengers <= Number(item.max_passengers),
  );
}

function vehicleCapacity(vehicle) {
  const routeEntries = routePrices().filter((item) => item.vehicle === vehicle);
  const entries = routeEntries.length
    ? routeEntries
    : state.prices.filter((item) => item.vehicle === vehicle);
  const capacities = entries
    .map((item) => Number(item.max_passengers))
    .filter(Boolean);
  return capacities.length ? Math.max(...capacities) : null;
}

function vehicleConfig(value) {
  return (
    VEHICLES.find((vehicle) => vehicle.value === value) || {
      id: value,
      value,
      className: "Private",
      title: value,
      description: "خيار نقل خاص متاح عبر المكتب",
      image: "./assets/hero-car.webp",
      luggageCapacity: null,
    }
  );
}

function availableVehicleValues() {
  return unique([
    ...VEHICLES.map((vehicle) => vehicle.value),
    ...state.prices.map((item) => item.vehicle).filter(Boolean),
  ]);
}

async function loadCatalog() {
  const status = $("#catalog-status");
  const requests = [
    fetch("./prices.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Local catalog unavailable");
      return response.json();
    }),
    fetch(`${CATALOG_URL}?v=${Date.now()}`, { cache: "no-store" }).then(
      (response) => {
        if (!response.ok) throw new Error("Remote catalog unavailable");
        return response.json();
      },
    ),
  ];

  const results = await Promise.allSettled(requests);
  const catalogs = results
    .filter(
      (result) =>
        result.status === "fulfilled" && Array.isArray(result.value.prices),
    )
    .map((result) => result.value);

  if (!catalogs.length) {
    status.className = "catalog-status is-error";
    status.textContent =
      "تعذر تحميل الأسعار حالياً. يمكنك إكمال الطلب وسيؤكد المكتب السعر عبر واتساب.";
    renderFleet();
    renderPopularRoutes();
    updateWhatsappLinks();
    renderRecipients();
    return;
  }

  const catalog = catalogs.sort(
    (a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0),
  )[0];
  state.prices = catalog.prices.map((price) => ({
    ...price,
    stages: Number(price.stages || 1),
    min_passengers: Number(price.min_passengers),
    max_passengers: Number(price.max_passengers),
    price: Number(price.price),
  }));
  state.whatsappNumbers = unique(
    (catalog.whatsapp_numbers?.length
      ? catalog.whatsapp_numbers
      : [catalog.whatsapp]
    )
      .map(normalizeWhatsapp)
      .filter(Boolean),
  );
  if (!state.whatsappNumbers.length) {
    state.whatsappNumbers = [...DEFAULT_WHATSAPP_NUMBERS];
  }
  state.booking.recipient = state.whatsappNumbers[0];

  status.className = "catalog-status is-ready";
  status.textContent = "الأسعار محدثة وجاهزة للحجز.";
  updateWhatsappLinks();
  renderRecipients();
  renderFleet();
  renderPopularRoutes();
  updateSummary();
}

function updateWhatsappLinks() {
  $$("[data-whatsapp-link]").forEach((link) => {
    const index = Number(link.dataset.whatsappIndex || 0);
    const number = state.whatsappNumbers[index] || state.whatsappNumbers[0];
    link.href = `https://wa.me/${number}?text=${encodeURIComponent(
      "مرحباً دروب الساحل، أريد الاستفسار عن رحلة.",
    )}`;
    link.target = "_blank";
    link.rel = "noopener";
  });

  $$("[data-whatsapp-number]").forEach((element) => {
    const index = Number(element.dataset.whatsappIndex || 0);
    element.textContent = formatWhatsapp(
      state.whatsappNumbers[index] || state.whatsappNumbers[0],
    );
  });
}

function renderRecipients() {
  const container = $("#recipient-options");
  container.innerHTML = state.whatsappNumbers
    .map(
      (number, index) => `
        <label class="recipient-option">
          <input type="radio" name="recipient" value="${number}" ${index === 0 ? "checked" : ""} />
          <span>واتساب ${index + 1}</span>
          <bdi dir="ltr">${formatWhatsapp(number)}</bdi>
        </label>
      `,
    )
    .join("");

  $$('input[name="recipient"]', container).forEach((input) => {
    input.addEventListener("change", () => {
      state.booking.recipient = input.value;
    });
  });
}

function locationIcon(type) {
  if (type === "airport") return "✈";
  if (type === "border") return "↝";
  return "⌖";
}

function openLocationPicker(target) {
  state.pickerTarget = target;
  const dialog = $("#location-dialog");
  $("#location-dialog-title").textContent =
    target === "origin" ? "من أين؟" : "إلى أين؟";
  $("#location-search").value = "";
  renderLocationResults("");
  dialog.showModal();
  window.setTimeout(() => $("#location-search").focus(), 40);
}

function closeLocationPicker() {
  $("#location-dialog").close();
}

function pickerLocations() {
  const selectedOther =
    state.pickerTarget === "origin"
      ? state.booking.destination
      : state.booking.origin;
  return LOCATIONS.filter((location) => location.id !== selectedOther?.id);
}

function optionMarkup(location) {
  return `
    <button class="location-option" type="button" data-location-id="${escapeHtml(location.id)}">
      <span class="location-option-icon" aria-hidden="true">${locationIcon(location.type)}</span>
      <span>
        <strong>${escapeHtml(location.nameAr)}</strong>
        <small dir="ltr">${escapeHtml(location.nameEn)}</small>
      </span>
      ${location.code ? `<bdi dir="ltr">${escapeHtml(location.code)}</bdi>` : ""}
    </button>
  `;
}

function renderLocationResults(query) {
  const normalizedQuery = normalizeSearch(query);
  const locations = pickerLocations().filter((location) => {
    if (!normalizedQuery) return true;
    return normalizeSearch(
      `${location.nameAr} ${location.nameEn} ${location.code || ""}`,
    ).includes(normalizedQuery);
  });
  const results = $("#location-results");
  const empty = $("#location-empty");
  const customButton = $("#use-custom-location");

  if (!locations.length) {
    results.innerHTML = "";
    empty.hidden = false;
    customButton.hidden = !(
      state.pickerTarget === "destination" && query.trim().length >= 2
    );
    customButton.dataset.value = query.trim();
    return;
  }

  empty.hidden = true;
  customButton.hidden = true;
  const popularIds =
    state.booking.origin?.value === "مطار بيروت" &&
    state.pickerTarget === "destination"
      ? BORDER_ROUTES.map((location) => location.id)
      : ["airport-damascus", "airport-beirut", "city-latakia", "city-tartus"];

  let groups;
  if (normalizedQuery) {
    groups = [
      ["المطارات", locations.filter((location) => location.type === "airport")],
      ["المدن", locations.filter((location) => location.type === "city")],
      [
        "المعابر الحدودية",
        locations.filter((location) => location.type === "border"),
      ],
    ];
  } else {
    const popular = locations.filter((location) =>
      popularIds.includes(location.id),
    );
    const remaining = locations.filter(
      (location) => !popularIds.includes(location.id),
    );
    groups = [
      ["الوجهات الشائعة", popular],
      ["المطارات", remaining.filter((location) => location.type === "airport")],
      ["المدن", remaining.filter((location) => location.type === "city")],
      [
        "المعابر الحدودية",
        remaining.filter((location) => location.type === "border"),
      ],
    ];
  }

  results.innerHTML = groups
    .filter(([, items]) => items.length)
    .map(
      ([title, items]) => `
        <section class="location-group">
          <h3>${title}</h3>
          ${items.map(optionMarkup).join("")}
        </section>
      `,
    )
    .join("");

  $$("[data-location-id]", results).forEach((button) => {
    button.addEventListener("click", () => {
      const location = LOCATIONS.find(
        (item) => item.id === button.dataset.locationId,
      );
      setLocation(state.pickerTarget, location);
      closeLocationPicker();
    });
  });
}

function setLocation(target, location) {
  state.booking[target] = location;
  if (
    state.booking.origin?.id &&
    state.booking.origin.id === state.booking.destination?.id
  ) {
    state.booking[target === "origin" ? "destination" : "origin"] = null;
  }
  state.booking.vehicle = "";
  syncRouteUI();
  renderVehicles();
  updateSummary();
}

function syncRouteUI() {
  ["origin", "destination"].forEach((target) => {
    $$(`[data-location-label="${target}"]`).forEach((label) => {
      const location = state.booking[target];
      label.textContent =
        location?.nameAr ||
        (target === "origin"
          ? "اختر المطار أو المدينة"
          : "اختر الوجهة أو المعبر");
      label.closest("button")?.classList.toggle("has-value", Boolean(location));
    });
  });

  $("#route-stage").hidden = !(
    state.booking.origin && state.booking.destination
  );
  $("#flight-field").hidden = state.booking.origin?.type !== "airport";
  $("#swap-route").disabled =
    state.booking.origin?.type === "border" ||
    state.booking.destination?.type === "border";
}

function swapRoute() {
  if ($("#swap-route").disabled) return;
  const origin = state.booking.origin;
  state.booking.origin = state.booking.destination;
  state.booking.destination = origin;
  state.booking.vehicle = "";
  syncRouteUI();
  renderVehicles();
  updateSummary();
}

function selectDate(value) {
  state.booking.date = value;
  $("#trip-date").value = value;
  $$(".date-shortcuts button").forEach((button) => {
    const target =
      button.dataset.dateShortcut === "today" ? todayValue() : todayValue(1);
    button.classList.toggle("is-selected", target === value);
  });
  const customLabel = $("#trip-date").closest("label");
  customLabel.classList.toggle(
    "is-selected",
    Boolean(value) && ![todayValue(), todayValue(1)].includes(value),
  );
  $("span", customLabel).textContent =
    value && ![todayValue(), todayValue(1)].includes(value)
      ? formatDate(value, "short")
      : "اختيار تاريخ";
  updateSummary();
}

function updateCounter(type, change) {
  const minimum = type === "passengers" ? 1 : 0;
  const maximum = 20;
  state.booking[type] = Math.min(
    maximum,
    Math.max(minimum, state.booking[type] + change),
  );
  $(`#${type}-count`).textContent = state.booking[type];
  if (type === "passengers") {
    state.booking.vehicle = "";
    renderVehicles();
  }
  updateSummary();
}

function renderVehicles() {
  const container = $("#vehicle-list");
  const values = availableVehicleValues();
  container.innerHTML = values
    .map((value) => {
      const config = vehicleConfig(value);
      const capacity = vehicleCapacity(value);
      const matchingPrice = routePrices().find(
        (item) =>
          item.vehicle === value &&
          state.booking.passengers >= item.min_passengers &&
          state.booking.passengers <= item.max_passengers,
      );
      const unsuitable = Boolean(
        capacity && state.booking.passengers > capacity,
      );
      const selected = state.booking.vehicle === value;
      return `
        <button
          class="vehicle-card ${selected ? "is-selected" : ""}"
          type="button"
          data-vehicle="${escapeHtml(value)}"
          ${unsuitable ? "disabled" : ""}
          aria-pressed="${selected}"
        >
          <span class="vehicle-image">
            <img src="${escapeHtml(config.image)}" alt="${escapeHtml(config.title)}" width="220" height="130" loading="lazy" />
          </span>
          <span>
            <small class="vehicle-class" dir="ltr">${escapeHtml(config.className)}</small>
            <h4>${escapeHtml(config.title)}</h4>
            <p>${escapeHtml(config.description)}</p>
            <span class="vehicle-meta">
              <span>♙ ${capacity ? `حتى ${capacity} ركاب` : "السعة تُراجع"}</span>
              <span>▣ الحقائب حسب العدد</span>
            </span>
          </span>
          <span class="vehicle-offer">
            <small>${unsuitable ? "غير مناسب لعدد الركاب" : matchingPrice ? "سعر الرحلة" : "التسعير"}</small>
            <strong>${unsuitable ? "—" : matchingPrice ? currency(matchingPrice.price) : "بعد المراجعة"}</strong>
          </span>
        </button>
      `;
    })
    .join("");

  $$("[data-vehicle]", container).forEach((card) => {
    card.addEventListener("click", () => {
      state.booking.vehicle = card.dataset.vehicle;
      renderVehicles();
      updateSummary();
    });
  });
}

function renderFleet() {
  const container = $("#fleet-showcase");
  const values = availableVehicleValues();
  container.innerHTML = values
    .map((value) => {
      const config = vehicleConfig(value);
      const capacity = vehicleCapacity(value);
      return `
        <article class="fleet-card" data-vehicle="${escapeHtml(value)}">
          <div class="fleet-image"><img src="${escapeHtml(config.image)}" alt="${escapeHtml(config.title)}" width="260" height="150" loading="lazy" /></div>
          <div>
            <small dir="ltr">${escapeHtml(config.className)}</small>
            <h3>${escapeHtml(config.title)}</h3>
            <p>${escapeHtml(config.description)}</p>
            <span class="fleet-capacity">${capacity ? `سعة التسعير الحالية: حتى ${capacity} ركاب` : "تُحدد السعة عند مراجعة الطلب"} · الحقائب حسب العدد</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPopularRoutes() {
  const container = $("#popular-routes");
  container.innerHTML = POPULAR_ROUTE_KEYS.map(([airport, destination]) => {
    const prices = state.prices.filter(
      (item) => item.airport === airport && item.destination === destination,
    );
    const startingPrice = prices.length
      ? Math.min(...prices.map((item) => Number(item.price)))
      : null;
    return `
      <button class="route-card" type="button" data-airport="${airport}" data-destination="${destination}">
        <small>رحلة شائعة</small>
        <strong>${airport}</strong>
        <span class="route-arrow">↓</span>
        <strong>${destination}</strong>
        <span class="route-price">
          <span>${startingPrice ? "ابتداءً من" : "السعر"}</span>
          <b>${startingPrice ? currency(startingPrice) : "بعد المراجعة"}</b>
        </span>
      </button>
    `;
  }).join("");

  $$(".route-card", container).forEach((card) => {
    card.addEventListener("click", () => {
      const origin = AIRPORTS.find(
        (location) => location.value === card.dataset.airport,
      );
      const destination = [...CITIES, ...BORDER_ROUTES].find(
        (location) => location.value === card.dataset.destination,
      );
      state.booking.origin = origin;
      state.booking.destination = destination;
      const routeEntry = state.prices.find(
        (item) =>
          item.airport === card.dataset.airport &&
          item.destination === card.dataset.destination,
      );
      state.booking.stages = Number(routeEntry?.stages || 1);
      const stageInput = $(
        `input[name="stages"][value="${state.booking.stages}"]`,
      );
      if (stageInput) stageInput.checked = true;
      state.booking.vehicle = "";
      syncRouteUI();
      renderVehicles();
      updateSummary();
      goToStep(0, false);
      $("#booking").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function updateSummary() {
  const price = selectedPrice();
  const values = {
    origin: state.booking.origin?.nameAr || "لم تحدد بعد",
    destination: state.booking.destination?.nameAr || "لم تحدد بعد",
    date: formatDate(state.booking.date),
    time: state.booking.time || "—",
    vehicle: state.booking.vehicle || "—",
    passengers: String(state.booking.passengers),
    luggage: String(state.booking.luggage),
    price: state.booking.vehicle
      ? price
        ? currency(price.price)
        : "السعر بعد مراجعة الطلب"
      : "يظهر بعد اختيار السيارة",
  };
  Object.entries(values).forEach(([key, value]) => {
    $$(`[data-summary="${key}"]`).forEach((element) => {
      element.textContent = value;
    });
  });
}

function validateRoute() {
  const error = $("#route-error");
  if (!state.booking.origin || !state.booking.destination) {
    error.textContent = "اختر نقطة الانطلاق والوجهة للمتابعة.";
    return false;
  }
  if (state.booking.origin.value === state.booking.destination.value) {
    error.textContent = "يجب أن تكون نقطة الانطلاق مختلفة عن الوجهة.";
    return false;
  }
  error.textContent = "";
  return true;
}

function validateSchedule() {
  const error = $("#schedule-error");
  if (!state.booking.date) {
    error.textContent = "اختر تاريخ الرحلة.";
    return false;
  }
  if (state.booking.date < todayValue()) {
    error.textContent = "اختر تاريخاً من اليوم أو بعده.";
    return false;
  }
  if (!state.booking.time) {
    error.textContent = "اختر وقت الاستقبال.";
    return false;
  }
  error.textContent = "";
  return true;
}

function validateVehicle() {
  const error = $("#vehicle-error");
  if (!state.booking.vehicle) {
    error.textContent = "اختر السيارة المناسبة للمتابعة.";
    return false;
  }
  const capacity = vehicleCapacity(state.booking.vehicle);
  if (capacity && state.booking.passengers > capacity) {
    error.textContent = "هذه السيارة غير مناسبة لعدد الركاب المحدد.";
    return false;
  }
  error.textContent = "";
  return true;
}

function setFieldError(id, message) {
  const input = $(`#${id}`);
  const wrapper = input.closest(".premium-input, .phone-field");
  wrapper?.classList.toggle("is-invalid", Boolean(message));
  const error = $(`[data-error-for="${id}"]`);
  if (error) error.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function validateDetails() {
  state.booking.passenger.fullName = $("#full-name").value.trim();
  state.booking.passenger.phone = $("#phone").value.trim();
  state.booking.passenger.whatsapp = $("#passenger-whatsapp").value.trim();
  state.booking.passenger.notes = $("#notes").value.trim();

  const phoneDigits = state.booking.passenger.phone.replace(/\D/g, "");
  const whatsappDigits = state.booking.passenger.whatsapp.replace(/\D/g, "");
  const nameValid = state.booking.passenger.fullName.length >= 2;
  const phoneValid = phoneDigits.length >= 7 && phoneDigits.length <= 12;
  const whatsappValid =
    whatsappDigits.length >= 7 && whatsappDigits.length <= 15;

  setFieldError(
    "full-name",
    nameValid ? "" : "أدخل الاسم الكامل كما تريد أن يظهر في الطلب.",
  );
  setFieldError(
    "phone",
    phoneValid ? "" : "أدخل رقم هاتف صحيحاً دون رمز الدولة.",
  );
  setFieldError(
    "passenger-whatsapp",
    whatsappValid ? "" : "أدخل رقم واتساب صحيحاً مع رمز الدولة.",
  );
  $("#details-error").textContent =
    nameValid && phoneValid && whatsappValid
      ? ""
      : "راجع الحقول المميزة قبل المتابعة.";
  return nameValid && phoneValid && whatsappValid;
}

function validateStep(step) {
  if (step === 0) return validateRoute();
  if (step === 1) return validateSchedule();
  if (step === 2) return validateVehicle();
  if (step === 3) return validateDetails();
  return true;
}

function goToStep(nextStep, shouldFocus = true) {
  const boundedStep = Math.max(0, Math.min(4, nextStep));
  state.currentStep = boundedStep;
  $$(".booking-step").forEach((panel) => {
    const active = Number(panel.dataset.step) === boundedStep;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  $$(".booking-progress li").forEach((item) => {
    const step = Number(item.dataset.progressStep);
    item.classList.toggle("is-active", step === boundedStep);
    item.classList.toggle("is-complete", step < boundedStep);
    if (step === boundedStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  if (boundedStep === 2) renderVehicles();
  if (boundedStep === 4) renderReview();
  updateSummary();

  if (shouldFocus) {
    const panel = $(`.booking-step[data-step="${boundedStep}"]`);
    const heading = $("h3", panel);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    if (window.innerWidth < 860) {
      $(".booking-progress").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }
}

function renderReview() {
  const price = selectedPrice();
  $("#review-origin").textContent = state.booking.origin?.nameAr || "—";
  $("#review-destination").textContent =
    state.booking.destination?.nameAr || "—";
  const fullPhone = `${state.booking.passenger.countryCode}${state.booking.passenger.phone
    .replace(/\D/g, "")
    .replace(/^0/, "")}`;
  const details = [
    ["الاسم", state.booking.passenger.fullName],
    ["الهاتف", fullPhone, "ltr"],
    ["واتساب", state.booking.passenger.whatsapp, "ltr"],
    ["التاريخ", formatDate(state.booking.date)],
    ["الوقت", state.booking.time, "ltr"],
    ["السيارة", state.booking.vehicle],
    ["الركاب", `${state.booking.passengers} ركاب`],
    ["الحقائب", `${state.booking.luggage} حقائب`],
    ["طريقة الرحلة", stageLabel(state.booking.stages)],
  ];
  if (state.booking.flightNumber) {
    details.splice(5, 0, ["رقم الرحلة", state.booking.flightNumber, "ltr"]);
  }
  $("#review-list").innerHTML = details
    .map(
      ([label, value, direction]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd ${direction ? `dir="${direction}"` : ""}>${escapeHtml(value || "غير مذكور")}</dd></div>`,
    )
    .join("");
  $("#review-price").textContent = price
    ? currency(price.price)
    : "السعر بعد مراجعة الطلب";
  $("#review-price-note").textContent = price
    ? `${state.booking.vehicle} · ${stageLabel(state.booking.stages)}`
    : "سيؤكد المكتب السعر والتوفر عبر واتساب.";
}

function buildWhatsappMessage() {
  const price = selectedPrice();
  const fullPhone = `${state.booking.passenger.countryCode}${state.booking.passenger.phone
    .replace(/\D/g, "")
    .replace(/^0/, "")}`;
  return [
    "طلب حجز جديد — Coast Ways",
    "",
    `الاسم: ${state.booking.passenger.fullName}`,
    `رقم الهاتف: ${fullPhone}`,
    `رقم واتساب: ${state.booking.passenger.whatsapp}`,
    `من: ${state.booking.origin.nameAr}`,
    `إلى: ${state.booking.destination.nameAr}`,
    `التاريخ: ${formatDate(state.booking.date)}`,
    `الوقت: ${state.booking.time}`,
    `رقم الرحلة: ${state.booking.flightNumber || "غير مذكور"}`,
    `السيارة: ${state.booking.vehicle}`,
    `عدد الركاب: ${state.booking.passengers}`,
    `عدد الحقائب: ${state.booking.luggage}`,
    `طريقة الرحلة: ${stageLabel(state.booking.stages)}`,
    `السعر: ${price ? currency(price.price) : "بعد مراجعة الطلب"}`,
    `ملاحظات: ${state.booking.passenger.notes || "لا يوجد"}`,
    "",
    "أرجو تأكيد توفر السيارة والحجز.",
  ].join("\n");
}

function submitBooking(event) {
  event.preventDefault();
  if (![0, 1, 2, 3].every(validateStep)) {
    const invalidStep = [0, 1, 2, 3].find((step) => !validateStep(step));
    goToStep(invalidStep ?? 0);
    return;
  }
  const recipient =
    normalizeWhatsapp(state.booking.recipient) || state.whatsappNumbers[0];
  window.location.href = `https://wa.me/${recipient}?text=${encodeURIComponent(
    buildWhatsappMessage(),
  )}`;
}

async function checkFlightNumber() {
  state.booking.flightNumber = $("#flight-number").value.trim().toUpperCase();
  $("#flight-number").value = state.booking.flightNumber;
  if (!state.booking.flightNumber || !state.booking.date) return;
  const status = $(".flight-status");
  status.textContent = "جارٍ التحقق من إعداد متابعة الرحلات…";
  const information = await flightTrackingService.track({
    flightNumber: state.booking.flightNumber,
    flightDate: state.booking.date,
  });
  status.textContent = information.configured
    ? "تم ربط رقم الرحلة بطلبك."
    : "مزود المتابعة غير متصل حالياً؛ سيصل رقم الرحلة كاملاً إلى المكتب.";
}

function initializeHeader() {
  const header = $("#site-header");
  const menuButton = $("#menu-toggle");
  const menu = $("#mobile-nav");
  const floating = $(".floating-whatsapp");

  const handleScroll = () => {
    const scrolled = window.scrollY > 24;
    header.classList.toggle("is-scrolled", scrolled);
    floating.classList.toggle("is-compact", window.scrollY > 520);
  };
  handleScroll();
  window.addEventListener("scroll", handleScroll, { passive: true });

  const heroBooking = $(".hero-quick-book");
  if (heroBooking && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => floating.classList.toggle("is-hidden", entry.isIntersecting),
      { threshold: 0.12 },
    );
    observer.observe(heroBooking);
  }

  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    menuButton.setAttribute(
      "aria-label",
      expanded ? "فتح القائمة" : "إغلاق القائمة",
    );
    menu.hidden = expanded;
    header.classList.toggle("is-open", !expanded);
  });

  $$("a", menu).forEach((link) => {
    link.addEventListener("click", () => {
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "فتح القائمة");
      menu.hidden = true;
      header.classList.remove("is-open");
    });
  });
}

function initializeBooking() {
  const dateInput = $("#trip-date");
  dateInput.min = todayValue();

  $$("[data-open-location]").forEach((button) => {
    button.addEventListener("click", () =>
      openLocationPicker(button.dataset.openLocation),
    );
  });
  $("#close-location-dialog").addEventListener("click", closeLocationPicker);
  $("#location-dialog").addEventListener("click", (event) => {
    if (event.target === $("#location-dialog")) closeLocationPicker();
  });
  $("#location-search").addEventListener("input", (event) => {
    renderLocationResults(event.target.value);
  });
  $("#use-custom-location").addEventListener("click", (event) => {
    const value = event.currentTarget.dataset.value;
    if (!value) return;
    setLocation("destination", {
      id: `custom-${normalizeSearch(value).replace(/\s+/g, "-")}`,
      type: "custom",
      nameAr: value,
      nameEn: "Custom destination",
      value,
    });
    closeLocationPicker();
  });
  $("#swap-route").addEventListener("click", swapRoute);

  $$('input[name="stages"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.booking.stages = Number(input.value);
      state.booking.vehicle = "";
      renderVehicles();
      updateSummary();
    });
  });

  $$("[data-date-shortcut]").forEach((button) => {
    button.addEventListener("click", () => {
      selectDate(
        button.dataset.dateShortcut === "today" ? todayValue() : todayValue(1),
      );
    });
  });
  dateInput.closest("label").addEventListener("click", () => {
    if (typeof dateInput.showPicker === "function") dateInput.showPicker();
  });
  dateInput.addEventListener("change", () => selectDate(dateInput.value));
  $("#pickup-time").addEventListener("change", (event) => {
    state.booking.time = event.target.value;
    updateSummary();
  });

  $$("[data-counter-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.closest("[data-stepper]").dataset.stepper;
      const change = button.dataset.counterAction === "increase" ? 1 : -1;
      updateCounter(type, change);
    });
  });

  $$("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (validateStep(state.currentStep)) {
        goToStep(state.currentStep + 1);
      }
    });
  });
  $$("[data-prev-step]").forEach((button) => {
    button.addEventListener("click", () => goToStep(state.currentStep - 1));
  });

  $("#flight-number").addEventListener("blur", checkFlightNumber);
  $("#phone").addEventListener("blur", () => {
    if (!$("#passenger-whatsapp").value.trim()) {
      const digits = $("#phone").value.replace(/\D/g, "").replace(/^0/, "");
      $("#passenger-whatsapp").value =
        digits && `${state.booking.passenger.countryCode}${digits}`;
    }
  });

  const countryButton = $("#country-code");
  const countryMenu = $("#country-menu");
  countryButton.addEventListener("click", () => {
    const expanded = countryButton.getAttribute("aria-expanded") === "true";
    countryButton.setAttribute("aria-expanded", String(!expanded));
    countryMenu.hidden = expanded;
  });
  $$("[data-code]", countryMenu).forEach((option) => {
    option.addEventListener("click", () => {
      state.booking.passenger.countryCode = option.dataset.code;
      $("span:first-child", countryButton).textContent = option.dataset.flag;
      $("bdi", countryButton).textContent = option.dataset.code;
      countryMenu.hidden = true;
      countryButton.setAttribute("aria-expanded", "false");
      $("#phone").focus();
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".phone-field")) {
      countryMenu.hidden = true;
      countryButton.setAttribute("aria-expanded", "false");
    }
  });

  $("#booking-form").addEventListener("submit", submitBooking);
  syncRouteUI();
  renderVehicles();
  updateSummary();
}

function initialize() {
  initializeHeader();
  initializeBooking();
  loadCatalog();
}

initialize();
