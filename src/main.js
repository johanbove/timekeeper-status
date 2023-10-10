// This works because our script is loaded as a module "type="module" defer async"
import * as Earthstar from "https://cdn.earthstar-project.org/js/earthstar.web.v10.2.2.js";

const dataLoading = () => {
  document.getElementById("data-ready")?.classList.add("is-hidden");
  document.getElementById("data-loading")?.classList.remove("is-hidden");
};

const dataReady = () => {
  document.getElementById("data-ready")?.classList.remove("is-hidden");
  document.getElementById("data-loading")?.classList.add("is-hidden");
};

const updateDataLoading = (current) => {
  const el = document.getElementById("data-loading");
  el.innerText = current;
};

/**
 * Outputs the status
 */
const renderStatus = (status) => {
  const statusEl = document.getElementById("status");
  if (!statusEl) {
    return;
  }
  statusEl.innerHTML = status;
};

const dataError = (show) => {
  if (show) {
    document.getElementById("data-error")?.classList.remove("is-hidden");
  } else {
    document.getElementById("data-error")?.classList.add("is-hidden");
  }
};

/**
 * 
 * @param {*} entries 
 */
const renderEntriesTable = (entries) => {
  if ("content" in document.createElement("template")) {

    // Instantiate the table with the existing HTML tbody
    // and the row with the template
    const tbody = document.querySelector("#entries tbody");
    const commentTemplate = document.querySelector("#timeentrycomment");
    const template = document.querySelector("#timekeeperentry");

    // reset 
    tbody.innerHTML = null;

    Object.keys(entries).forEach((key) => {
      const entry = entries[key];
      // Clone the new row and insert it into the table
      const clone = template.content.cloneNode(true);
      const td = clone.querySelectorAll("td");
      td[0].textContent = key;
      td[1].textContent = entry.duration.toFixed(2) + "h";

      const comments = entry.comments;

      td[2].innerHTML = null;

      comments.forEach((comment) => {
        const commentClone = commentTemplate.content.cloneNode(true);

        const timestampEl = commentClone.querySelector(".comment-timestamp");
        timestampEl.textContent = new Date(comment.timestamp).toLocaleString();
        timestampEl.setAttribute('datetime', comment.timestamp);
        commentClone.querySelector(".comment-label").textContent = comment.label;
        commentClone.querySelector(".comment-duration").textContent = comment.duration.toFixed(2) + 'h';

        td[2].appendChild(commentClone);
      });

      tbody.appendChild(clone);
    });

  } else {
    throw new Error('Template tag not supported in this browser');
  }

};

/**
 * Renders the journal to the HTML
 */
const renderJournal = async (replica) => {
  const LIMIT = -1000;

  const journalEl = document.getElementById("journal");
  const journalEntriesLengthEl = document.getElementById(
    "journalEntriesLength",
  );
  const journal = await replica.queryDocs({
    historyMode: "latest",
    filter: {
      // Take only the files for each month, not the individual entries
      // 202 ... 2023, 2024, ...
      pathStartsWith: "/timekeeper/1.0/journal/202",
    },
  });
  if (journalEl) {
    journalEl.innerHTML = "";
  }
  if (!journal) {
    return;
  }
  // Parse the text files
  const theJournalData = [];
  const fileEntries = [];
  for (const file of journal) {
    fileEntries.push(file.text.split(/\r?\n/).filter((element) => element));
  }
  fileEntries.forEach((entries) => {
    entries.forEach((entry) => {
      theJournalData.push(entry);
    });
  });
  // Show last x entries
  const _entries = theJournalData?.slice(LIMIT).reverse();
  if (journalEntriesLengthEl) {
    if (Math.abs(LIMIT) < theJournalData.length) {
      journalEntriesLengthEl.innerText = `${Math.abs(LIMIT)
        } of ${theJournalData.length} entries`;
    } else {
      journalEntriesLengthEl.innerText = `${theJournalData.length} entries`;
    }
  }
  /**
   * Creates the HTML elements and appends it to the journal
   * @param {Date} theDate
   * @param {String} theContent
   */
  const renderToHTML = (theDate, theContent) => {
    const node = document.createElement("li");
    const dateNode = document.createElement("time");
    dateNode.classList.add("entry-date");
    const textNode = document.createElement("div");
    textNode.classList.add("entry-content");
    dateNode.innerText = new Intl.DateTimeFormat("en-gb", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(theDate);
    textNode.innerText = theContent;
    node.appendChild(dateNode);
    node.appendChild(textNode);
    return node;
  };

  const entriesByDay = {};
  const entriesByMonth = {};

  let node;

  _entries.forEach((entry) => {
    const _entry = entry.split(/\t/);
    if (!_entry.length) {
      console.error("Unexpected invalid entry", entry);
      return;
    }
    // First part is the data
    const _date = new Date(parseInt(_entry[0], 10));
    // Second entry part is the actual message
    const _content = _entry[1] || "";

    const _theDay = _date.toISOString().split("T");
    const _theMonth = _date.getMonth() + 1;

    if (entriesByDay[_theDay[0]]) {
      entriesByDay[_theDay[0]].push({ date: _date, content: _content });
    } else {
      entriesByDay[_theDay[0]] = [{ date: _date, content: _content }];
    }

    if (entriesByMonth[_theMonth]) {
      entriesByMonth[_theMonth].push({ date: _date, content: _content });
    } else {
      entriesByMonth[_theMonth] = [{ date: _date, content: _content }];
    }
  });

  let lastKey;

  Object.keys(entriesByDay).forEach((key) => {
    const entries = entriesByDay[key];
    const count = entries.length;
    let sublist, label;
    if (key !== lastKey) {
      node = document.createElement("li");
      sublist = document.createElement("ul");
      label = document.createElement("h4");
      label.classList.add("subtitle", "is-4", "mt-2");
      const labelDate = new Date(key);
      const labelDateFormatOptions = {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      };
      node.classList.add(`month-${labelDate.getMonth() + 1}`);
      label.innerText = `${count} on ${new Intl.DateTimeFormat("en-gb", labelDateFormatOptions).format(
        labelDate,
      )
        }`;
      node.appendChild(label);
      lastKey = key;
    }
    entries.forEach((entry, index) => {
      const { date, content } = entry;
      const el = renderToHTML(date, content);
      sublist.appendChild(el);
    });
    node.appendChild(sublist);
    if (journalEl) {
      journalEl.appendChild(node);
    }
  });

  // Debug
  // console.log('entriesByDay', entriesByDay);
  // console.log('entriesByMonth', entriesByMonth);
};

/**
 * Shows the settings form
 */
const setup = () => {
  const formEl = document.getElementById("settings");
  const setupEl = document.getElementById("setupSection");
  const headerEl = document.getElementById("headerSection");
  const journalEl = document.getElementById("journalSection");
  const entriesEl = document.getElementById("entriesSection");
  const loadingEl = document.getElementById("data-loading");

  setupEl.classList.remove("is-hidden");
  loadingEl.classList.add("is-hidden");
  formEl.classList.remove("is-hidden");
  headerEl.classList.add("is-hidden");
  journalEl.classList.add("is-hidden");
  entriesEl.classList.add("is-hidden");

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();

    const result = saveSettings(formEl);

    if (result) {
      main();
    }
  });
};

/**
 *
 */
const saveSettings = (form) => {
  let author;
  let share;
  let server;

  /**
   * Allows for storing settings in browser
   */
  const settings = new Earthstar.SharedSettings();

  // Bind the FormData object and the form element
  const FD = new FormData(form);

  console.log("FD", FD);

  author = FD.get("author_address");
  share = FD.get("share_address");
  server = FD.get("sync_url");

  let error;

  if (Earthstar.isErr(Earthstar.checkAuthorIsValid(author))) {
    error = Earthstar.checkAuthorIsValid(author);
    window.alert(error);
    throw new Error(error);
  }

  if (Earthstar.isErr(Earthstar.checkShareIsValid(share))) {
    error = Earthstar.checkShareIsValid(share);
    window.alert(error);
    throw new Error(error);
  }

  if (!server || server.length < 5) {
    error = "Invalid server url";
    window.alert(error);
    throw new Error(error);
  }

  settings.addShare(share);
  settings.addServer(server);
  settings.author = { address: author, secret: "" };

  console.log("settings", settings);
  return true;
};

/**
   * Gets the "status" doc from the replica
   */
const getStatusDoc = async (replica, statusPath) => {
  const replicaStatus = await replica.getLatestDocAtPath(statusPath);
  if (replicaStatus) {
    renderStatus(replicaStatus?.text);
  }
};

const rtStatus = async (cache, statusPath) => {
  const cacheStatus = await cache.getLatestDocAtPath(statusPath);
  if (cacheStatus) {
    renderStatus(cacheStatus?.text);
  }
};

/**
 * Fetches the report as an attachment from the Earthstar DB
 * @param {*} replica
 * @param {*} year
 * @param {*} week
 * @returns
 */
const getReport = async (replica, year, week) => {
  const doc = await replica.getLatestDocAtPath(
    `/timekeeper/1.0/entries/reports/${year}/${week}/report.json`,
  );
  if (!doc || Earthstar.isErr(doc)) {
    //throw new Error('No report available!');
    console.error("No report available");
    return;
  }
  console.log("doc", doc);
  console.log("attachmentSize", doc.attachmentSize);
  const attachment = await replica.getAttachment(doc);
  const report = new TextDecoder().decode(await attachment.bytes());
  return JSON.parse(report);
};

/**
 * Basis for being able to display my timekeeper entries
 * @param {*} year
 * @param {*} week
 */
const renderReport = async (replica, year, week) => {
  const theReport = await getReport(replica, year, week);
  if (!theReport) {
    return;
  }
  console.log("theReport", theReport);
  const entriesyearweekEl = document.getElementById("entriesyearweek");
  entriesyearweekEl.innerText = `For week ${theReport.currentWeekId}`;

  renderEntriesTable(theReport.tagsPerDay);
};

/**
 * 
 * @param {*} replica 
 */
const initCache = (replica) => {
  // Load the data from the replica and write to the doc
  // The cache allows us to listen to updates to the replica, adding the reactivity aspects we need
  const cache = new Earthstar.ReplicaCache(replica);
  // Whenever the replica is updated, this gets called and we update the log
  cache.onCacheUpdated(async () => {
    console.log("cache.onCacheUpdated");
    await rtStatus(cache, statusPath);
  });
};

const initPeerSyncer = (replica, theserver) => {
  const LIVE = true;
  /**
   * Syncs with a remote replica so that we can get updates from other internet-enabled replicas
   */
  const peer = new Earthstar.Peer();
  peer.addReplica(replica);

  // console.log('peer', peer);
  // The 'live' argument keeps a persistent connection that will update the replica
  //  whenever changes are detected from the remote replica
  return peer.sync(theserver, LIVE);
};

const checkSyncerPartner = async (syncer) => {
  const partner = syncer.partner;
  console.log("partner.isSecure", partner.isSecure);
};

/**
 * 
 * @param {*} syncer 
 * @param {*} replica 
 */
const syncerOnStatusChange = (syncer, replica, params) => {
  const { weekNumber, year, statusPath, server, share } = params;
  console.log("syncerOnStatusChange", syncer);
  checkSyncerPartner(syncer);

  syncer.onStatusChange(async (newStatus) => {
    dataError(false);
    console.log("syncer.onStatusChange", newStatus);

    let allRequestedDocs = 0;
    let allReceivedDocs = 0;
    let allSentDocs = 0;
    let transfersInProgress = 0;
    let docsStatus;

    try {
      for (const share in newStatus) {
        console.log("status update on share", share);
        const shareStatus = newStatus[share];
        allRequestedDocs += shareStatus.docs.requestedCount;
        allReceivedDocs += shareStatus.docs.receivedCount;
        allSentDocs += shareStatus.docs.sentCount;
        docsStatus = shareStatus.docs.status;
        console.log("docsStatus", docsStatus);

        const transfersWaiting = shareStatus.attachments.filter(
          (transfer) => {
            return transfer.status === "ready" ||
              transfer.status === "in_progress";
          },
        );
        transfersInProgress += transfersWaiting.length;

        if (docsStatus === "aborted" && transfersInProgress === 0) {
          console.log(
            "Websocket aborted?",
            "transfersInProgress",
            transfersInProgress,
          );
          await replica.close(false);
          console.log("closed replica?", replica.isClosed());
          // @TODO simply call init() again?
          replica = initReplica(share);
          syncer = initPeerSyncer(replica, server);
          syncerOnStatusChange(syncer, replica, params);
        }
      }
      console.log(
        `Syncing ${Object.keys(newStatus).length
        } shares, got ${allReceivedDocs}/${allRequestedDocs}, sent ${allSentDocs}, ${transfersInProgress} attachment transfers in progress.`,
      );

      if (allReceivedDocs < allRequestedDocs) {
        let text = `Status: ${docsStatus} ${allRequestedDocs} docs...`;
        if (allReceivedDocs > 0 && docsStatus === "gossiping") {
          const percent = allReceivedDocs / allRequestedDocs * 100;
          text = `Syncing: ${percent.toFixed(1)}%...`;
        }
        updateDataLoading(text);
        dataLoading();
      } else {
        dataReady();
      }
      await getStatusDoc(replica, statusPath);
      await renderJournal(replica);
      renderReport(replica, year, weekNumber);
    } catch (error) {
      dataReady();
      // @TODO Try to reconnect?
      if (error === "Websocket error") {
        console.log("Websocket error", "should try to reconnect...");
      }
      dataError(true);
      console.error(error);
    }
  });
};

/**
 * 
 * @param {*} share 
 * @returns 
 */
const initReplica = (share) => {
  console.log("init a replica", share);
  /**
   * Creates the replica, which stores the documents and allows us to query them
   */
  return new Earthstar.Replica({
    driver: new Earthstar.ReplicaDriverWeb(share),
    // shareSecret, // Not given as this is READONLY!
  });
};

/**
 * 
 * @returns 
 */
const main = () => {
  const formEl = document.getElementById("settings");
  const setupEl = document.getElementById("setupSection");
  const headerEl = document.getElementById("headerSection");
  const journalEl = document.getElementById("journalSection");
  const entriesEl = document.getElementById("entriesSection");
  const loadingEl = document.getElementById("data-loading");

  const settings = new Earthstar.SharedSettings();

  let hasSettings = settings.shares.length && settings.servers.length &&
    settings.author;

  if (!hasSettings) {
    return setup();
  } else {
    setupEl.classList.add("is-hidden");
    loadingEl.classList.remove("is-hidden");
    formEl.classList.add("is-hidden");
    headerEl.classList.remove("is-hidden");
    journalEl.classList.remove("is-hidden");
    entriesEl.classList.remove("is-hidden");
  }

  const AUTHOR = settings.author.address;
  const SHARE_INDEX = 0;
  const SERVER_INDEX = 0;
  const statusPath = `/about/1.0/~${AUTHOR}/status`;

  const THESHARE = settings.shares[SHARE_INDEX];
  const THESERVER = settings.servers[SERVER_INDEX];

  let replica = initReplica(THESHARE);

  initCache(replica);

  /*
      Allows for creating reports for different weeks.
      Does not influence the "journal" yet.
      Might add a pagination system, or a filter at some point for the "journal" too.
  */
  const urlSearchParams = new URLSearchParams(window.location.search);

  const _year = urlSearchParams.get('year');
  const _week = urlSearchParams.get('week');

  const year = parseInt(_year, 10) || 2023;
  const week = parseInt(_week, 10) || 41;

  const params = { year, week, statusPath, share: THESHARE, server: THESERVER };

  /**
   * 
   * @param {*} replica 
   * @param {*} server 
   * @param {*} params
   */
  const init = async (replica, params) => {
    const { year, week, statusPath, server } = params;

    const syncer = initPeerSyncer(replica, server);

    syncerOnStatusChange(syncer, replica, params);

    await getStatusDoc(replica, statusPath);
    await renderJournal(replica);

    renderReport(replica, year, week);

    dataReady();

    // this only works with appetite "once"
    await syncer.isDone();
    console.log("SYNCED!");

    await replica.close(false);
  };

  init(replica, params);

};

main();
