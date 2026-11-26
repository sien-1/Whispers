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
  screeningView: document.getElementById("screeningView"),
  screeningForm: document.getElementById("screeningForm"),
  screeningTitle: document.getElementById("screeningTitle"),
  screeningQuestions: document.getElementById("screeningQuestions"),
  screeningAnswer: document.getElementById("screeningAnswer"),
  verifyAnswerButton: document.getElementById("verifyAnswerButton"),
  screeningStatus: document.getElementById("screeningStatus"),
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
  candidates: [],
  selectedCandidate: null,
  pageIndex: 0,
  turning: false
};

function resolveNotes(noteIds) {
  const byId = new Map(state.data.noteLibrary.map((note) => [note.id, note]));
  return noteIds.map((noteId) => byId.get(noteId)).filter(Boolean);
}

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
    if (!state.data.others.noteIds.length) {
      if (!state.data.noteLibrary.some((note) => note.id === fallbackNote.id)) {
        state.data.noteLibrary.push(fallbackNote);
      }
      state.data.others.noteIds = [fallbackNote.id];
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

function findPeople(name) {
  const target = dataUtils.normalizeName(name);
  return state.data.people.filter((person) => {
    const candidates = [person.name, ...(person.aliases || [])];
    return candidates.some((candidate) => dataUtils.normalizeName(candidate) === target);
  });
}

function hasScreening(person) {
  return Boolean(
    person?.screening?.question
    && Array.isArray(person.screening.answerHashes)
    && person.screening.answerHashes.length
  );
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
  elements.screeningView.hidden = true;
  elements.readerView.hidden = false;
  elements.backButton.hidden = false;
  elements.pager.hidden = false;
  updatePage();
  elements.liveStatus.textContent = "纸条已展开。";
  elements.readerView.focus({ preventScroll: true });
}

function selectScreeningCandidate(candidateId) {
  state.selectedCandidate = state.candidates.find((person) => person.id === candidateId)
    || state.candidates[0]
    || null;
}

function showScreening(candidates) {
  state.screen = "screening";
  state.turning = false;
  state.candidates = candidates;
  state.selectedCandidate = candidates[0] || null;
  state.source = "personal";

  clearPaperAnimation();
  elements.homeView.hidden = true;
  elements.readerView.hidden = true;
  elements.screeningView.hidden = false;
  elements.backButton.hidden = false;
  elements.pager.hidden = true;
  elements.paperStack.dataset.pages = "1";
  elements.screeningQuestions.replaceChildren();
  elements.screeningStatus.textContent = "";
  elements.screeningAnswer.value = "";

  if (candidates.length === 1) {
    elements.screeningTitle.textContent = "先回答一个小问题，找到你的那张纸。";
    const question = document.createElement("p");
    question.className = "screening-question";
    question.textContent = candidates[0].screening.question;
    elements.screeningQuestions.append(question);
  } else {
    elements.screeningTitle.textContent = "这个名字对应不止一张纸，请选择属于你的小问题。";
    const group = document.createElement("fieldset");
    group.className = "screening-choice-group";
    const legend = document.createElement("legend");
    legend.textContent = "选择你能回答的问题";
    group.append(legend);

    candidates.forEach((person, index) => {
      const label = document.createElement("label");
      label.className = "screening-choice";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "screeningCandidate";
      radio.value = person.id;
      radio.checked = index === 0;
      radio.addEventListener("change", () => {
        selectScreeningCandidate(person.id);
        elements.screeningStatus.textContent = "";
      });
      const text = document.createElement("span");
      text.textContent = person.screening.question;
      label.append(radio, text);
      group.append(label);
    });

    elements.screeningQuestions.append(group);
  }

  elements.screeningAnswer.focus({ preventScroll: true });
}

function showHome() {
  state.screen = "home";
  state.turning = false;
  state.candidates = [];
  state.selectedCandidate = null;
  clearPaperAnimation();
  elements.homeView.hidden = false;
  elements.screeningView.hidden = true;
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

  const people = findPeople(name);
  const allHaveScreening = people.length > 0 && people.every(hasScreening);

  if (people.length === 1 && !hasScreening(people[0])) {
    showReader({
      name: people[0].name,
      notes: resolveNotes(people[0].noteIds),
      source: "personal"
    });
  } else if (allHaveScreening) {
    showScreening(people);
  } else {
    showReader({
      name: "",
      notes: resolveNotes(state.data.others.noteIds),
      source: "fallback"
    });
  }
});

elements.nameInput.addEventListener("input", () => {
  elements.formStatus.textContent = "";
});

elements.screeningForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const answer = elements.screeningAnswer.value.trim();
  const person = state.selectedCandidate;

  if (!answer) {
    elements.screeningStatus.textContent = "先写下你的答案。";
    elements.screeningAnswer.focus();
    return;
  }
  if (!person || !hasScreening(person)) return;

  elements.verifyAnswerButton.disabled = true;
  elements.screeningStatus.textContent = "正在确认…";

  try {
    const answerHash = await dataUtils.hashAnswer(answer);
    if (person.screening.answerHashes.includes(answerHash)) {
      showReader({
        name: person.name,
        notes: resolveNotes(person.noteIds),
        source: "personal"
      });
    } else {
      elements.screeningStatus.textContent = "答案还不太一样，再想一想吧。";
      elements.screeningAnswer.select();
    }
  } catch (error) {
    console.error(error);
    elements.screeningStatus.textContent = "暂时无法确认答案，请稍后再试。";
  } finally {
    elements.verifyAnswerButton.disabled = false;
  }
});

elements.screeningAnswer.addEventListener("input", () => {
  elements.screeningStatus.textContent = "";
});

elements.previousButton.addEventListener("click", () => turnPage(-1));
elements.nextButton.addEventListener("click", () => turnPage(1));
elements.backButton.addEventListener("click", showHome);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.screen !== "home") {
    event.preventDefault();
    showHome();
    return;
  }
  if (state.screen !== "reader") return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    turnPage(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    turnPage(1);
  }
});

function setVisualLook(look) {
  const allowed = ["stationery", "editorial", "soft"];
  const selected = allowed.includes(look) ? look : "stationery";
  document.documentElement.dataset.look = selected;
  document.querySelectorAll("[data-look-option]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lookOption === selected));
  });
  const url = new URL(window.location.href);
  url.searchParams.set("look", selected);
  window.history.replaceState({}, "", url);
}

document.querySelectorAll("[data-look-option]").forEach((button) => {
  button.addEventListener("click", () => setVisualLook(button.dataset.lookOption));
});
setVisualLook(document.documentElement.dataset.look);

loadNotes();
