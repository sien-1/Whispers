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
    addPersonButton: document.getElementById("addPersonButton"),
    addNoteButton: document.getElementById("addNoteButton"),
    notesEditor: document.getElementById("notesEditor"),
    actionStatus: document.getElementById("actionStatus"),
    reloadButton: document.getElementById("reloadButton"),
    saveDraftButton: document.getElementById("saveDraftButton"),
    downloadButton: document.getElementById("downloadButton"),
    copyButton: document.getElementById("copyButton"),
    jsonPreview: document.getElementById("jsonPreview"),
    githubForm: document.getElementById("githubForm"),
    repoInput: document.getElementById("repoInput"),
    branchInput: document.getElementById("branchInput"),
    pathInput: document.getElementById("pathInput"),
    tokenInput: document.getElementById("tokenInput"),
    publishButton: document.getElementById("publishButton"),
    publishStatus: document.getElementById("publishStatus")
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
      notes: [createNote()]
    };
  }

  function makeEmptyData() {
    return {
      version: 1,
      people: [],
      others: {
        notes: [{
          id: dataUtils.makeId("fallback"),
          message: "愿你今天也有值得期待的小事，也有可以安心停下来的时刻。",
          createdAt: new Date().toISOString()
        }]
      }
    };
  }

  function asEditableData(raw) {
    const people = Array.isArray(raw?.people) ? raw.people : [];
    const otherNotes = Array.isArray(raw?.others?.notes)
      ? raw.others.notes
      : Array.isArray(raw?.others)
        ? raw.others
        : [];

    return {
      version: 1,
      people: people.map((person) => ({
        id: String(person?.id || dataUtils.makeId("person")),
        name: String(person?.name || ""),
        aliases: Array.isArray(person?.aliases)
          ? person.aliases.map((alias) => String(alias))
          : [],
        notes: (Array.isArray(person?.notes) ? person.notes : []).map((note) => ({
          id: String(note?.id || dataUtils.makeId("note")),
          message: String(note?.message || ""),
          createdAt: dataUtils.normalizeDate(note?.createdAt)
        }))
      })),
      others: {
        notes: otherNotes.map((note) => ({
          id: String(note?.id || dataUtils.makeId("fallback")),
          message: String(note?.message || ""),
          createdAt: dataUtils.normalizeDate(note?.createdAt)
        }))
      }
    };
  }

  function getSelectedPerson() {
    if (!state.selectedKey.startsWith("person:")) return null;
    const id = state.selectedKey.slice("person:".length);
    return state.data.people.find((person) => person.id === id) || null;
  }

  function getSelectedNotes() {
    const person = getSelectedPerson();
    return person ? person.notes : state.data.others.notes;
  }

  function totalNotes() {
    return state.data.people.reduce((total, person) => total + person.notes.length, 0);
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
    elements.fallbackCount.textContent = String(state.data.others.notes.length);
    elements.othersListCount.textContent = String(state.data.others.notes.length);
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
      count.textContent = String(person.notes.length);
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
    const person = getSelectedPerson();
    elements.notesEditor.replaceChildren();

    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "empty-notes";
      empty.textContent = "这里还没有小纸条，点击“添加一张”开始。";
      elements.notesEditor.append(empty);
      return;
    }

    notes.forEach((note, index) => {
      const article = document.createElement("article");
      article.className = "note-editor";
      article.dataset.noteId = note.id;

      const toolbar = document.createElement("div");
      toolbar.className = "note-toolbar";
      const number = document.createElement("span");
      number.className = "note-number";
      number.textContent = `小纸条 ${String(index + 1).padStart(2, "0")}`;

      const actions = document.createElement("div");
      actions.className = "note-actions";
      actions.append(
        makeActionButton("↑", "up", note.id, index === 0),
        makeActionButton("↓", "down", note.id, index === notes.length - 1),
        makeActionButton("删除", "delete", note.id, false, "is-delete")
      );
      toolbar.append(number, actions);

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

      const timeLabel = document.createElement("label");
      timeLabel.className = "note-time-field";
      const timeCaption = document.createElement("span");
      timeCaption.textContent = "提交时间";
      const timeInput = document.createElement("input");
      timeInput.type = "datetime-local";
      timeInput.value = dataUtils.toDateTimeLocal(note.createdAt);
      timeInput.dataset.noteId = note.id;
      timeLabel.append(timeCaption, timeInput);
      meta.append(count, timeLabel);

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

    if (person === null) {
      // 普通祝福同样允许排序和删除，这里不额外插入状态说明。
    }
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
    elements.personNameInput.value = isOthers ? "" : person.name;
    elements.personAliasesInput.value = isOthers ? "" : person.aliases.join(", ");
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
  }

  function selectKey(key) {
    state.selectedKey = key;
    renderAll();
  }

  function addPerson() {
    const person = createPerson();
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
    if (!window.confirm(`删除“${person.name.trim() || "未命名"}”以及其中的 ${person.notes.length} 张小纸条？`)) {
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
    const notes = getSelectedNotes();
    notes.push(createNote(getSelectedPerson() ? "note" : "fallback"));
    renderAll();
    updateDirtyState("已添加一张小纸条。");
    requestAnimationFrame(() => {
      const inputs = elements.notesEditor.querySelectorAll("textarea");
      inputs[inputs.length - 1]?.focus();
    });
  }

  function moveNote(noteId, direction) {
    const notes = getSelectedNotes();
    const index = notes.findIndex((note) => note.id === noteId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= notes.length) return;
    [notes[index], notes[nextIndex]] = [notes[nextIndex], notes[index]];
    renderAll();
    updateDirtyState("已调整纸条顺序。");
  }

  function deleteNote(noteId) {
    const notes = getSelectedNotes();
    const index = notes.findIndex((note) => note.id === noteId);
    if (index < 0) return;
    if (!window.confirm("删除这张小纸条？")) return;
    notes.splice(index, 1);
    renderAll();
    updateDirtyState("已删除一张小纸条。");
  }

  function validateData() {
    const errors = [];
    const identityOwners = new Map();

    if (!state.data.people.length) {
      errors.push("至少添加一个名字。");
    }

    state.data.people.forEach((person, personIndex) => {
      const name = person.name.trim();
      if (!name) {
        errors.push(`第 ${personIndex + 1} 个名字还没有填写称呼。`);
      }
      const identities = [name, ...person.aliases];
      identities.forEach((identity) => {
        const key = dataUtils.normalizeName(identity);
        if (!key) return;
        const owner = identityOwners.get(key);
        if (owner !== undefined && owner !== personIndex) {
          errors.push(`名字或别名“${identity}”和其他人重复了。`);
        } else {
          identityOwners.set(key, personIndex);
        }
      });
      if (!person.notes.length) {
        errors.push(`“${name || "未命名"}”还没有小纸条。`);
      }
      person.notes.forEach((note, noteIndex) => {
        if (!note.message.trim()) {
          errors.push(`“${name || "未命名"}”的第 ${noteIndex + 1} 张小纸条是空的。`);
        }
      });
    });

    if (!state.data.others.notes.length) {
      errors.push("至少保留一张普通祝福。");
    }
    state.data.others.notes.forEach((note, index) => {
      if (!note.message.trim()) {
        errors.push(`第 ${index + 1} 张普通祝福是空的。`);
      }
    });

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

    return {
      version: 1,
      people: state.data.people.map((person) => ({
        id: person.id,
        name: person.name.trim(),
        aliases: uniqueAliases(person.aliases)
          .filter((alias) => dataUtils.normalizeName(alias) !== dataUtils.normalizeName(person.name)),
        notes: person.notes.map((note) => ({
          id: note.id,
          message: note.message.trim(),
          createdAt: dataUtils.normalizeDate(note.createdAt)
        }))
      })),
      others: {
        notes: state.data.others.notes.map((note) => ({
          id: note.id,
          message: note.message.trim(),
          createdAt: dataUtils.normalizeDate(note.createdAt)
        }))
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
      if (!state.data.others.notes.length) {
        state.data.others.notes = [createNote("fallback")];
      }
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

    const [owner, repo] = elements.repoInput.value.trim().split("/");
    const branch = elements.branchInput.value.trim() || "main";
    const path = elements.pathInput.value.trim().replace(/^\/+/, "") || "notes.json";
    const token = elements.tokenInput.value.trim();

    if (!owner || !repo || !token) {
      setPublishStatus("请填写 owner/repository、分支和令牌。");
      return;
    }

    state.publishing = true;
    elements.publishButton.disabled = true;
    elements.publishButton.textContent = "正在发布…";
    setPublishStatus("正在连接 GitHub…");

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
    } finally {
      state.publishing = false;
      elements.publishButton.disabled = false;
      elements.publishButton.textContent = "发布当前数据";
    }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!draft?.data) return;
      state.data = asEditableData(draft.data);
      if (!state.data.others.notes.length) {
        state.data.others.notes = [createNote("fallback")];
      }
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
    elements.deletePersonButton.addEventListener("click", deletePerson);

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
