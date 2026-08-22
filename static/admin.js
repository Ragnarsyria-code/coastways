const state = { prices: [], whatsapp: "" };
const $ = (selector) => document.querySelector(selector);

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "حدث خطأ، حاول مرة أخرى");
  }
  return response.json();
}

function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast show${isError ? " error-toast" : ""}`;
  setTimeout(() => element.classList.remove("show"), 2600);
}

async function checkSession() {
  const session = await request("/api/admin/session");
  if (session.authenticated) showAdmin();
}

async function showAdmin() {
  $("#login-view").classList.add("hidden");
  $("#admin-view").classList.remove("hidden");
  await loadCatalog();
}

async function loadCatalog() {
  const catalog = await request("/api/catalog");
  state.prices = catalog.prices;
  state.whatsapp = catalog.whatsapp;
  $("#whatsapp-input").value = catalog.whatsapp;
  $("#whatsapp-display").textContent = `+${catalog.whatsapp}`;
  $("#prices-count").textContent = catalog.prices.length;
  $("#airports-count").textContent = new Set(catalog.prices.map((price) => price.airport)).size;
  renderPrices();
}

function renderPrices() {
  const query = $("#search").value.trim().toLowerCase();
  const rows = state.prices.filter((item) =>
    [item.airport, item.destination, item.vehicle].some((value) => value.toLowerCase().includes(query)),
  );
  $("#prices-table").innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td><b>${item.airport}</b></td>
          <td>${item.destination}</td>
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
  $("#edit-vehicle").value = item?.vehicle || "";
  $("#edit-price").value = item?.price || "";
  $("#edit-min").value = item?.min_passengers || 1;
  $("#edit-max").value = item?.max_passengers || 4;
  $("#price-dialog").showModal();
}

async function savePrice(event) {
  event.preventDefault();
  const id = $("#price-id").value;
  const payload = {
    airport: $("#edit-airport").value,
    destination: $("#edit-destination").value,
    vehicle: $("#edit-vehicle").value,
    price: Number($("#edit-price").value),
    min_passengers: Number($("#edit-min").value),
    max_passengers: Number($("#edit-max").value),
  };
  try {
    await request(id ? `/api/admin/prices/${id}` : "/api/admin/prices", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    $("#price-dialog").close();
    await loadCatalog();
    toast("تم حفظ السعر بنجاح");
  } catch (error) {
    toast(error.message, true);
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-error").textContent = "";
  try {
    await request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#password").value }),
    });
    await showAdmin();
  } catch (error) {
    $("#login-error").textContent = error.message;
  }
});

$("#logout").addEventListener("click", async () => {
  await request("/api/admin/logout", { method: "POST" });
  location.reload();
});

$("#add-price").addEventListener("click", () => openDialog());
$("#close-dialog").addEventListener("click", () => $("#price-dialog").close());
$("#price-form").addEventListener("submit", savePrice);
$("#search").addEventListener("input", renderPrices);
$("#prices-table").addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) openDialog(state.prices.find((item) => item.id === Number(editId)));
  if (deleteId && confirm("هل تريد حذف هذا السعر؟")) {
    try {
      await request(`/api/admin/prices/${deleteId}`, { method: "DELETE" });
      await loadCatalog();
      toast("تم حذف السعر");
    } catch (error) {
      toast(error.message, true);
    }
  }
});

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ whatsapp: $("#whatsapp-input").value }),
    });
    await loadCatalog();
    toast("تم تحديث رقم واتساب");
  } catch (error) {
    toast(error.message, true);
  }
});

checkSession().catch(() => {});
