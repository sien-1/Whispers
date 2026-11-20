(function () {
  const TIME_ZONE = "Asia/Shanghai";

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("zh-CN");
  }

  function normalizeAnswer(value) {
    return normalizeName(value).replace(/[\s\p{P}\p{S}]+/gu, "");
  }

  async function hashAnswer(value) {
    const normalized = normalizeAnswer(value);
    if (!normalized) return "";
    if (!window.crypto?.subtle) {
      throw new Error("当前浏览器不支持安全摘要，请使用 HTTPS 或 localhost 打开发布端。");
    }
    const bytes = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function makeId(prefix) {
    if (window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  function normalizeNote(note, index, prefix) {
    if (typeof note === "string") {
      return {
        id: makeId(`${prefix}-${index + 1}`),
        message: note,
        createdAt: new Date().toISOString()
      };
    }

    return {
      id: String(note?.id || makeId(`${prefix}-${index + 1}`)),
      message: String(note?.message || "").trim(),
      createdAt: normalizeDate(note?.createdAt)
    };
  }

  function normalizeScreening(screening) {
    const question = String(screening?.question || "").trim();
    const answerHashes = (Array.isArray(screening?.answerHashes) ? screening.answerHashes : [])
      .map((hash) => String(hash).trim().toLowerCase())
      .filter((hash) => /^[a-f0-9]{64}$/.test(hash));
    return question && answerHashes.length
      ? { question, answerHashes: Array.from(new Set(answerHashes)) }
      : null;
  }

  function normalizeData(raw) {
    let peopleSource = Array.isArray(raw?.people) ? raw.people : null;
    const noteLibraryById = new Map();

    function addLibraryNote(note, index, prefix) {
      const normalized = normalizeNote(note, index, prefix);
      if (!normalized.message) return "";
      if (!noteLibraryById.has(normalized.id)) {
        noteLibraryById.set(normalized.id, normalized);
      }
      return normalized.id;
    }

    if (!peopleSource && Array.isArray(raw?.notes) && raw.notes.some((entry) => entry?.name)) {
      const grouped = new Map();
      raw.notes.forEach((entry) => {
        const name = String(entry?.name || "").trim();
        if (!name) return;
        const key = normalizeName(name);
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: makeId("person"),
            name,
            aliases: [],
            noteIds: []
          });
        }
        const person = grouped.get(key);
        const messages = Array.isArray(entry?.messages)
          ? entry.messages
          : [entry?.message].filter(Boolean);
        messages.forEach((message, index) => {
          const noteId = addLibraryNote(message, index, "note");
          if (noteId) person.noteIds.push(noteId);
        });
      });
      peopleSource = Array.from(grouped.values());
    }

    if (Array.isArray(raw?.noteLibrary)) {
      raw.noteLibrary.forEach((note, index) => {
        addLibraryNote(note, index, "library");
      });
    }

    const people = (peopleSource || []).map((person, index) => {
      const noteIds = [];
      if (Array.isArray(person?.noteIds)) {
        person.noteIds.forEach((noteId) => {
          const id = String(noteId || "").trim();
          if (id && noteLibraryById.has(id)) noteIds.push(id);
        });
      }
      if (Array.isArray(person?.notes)) {
        person.notes.forEach((note, noteIndex) => {
          const noteId = addLibraryNote(note, noteIndex, "note");
          if (noteId) noteIds.push(noteId);
        });
      }

      return {
        id: String(person?.id || makeId(`person-${index + 1}`)),
        name: String(person?.name || "").trim(),
        aliases: Array.isArray(person?.aliases)
          ? person.aliases.map((alias) => String(alias).trim()).filter(Boolean)
          : [],
        screening: normalizeScreening(person?.screening),
        noteIds: Array.from(new Set(noteIds))
      };
    }).filter((person) => person.name && person.noteIds.length);

    const otherNoteIds = [];
    if (Array.isArray(raw?.others?.noteIds)) {
      raw.others.noteIds.forEach((noteId) => {
        const id = String(noteId || "").trim();
        if (id && noteLibraryById.has(id)) otherNoteIds.push(id);
      });
    }
    if (Array.isArray(raw?.others?.notes)) {
      raw.others.notes.forEach((note, index) => {
        const noteId = addLibraryNote(note, index, "fallback");
        if (noteId) otherNoteIds.push(noteId);
      });
    } else if (Array.isArray(raw?.others)) {
      raw.others.forEach((note, index) => {
        const noteId = addLibraryNote(note, index, "fallback");
        if (noteId) otherNoteIds.push(noteId);
      });
    } else if (Array.isArray(raw?.fallbackMessages)) {
      raw.fallbackMessages.forEach((note, index) => {
        const noteId = addLibraryNote(note, index, "fallback");
        if (noteId) otherNoteIds.push(noteId);
      });
    }

    const noteLibrary = Array.from(noteLibraryById.values());
    const libraryIds = new Set(noteLibrary.map((note) => note.id));

    return {
      version: 2,
      noteLibrary,
      people,
      others: {
        noteIds: Array.from(new Set(otherNoteIds)).filter((id) => libraryIds.has(id))
      }
    };
  }

  function formatTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

    return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
  }

  function toDateTimeLocal(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function fromDateTimeLocal(value) {
    if (!value) return new Date().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  window.WhisperData = {
    TIME_ZONE,
    normalizeName,
    normalizeAnswer,
    hashAnswer,
    makeId,
    normalizeDate,
    normalizeNote,
    normalizeScreening,
    normalizeData,
    formatTimestamp,
    toDateTimeLocal,
    fromDateTimeLocal
  };
})();
