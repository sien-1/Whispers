const DATA_URL = new URLSearchParams(window.location.search).get("demo") === "1"
  ? "./demo-notes.json"
  : "./notes.json";

const dataUtils = window.WhisperData;
const fallbackNote = {
  id: "builtin-fallback",
  message: "愿你今天也有值得期待的小事，也有可以安心停下来的时刻。",
  createdAt: new Date().toISOString()
};

const elements = {
  backButton: document.getElementById("backButton"),
  paperStack: document.getElementById("paperStack"),
  paper: document.querySelector(".paper"),
  homeView: document.getElementById("homeView"),
  readerView: document.getElementById("readerView"),
  nameForm: document.getElementById("nameForm"),
  nameLine: document.getElementById("nameLine"),
  nameInput: document.getElementById("nameInput"),
  openButton: document.getElementById("openButton"),
  formStatus: document.getElementById("formStatus"),
  readerName: document.getElementById("readerName"),
  noteMessage: document.getElementById("noteMessage"),
  noteTime: document.getElementById("noteTime"),
  pager: document.getElementById("pager"),
  previousButton: document.getElementById("previousButton"),
  nextButton: document.getElementById("nextButton"),
  pageCount: document.getElementById("pageCount"),
  liveStatus: document.getElementById("liveStatus")
};

const state = {
  data: null,
  screen: "home",
  source: "personal",
  displayName: "",
  notes: [],
  pageIndex: 0,
  turning: false
};

async function loadNotes() {
  elements.openButton.disabled = true;
  elements.formStatus.textContent = "正在准备纸条…";

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`notes request failed: ${response.status}`);
    }
    const raw = await response.json();
    state.data = dataUtils.normalizeData(raw);
    if (!state.data.others.notes.length) {
      state.data.others.notes = [fallbackNote];
    }
    elements.formStatus.textContent = "";
    elements.openButton.disabled = false;
  } catch (error) {
    console.error(error);
    state.data = dataUtils.normalizeData({
      people: [],
      others: { notes: [fallbackNote] }
    });
    elements.formStatus.textContent = "纸条暂时没能取到，请检查 notes.json 或本地服务。";
    elements.openButton.disabled = false;
  }
}

function findPerson(name) {
  const target = dataUtils.normalizeName(name);
  return state.data.people.find((person) => {
    const candidates = [person.name, ...(person.aliases || [])];
    return candidates.some((candidate) => dataUtils.normalizeName(candidate) === target);
  });
}

function updatePage() {
  const note = state.notes[state.pageIndex];
  if (!note) return;

  elements.readerName.textContent = state.source === "fallback" ? "你" : state.displayName;
  elements.noteMessage.textContent = note.message;
  elements.noteTime.dateTime = note.createdAt;
  elements.noteTime.textContent = dataUtils.formatTimestamp(note.createdAt);

  const count = state.notes.length;
  elements.pageCount.textContent = `${state.pageIndex + 1}/${count}`;
  elements.previousButton.disabled = state.pageIndex <= 0;
  elements.nextButton.disabled = state.pageIndex >= count - 1;
  elements.paperStack.dataset.pages = String(count);
}

function clearPaperAnimation() {
  elements.paper.classList.remove(
    "is-page-in-next",
    "is-page-in-prev",
    "is-page-out-next",
    "is-page-out-prev"
  );
}

function showReader({ name, notes, source }) {
  state.screen = "reader";
  state.source = source;
  state.displayName = name;
  state.notes = notes.length ? notes : [fallbackNote];
  state.pageIndex = 0;
  state.turning = false;

  clearPaperAnimation();
  elements.homeView.hidden = true;
  elements.readerView.hidden = false;
  elements.backButton.hidden = false;
  elements.pager.hidden = false;
  updatePage();
  elements.liveStatus.textContent = "纸条已展开。";
  elements.readerView.focus({ preventScroll: true });
}

function showHome() {
  state.screen = "home";
  state.turning = false;
  clearPaperAnimation();
  elements.homeView.hidden = false;
  elements.readerView.hidden = true;
  elements.backButton.hidden = true;
  elements.pager.hidden = true;
  elements.formStatus.textContent = "";
  elements.nameInput.focus({ preventScroll: true });
  elements.nameInput.select();
}

function turnPage(direction) {
  if (state.screen !== "reader" || state.turning) return;
  const nextIndex = state.pageIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.notes.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    state.pageIndex = nextIndex;
    updatePage();
    return;
  }

  state.turning = true;
  const outClass = direction > 0 ? "is-page-out-next" : "is-page-out-prev";
  const inClass = direction > 0 ? "is-page-in-next" : "is-page-in-prev";
  elements.paper.classList.add(outClass);

  window.setTimeout(() => {
    state.pageIndex = nextIndex;
    updatePage();
    elements.paper.classList.remove(outClass);
    elements.paper.classList.add(inClass);

    window.setTimeout(() => {
      elements.paper.classList.remove(inClass);
      state.turning = false;
    }, 280);
  }, 150);
}

elements.nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.nameInput.value.trim();

  if (!name) {
    elements.formStatus.textContent = "先写下一个名字。";
    elements.nameLine.classList.remove("is-invalid");
    void elements.nameLine.offsetWidth;
    elements.nameLine.classList.add("is-invalid");
    elements.nameInput.focus();
    return;
  }

  const person = findPerson(name);
  if (person) {
    showReader({
      name: person.name,
      notes: person.notes,
      source: "personal"
    });
  } else {
    showReader({
      name: "",
      notes: state.data.others.notes,
      source: "fallback"
    });
  }
});

elements.nameInput.addEventListener("input", () => {
  elements.formStatus.textContent = "";
});

elements.previousButton.addEventListener("click", () => turnPage(-1));
elements.nextButton.addEventListener("click", () => turnPage(1));
elements.backButton.addEventListener("click", showHome);

document.addEventListener("keydown", (event) => {
  if (state.screen !== "reader") return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    turnPage(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    turnPage(1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    showHome();
  }
});

loadNotes();
