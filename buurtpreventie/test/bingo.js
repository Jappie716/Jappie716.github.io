// ═══════════════════════════════════════════════════════════════════
//  bingo.js  –  Phase 1: Lobby & User Presence
//  Uses Firebase v10 ESM (CDN).
//  Replace the firebaseConfig object with your own project's config.
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
// TODO: Replace with your own Firebase project configuration.
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

// ─── 3. Helpers ───────────────────────────────────────────────────
let unsubscribePlayers = null; // cleanup handle for onSnapshot

/** Show/hide the two main screens */
function showScreen(name) {
  authScreen.classList.toggle("hidden", name !== "auth");
  lobbyScreen.classList.toggle("hidden", name !== "lobby");
}

/** Display an auth error message */
function setAuthError(msg) {
  authError.textContent = msg;
}

/** Friendly Dutch Firebase error messages */
function friendlyError(code) {
  const map = {
    "auth/user-not-found":        "Geen account gevonden met dit e-mailadres.",
    "auth/wrong-password":        "Onjuist wachtwoord. Probeer het opnieuw.",
    "auth/email-already-in-use":  "Dit e-mailadres is al in gebruik.",
    "auth/weak-password":         "Kies een wachtwoord van minimaal 6 tekens.",
    "auth/invalid-email":         "Vul een geldig e-mailadres in.",
    "auth/too-many-requests":     "Te veel pogingen. Wacht even en probeer opnieuw.",
    "auth/invalid-credential":    "E-mailadres of wachtwoord klopt niet.",
  };
  return map[code] ?? "Er ging iets mis. Probeer het opnieuw.";
}

/** Update the #player-count badge */
function updateCountBadge(n) {
  playerCount.textContent = n === 1 ? "1 speler" : `${n} spelers`;
}

/** Render a single player row inside #player-list */
function buildPlayerItem(id, data, currentUid) {
  const li = document.createElement("li");
  li.className = "player-item";
  li.dataset.id = id;
  if (id === currentUid) li.classList.add("player-item--me");

  const nameSpan = document.createElement("span");
  nameSpan.className = "player-name";
  nameSpan.textContent = data.username ?? "Onbekend";

  const badge = document.createElement("span");
  badge.className = data.canSpin ? "badge badge--spinner" : "badge badge--no-spinner";
  badge.textContent = data.canSpin ? "Kan draaien" : "Geen draaier";

  if (id === currentUid) {
    const meBadge = document.createElement("span");
    meBadge.className = "badge badge--me";
    meBadge.textContent = "U";
    li.append(nameSpan, meBadge, badge);
  } else {
    li.append(nameSpan, badge);
  }

  return li;
}

// ─── 4. Firestore helpers ─────────────────────────────────────────

/** Get a reference to the player's document */
const playerRef = (uid) => doc(db, "bingo_players", uid);

/**
 * Ensure the player document exists.
 * Creates it on first login; on subsequent logins only refreshes lastSeen.
 */
async function ensurePlayerDoc(uid, username) {
  const ref  = playerRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      username:  username,
      canSpin:   true,           // default: willing to spin
      lastSeen:  serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { lastSeen: serverTimestamp() });
  }
}

/**
 * Update the canSpin field for the current user.
 * Note: canSpin = true  → user IS willing to spin
 *       canSpin = false → user opted OUT ("geen draaier")
 * The checkbox reads "Ik wil GEEN draaier zijn", so:
 *   checked   → canSpin = false
 *   unchecked → canSpin = true
 */
async function updateCanSpin(uid, checkboxChecked) {
  const canSpin = !checkboxChecked;
  try {
    await updateDoc(playerRef(uid), { canSpin, lastSeen: serverTimestamp() });
    optOutStatus.textContent = checkboxChecked
      ? "✔ Opgeslagen: u staat niet op de draailijst."
      : "✔ Opgeslagen: u kunt draaien!";
  } catch (err) {
    console.error("canSpin update failed:", err);
    optOutStatus.textContent = "⚠ Opslaan mislukt. Controleer uw verbinding.";
  }
  // Clear status message after 3 s
  setTimeout(() => { optOutStatus.textContent = ""; }, 3000);
}

/**
 * Start a live Firestore listener on the 'bingo_players' collection.
 * Returns an unsubscribe function.
 */
function startPlayerListener(currentUid) {
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
        return;
      }

      updateCountBadge(snapshot.size);

      // Sort: current user first, then alphabetically
      const docs = snapshot.docs.sort((a, b) => {
        if (a.id === currentUid) return -1;
        if (b.id === currentUid) return 1;
        return (a.data().username ?? "").localeCompare(b.data().username ?? "", "nl");
      });

      docs.forEach((docSnap) => {
        playerList.appendChild(buildPlayerItem(docSnap.id, docSnap.data(), currentUid));
      });

      // Sync the checkbox to Firestore state for the current user
      const myData = snapshot.docs.find((d) => d.id === currentUid)?.data();
      if (myData !== undefined) {
        optOutCheck.checked = !myData.canSpin;
      }
    },
   (err) => {
      console.error("Foutcode:", err.code);
      console.error("Foutmelding:", err.message);
      playerList.innerHTML = `<li class="player-placeholder">⚠ Kan lijst niet laden.</li>`;
    }
  );
}

// ─── 5. Auth state observer ───────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  console.log("Auth user:", user ? user.uid : "NIET INGELOGD");
  // Clean up any previous listener
  if (unsubscribePlayers) {
    unsubscribePlayers();
    unsubscribePlayers = null;
  }

  if (!user) {
    showScreen("auth");
    return;  // ← stopt hier, listener wordt NIET gestart
  }

  // Wacht tot het token écht actief is voordat we Firestore benaderen
  await user.getIdToken(true);
  // ── Logged in ──
  try {
    // Haal username op uit /users/{uid} (de centrale gebruikerscollectie)
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const storedName = userSnap.exists() ? userSnap.data().username : user.email;

    headerUsername.textContent = storedName;
    await ensurePlayerDoc(user.uid, storedName);
  } catch (err) {
    console.error("Failed to load player doc:", err);
    headerUsername.textContent = user.email;
  }

  showScreen("lobby");
  unsubscribePlayers = startPlayerListener(user.uid);

  // Opt-out checkbox listener
  optOutCheck.onchange = () => updateCanSpin(user.uid, optOutCheck.checked);
});

// ─── 6. Auth UI – tab switching ──────────────────────────────────
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

// ─── 7. Login ─────────────────────────────────────────────────────
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
    // onAuthStateChanged handles the rest
  } catch (err) {
    setAuthError(friendlyError(err.code));
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Inloggen";
  }
});

// ─── 8. Register ──────────────────────────────────────────────────
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
    // Schrijf het users-doc zodat de username beschikbaar is voor de hele app
    await setDoc(doc(db, "users", cred.user.uid), {
      username: username,
    });
    // bingo_players doc wordt aangemaakt door ensurePlayerDoc in onAuthStateChanged
  } catch (err) {
    setAuthError(friendlyError(err.code));
  } finally {
    btnRegister.disabled = false;
    btnRegister.textContent = "Account aanmaken";
  }
});

// ─── 9. Logout ────────────────────────────────────────────────────
btnLogout.addEventListener("click", async () => {
  if (unsubscribePlayers) { unsubscribePlayers(); unsubscribePlayers = null; }
  await signOut(auth);
});

// ─── 10. Misc ─────────────────────────────────────────────────────
footerYear.textContent = new Date().getFullYear();

// Allow pressing Enter in auth fields
[loginPassword, loginEmail].forEach((el) =>
  el.addEventListener("keydown", (e) => { if (e.key === "Enter") btnLogin.click(); })
);
[regPassword, regEmail, regUsername].forEach((el) =>
  el.addEventListener("keydown", (e) => { if (e.key === "Enter") btnRegister.click(); })
);
