// ═══════════════════════════════════════════════════════════════════
//  bingo.js  –  Phase 1: Lobby & User Presence
//  Uses Firebase v10 ESM (CDN).
// ═══════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── 1. Firebase config ────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCKbHyMpd5Um3Zpo8BoODQ1_yYpB9EneE0",
  authDomain: "buurtpreventie-b74ad.firebaseapp.com",
  projectId: "buurtpreventie-b74ad",
  storageBucket: "buurtpreventie-b74ad.firebasestorage.app",
  messagingSenderId: "374517472678",
  appId: "1:374517472678:web:8d1b6ecf2c2699769ec367"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── 2. DOM references ────────────────────────────────────────────
const authScreen     = document.getElementById("auth-screen");
const lobbyScreen    = document.getElementById("lobby-screen");

// Auth
const tabLogin       = document.getElementById("tab-login");
const tabRegister    = document.getElementById("tab-register");
const panelLogin     = document.getElementById("panel-login");
const panelRegister  = document.getElementById("panel-register");
const loginEmail     = document.getElementById("login-email");
const loginPassword  = document.getElementById("login-password");
const btnLogin       = document.getElementById("btn-login");
const regUsername    = document.getElementById("reg-username");
const regEmail       = document.getElementById("reg-email");
const regPassword    = document.getElementById("reg-password");
const btnRegister    = document.getElementById("btn-register");
const authError      = document.getElementById("auth-error");

// Lobby
const headerUsername = document.getElementById("header-username");
const btnLogout      = document.getElementById("btn-logout");
const playerList     = document.getElementById("player-list");
const playerCount    = document.getElementById("player-count");
const optOutCheck    = document.getElementById("opt-out-check");
const optOutStatus   = document.getElementById("opt-out-status");
const footerYear     = document.getElementById("footer-year");
const startSection   = document.getElementById("start-section");
const btnReady       = document.getElementById("btn-ready");
const readyStatus    = document.getElementById("ready-status");
const countdownEl    = document.getElementById("countdown");

// ─── 3. State ─────────────────────────────────────────────────────
let unsubscribePlayers = null;
let countdownInterval  = null;

// ─── 4. Helpers ───────────────────────────────────────────────────
function showScreen(name) {
  authScreen.classList.toggle("hidden", name !== "auth");
  lobbyScreen.classList.toggle("hidden", name !== "lobby");
}

function setAuthError(msg) {
  authError.textContent = msg;
}

function friendlyError(code) {
  const map = {
    "auth/user-not-found":       "Geen account gevonden met dit e-mailadres.",
    "auth/wrong-password":       "Onjuist wachtwoord. Probeer het opnieuw.",
    "auth/email-already-in-use": "Dit e-mailadres is al in gebruik.",
    "auth/weak-password":        "Kies een wachtwoord van minimaal 6 tekens.",
    "auth/invalid-email":        "Vul een geldig e-mailadres in.",
    "auth/too-many-requests":    "Te veel pogingen. Wacht even en probeer opnieuw.",
    "auth/invalid-credential":   "E-mailadres of wachtwoord klopt niet.",
  };
  return map[code] ?? "Er ging iets mis. Probeer het opnieuw.";
}

function updateCountBadge(n) {
  playerCount.textContent = n === 1 ? "1 speler" : `${n} spelers`;
}

// ─── 5. Player list rendering ─────────────────────────────────────
function buildPlayerItem(id, data, uid) {
  const li = document.createElement("li");
  li.className = "player-item";
  li.dataset.id = id;
  if (id === uid) li.classList.add("player-item--me");

  // Name — bold via CSS on player-item--me, normal for others
  const nameSpan = document.createElement("span");
  nameSpan.className = "player-name";
  nameSpan.textContent = data.username ?? "Onbekend";
  li.appendChild(nameSpan);

  // Ready checkmark — visible when player clicked "Klaar om te spelen"
  if (data.readyForGame) {
    const check = document.createElement("span");
    check.className = "ready-check";
    check.title = "Klaar voor het spel";
    check.textContent = "✔";
    li.appendChild(check);
  }

  // Spinner badge — changed text to "Wil draaien"
  const badge = document.createElement("span");
  badge.className = data.canSpin ? "badge badge--spinner" : "badge badge--no-spinner";
  badge.textContent = data.canSpin ? "Wil draaien" : "Geen draaier";
  li.appendChild(badge);

  return li;
}

// ─── 6. Start / voting logic ──────────────────────────────────────

/** Pick a random spinner; logs to console for devs */
function pickRandomSpinner(docs) {
  const willing = docs.filter(d => d.data().canSpin === true);
  // If nobody wants to spin, pick from everyone (tough luck!)
  const pool    = willing.length > 0 ? willing : docs;
  const chosen  = pool[Math.floor(Math.random() * pool.length)];
  const name    = chosen.data().username ?? "Onbekend";

  if (willing.length === 0) {
    console.warn("⚠️ DEV — Niemand wil draaien. Willekeurige speler gekozen (pech!)");
  }
  console.log(`🎱 DEV — Gekozen draaier: "${name}" (uid: ${chosen.id})`);
  return { id: chosen.id, name };
}

function startCountdown(docs) {
  let seconds = 20;
  countdownEl.classList.remove("hidden");
  countdownEl.textContent = `Het spel begint over ${seconds} seconden…`;

  countdownInterval = setInterval(() => {
    seconds--;
    countdownEl.textContent = `Het spel begint over ${seconds} seconden…`;

    if (seconds <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownEl.textContent = "🎉 Het spel begint nu!";
      pickRandomSpinner(docs);
      // TODO Phase 2: navigate to game screen
    }
  }, 1000);
}

/**
 * Called on every snapshot update.
 * Shows the start button once >= 2 players are present,
 * tracks the 50% vote threshold, and triggers the countdown.
 */
function handleStartLogic(docs, uid) {
  const total      = docs.length;
  const readyCount = docs.filter(d => d.data().readyForGame === true).length;
  const needed     = Math.ceil(total / 2); // 50% rounded up

  // Hide start section when fewer than 2 players
  if (total < 2) {
    startSection.classList.add("hidden");
    // Cancel any running countdown if players drop below 2
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      countdownEl.textContent = "";
      countdownEl.classList.add("hidden");
    }
    return;
  }

  startSection.classList.remove("hidden");

  // Sync button state for current user
  const iAmReady = docs.find(d => d.id === uid)?.data().readyForGame === true;
  btnReady.textContent = iAmReady ? "✔ Ik ben klaar!" : "Klaar om te spelen!";
  btnReady.disabled    = iAmReady;
  btnReady.classList.toggle("btn-ready--active", iAmReady);

  // Show vote progress
  readyStatus.textContent = `${readyCount} van ${total} spelers klaar (${needed} nodig)`;

  // Start countdown when threshold reached and no countdown running yet
  if (readyCount >= needed && countdownInterval === null) {
    startCountdown(docs);
  }

  // Cancel countdown if votes drop below threshold (e.g. player left)
  if (readyCount < needed && countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
    countdownEl.textContent = "";
    countdownEl.classList.add("hidden");
  }
}

// ─── 7. Firestore helpers ─────────────────────────────────────────
const playerRef = (uid) => doc(db, "bingo_players", uid);

async function ensurePlayerDoc(uid, username) {
  const ref  = playerRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      username:     username,
      canSpin:      true,
      readyForGame: false,
      lastSeen:     serverTimestamp(),
    });
  } else {
    // Reset readyForGame on every login so a fresh vote is needed each session
    await updateDoc(ref, {
      lastSeen:     serverTimestamp(),
      readyForGame: false,
    });
  }
}

async function updateCanSpin(uid, checkboxChecked) {
  const canSpin = !checkboxChecked;
  try {
    await updateDoc(playerRef(uid), { canSpin, lastSeen: serverTimestamp() });
    optOutStatus.textContent = checkboxChecked
      ? "✔ Opgeslagen: u staat niet op de draailijst."
      : "✔ Opgeslagen: u wilt draaien!";
  } catch (err) {
    console.error("canSpin update failed:", err);
    optOutStatus.textContent = "⚠ Opslaan mislukt. Controleer uw verbinding.";
  }
  setTimeout(() => { optOutStatus.textContent = ""; }, 3000);
}

async function setReadyForGame(uid) {
  try {
    await updateDoc(playerRef(uid), {
      readyForGame: true,
      lastSeen:     serverTimestamp(),
    });
  } catch (err) {
    console.error("readyForGame update failed:", err);
  }
}

// ─── 8. Player listener ───────────────────────────────────────────
function startPlayerListener(uid) {
  return onSnapshot(
    collection(db, "bingo_players"),
    (snapshot) => {
      playerList.innerHTML = "";

      if (snapshot.empty) {
        const li = document.createElement("li");
        li.className = "player-placeholder";
        li.textContent = "Nog niemand aanwezig…";
        playerList.appendChild(li);
        updateCountBadge(0);
        startSection.classList.add("hidden");
        return;
      }

      updateCountBadge(snapshot.size);

      // Sort: current user first, then alphabetically
      const sorted = snapshot.docs.sort((a, b) => {
        if (a.id === uid) return -1;
        if (b.id === uid) return 1;
        return (a.data().username ?? "").localeCompare(b.data().username ?? "", "nl");
      });

      sorted.forEach(docSnap =>
        playerList.appendChild(buildPlayerItem(docSnap.id, docSnap.data(), uid))
      );

      // Sync opt-out checkbox to Firestore state
      const myData = snapshot.docs.find(d => d.id === uid)?.data();
      if (myData !== undefined) {
        optOutCheck.checked = !myData.canSpin;
      }

      // Handle ready/start voting
      handleStartLogic(snapshot.docs, uid);
    },
    (err) => {
      console.error("Foutcode:", err.code);
      console.error("Foutmelding:", err.message);
      playerList.innerHTML = `<li class="player-placeholder">⚠ Kan lijst niet laden.</li>`;
    }
  );
}

// ─── 9. Auth state observer ───────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  console.log("Auth user:", user ? user.uid : "NIET INGELOGD");

  if (unsubscribePlayers) { unsubscribePlayers(); unsubscribePlayers = null; }
  if (countdownInterval)  { clearInterval(countdownInterval); countdownInterval = null; }

  if (!user) {
    showScreen("auth");
    return;
  }

  await user.getIdToken(true);

  try {
    const snap       = await getDoc(playerRef(user.uid));
    const storedName = snap.exists() ? snap.data().username : user.email;

    headerUsername.textContent = storedName;
    await ensurePlayerDoc(user.uid, storedName);
  } catch (err) {
    console.error("Failed to load player doc:", err);
    headerUsername.textContent = user.email;
  }

  showScreen("lobby");
  unsubscribePlayers = startPlayerListener(user.uid);

  optOutCheck.onchange = () => updateCanSpin(user.uid, optOutCheck.checked);
  btnReady.onclick     = () => setReadyForGame(user.uid);
});

// ─── 10. Auth UI – tabs ───────────────────────────────────────────
tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active");
  tabLogin.setAttribute("aria-selected", "true");
  tabRegister.classList.remove("active");
  tabRegister.setAttribute("aria-selected", "false");
  panelLogin.classList.remove("hidden");
  panelRegister.classList.add("hidden");
  setAuthError("");
});

tabRegister.addEventListener("click", () => {
  tabRegister.classList.add("active");
  tabRegister.setAttribute("aria-selected", "true");
  tabLogin.classList.remove("active");
  tabLogin.setAttribute("aria-selected", "false");
  panelRegister.classList.remove("hidden");
  panelLogin.classList.add("hidden");
  setAuthError("");
});

// ─── 11. Login ────────────────────────────────────────────────────
btnLogin.addEventListener("click", async () => {
  setAuthError("");
  const email    = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    setAuthError("Vul uw e-mailadres en wachtwoord in.");
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Bezig…";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    setAuthError(friendlyError(err.code));
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Inloggen";
  }
});

// ─── 12. Register ─────────────────────────────────────────────────
btnRegister.addEventListener("click", async () => {
  setAuthError("");
  const username = regUsername.value.trim();
  const email    = regEmail.value.trim();
  const password = regPassword.value;

  if (!username) { setAuthError("Vul uw naam in."); return; }
  if (!email)    { setAuthError("Vul een e-mailadres in."); return; }
  if (!password) { setAuthError("Kies een wachtwoord."); return; }

  btnRegister.disabled = true;
  btnRegister.textContent = "Bezig…";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(playerRef(cred.user.uid), {
      username:     username,
      canSpin:      true,
      readyForGame: false,
      lastSeen:     serverTimestamp(),
    });
  } catch (err) {
    setAuthError(friendlyError(err.code));
  } finally {
    btnRegister.disabled = false;
    btnRegister.textContent = "Account aanmaken";
  }
});

// ─── 13. Logout ───────────────────────────────────────────────────
btnLogout.addEventListener("click", async () => {
  if (unsubscribePlayers) { unsubscribePlayers(); unsubscribePlayers = null; }
  if (countdownInterval)  { clearInterval(countdownInterval); countdownInterval = null; }
  await signOut(auth);
});

// ─── 14. Misc ─────────────────────────────────────────────────────
footerYear.textContent = new Date().getFullYear();

[loginPassword, loginEmail].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") btnLogin.click(); })
);
[regPassword, regEmail, regUsername].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key === "Enter") btnRegister.click(); })
);
