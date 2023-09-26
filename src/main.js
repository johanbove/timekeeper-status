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

/**
 * Outputs the status
 **/
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
}

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
  _entries.forEach((entry) => {
    const _entry = entry.split(/\t/);
    const _date = new Date(parseInt(_entry[0], 10));
    const node = document.createElement("li");
    const dateNode = document.createElement("div");
    dateNode.classList.add("entry-date");
    const textNode = document.createElement("div");
    textNode.classList.add("entry-content");
    dateNode.innerText = new Intl.DateTimeFormat("en-gb", {
      dateStyle: "full",
      timeStyle: "medium",
    }).format(_date);
    textNode.innerText = _entry[1];
    node.appendChild(dateNode);
    node.appendChild(textNode);
    if (journalEl) {
      journalEl.appendChild(node);
    }
  });
};

/**
 * Requests and stores the address of the share and server to sync with
 * @param {*} opts 
 * @returns 
 */
const getSettings = (opts) => {
  const { author } = opts;

  let shareAddress;
  let server;
  /**
  * Allows for storing settings in browser
  */
  const settings = new Earthstar.SharedSettings();

  // Not really used right now as we don't allow edits
  settings.author = { address: author, secret: "" };

  if (!settings.shares.length || !settings.servers.length) {
    if (!settings.shares.length) {
      shareAddress = window.prompt("Welcome!\nWhat is the share address?");
      if (shareAddress?.length) {
        settings.addShare(shareAddress);
      }
      location.reload();
    }
    if (!settings.servers.length) {
      server = window.prompt("What is the server to sync with?");
      if (server?.length) {
        settings.addServer(server);
      }
      location.reload();
    }
  }

  return { share: settings.shares[0], server: settings.servers[0] }
}

/**
 * aka main
 */
const app = () => {

  /**
   * The user to read the status from.
   * Not a secret!
   */
  const AUTHOR = "@joe1.b3nemplqj3wowds7vqeu5nnrf6yv6co3bnncv64peywoyvv7lpw3a";
  const statusPath = `/about/1.0/~${AUTHOR}/status`;

  const { share, server } = getSettings({ author: AUTHOR });

  const THESHARE = share;
  const THESERVER = server;

  const initReplica = () => {
    console.log('init a replica', THESHARE)
    /**
     * Creates the replica, which stores the documents and allows us to query them
     **/
    return new Earthstar.Replica({
      driver: new Earthstar.ReplicaDriverWeb(THESHARE),
      // shareSecret, // Not given as this is READONLY!
    });
  }

  let replica = initReplica();

  /**
   * Gets the "status" doc from the replica
   */
  const getStatusDoc = async (replica) => {
    const replicaStatus = await replica.getLatestDocAtPath(statusPath);
    if (replicaStatus) {
      renderStatus(replicaStatus?.text);
    }
  };

  const rtStatus = async (cache) => {
    const cacheStatus = await cache.getLatestDocAtPath(statusPath);
    if (cacheStatus) {
      renderStatus(cacheStatus?.text);
    }
  };

  const initCache = (replica) => {
    // Load the data from the replica and write to the doc
    // The cache allows us to listen to updates to the replica, adding the reactivity aspects we need
    const cache = new Earthstar.ReplicaCache(replica);
    // Whenever the replica is updated, this gets called and we update the log
    cache.onCacheUpdated(async () => {
      console.log('cache.onCacheUpdated');
      await rtStatus();
    });
  }

  initCache(replica);

  const initPeerSyncer = (replica) => {
    const LIVE = true;
    /**
     * Syncs with a remote replica so that we can get updates from other internet-enabled replicas
      **/
    const peer = new Earthstar.Peer();
    peer.addReplica(replica);

    // console.log('peer', peer);
    // The 'live' argument keeps a persistent connection that will update the replica
    //  whenever changes are detected from the remote replica
    return peer.sync(THESERVER, LIVE);
  }

  const checkSyncerPartner = async (syncer) => {
    const partner = syncer.partner;
    console.log('partner.isSecure', partner.isSecure);
  }

  const syncerOnStatusChange = (syncer) => {
    console.log('syncerOnStatusChange', syncer);
    checkSyncerPartner(syncer);

    syncer.onStatusChange(async (newStatus) => {
      dataError(false);
      console.log('syncer.onStatusChange', newStatus);
  
      let allRequestedDocs = 0;
      let allReceivedDocs = 0;
      let allSentDocs = 0;
      let transfersInProgress = 0;

      try {
        for (const share in newStatus) {
          console.log('status update on share', share);
          const shareStatus = newStatus[share];
          allRequestedDocs += shareStatus.docs.requestedCount;
          allReceivedDocs += shareStatus.docs.receivedCount;
          allSentDocs += shareStatus.docs.sentCount;
          const docsStatus = shareStatus.docs.status;
          console.log('docsStatus', docsStatus);
  
          const transfersWaiting = shareStatus.attachments.filter((transfer) => {
            return transfer.status === "ready" || transfer.status === "in_progress";
          });
          transfersInProgress += transfersWaiting.length;
  
          if (docsStatus === 'aborted' && transfersInProgress === 0) {
            console.log('Websocket aborted?', 'transfersInProgress', transfersInProgress);
            await replica.close(false);
            console.log('closed replica?', replica.isClosed());
            // @TODO simply call init() again?
            replica = initReplica();
            syncer = initPeerSyncer(replica);
            syncerOnStatusChange(syncer);
          }
        }
        console.log(
          `Syncing ${Object.keys(newStatus).length
          } shares, got ${allReceivedDocs}/${allRequestedDocs}, sent ${allSentDocs}, ${transfersInProgress} attachment transfers in progress.`,
        );
        if (allReceivedDocs < allRequestedDocs) {
          dataLoading();
        } else {
          dataReady();
        }
        await getStatusDoc(replica);
        await renderJournal(replica);
      } catch (error) {
        dataReady();
        // @TODO Try to reconnect?
        if (error === "Websocket error") {
          console.log('Websocket error', 'should try to reconnect...');
        }
        dataError(true);
        console.error(error);
      }
    });
  }

  /**
   * Initial sync
   */
  const init = async () => {
    const syncer = initPeerSyncer(replica);

    syncerOnStatusChange(syncer);

    await getStatusDoc(replica);
    await renderJournal(replica);
    
    dataReady();
    
    // this only works with appetite "once"
    await syncer.isDone();
    console.log("SYNCED!");

    await replica.close(false);
  };

  init();

}

app();
