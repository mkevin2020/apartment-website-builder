"use client";

import { useEffect } from "react";

/**
 * Broadcast channel name for cross-tab logout. When one tab signs out, every
 * other open tab must leave too — otherwise a second tab keeps showing a portal
 * whose session no longer exists, and the user believes they are still signed in.
 */
const LOGOUT_CHANNEL = "cielo-vista-auth";
const LOGOUT_EVENT = "logged-out";

/**
 * Tear down everything this browser is holding on behalf of the user.
 *
 * The cookie is what authorises requests, and clearing it server-side is the
 * part that actually matters. But this is a PWA: the service worker caches
 * every navigation it sees, including authenticated portal pages, and those
 * cached responses survive logout. On a shared phone the next person could
 * press Back and be served a cached dashboard shell from Cache Storage.
 *
 * So logout now clears, in order:
 *   1. the server-side session (revokes the token by its jti — a stolen copy
 *      stops working, not just this browser's copy)
 *   2. the localStorage UI mirror
 *   3. Cache Storage — every cache this origin owns
 *   4. IndexedDB, where anything cached by a library would live
 *   5. other tabs, via BroadcastChannel
 */
export async function logout(redirectTo = "/login") {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Even if the network call fails, still clear local state and leave.
  }

  localStorage.removeItem("admin_session");
  localStorage.removeItem("manager_session");
  localStorage.removeItem("employee_session");
  localStorage.removeItem("tenant_session");

  await clearBrowserStorage();

  // Tell the other tabs before navigating away.
  try {
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    channel.postMessage(LOGOUT_EVENT);
    channel.close();
  } catch {
    // BroadcastChannel is unsupported on some older Safari builds; the
    // storage-event fallback in SessionGuard covers those.
  }

  window.location.replace(redirectTo);
}

/** Empty Cache Storage and IndexedDB for this origin. Best-effort throughout. */
async function clearBrowserStorage() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* nothing we can do; never block logout on it */
  }

  try {
    // `databases()` is unsupported on Firefox and older Safari, so this is a
    // best-effort sweep rather than a guarantee.
    const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
    if (typeof idb.databases === "function") {
      const dbs = await idb.databases();
      await Promise.all(
        dbs.map((db) => (db.name ? indexedDB.deleteDatabase(db.name) : undefined)),
      );
    }
  } catch {
    /* best effort */
  }
}

// Mounted on protected pages (dashboards/portals). Redirects to the login page
// when the session is missing or no longer valid — including when the page is
// restored from the browser's back/forward cache (bfcache), where React effects
// do NOT re-run and a normal mount check would be skipped. This closes the hole
// where pressing the browser Forward button showed a portal after logging out.
//
// The authoritative check is the /api/auth/me call, which verifies the signed
// cookie on the server. The localStorage check in front of it is only a fast
// path that avoids a request when the user is obviously signed out — it is not
// trusted on its own, because anyone can write a localStorage key.
export function SessionGuard({
  sessionKey,
  redirectTo = "/login",
}: {
  sessionKey: string;
  redirectTo?: string;
}) {
  useEffect(() => {
    let cancelled = false;

    const leave = () => {
      // location.replace (not router.push) so the dead page doesn't stay in
      // history and bfcache-restored pages navigate away reliably.
      window.location.replace(redirectTo);
    };

    const check = async () => {
      if (!localStorage.getItem(sessionKey)) {
        leave();
        return;
      }
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!cancelled && !res.ok) {
          localStorage.removeItem(sessionKey);
          void clearBrowserStorage();
          leave();
        }
      } catch {
        // Offline or transient failure — don't sign the user out over it.
      }
    };

    void check();

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check();
    };

    // Cross-tab logout, primary path.
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(LOGOUT_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data === LOGOUT_EVENT) leave();
      };
    } catch {
      channel = null;
    }

    // Fallback for browsers without BroadcastChannel: localStorage writes fire
    // a `storage` event in the OTHER tabs, so a cleared session key is a signal.
    const onStorage = (e: StorageEvent) => {
      if (e.key === sessionKey && e.newValue === null) leave();
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [sessionKey, redirectTo]);

  return null;
}

// NOTE: an earlier version also auto-cleared sessions whenever a login page
// was shown ("LogoutOnLoginPage"). That logged people out just for navigating
// past a login page, so it was removed — logging out now happens ONLY via the
// Logout button. SessionGuard above still blocks the back/forward cache from
// showing a portal after a real logout.
