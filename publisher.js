(() => {
  const dataUtils = window.WhisperData;
  const DRAFT_KEY = "whispers-data-draft-v1";
  const GITHUB_CONFIG_KEY = "whispers-github-config-v1";
  const GITHUB_TOKEN_KEY = "whispers-github-token-session";

  const elements = {
    draftBanner: document.getElementById("draftBanner"),
    restoreDraftButton: document.getElementById("restoreDraftButton"),
    dismissDraftButton: document.getElementById("dismissDraftButton"),
    peopleCount: document.getElementById("peopleCount"),
    notesCount: document.getElementById("notesCount"),
    fallbackCount: document.getElementById("fallbackCount"),
    loadMessage: document.getElementById("loadMessage"),
    nameList: document.getElementById("nameList"),
    othersButton: document.getElementById("othersButton"),
    othersListCount: document.getElementById("othersListCount"),
    personSelect: document.getElementById("personSelect"),
    mobileAddPersonButton: document.getElementById("mobileAddPersonButton"),
    emptyEditor: document.getElementById("emptyEditor"),
    emptyAddPersonButton: document.getElementById("emptyAddPersonButton"),
    editorContent: document.getElementById("editorContent"),
    editorEyebrow: document.getElementById("editorEyebrow"),
    editorTitle: document.getElementById("editorTitle"),
    deletePersonButton: document.getElementById("deletePersonButton"),
    personFields: document.getElementById("personFields"),
    personNameInput: document.getElementById("personNameInput"),
    personAliasesInput: document.getElementById("personAliasesInput"),
    screeningEditor: document.getElementById("screeningEditor"),
    screeningStateBadge: document.getElementById("screeningStateBadge"),
    screeningQuestionInput: document.getElementById("screeningQuestionInput"),
    screeningAnswersInput: document.getElementById("screeningAnswersInput"),
    saveScreeningButton: document.getElementById("saveScreeningButton"),
    screeningStatus: document.getElementById("screeningStatus"),
    addPersonButton: document.getElementById("addPersonButton"),
    addNoteButton: document.getElementById("addNoteButton"),
    openLibraryButton: document.getElementById("openLibraryButton"),
    noteLibraryDialog: document.getElementById("noteLibraryDialog"),
    closeLibraryButton: document.getElementById("closeLibraryButton"),
    librarySearchInput: document.getElementById("librarySearchInput"),
    librarySummary: document.getElementById("librarySummary"),
    noteLibraryList: document.getElementById("noteLibraryList"),
    notesEditor: document.getElementById("notesEditor"),
    actionStatus: document.getElementById("actionStatus"),
    reloadButton: document.getElementById("reloadButton"),
    saveDraftButton: document.getElementById("saveDraftButton"),
    downloadButton: document.getElementById("downloadButton"),
    copyButton: document.getElementById("copyButton"),
    jsonPreview: document.getElementById("jsonPreview"),
    githubForm: document.getElementById("githubForm"),
    githubPanel: document.getElementById("githubPanel"),
    repoInput: document.getElementById("repoInput"),
    branchInput: document.getElementById("branchInput"),
    pathInput: document.getElementById("pathInput"),
    tokenInput: document.getElementById("tokenInput"),
    publishButton: document.getElementById("publishButton"),
    publishStatus: document.getElementById("publishStatus"),
    quickPublishButton: document.getElementById("quickPublishButton"),
    headerPublishButton: document.getElementById("headerPublishButton"),
    githubQuickStatus: document.getElementById("githubQuickStatus")
  };

  const state = {
    data: null,
    selectedKey: "others",
    dirty: false,
    draftTimer: 0,
    publishing: false
  };

  function createNote(prefix = "note") {
    return {
      id: dataUtils.makeId(prefix),
      message: "",
      createdAt: new Date().toISOString()
    };
  }

  function createPerson() {
    return {
      id: dataUtils.makeId("person"),
      name: "新名字",
      aliases: [],
      screening: null,
      noteIds: []
    };
  }

  function makeEmptyData() {
    const fallback = createNote("fallback");
    fallback.message = "愿你今天也有值得期待的小事，也有可以安心停下来的时刻。";
    return {
      version: 2,
      noteLibrary: [fallback],
      people: [],
      others: {
        noteIds: [fallback.id]
      }
    };
  }

  function asEditableData(raw) {
    const data = dataUtils.normalizeData(raw);
    return {
      version: 2,
      noteLibrary: data.noteLibrary,
      people: data.people,
      others: data.others
    };
  }

  function getSelectedPerson() {
    if (!state.selectedKey.startsWith("person:")) return null;
    const id = state.selectedKey.slice("person:".length);
    return state.data.people.find((person) => person.id === id) || null;
  }

  function getSelectedNoteIds() {
    const person = getSelectedPerson();
    return person ? person.noteIds : state.data.others.noteIds;
  }

  function getNoteById(noteId) {
    return state.data.noteLibrary.find((note) => note.id === noteId) || null;
  }

  function ensureFallbackNote() {
    if (state.data.others.noteIds.length) return;
    const note = createNote("fallback");
    note.message = "愿你今天也有值得期待的小事，也有可以安心停下来的时刻。";
    state.data.noteLibrary.push(note);
    state.data.others.noteIds.push(note.id);
  }

  function resolveNotes(noteIds) {
    return noteIds.map((noteId) => getNoteById(noteId)).filter(Boolean);
  }

  function getSelectedNotes() {
    return resolveNotes(getSelectedNoteIds());
  }

  function noteUsageCount(noteId) {
    const personalUses = state.data.people.filter((person) => person.noteIds.includes(noteId)).length;
    return personalUses + (state.data.others.noteIds.includes(noteId) ? 1 : 0);
  }

  function totalNotes() {
    return state.data.noteLibrary.length;
  }

  function setStatus(message) {
    elements.actionStatus.textContent = message;
  }

  function setPublishStatus(message, url = "") {
    elements.publishStatus.replaceChildren();
    if (!message) return;
    elements.publishStatus.append(document.createTextNode(message));
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = " 打开提交记录";
      elements.publishStatus.append(link);
    }
  }

  function updateStats() {
    elements.peopleCount.textContent = String(state.data.people.length);
    elements.notesCount.textContent = String(totalNotes());
    elements.fallbackCount.textContent = String(state.data.others.noteIds.length);
    elements.othersListCount.textContent = String(state.data.others.noteIds.length);
  }

  function updateJsonPreview() {
    elements.jsonPreview.textContent = JSON.stringify(state.data, null, 2);
  }

  function updateDirtyState(message = "有尚未发布的更改。") {
    state.dirty = true;
    setStatus(message);
    updateJsonPreview();
    window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(() => saveDraft(true), 420);
  }

  function saveDraft(quiet = false) {
    if (!state.data) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: state.data
      }));
      if (!quiet) {
        setStatus(`草稿已保存在本机 · ${new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        })}`);
      }
    } catch (error) {
      console.error(error);
      if (!quiet) setStatus("本机草稿保存失败，建议先下载 JSON。");
    }
  }

  function renderNameList() {
    elements.nameList.replaceChildren();

    if (!state.data.people.length) {
      const empty = document.createElement("p");
      empty.className = "empty-notes";
      empty.textContent = "还没有名字，点击右上角的加号添加。";
      elements.nameList.append(empty);
      return;
    }

    state.data.people.forEach((person) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "name-item";
      button.dataset.personId = person.id;
      button.setAttribute(
        "aria-pressed",
        String(state.selectedKey === `person:${person.id}`)
      );

      const copy = document.createElement("span");
      copy.className = "name-copy";
      const name = document.createElement("strong");
      name.textContent = person.name.trim() || "未命名";
      const detail = document.createElement("span");
      detail.textContent = person.aliases.length
        ? `别名 · ${person.aliases.join(" / ")}`
        : "没有别名";
      copy.append(name, detail);

      const count = document.createElement("span");
      count.className = "count-badge";
      count.textContent = String(person.noteIds.length);
      button.append(copy, count);
      button.addEventListener("click", () => {
        state.selectedKey = `person:${person.id}`;
        renderAll();
      });
      elements.nameList.append(button);
    });
  }

  function renderPersonSelect() {
    elements.personSelect.replaceChildren();

    state.data.people.forEach((person) => {
      const option = document.createElement("option");
      option.value = `person:${person.id}`;
      option.textContent = person.name.trim() || "未命名";
      elements.personSelect.append(option);
    });

    const others = document.createElement("option");
    others.value = "others";
    others.textContent = "普通祝福";
    elements.personSelect.append(others);
    elements.personSelect.value = state.selectedKey;
  }

  function makeActionButton(label, action, noteId, disabled = false, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-action ${extraClass}`.trim();
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.noteId = noteId;
    button.disabled = disabled;
    return button;
  }

  function renderNotes() {
    const notes = getSelectedNotes();
    elements.notesEditor.replaceChildren();

    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "empty-notes";
      empty.textContent = "这里还没有小纸条，可以新建一张或从纸条库选择。";
      elements.notesEditor.append(empty);
      return;
    }

    notes.forEach((note, index) => {
      const article = document.createElement("article");
      article.className = "note-editor";
      article.dataset.noteId = note.id;

      const toolbar = document.createElement("div");
      toolbar.className = "note-toolbar";
      const titleGroup = document.createElement("div");
      titleGroup.className = "note-title-group";
      const number = document.createElement("span");
      number.className = "note-number";
      number.textContent = `小纸条 ${String(index + 1).padStart(2, "0")}`;
      titleGroup.append(number);
      const usage = noteUsageCount(note.id);
      if (usage > 1) {
        const shareBadge = document.createElement("span");
        shareBadge.className = "note-share-badge";
        shareBadge.textContent = `共享给 ${usage} 人`;
        titleGroup.append(shareBadge);
      }

      const actions = document.createElement("div");
      actions.className = "note-actions";
      actions.append(
        makeActionButton("↑", "up", note.id, index === 0),
        makeActionButton("↓", "down", note.id, index === notes.length - 1),
        makeActionButton("移出", "delete", note.id, false, "is-delete")
      );
      toolbar.append(titleGroup, actions);

      const textarea = document.createElement("textarea");
      textarea.rows = 5;
      textarea.value = note.message;
      textarea.placeholder = "写一张小纸条…";
      textarea.dataset.noteId = note.id;
      textarea.setAttribute("aria-label", `小纸条 ${index + 1} 内容`);

      const meta = document.createElement("div");
      meta.className = "note-meta";
      const count = document.createElement("span");
      count.className = "character-count";
      count.textContent = `${note.message.length} 字`;

      const timeField = document.createElement("div");
      timeField.className = "note-time-field";
      const timeHead = document.createElement("div");
      timeHead.className = "time-field-head";
      const timeCaption = document.createElement("label");
      timeCaption.textContent = "提交时间";
      const timeId = `note-time-${note.id}`;
      timeCaption.htmlFor = timeId;
      const nowButton = document.createElement("button");
      nowButton.type = "button";
      nowButton.className = "time-now-button";
      nowButton.textContent = "当前时间";
      nowButton.dataset.action = "now";
      nowButton.dataset.noteId = note.id;
      const timeInput = document.createElement("input");
      timeInput.id = timeId;
      timeInput.type = "datetime-local";
      timeInput.value = dataUtils.toDateTimeLocal(note.createdAt);
      timeInput.dataset.noteId = note.id;
      timeHead.append(timeCaption, nowButton);
      timeField.append(timeHead, timeInput);
      meta.append(count, timeField);

      article.append(toolbar, textarea, meta);
      elements.notesEditor.append(article);

      textarea.addEventListener("input", () => {
        note.message = textarea.value;
        count.textContent = `${note.message.length} 字`;
        updateDirtyState();
      });

      timeInput.addEventListener("input", () => {
        note.createdAt = dataUtils.fromDateTimeLocal(timeInput.value);
        updateDirtyState();
      });
    });

  }

  function getNoteRecipients(noteId) {
    const names = state.data.people
      .filter((person) => person.noteIds.includes(noteId))
      .map((person) => person.name.trim() || "未命名");
    if (state.data.others.noteIds.includes(noteId)) names.push("普通祝福");
    return names;
  }

  function toggleNoteAttachment(noteId) {
    const noteIds = getSelectedNoteIds();
    const index = noteIds.indexOf(noteId);
    if (index >= 0) {
      noteIds.splice(index, 1);
      updateDirtyState("已将纸条从当前名字移出。");
    } else {
      noteIds.push(noteId);
      updateDirtyState("已将纸条加入当前名字。");
    }
    renderAll();
    renderLibraryDialog();
  }

  function renderLibraryDialog() {
    const query = elements.librarySearchInput.value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
    const currentIds = new Set(getSelectedNoteIds());
    const notes = state.data.noteLibrary.filter((note) => {
      if (!query) return true;
      return note.message.normalize("NFKC").toLocaleLowerCase("zh-CN").includes(query);
    });

    elements.noteLibraryList.replaceChildren();
    elements.librarySummary.textContent = `${notes.length} / ${state.data.noteLibrary.length} 张纸条`;

    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "empty-notes";
      empty.textContent = query ? "没有找到包含这段文字的纸条。" : "纸条库还是空的。";
      elements.noteLibraryList.append(empty);
      return;
    }

    notes.forEach((note) => {
      const attached = currentIds.has(note.id);
      const recipients = getNoteRecipients(note.id);
      const item = document.createElement("article");
      item.className = `library-item${attached ? " is-attached" : ""}`;

      const copy = document.createElement("div");
      copy.className = "library-item-copy";
      const message = document.createElement("p");
      message.className = "library-item-message";
      message.textContent = note.message;

      const meta = document.createElement("div");
      meta.className = "library-item-meta";
      const time = document.createElement("span");
      time.textContent = dataUtils.formatTimestamp(note.createdAt);
      const usage = document.createElement("span");
      usage.textContent = recipients.length
        ? `关联：${recipients.join("、")}`
        : "尚未关联名字";
      meta.append(time, usage);
      copy.append(message, meta);

      const action = document.createElement("button");
      action.type = "button";
      action.className = "library-item-action";
      action.textContent = attached ? "移出" : "加入";
      action.addEventListener("click", () => toggleNoteAttachment(note.id));
      item.append(copy, action);
      elements.noteLibraryList.append(item);
    });
  }

  function openLibraryDialog() {
    elements.librarySearchInput.value = "";
    renderLibraryDialog();
    if (typeof elements.noteLibraryDialog.showModal === "function") {
      elements.noteLibraryDialog.showModal();
    } else {
      elements.noteLibraryDialog.setAttribute("open", "");
    }
    requestAnimationFrame(() => elements.librarySearchInput.focus());
  }

  function renderEditor() {
    if (state.selectedKey !== "others" && !getSelectedPerson()) {
      state.selectedKey = state.data.people[0] ? `person:${state.data.people[0].id}` : "others";
    }

    const person = getSelectedPerson();
    const isOthers = person === null;
    elements.editorEyebrow.textContent = isOthers ? "未匹配时展示" : "正在编辑";
    elements.editorTitle.textContent = isOthers
      ? "普通祝福"
      : (person.name.trim() || "未命名");
    elements.deletePersonButton.hidden = isOthers;
    elements.personFields.hidden = isOthers;
    elements.screeningEditor.hidden = isOthers;
    elements.personNameInput.value = isOthers ? "" : person.name;
    elements.personAliasesInput.value = isOthers ? "" : person.aliases.join(", ");
    elements.screeningQuestionInput.value = isOthers ? "" : (person.screening?.question || "");
    elements.screeningAnswersInput.value = "";
    elements.screeningAnswersInput.placeholder = person?.screening?.answerHashes?.length
      ? "已设置答案；留空保持，输入新答案可替换"
      : "多个答案用逗号分隔";
    elements.screeningStateBadge.textContent = person?.screening?.answerHashes?.length
      ? "已设置"
      : "未设置";
    elements.screeningStatus.textContent = person?.screening?.answerHashes?.length
      ? `已保存 ${person.screening.answerHashes.length} 个答案`
      : "重名时建议设置";
    elements.othersButton.setAttribute("aria-pressed", String(isOthers));
    elements.emptyEditor.hidden = true;
    elements.editorContent.hidden = false;
    renderNotes();
  }

  function renderAll() {
    updateStats();
    renderNameList();
    renderPersonSelect();
    renderEditor();
    updateJsonPreview();
    if (elements.noteLibraryDialog.open) renderLibraryDialog();
  }

  function selectKey(key) {
    state.selectedKey = key;
    renderAll();
  }

  function addPerson() {
    const person = createPerson();
    const note = createNote();
    state.data.noteLibrary.push(note);
    person.noteIds.push(note.id);
    state.data.people.push(person);
    state.selectedKey = `person:${person.id}`;
    renderAll();
    updateDirtyState("已添加一个名字，请填写称呼和小纸条。");
    requestAnimationFrame(() => {
      elements.personNameInput.focus();
      elements.personNameInput.select();
    });
  }

  function deletePerson() {
    const person = getSelectedPerson();
    if (!person) return;
    if (!window.confirm(`删除“${person.name.trim() || "未命名"}”及其纸条关联？纸条库内容不会被删除。`)) {
      return;
    }

    const index = state.data.people.findIndex((item) => item.id === person.id);
    state.data.people.splice(index, 1);
    const next = state.data.people[Math.min(index, state.data.people.length - 1)];
    state.selectedKey = next ? `person:${next.id}` : "others";
    renderAll();
    updateDirtyState("已删除这个名字。");
  }

  function addNote() {
    const note = createNote(getSelectedPerson() ? "note" : "fallback");
    state.data.noteLibrary.push(note);
    getSelectedNoteIds().push(note.id);
    renderAll();
    if (elements.noteLibraryDialog.open) renderLibraryDialog();
    updateDirtyState("已新建一张小纸条并加入纸条库。");
    requestAnimationFrame(() => {
      const inputs = elements.notesEditor.querySelectorAll("textarea");
      inputs[inputs.length - 1]?.focus();
    });
  }

  function moveNote(noteId, direction) {
    const noteIds = getSelectedNoteIds();
    const index = noteIds.indexOf(noteId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= noteIds.length) return;
    [noteIds[index], noteIds[nextIndex]] = [noteIds[nextIndex], noteIds[index]];
    renderAll();
    updateDirtyState("已调整纸条顺序。");
  }

  function deleteNote(noteId) {
    const noteIds = getSelectedNoteIds();
    const index = noteIds.indexOf(noteId);
    if (index < 0) return;
    if (!window.confirm("将这张纸条从当前名字移出？纸条仍会保留在纸条库中。")) return;
    noteIds.splice(index, 1);
    renderAll();
    if (elements.noteLibraryDialog.open) renderLibraryDialog();
    updateDirtyState("已将纸条从当前名字移出，纸条库中的内容仍保留。");
  }

  function setNoteTimeToNow(noteId) {
    const note = getNoteById(noteId);
    if (!note) return;
    note.createdAt = new Date().toISOString();
    renderEditor();
    updateDirtyState("提交时间已更新为当前时间。");
  }

  async function saveScreening() {
    const person = getSelectedPerson();
    if (!person) return;

    const question = elements.screeningQuestionInput.value.trim();
    const answers = elements.screeningAnswersInput.value
      .split(/[,，\n]/)
      .map((answer) => answer.trim())
      .filter(Boolean);
    const existingHashes = person.screening?.answerHashes || [];

    if (!question && answers.length) {
      elements.screeningStatus.textContent = "请先填写小问题，再保存答案。";
      return;
    }

    if (!question) {
      person.screening = null;
      renderEditor();
      updateDirtyState("已移除这位访客的筛查问题。");
      elements.screeningStatus.textContent = "重名时建议设置";
      return;
    }

    if (!answers.length && !existingHashes.length) {
      elements.screeningStatus.textContent = "请至少填写一个筛查答案。";
      return;
    }

    elements.saveScreeningButton.disabled = true;
    elements.screeningStatus.textContent = "正在保存答案…";

    try {
      const uniqueAnswers = Array.from(new Map(
        answers.map((answer) => [dataUtils.normalizeAnswer(answer), answer])
      ).values()).filter((answer) => dataUtils.normalizeAnswer(answer));
      const answerHashes = uniqueAnswers.length
        ? await Promise.all(uniqueAnswers.map((answer) => dataUtils.hashAnswer(answer)))
        : existingHashes;
      const validHashes = Array.from(new Set(answerHashes.filter(Boolean)));

      if (!validHashes.length) {
        throw new Error("筛查答案不能为空。");
      }

      person.screening = {
        question,
        answerHashes: validHashes
      };
      renderEditor();
      updateDirtyState("重名筛查问题已更新。");
      elements.screeningStatus.textContent = `已保存 ${validHashes.length} 个答案`;
    } catch (error) {
      console.error(error);
      elements.screeningStatus.textContent = error.message || "筛查问题保存失败。";
    } finally {
      elements.saveScreeningButton.disabled = false;
    }
  }

  function validateData() {
    const errors = [];
    const identityOwners = new Map();
    const noteIdsInLibrary = new Set(state.data.noteLibrary.map((note) => note.id));

    if (!state.data.people.length) {
      errors.push("至少添加一个名字。");
    }

    state.data.people.forEach((person, personIndex) => {
      const name = person.name.trim();
      if (!name) {
        errors.push(`第 ${personIndex + 1} 个名字还没有填写称呼。`);
      }
      const identities = [name, ...person.aliases];
      Array.from(new Set(identities.map((identity) => dataUtils.normalizeName(identity)).filter(Boolean)))
        .forEach((key) => {
          if (!identityOwners.has(key)) identityOwners.set(key, new Set());
          identityOwners.get(key).add(personIndex);
        });

      const hasQuestion = Boolean(person.screening?.question);
      const hasAnswers = Boolean(person.screening?.answerHashes?.length);
      if (hasQuestion !== hasAnswers) {
        errors.push(`“${name || "未命名"}”的筛查问题和答案需要同时设置。`);
      }
      if (!person.noteIds.length) {
        errors.push(`“${name || "未命名"}”还没有小纸条。`);
      }
      person.noteIds.forEach((noteId, noteIndex) => {
        if (!noteIdsInLibrary.has(noteId)) {
          errors.push(`“${name || "未命名"}”的第 ${noteIndex + 1} 张小纸条不存在于纸条库。`);
          return;
        }
        const note = getNoteById(noteId);
        if (!note?.message.trim()) {
          errors.push(`“${name || "未命名"}”的第 ${noteIndex + 1} 张小纸条是空的。`);
        }
      });
    });

    const duplicatePeople = new Set();
    identityOwners.forEach((owners) => {
      if (owners.size > 1) {
        owners.forEach((personIndex) => duplicatePeople.add(personIndex));
      }
    });

    duplicatePeople.forEach((personIndex) => {
      const person = state.data.people[personIndex];
      if (!person?.screening?.question || !person.screening.answerHashes?.length) {
        errors.push(`“${person?.name || "未命名"}”存在重名，请为这一条设置小问题和答案。`);
      }
    });

    identityOwners.forEach((owners) => {
      if (owners.size <= 1) return;
      const questions = Array.from(owners)
        .map((personIndex) => dataUtils.normalizeName(state.data.people[personIndex]?.screening?.question || ""))
        .filter(Boolean);
      if (questions.length === owners.size && new Set(questions).size !== questions.length) {
        errors.push("同一重名组中的筛查问题需要彼此不同。");
      }
    });

    if (!state.data.others.noteIds.length) {
      errors.push("至少保留一张普通祝福。");
    }
    state.data.others.noteIds.forEach((noteId, index) => {
      if (!noteIdsInLibrary.has(noteId)) {
        errors.push(`第 ${index + 1} 张普通祝福不存在于纸条库。`);
        return;
      }
      const note = getNoteById(noteId);
      if (!note?.message.trim()) {
        errors.push(`第 ${index + 1} 张普通祝福是空的。`);
      }
    });

    if (noteIdsInLibrary.size !== state.data.noteLibrary.length) {
      errors.push("纸条库中存在重复的纸条 ID。");
    }

    return errors;
  }

  function makePublishData() {
    const errors = validateData();
    if (errors.length) {
      throw new Error(errors[0]);
    }

    const uniqueAliases = (aliases) => {
      const seen = new Set();
      return aliases
        .map((alias) => alias.trim())
        .filter((alias) => {
          const key = dataUtils.normalizeName(alias);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    };
    const publishableNotes = state.data.noteLibrary.filter((note) => note.message.trim());
    const publishableNoteIds = new Set(publishableNotes.map((note) => note.id));

    return {
      version: 2,
      noteLibrary: publishableNotes.map((note) => ({
        id: note.id,
        message: note.message.trim(),
        createdAt: dataUtils.normalizeDate(note.createdAt)
      })),
      people: state.data.people.map((person) => ({
        id: person.id,
        name: person.name.trim(),
        aliases: uniqueAliases(person.aliases)
          .filter((alias) => dataUtils.normalizeName(alias) !== dataUtils.normalizeName(person.name)),
        ...(person.screening ? {
          screening: {
            question: person.screening.question.trim(),
            answerHashes: Array.from(new Set(person.screening.answerHashes))
          }
        } : {}),
        noteIds: Array.from(new Set(person.noteIds)).filter((noteId) => publishableNoteIds.has(noteId))
      })),
      others: {
        noteIds: Array.from(new Set(state.data.others.noteIds))
          .filter((noteId) => publishableNoteIds.has(noteId))
      }
    };
  }

  function publishJson() {
    return `${JSON.stringify(makePublishData(), null, 2)}\n`;
  }

  async function loadOnline(showSuccess = false) {
    elements.loadMessage.textContent = "正在读取 notes.json…";
    try {
      const response = await fetch(`./notes.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`读取失败：${response.status}`);
      const raw = await response.json();
      state.data = asEditableData(dataUtils.normalizeData(raw));
      ensureFallbackNote();
      state.selectedKey = state.data.people[0]
        ? `person:${state.data.people[0].id}`
        : "others";
      state.dirty = false;
      renderAll();
      elements.loadMessage.textContent = showSuccess
        ? "已重新读取 notes.json。"
        : "";
    } catch (error) {
      console.error(error);
      state.data = makeEmptyData();
      state.selectedKey = "others";
      state.dirty = false;
      renderAll();
      elements.loadMessage.textContent = "暂时没能读取 notes.json，已创建一份空白数据。";
    }
  }

  function downloadJson() {
    try {
      const json = publishJson();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "notes.json";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("notes.json 已下载。将它上传到网站根目录即可更新线上内容。");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function copyJson() {
    try {
      const json = publishJson();
      await navigator.clipboard.writeText(json);
      setStatus("notes.json 已复制到剪贴板。");
    } catch (error) {
      setStatus("复制失败，可以改用“下载 JSON”。");
    }
  }

  function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function saveGithubConfig() {
    const config = {
      repo: elements.repoInput.value.trim(),
      branch: elements.branchInput.value.trim() || "main",
      path: elements.pathInput.value.trim().replace(/^\/+/, "") || "notes.json"
    };
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(config));
    sessionStorage.setItem(GITHUB_TOKEN_KEY, elements.tokenInput.value.trim());
    updateGithubQuickStatus();
  }

  function restoreGithubConfig() {
    try {
      const config = JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || "{}");
      if (config.repo) elements.repoInput.value = config.repo;
      if (config.branch) elements.branchInput.value = config.branch;
      if (config.path) elements.pathInput.value = config.path;
    } catch {
      // 配置损坏时保持默认值。
    }
    elements.tokenInput.value = sessionStorage.getItem(GITHUB_TOKEN_KEY) || "";
    updateGithubQuickStatus();
  }

  function getGithubSettings() {
    const [owner, repo] = elements.repoInput.value.trim().split("/");
    return {
      owner: owner || "",
      repo: repo || "",
      branch: elements.branchInput.value.trim() || "main",
      path: elements.pathInput.value.trim().replace(/^\/+/, "") || "notes.json",
      token: elements.tokenInput.value.trim()
    };
  }

  function updateGithubQuickStatus() {
    const settings = getGithubSettings();
    const hasRepo = Boolean(settings.owner && settings.repo);
    const hasToken = Boolean(settings.token);

    elements.githubQuickStatus.classList.toggle("is-ready", hasRepo && hasToken);
    if (hasRepo && hasToken) {
      elements.githubQuickStatus.textContent = `已连接 ${settings.owner}/${settings.repo} · ${settings.branch}`;
    } else if (hasRepo) {
      elements.githubQuickStatus.textContent = "仓库已填写；首次点击一键发布会提示填写令牌。";
    } else {
      elements.githubQuickStatus.textContent = "GitHub 尚未配置";
    }
  }

  function openGithubSetup(message, field) {
    elements.githubPanel.open = true;
    setPublishStatus(message);
    setStatus(message);
    elements.githubPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => field?.focus(), 250);
  }

  function setPublishingState(isPublishing) {
    state.publishing = isPublishing;
    elements.publishButton.disabled = isPublishing;
    elements.quickPublishButton.disabled = isPublishing;
    elements.headerPublishButton.disabled = isPublishing;
    elements.publishButton.textContent = isPublishing ? "正在发布…" : "发布当前数据";
    elements.quickPublishButton.textContent = isPublishing ? "正在发布…" : "一键发布到 GitHub";
    elements.headerPublishButton.textContent = isPublishing ? "发布中…" : "发布";
  }

  function quickPublish() {
    if (state.publishing) return;
    const settings = getGithubSettings();

    if (!settings.owner || !settings.repo) {
      openGithubSetup("请先填写 GitHub 仓库，例如 owner/repository。", elements.repoInput);
      return;
    }
    if (!settings.token) {
      openGithubSetup("首次发布需要填写 Fine-grained token；本标签页后续发布会继续使用它。", elements.tokenInput);
      return;
    }

    publishToGithub();
  }

  async function publishToGithub() {
    if (state.publishing) return;
    setPublishStatus("");

    let json;
    try {
      json = publishJson();
    } catch (error) {
      setPublishStatus(error.message);
      return;
    }

    const settings = getGithubSettings();
    const { owner, repo, branch, path, token } = settings;

    if (!owner || !repo || !token) {
      openGithubSetup(
        "请填写 owner/repository、分支和令牌。",
        !owner || !repo ? elements.repoInput : elements.tokenInput
      );
      return;
    }

    setPublishingState(true);
    setPublishStatus("正在连接 GitHub…");
    setStatus("正在发布到 GitHub…");

    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    try {
      saveGithubConfig();
      const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
        headers,
        cache: "no-store"
      });

      let sha;
      if (currentResponse.ok) {
        const current = await currentResponse.json();
        sha = current.sha;
      } else if (currentResponse.status !== 404) {
        const payload = await currentResponse.json().catch(() => ({}));
        throw new Error(payload.message || `读取 GitHub 文件失败：${currentResponse.status}`);
      }

      const publishResponse = await fetch(endpoint, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `更新悄悄话数据 ${new Date().toISOString()}`,
          content: utf8ToBase64(json),
          branch,
          ...(sha ? { sha } : {})
        })
      });

      const result = await publishResponse.json().catch(() => ({}));
      if (!publishResponse.ok) {
        throw new Error(result.message || `发布失败：${publishResponse.status}`);
      }

      state.dirty = false;
      localStorage.removeItem(DRAFT_KEY);
      setPublishStatus("发布成功。部署完成后，访客刷新页面即可看到更新。", result.commit?.html_url || "");
      setStatus("数据已发布到 GitHub，等待自动部署。");
    } catch (error) {
      console.error(error);
      setPublishStatus(error.message || "发布失败，请检查仓库权限和网络。");
      setStatus("发布失败，请检查 GitHub 设置。");
    } finally {
      setPublishingState(false);
    }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!draft?.data) return;
      state.data = asEditableData(draft.data);
      ensureFallbackNote();
      state.selectedKey = state.data.people[0]
        ? `person:${state.data.people[0].id}`
        : "others";
      state.dirty = true;
      elements.draftBanner.hidden = true;
      renderAll();
      setStatus("已恢复本机草稿，尚未发布。");
    } catch {
      setStatus("本机草稿无法读取。");
    }
  }

  function hasDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return Boolean(draft?.data);
    } catch {
      return false;
    }
  }

  function bindEvents() {
    elements.addPersonButton.addEventListener("click", addPerson);
    elements.mobileAddPersonButton.addEventListener("click", addPerson);
    elements.emptyAddPersonButton.addEventListener("click", addPerson);
    elements.addNoteButton.addEventListener("click", addNote);
    elements.openLibraryButton.addEventListener("click", openLibraryDialog);
    elements.closeLibraryButton.addEventListener("click", () => elements.noteLibraryDialog.close());
    elements.librarySearchInput.addEventListener("input", renderLibraryDialog);
    elements.noteLibraryDialog.addEventListener("click", (event) => {
      if (event.target === elements.noteLibraryDialog) elements.noteLibraryDialog.close();
    });
    elements.deletePersonButton.addEventListener("click", deletePerson);
    elements.saveScreeningButton.addEventListener("click", saveScreening);

    elements.othersButton.addEventListener("click", () => selectKey("others"));
    elements.personSelect.addEventListener("change", () => selectKey(elements.personSelect.value));

    elements.personNameInput.addEventListener("input", () => {
      const person = getSelectedPerson();
      if (!person) return;
      person.name = elements.personNameInput.value;
      elements.editorTitle.textContent = person.name.trim() || "未命名";
      const activeNameButton = Array.from(
        elements.nameList.querySelectorAll("[data-person-id]")
      ).find((button) => button.dataset.personId === person.id);
      const nameLabel = activeNameButton?.querySelector(".name-copy strong");
      if (nameLabel) nameLabel.textContent = person.name.trim() || "未命名";
      const option = Array.from(elements.personSelect.options)
        .find((item) => item.value === `person:${person.id}`);
      if (option) option.textContent = person.name.trim() || "未命名";
      updateDirtyState();
    });

    elements.personAliasesInput.addEventListener("input", () => {
      const person = getSelectedPerson();
      if (!person) return;
      person.aliases = elements.personAliasesInput.value
        .split(/[,，]/)
        .map((alias) => alias.trim())
        .filter(Boolean);
      updateDirtyState();
    });

    elements.notesEditor.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action][data-note-id]");
      if (!button) return;
      const { action, noteId } = button.dataset;
      if (action === "up") moveNote(noteId, -1);
      if (action === "down") moveNote(noteId, 1);
      if (action === "delete") deleteNote(noteId);
      if (action === "now") setNoteTimeToNow(noteId);
    });

    elements.saveDraftButton.addEventListener("click", () => saveDraft(false));
    elements.downloadButton.addEventListener("click", downloadJson);
    elements.copyButton.addEventListener("click", copyJson);
    elements.reloadButton.addEventListener("click", async () => {
      if (state.dirty && !window.confirm("重新读取会放弃当前未发布的修改，继续吗？")) return;
      await loadOnline(true);
    });

    elements.restoreDraftButton.addEventListener("click", restoreDraft);
    elements.dismissDraftButton.addEventListener("click", () => {
      elements.draftBanner.hidden = true;
    });

    elements.githubForm.addEventListener("submit", (event) => {
      event.preventDefault();
      publishToGithub();
    });
    elements.quickPublishButton.addEventListener("click", quickPublish);
    elements.headerPublishButton.addEventListener("click", quickPublish);
    [elements.repoInput, elements.branchInput, elements.pathInput, elements.tokenInput]
      .forEach((input) => input.addEventListener("input", updateGithubQuickStatus));
  }

  async function init() {
    bindEvents();
    restoreGithubConfig();
    await loadOnline();
    if (hasDraft()) {
      elements.draftBanner.hidden = false;
    }
  }

  init();
})();
