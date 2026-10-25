(() => {
  "use strict";

  const STORAGE_KEY = "absolute-fitness-enrollees";
  const PLANS = {
    3: { days: 3, price: 0, label: "3-day promo" },
    7: { days: 7, price: 0, label: "7-day promo" },
    15: { days: 15, price: 400, label: "15-day plan" },
    30: { days: 30, price: 750, label: "30-day plan" },
    "15+3": { days: 18, price: 400, label: "15 days + 3 free days" },
    "15+7": { days: 22, price: 400, label: "15 days + 7 free days" },
    "30+3": { days: 33, price: 750, label: "30 days + 3 free days" },
    "30+7": { days: 37, price: 750, label: "30 days + 7 free days" },
  };
  const palettes = [
    ["#f0f4e4", "#6f883e"],
    ["#fceee7", "#ba795a"],
    ["#eaf1f8", "#6685a6"],
    ["#f1edfa", "#8974aa"],
    ["#e7f3ef", "#638e7c"],
    ["#f8efda", "#a28748"],
  ];

  const $ = (selector) => document.querySelector(selector);
  const form = $("#enrolment-form");
  const modal = $("#enrolment-modal");
  const durationSelect = $("#member-duration");
  const priceValue = $("#price-value");
  const priceIcon = $(".price-preview-icon");
  const formError = $("#form-error");
  const toast = $("#toast");
  const dateFormatter = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  let enrollees = loadEnrollees();
  let toastTimeout;

  function loadEnrollees() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) throw new Error("Stored enrollee data must be a list.");
      return parsed.filter((entry) =>
        entry && typeof entry.id === "string" &&
        typeof entry.name === "string" && typeof entry.phone === "string" &&
        PLANS[entry.duration] && typeof entry.startDate === "string"
      );
    } catch (error) {
      console.error("Unable to load Absolute Fitness enrolments.", error);
      showToast("Could not read saved enrolments.");
      return [];
    }
  }

  function saveEnrollees() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollees));
      return true;
    } catch (error) {
      console.error("Unable to save Absolute Fitness enrolments.", error);
      showToast("Could not save enrolment. Check device storage and try again.");
      return false;
    }
  }

  function utcDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function getMemberStatus(member) {
    const endDateUtc = utcDate(member.startDate) + (PLANS[member.duration].days - 1) * 86400000;
    const todayUtc = utcDate(todayString());
    const daysLeft = Math.max(0, Math.floor((endDateUtc - todayUtc) / 86400000) + 1);
    return { daysLeft, endDate: new Date(endDateUtc), status: daysLeft === 0 ? "expired" : daysLeft <= 3 ? "expiring" : "active" };
  }

  function formatDate(date) {
    return dateFormatter.format(date);
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function memberMarkup(member, directory = false) {
    const status = getMemberStatus(member);
    const plan = PLANS[member.duration];
    const palette = palettes[Array.from(member.id).reduce((sum, character) => sum + character.charCodeAt(0), 0) % palettes.length];
    const name = escapeHtml(member.name);
    const phone = escapeHtml(member.phone);
    const statusLabel = status.status === "expiring" ? "Expiring soon" : status.status.charAt(0).toUpperCase() + status.status.slice(1);
    const memberCell = `<div class="member-cell"><span class="member-avatar" style="background:${palette[0]};color:${palette[1]}">${escapeHtml(initials(member.name))}</span><span><span class="member-name">${name}</span>${directory ? "" : `<span class="member-phone">${phone}</span>`}</span></div>`;
    if (!directory) {
      return `<tr><td>${memberCell}</td><td><span class="plan-chip">${plan.label || `${plan.days} days`}</span></td><td>${formatDate(new Date(utcDate(member.startDate)))}</td><td><span class="badge badge-${status.status}">${statusLabel}</span></td></tr>`;
    }
    const daysClass = status.status === "expired" ? "is-expired" : status.status === "expiring" ? "is-soon" : "";
    const daysLabel = status.daysLeft === 0 ? "Expired" : `${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"}`;
    const planLabel = plan.label || `${plan.days}-day plan`;
    const priceLabel = plan.price === 0 ? "FREE" : `₱${plan.price.toLocaleString("en-PH")}`;
    return `<tr><td>${memberCell}</td><td>${phone}</td><td><span class="plan-chip">${planLabel}</span></td><td>${priceLabel}</td><td>${formatDate(new Date(utcDate(member.startDate)))}</td><td>${formatDate(status.endDate)}</td><td><span class="days-left ${daysClass}">${daysLabel}<small>${status.daysLeft ? "remaining" : "plan ended"}</small></span></td><td><span class="badge badge-${status.status}">${statusLabel}</span></td></tr>`;
  }

  function render() {
    const active = enrollees.filter((member) => getMemberStatus(member).status !== "expired");
    const expiring = enrollees.filter((member) => getMemberStatus(member).status === "expiring");
    const month = todayString().slice(0, 7);
    $("#active-count").textContent = active.length;
    $("#expiring-count").textContent = expiring.length;
    $("#revenue-total").textContent = `₱${enrollees.reduce((sum, member) => sum + PLANS[member.duration].price, 0).toLocaleString("en-PH")}`;
    $("#month-count").textContent = enrollees.filter((member) => member.startDate.startsWith(month)).length;
    $("#nav-count").textContent = enrollees.length;
    $("#directory-total").textContent = enrollees.length;
    $("#directory-active").textContent = active.length;

    const recent = [...enrollees].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5);
    $("#recent-table-body").innerHTML = recent.map((member) => memberMarkup(member)).join("");
    $("#recent-empty").classList.toggle("is-empty-visible", enrollees.length === 0);
    $("#recent-table-body").parentElement.style.display = enrollees.length === 0 ? "none" : "";
    renderDirectory();
  }

  function renderDirectory() {
    const query = $("#search-input").value.trim().toLocaleLowerCase();
    const filter = $("#status-filter").value;
    const visible = [...enrollees]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((member) => {
        const matchesQuery = member.name.toLocaleLowerCase().includes(query) || member.phone.toLocaleLowerCase().includes(query);
        const status = getMemberStatus(member).status;
        const matchesStatus = filter === "all" || status === filter;
        return matchesQuery && matchesStatus;
      });
    $("#directory-table-body").innerHTML = visible.map((member) => memberMarkup(member, true)).join("");
    const empty = $("#directory-empty");
    empty.classList.toggle("is-empty-visible", visible.length === 0);
    $("#directory-table-body").parentElement.style.display = visible.length === 0 ? "none" : "";
    if (enrollees.length === 0) {
      $("#directory-empty-title").textContent = "No enrollees yet";
      $("#directory-empty-copy").textContent = "Add a member to start tracking their plan and days left.";
      $(".empty-cta").style.display = "";
    } else {
      $("#directory-empty-title").textContent = "No matching enrollees";
      $("#directory-empty-copy").textContent = "Try a different name, phone number, or status filter.";
      $(".empty-cta").style.display = "none";
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function openModal() {
    form.reset();
    formError.textContent = "";
    priceValue.textContent = "Choose a plan";
    priceIcon.textContent = "₱";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => $("#member-name").focus(), 30);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function setView(name) {
    const isDashboard = name === "dashboard";
    $("#dashboard-view").classList.toggle("is-visible", isDashboard);
    $("#enrollees-view").classList.toggle("is-visible", !isDashboard);
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === name));
    $("#breadcrumb-current").textContent = isDashboard ? "Overview" : "Enrollees";
  }

  document.querySelectorAll("[data-open-form]").forEach((button) => button.addEventListener("click", openModal));
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-show-enrollees]").forEach((button) => button.addEventListener("click", () => setView("enrollees")));
  $("#close-modal").addEventListener("click", closeModal);
  $("#cancel-modal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });
  $("#search-input").addEventListener("input", renderDirectory);
  $("#status-filter").addEventListener("change", renderDirectory);
  durationSelect.addEventListener("change", () => {
    const plan = PLANS[durationSelect.value];
    priceValue.textContent = plan ? (plan.price === 0 ? "FREE" : `₱${plan.price.toLocaleString("en-PH")}`) : "Choose a plan or promo";
    priceIcon.textContent = plan && plan.price === 0 ? "✓" : "₱";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    formError.textContent = "";
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim().replace(/\s+/g, " ");
    const phone = String(data.get("phone") || "").trim();
    const duration = String(data.get("duration") || "");
    if (!name || !phone || !PLANS[duration]) {
      formError.textContent = "Please enter a name, phone number, and valid plan.";
      return;
    }
    const member = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, phone, duration, startDate: todayString() };
    enrollees.push(member);
    if (!saveEnrollees()) {
      enrollees.pop();
      return;
    }
    render();
    closeModal();
    showToast(`${name} added to the enrollee directory.`);
  });

  const now = new Date();
  $("#today-label").textContent = new Intl.DateTimeFormat("en-PH", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(now);
  $("#footer-year").textContent = now.getFullYear();
  document.querySelectorAll(".footer-year").forEach((element) => { element.textContent = now.getFullYear(); });
  render();
})();
