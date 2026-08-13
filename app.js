(function () {
  const STORAGE_KEY = "cuanto-mas";
  const HOLIDAYS_STORAGE_PREFIX = "cuanto-mas-feriados-";
  const FERIADOS_API = "https://api.argentinadatos.com/v1/feriados/";
  const SAVE_DEBOUNCE_MS = 200;
  const HOURS_EPSILON = 0.005;

  const els = {
    form: document.getElementById("calcForm"),
    monthContext: document.getElementById("monthContext"),
    modeEarn: document.getElementById("modeEarn"),
    modeTarget: document.getElementById("modeTarget"),
    modeCal: document.getElementById("modeCal"),
    result: document.getElementById("result"),
    calendar: document.getElementById("calendar"),
    rate: document.getElementById("rate"),
    hours: document.getElementById("hours"),
    hoursDone: document.getElementById("hoursDone"),
    loggedToday: document.getElementById("loggedToday"),
    loggedTodayField: document.getElementById("loggedTodayField"),
    target: document.getElementById("target"),
    resultLabel: document.getElementById("resultLabel"),
    resultValue: document.getElementById("resultValue"),
    resultHint: document.getElementById("resultHint"),
    progress: document.getElementById("progress"),
    progressPct: document.getElementById("progressPct"),
    progressBar: document.getElementById("progressBar"),
    progressFill: document.getElementById("progressFill"),
    progressEarned: document.getElementById("progressEarned"),
    calendarGrid: document.getElementById("calendarGrid"),
    panels: document.querySelectorAll("[data-panel]"),
  };

  let mode = "earn";
  let saveTimer = null;
  let lastResultText = "";
  const holidayCache = Object.create(null);
  const holidayNamesCache = Object.create(null);

  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function toKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function transferHoliday(date) {
    const weekday = date.getDay();
    if (weekday === 2) return addDays(date, -1);
    if (weekday === 3) return addDays(date, -2);
    if (weekday === 4) return addDays(date, 4);
    if (weekday === 5) return addDays(date, 3);
    return date;
  }

  function localHolidaysFallback(year) {
    const set = new Set();
    const fixed = [
      [1, 1],
      [3, 24],
      [4, 2],
      [5, 1],
      [5, 25],
      [6, 20],
      [7, 9],
      [12, 8],
      [12, 25],
    ];
    const transferable = [
      [6, 17],
      [8, 17],
      [10, 12],
      [11, 20],
    ];

    fixed.forEach(function (pair) {
      set.add(toKey(new Date(year, pair[0] - 1, pair[1])));
    });
    transferable.forEach(function (pair) {
      set.add(toKey(transferHoliday(new Date(year, pair[0] - 1, pair[1]))));
    });

    const easter = easterSunday(year);
    set.add(toKey(addDays(easter, -48)));
    set.add(toKey(addDays(easter, -47)));
    set.add(toKey(addDays(easter, -2)));

    return set;
  }

  function holidaysFromApiPayload(payload) {
    const set = new Set();
    const names = Object.create(null);
    if (!Array.isArray(payload)) return { set: set, names: names };
    payload.forEach(function (item) {
      if (item && typeof item.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) {
        set.add(item.fecha);
        if (typeof item.nombre === "string" && item.nombre) {
          names[item.fecha] = item.nombre;
        }
      }
    });
    return { set: set, names: names };
  }

  function readCachedHolidays(year) {
    try {
      const raw = localStorage.getItem(HOLIDAYS_STORAGE_PREFIX + year);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const parsed = holidaysFromApiPayload(data);
      if (parsed.set.size === 0) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeCachedHolidays(year, payload) {
    try {
      localStorage.setItem(HOLIDAYS_STORAGE_PREFIX + year, JSON.stringify(payload));
    } catch (err) {
      return;
    }
  }

  function setHolidays(year, set, names) {
    holidayCache[year] = set;
    holidayNamesCache[year] = names || holidayNamesCache[year] || Object.create(null);
  }

  function getHolidays(year) {
    if (holidayCache[year]) return holidayCache[year];
    const cached = readCachedHolidays(year);
    if (cached) {
      setHolidays(year, cached.set, cached.names);
      return cached.set;
    }
    const fallback = localHolidaysFallback(year);
    setHolidays(year, fallback, Object.create(null));
    return fallback;
  }

  function holidaysEqual(a, b) {
    if (a === b) return true;
    if (!a || !b || a.size !== b.size) return false;
    var changed = false;
    a.forEach(function (fecha) {
      if (!b.has(fecha)) changed = true;
    });
    return !changed;
  }

  function loadHolidays(year) {
    const previous = holidayCache[year] || null;
    const cached = readCachedHolidays(year);
    if (cached) setHolidays(year, cached.set, cached.names);

    return fetch(FERIADOS_API + year)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (payload) {
        const parsed = holidaysFromApiPayload(payload);
        if (parsed.set.size === 0) throw new Error("empty");
        writeCachedHolidays(year, payload);
        setHolidays(year, parsed.set, parsed.names);
        return { set: parsed.set, changed: !holidaysEqual(previous, parsed.set) };
      })
      .catch(function () {
        if (!holidayCache[year]) {
          setHolidays(year, localHolidaysFallback(year), Object.create(null));
        }
        return {
          set: holidayCache[year],
          changed: !holidaysEqual(previous, holidayCache[year]),
        };
      });
  }

  function isBusinessDay(date, holidays) {
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) return false;
    return !holidays.has(toKey(date));
  }

  function businessDaysInMonth(year, monthIndex) {
    const holidays = getHolidays(year);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (isBusinessDay(new Date(year, monthIndex, day), holidays)) count += 1;
    }

    return count;
  }

  function remainingBusinessDays(fromDate, options) {
    const excludeToday = !!(options && options.excludeToday);
    const today = startOfLocalDay(fromDate);
    const year = today.getFullYear();
    const monthIndex = today.getMonth();
    const holidays = getHolidays(year);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const todayIsBusiness = isBusinessDay(today, holidays);
    let startDay = today.getDate();

    if (excludeToday && todayIsBusiness) {
      startDay += 1;
    }

    let count = 0;
    for (let day = startDay; day <= daysInMonth; day++) {
      if (isBusinessDay(new Date(year, monthIndex, day), holidays)) count += 1;
    }

    return {
      count: count,
      includesToday: todayIsBusiness && !excludeToday,
      fromNextBusinessDay: excludeToday && todayIsBusiness,
    };
  }

  function isLoggedTodayChecked() {
    return !!els.loggedToday.checked;
  }

  function syncLoggedTodayFromState(state) {
    const todayKey = toKey(new Date());
    els.loggedToday.checked = !!(state && state.loggedTodayDate === todayKey);
  }

  function loggedTodayStorageValue() {
    return els.loggedToday.checked ? toKey(new Date()) : "";
  }

  function formatMoney(value) {
    const rounded = Math.round(value * 100) / 100;
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    }).format(rounded);
  }

  function formatHours(value) {
    const rounded = Math.round(value * 100) / 100;
    return new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 2,
    }).format(rounded);
  }

  function formatMonthLabel(date) {
    const name = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(date);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function parseNumber(input) {
    const raw = String(input.value).trim().replace(",", ".");
    if (raw === "") return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function hasOptionalValue(input) {
    return String(input.value).trim() !== "";
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch (err) {
      return null;
    }
  }

  function saveState() {
    const payload = {
      rate: els.rate.value,
      hours: els.hours.value,
      hoursDone: els.hoursDone.value,
      loggedTodayDate: loggedTodayStorageValue(),
      target: els.target.value,
      mode: mode,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      return;
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, SAVE_DEBOUNCE_MS);
  }

  function normalizeMode(nextMode) {
    if (nextMode === "target" || nextMode === "cal") return nextMode;
    return "earn";
  }

  function setMode(nextMode) {
    mode = normalizeMode(nextMode);
    const onCal = mode === "cal";

    els.modeEarn.classList.toggle("is-active", mode === "earn");
    els.modeTarget.classList.toggle("is-active", mode === "target");
    els.modeCal.classList.toggle("is-active", onCal);
    els.modeEarn.setAttribute("aria-selected", mode === "earn" ? "true" : "false");
    els.modeTarget.setAttribute("aria-selected", mode === "target" ? "true" : "false");
    els.modeCal.setAttribute("aria-selected", onCal ? "true" : "false");

    els.form.classList.toggle("is-hidden", onCal);
    els.result.classList.toggle("is-hidden", onCal);
    els.calendar.classList.toggle("is-hidden", !onCal);

    els.panels.forEach(function (panel) {
      const show = panel.getAttribute("data-panel") === mode;
      panel.classList.toggle("is-hidden", !show);
    });

    calculate();
    scheduleSave();
  }

  function pulseResult(text) {
    if (text === lastResultText) {
      els.resultValue.textContent = text;
      return;
    }
    lastResultText = text;
    els.resultValue.textContent = text;
    els.resultValue.classList.remove("is-pulse");
    void els.resultValue.offsetWidth;
    els.resultValue.classList.add("is-pulse");
  }

  function showHint(text) {
    els.resultHint.textContent = text;
    els.resultHint.classList.remove("is-hidden");
  }

  function hideHint() {
    els.resultHint.textContent = "";
    els.resultHint.classList.add("is-hidden");
  }

  function hideProgress() {
    els.progress.classList.add("is-hidden");
    els.progress.hidden = true;
    els.progressFill.style.width = "0%";
    els.progressBar.setAttribute("aria-valuenow", "0");
    els.progressBar.removeAttribute("aria-valuetext");
    els.progressPct.textContent = "0%";
    els.progressEarned.textContent = "";
  }

  function showProgress(earned, targetAmount) {
    const ratio = targetAmount > 0 ? earned / targetAmount : 0;
    const pct = Math.round(ratio * 1000) / 10;
    const barPct = Math.max(0, Math.min(100, pct));
    const whole = Math.abs(pct - Math.round(pct)) < 1e-9;
    const pctLabel = new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: whole ? 0 : 1,
    }).format(pct);

    els.progressFill.style.width = barPct + "%";
    els.progressBar.setAttribute("aria-valuenow", String(Math.round(barPct)));
    els.progressBar.setAttribute("aria-valuetext", pctLabel + " por ciento");
    els.progressPct.textContent = pctLabel + "%";
    els.progressEarned.textContent =
      formatMoney(earned) + " de " + formatMoney(targetAmount);
    els.progress.classList.remove("is-hidden");
    els.progress.hidden = false;
  }

  function syncLoggedTodayVisibility(trackingProgress) {
    const show = mode === "target" && trackingProgress;
    els.loggedTodayField.classList.toggle("is-hidden", !show);
  }

  function calculate() {
    const now = new Date();
    const businessDays = businessDaysInMonth(now.getFullYear(), now.getMonth());
    const rate = parseNumber(els.rate);

    if (mode === "cal") {
      syncLoggedTodayVisibility(false);
      renderCalendar();
      return;
    }

    if (mode === "earn") {
      const hours = parseNumber(els.hours);
      const total = rate * hours;
      els.resultLabel.textContent = "Vas a cobrar";
      pulseResult(hours > 0 && rate > 0 ? formatMoney(total) : "—");
      hideHint();
      hideProgress();
      syncLoggedTodayVisibility(false);
      renderCalendar();
      return;
    }

    const target = parseNumber(els.target);
    const trackingProgress = hasOptionalValue(els.hoursDone);
    const hoursDone = trackingProgress ? parseNumber(els.hoursDone) : 0;

    syncLoggedTodayVisibility(trackingProgress);
    renderCalendar();

    if (!(rate > 0 && target > 0)) {
      els.resultLabel.textContent = "Tenés que trabajar";
      pulseResult("—");
      hideHint();
      hideProgress();
      return;
    }

    const hoursNeeded = target / rate;
    const hoursLeft = Math.max(0, hoursNeeded - hoursDone);
    const earned = hoursDone * rate;

    if (trackingProgress) {
      showProgress(earned, target);
    } else {
      hideProgress();
    }

    if (hoursLeft <= HOURS_EPSILON) {
      els.resultLabel.textContent = trackingProgress ? "Te faltan" : "Tenés que trabajar";
      pulseResult("0 h");
      if (trackingProgress) {
        showHint("Ya llegaste al objetivo");
      } else {
        hideHint();
      }
      return;
    }

    els.resultLabel.textContent = trackingProgress ? "Te faltan" : "Tenés que trabajar";
    pulseResult(formatHours(hoursLeft) + " h");

    if (trackingProgress) {
      const remaining = remainingBusinessDays(now, {
        excludeToday: isLoggedTodayChecked(),
      });
      if (remaining.count > 0) {
        const perDay = hoursLeft / remaining.count;
        var todayNote = "hoy no es día hábil";
        if (remaining.fromNextBusinessDay) todayNote = "desde el próximo hábil";
        else if (remaining.includesToday) todayNote = "incluye hoy";
        showHint(
          formatHours(perDay) + " h por día hábil restante (" + todayNote + ")"
        );
      } else {
        showHint("No quedan días hábiles este mes");
      }
      return;
    }

    if (businessDays > 0) {
      showHint(formatHours(hoursLeft / businessDays) + " h por día hábil");
    } else {
      hideHint();
    }
  }

  function applyDefaults(state) {
    if (state) {
      if (state.rate != null) els.rate.value = state.rate;
      if (state.hours != null) els.hours.value = state.hours;
      if (state.hoursDone != null) els.hoursDone.value = state.hoursDone;
      if (state.target != null) els.target.value = state.target;
      syncLoggedTodayFromState(state);
      setMode(normalizeMode(state.mode));
      return;
    }

    els.rate.value = "";
    els.hours.value = "";
    els.hoursDone.value = "";
    els.target.value = "";
    els.loggedToday.checked = false;
    setMode("earn");
  }

  function renderCalendar() {
    const now = startOfLocalDay(new Date());
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const holidays = getHolidays(year);
    const names = holidayNamesCache[year] || Object.create(null);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const mondayOffset = (firstWeekday + 6) % 7;
    const trackingProgress = hasOptionalValue(els.hoursDone);
    const excludeToday = trackingProgress && isLoggedTodayChecked();
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < mondayOffset; i++) {
      const spacer = document.createElement("span");
      spacer.className = "cal__day is-empty";
      spacer.setAttribute("aria-hidden", "true");
      fragment.appendChild(spacer);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day);
      const key = toKey(date);
      const work = isBusinessDay(date, holidays);
      const isToday = day === now.getDate();
      const isPast = date < now || (isToday && excludeToday);
      const cell = document.createElement("span");
      const label = String(day);
      cell.className = "cal__day";
      cell.textContent = label;
      cell.classList.toggle("is-work", work);
      cell.classList.toggle("is-off", !work);
      cell.classList.toggle("is-today", isToday);
      cell.classList.toggle("is-past", isPast && !isToday);
      cell.classList.toggle(
        "is-remaining",
        trackingProgress && work && !isPast && !isToday
      );

      if (isToday) {
        cell.setAttribute("aria-current", "date");
      }

      if (!work && names[key]) {
        cell.title = names[key];
        cell.setAttribute(
          "aria-label",
          label + (isToday ? ", hoy, " : ", ") + names[key]
        );
      } else if (work) {
        cell.setAttribute(
          "aria-label",
          label + (isToday ? ", hoy, día hábil" : ", día hábil")
        );
      } else {
        cell.setAttribute(
          "aria-label",
          label + (isToday ? ", hoy, no hábil" : ", no hábil")
        );
      }

      fragment.appendChild(cell);
    }

    els.calendarGrid.replaceChildren(fragment);
  }

  function initMonthContext() {
    const now = new Date();
    const days = businessDaysInMonth(now.getFullYear(), now.getMonth());
    els.monthContext.textContent =
      formatMonthLabel(now) + " · " + days + " días hábiles";
    renderCalendar();
  }

  function refreshCalendarDependentUi() {
    initMonthContext();
    calculate();
  }

  function onFieldInput() {
    calculate();
    scheduleSave();
  }

  els.form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  els.modeEarn.addEventListener("click", function () {
    setMode("earn");
  });
  els.modeTarget.addEventListener("click", function () {
    setMode("target");
  });
  els.modeCal.addEventListener("click", function () {
    setMode("cal");
  });

  [els.rate, els.hours, els.target, els.hoursDone].forEach(function (input) {
    input.addEventListener("input", onFieldInput);
  });

  els.loggedToday.addEventListener("change", onFieldInput);

  const year = new Date().getFullYear();
  const cached = readCachedHolidays(year);
  if (cached) {
    setHolidays(year, cached.set, cached.names);
    initMonthContext();
  } else {
    setHolidays(year, localHolidaysFallback(year), Object.create(null));
    els.monthContext.textContent =
      formatMonthLabel(new Date()) + " · …";
    renderCalendar();
  }

  applyDefaults(loadState());

  loadHolidays(year).then(function (result) {
    if (result.changed || !cached) refreshCalendarDependentUi();
  });
})();
