const REPOSITORY = "Ragnarsyria-code/coastways";
const FILE_PATH = "docs/prices.json";
const DATA_BRANCH = "site-data";
const state = { prices: [], whatsapp: "", sha: "", token: "" };
const $ = (selector) => document.querySelector(selector);

function decodeContent(content) {
  const bytes = Uint8Array.from(atob(content.replace(/\n/g, "")), (character) =>
    character.charCodeAt(0),
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}

function encodeContent(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2) + "\n");
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function githubRequest(options = {}) {
  const query = options.method === "PUT" ? "" : `?ref=${DATA_BRANCH}`;
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${FILE_PATH}${query}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      throw new Error("الرمز غير صحيح أو لا يملك صلاحية Contents: Read and write");
    }
    throw new Error(body.message || "تعذر الاتصال بـ GitHub");
  }
  return response.json();
}

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast show${isError ? " error-toast" : ""}`;
  setTimeout(() => element.classList.remove("show"), 3200);
}

async function loadCatalog() {
  const file = await githubRequest();
  const catalog = decodeContent(file.content);
  state.sha = file.sha;
  state.prices = catalog.prices.map((price) => ({ ...price, stages: price.stages || 1 }));
  state.whatsapp = catalog.whatsapp;
  $("#whatsapp-input").value = catalog.whatsapp;
  $("#whatsapp-display").textContent = `+${catalog.whatsapp}`;
  $("#prices-count").textContent = catalog.prices.length;
  $("#airports-count").textContent = new Set(catalog.prices.map((price) => price.airport)).size;
  renderPrices();
}

async function publishCatalog(message) {
  const content = encodeContent({ prices: state.prices, whatsapp: state.whatsapp });
  const result = await githubRequest({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, sha: state.sha, branch: DATA_BRANCH }),
  });
  state.sha = result.content.sha;
  toast("تم الحفظ والنشر، ستظهر التغييرات خلال دقيقة");
}

async function showAdmin() {
  await loadCatalog();
  $("#login-view").classList.add("hidden");
  $("#admin-view").classList.remove("hidden");
}

function renderPrices() {
  const query = $("#search").value.trim().toLowerCase();
  const rows = state.prices.filter((item) =>
    [item.airport, item.destination, item.vehicle].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
  $("#prices-table").innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td><b>${item.airport}</b></td>
          <td>${item.destination}</td>
          <td>${item.stages === 2 ? "مرحلتان" : "مرحلة واحدة"}</td>
          <td><span class="vehicle-pill">${item.vehicle}</span></td>
          <td>${item.min_passengers} – ${item.max_passengers}</td>
          <td><strong class="table-price">$${Number(item.price).toLocaleString("en-US")}</strong></td>
          <td class="row-actions">
            <button data-edit="${item.id}">تعديل</button>
            <button class="delete" data-delete="${item.id}">حذف</button>
          </td>
        </tr>`,
    )
    .join("");
}

function openDialog(item = null) {
  $("#price-form").reset();
  $("#price-id").value = item?.id || "";
  $("#dialog-mode").textContent = item ? "تعديل السعر" : "سعر جديد";
  $("#edit-airport").value = item?.airport || "";
  $("#edit-destination").value = item?.destination || "";
  $("#edit-stages").value = item?.stages || 1;
  $("#edit-vehicle").value = item?.vehicle || "";
  $("#edit-price").value = item?.price || "";
  $("#edit-min").value = item?.min_passengers || 1;
  $("#edit-max").value = item?.max_passengers || 4;
  $("#price-dialog").showModal();
}

async function savePrice(event) {
  event.preventDefault();
  const id = Number($("#price-id").value);
  const item = {
    id: id || Math.max(0, ...state.prices.map((price) => price.id)) + 1,
    airport: $("#edit-airport").value.trim(),
    destination: $("#edit-destination").value.trim(),
    stages: Number($("#edit-stages").value),
    vehicle: $("#edit-vehicle").value.trim(),
    price: Number($("#edit-price").value),
    min_passengers: Number($("#edit-min").value),
    max_passengers: Number($("#edit-max").value),
  };
  if (item.max_passengers < item.min_passengers) {
    toast("الحد الأعلى للركاب يجب أن يكون أكبر من الحد الأدنى", true);
    return;
  }
  const oldPrices = [...state.prices];
  if (id) {
    state.prices = state.prices.map((price) => (price.id === id ? item : price));
  } else {
    state.prices.push(item);
  }
  $("#price-dialog").close();
  renderPrices();
  try {
    await publishCatalog(id ? "تعديل سعر رحلة" : "إضافة سعر رحلة");
    await loadCatalog();
  } catch (error) {
    state.prices = oldPrices;
    renderPrices();
    toast(error.message, true);
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-error").textContent = "";
  state.token = $("#token").value.trim();
  try {
    await showAdmin();
    sessionStorage.setItem("coastways_github_token", state.token);
  } catch (error) {
    state.token = "";
    $("#login-error").textContent = error.message;
  }
});

$("#logout").addEventListener("click", () => {
  sessionStorage.removeItem("coastways_github_token");
  location.reload();
});

$("#add-price").addEventListener("click", () => openDialog());
$("#close-dialog").addEventListener("click", () => $("#price-dialog").close());
$("#price-form").addEventListener("submit", savePrice);
$("#search").addEventListener("input", renderPrices);
$("#prices-table").addEventListener("click", async (event) => {
  const editId = Number(event.target.dataset.edit);
  const deleteId = Number(event.target.dataset.delete);
  if (editId) openDialog(state.prices.find((item) => item.id === editId));
  if (deleteId && confirm("هل تريد حذف هذا السعر ونشر التغيير؟")) {
    const oldPrices = [...state.prices];
    state.prices = state.prices.filter((item) => item.id !== deleteId);
    renderPrices();
    try {
      await publishCatalog("حذف سعر رحلة");
      await loadCatalog();
    } catch (error) {
      state.prices = oldPrices;
      renderPrices();
      toast(error.message, true);
    }
  }
});

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const oldWhatsapp = state.whatsapp;
  state.whatsapp = $("#whatsapp-input").value.trim();
  try {
    await publishCatalog("تحديث رقم واتساب");
    await loadCatalog();
  } catch (error) {
    state.whatsapp = oldWhatsapp;
    toast(error.message, true);
  }
});

const savedToken = sessionStorage.getItem("coastways_github_token");
if (savedToken) {
  state.token = savedToken;
  showAdmin().catch(() => sessionStorage.removeItem("coastways_github_token"));
}
