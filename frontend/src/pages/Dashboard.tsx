import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "../lib/firebase";
import { apiFetch } from "../lib/api";
import "../styles/dashboard.css";

interface Watchlist {
  _id: string;
  name: string;
  stocks: {
    stockId: string;
    position: number;
    addedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

interface WatchlistsResponse {
  success: boolean;
  watchlists: Watchlist[];
}

interface CreateWatchlistResponse {
  success: boolean;
  message: string;
  watchlist: Watchlist;
}

interface RenameWatchlistResponse {
  success: boolean;
  message: string;
  watchlist: Watchlist;
}

interface DeleteWatchlistResponse {
  success: boolean;
  message: string;
  watchlistId: string;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(auth.currentUser);

  // =========================================================
  // WATCHLIST DATA
  // =========================================================

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [watchlistsLoading, setWatchlistsLoading] = useState(true);
  const [watchlistsError, setWatchlistsError] = useState("");

  // =========================================================
  // CREATE WATCHLIST
  // =========================================================

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [watchlistName, setWatchlistName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);

  // =========================================================
  // RENAME WATCHLIST
  // =========================================================

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameWatchlistTarget, setRenameWatchlistTarget] =
    useState<Watchlist | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renamingWatchlist, setRenamingWatchlist] = useState(false);

  // =========================================================
  // DELETE WATCHLIST
  // =========================================================

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteWatchlistTarget, setDeleteWatchlistTarget] =
    useState<Watchlist | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingWatchlist, setDeletingWatchlist] = useState(false);

  // =========================================================
  // AUTH STATE
  // =========================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  // =========================================================
  // LOAD WATCHLISTS
  // =========================================================

  useEffect(() => {
    if (!user) {
      setWatchlists([]);
      setWatchlistsLoading(false);
      return;
    }

    loadWatchlists();
  }, [user]);

  async function loadWatchlists() {
    try {
      setWatchlistsLoading(true);
      setWatchlistsError("");

      const response = (await apiFetch(
        "/watchlists"
      )) as WatchlistsResponse;

      setWatchlists(response.watchlists ?? []);
    } catch (error) {
      console.error("Failed to load watchlists:", error);

      setWatchlistsError(
        error instanceof Error
          ? error.message
          : "Unable to load your watchlists."
      );
    } finally {
      setWatchlistsLoading(false);
    }
  }

  // =========================================================
  // CREATE WATCHLIST
  // =========================================================

  function openCreateModal() {
    setWatchlistName("");
    setCreateError("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creatingWatchlist) {
      return;
    }

    setShowCreateModal(false);
    setWatchlistName("");
    setCreateError("");
  }

  async function handleCreateWatchlist(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedName = watchlistName.trim();

    // Frontend validation for better UX.
    // Backend validation remains the final authority.
    if (!trimmedName) {
      setCreateError("Please enter a watchlist name.");
      return;
    }

    if (trimmedName.length > 100) {
      setCreateError(
        "Watchlist name must be 100 characters or less."
      );
      return;
    }

    try {
      setCreatingWatchlist(true);
      setCreateError("");

      const response = (await apiFetch("/watchlists", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
        }),
      })) as CreateWatchlistResponse;

      if (!response.success || !response.watchlist) {
        throw new Error(
          response.message || "Failed to create watchlist."
        );
      }

      // Add the newly created watchlist immediately.
      setWatchlists((currentWatchlists) => [
        response.watchlist,
        ...currentWatchlists,
      ]);

      setShowCreateModal(false);
      setWatchlistName("");
      setCreateError("");
    } catch (error) {
      console.error("Failed to create watchlist:", error);

      setCreateError(
        error instanceof Error
          ? error.message
          : "Unable to create watchlist."
      );
    } finally {
      setCreatingWatchlist(false);
    }
  }

  // =========================================================
  // RENAME WATCHLIST
  // =========================================================

  function openRenameModal(watchlist: Watchlist) {
    setRenameWatchlistTarget(watchlist);
    setRenameName(watchlist.name);
    setRenameError("");
    setShowRenameModal(true);
  }

  function closeRenameModal() {
    if (renamingWatchlist) {
      return;
    }

    setShowRenameModal(false);
    setRenameWatchlistTarget(null);
    setRenameName("");
    setRenameError("");
  }

  async function handleRenameWatchlist(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!renameWatchlistTarget) {
      setRenameError("No watchlist selected.");
      return;
    }

    const trimmedName = renameName.trim();

    // Frontend validation for better UX.
    // Backend validation remains the final authority.
    if (!trimmedName) {
      setRenameError("Please enter a watchlist name.");
      return;
    }

    if (trimmedName.length > 100) {
      setRenameError(
        "Watchlist name must be 100 characters or less."
      );
      return;
    }

    // Avoid making an unnecessary API request.
    if (trimmedName === renameWatchlistTarget.name) {
      closeRenameModal();
      return;
    }

    try {
      setRenamingWatchlist(true);
      setRenameError("");

      const response = (await apiFetch(
        `/watchlists/${renameWatchlistTarget._id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedName,
          }),
        }
      )) as RenameWatchlistResponse;

      if (!response.success || !response.watchlist) {
        throw new Error(
          response.message || "Failed to rename watchlist."
        );
      }

      // Update only the renamed watchlist locally.
      setWatchlists((currentWatchlists) =>
        currentWatchlists.map((watchlist) =>
          watchlist._id === response.watchlist._id
            ? response.watchlist
            : watchlist
        )
      );

      setShowRenameModal(false);
      setRenameWatchlistTarget(null);
      setRenameName("");
      setRenameError("");
    } catch (error) {
      console.error("Failed to rename watchlist:", error);

      setRenameError(
        error instanceof Error
          ? error.message
          : "Unable to rename watchlist."
      );
    } finally {
      setRenamingWatchlist(false);
    }
  }

  // =========================================================
  // DELETE WATCHLIST
  // =========================================================

  function openDeleteModal(watchlist: Watchlist) {
    setDeleteWatchlistTarget(watchlist);
    setDeleteError("");
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deletingWatchlist) {
      return;
    }

    setShowDeleteModal(false);
    setDeleteWatchlistTarget(null);
    setDeleteError("");
  }

  async function handleDeleteWatchlist() {
    if (!deleteWatchlistTarget) {
      setDeleteError("No watchlist selected.");
      return;
    }

    try {
      setDeletingWatchlist(true);
      setDeleteError("");

      const response = (await apiFetch(
        `/watchlists/${deleteWatchlistTarget._id}`,
        {
          method: "DELETE",
        }
      )) as DeleteWatchlistResponse;

      if (!response.success) {
        throw new Error(
          response.message || "Failed to delete watchlist."
        );
      }

      // Remove the deleted watchlist from the current UI.
      setWatchlists((currentWatchlists) =>
        currentWatchlists.filter(
          (watchlist) =>
            watchlist._id !== deleteWatchlistTarget._id
        )
      );

      setShowDeleteModal(false);
      setDeleteWatchlistTarget(null);
      setDeleteError("");
    } catch (error) {
      console.error("Failed to delete watchlist:", error);

      setDeleteError(
        error instanceof Error
          ? error.message
          : "Unable to delete watchlist."
      );
    } finally {
      setDeletingWatchlist(false);
    }
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async function handleLogout() {
    await signOut(auth);
  }

  // =========================================================
  // USER DISPLAY
  // =========================================================

  const firstName =
    user?.email?.split("@")[0]?.split(/[._-]/)[0] || "there";

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="dashboard-page">

      {/* ================= HEADER ================= */}

      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-brand-mark">
            <svg
              viewBox="0 0 32 32"
              width="22"
              height="22"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 23L11 16L16 20L26 8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M21 8H26V13"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <span>MarketPulse</span>
        </div>

        <div className="dashboard-actions">
          <div className="market-status">
            <span />
            Market intelligence
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ================= MAIN ================= */}

      <main className="dashboard-main">

        {/* ================= WELCOME ================= */}

        <section className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow">
              YOUR MARKET WATCH
            </p>

            <h1>
              Good to see you, {firstName}.
            </h1>

            <p className="dashboard-description">
              See what meaningfully changed since your last check
              and focus on what deserves your attention.
            </p>
          </div>
        </section>

        {/* ================= WATCHLIST ================= */}

        <section className="watchlist-section">

          <div className="section-heading">
            <div>
              <span className="section-label">
                WATCHLISTS
              </span>

              <h2>
                Your watchlists
              </h2>
            </div>

            <button
              type="button"
              className="create-watchlist-button"
              onClick={openCreateModal}
            >
              <span>+</span>
              Create watchlist
            </button>
          </div>

          {/* ================= WATCHLIST ERROR ================= */}

          {watchlistsError && (
            <div className="watchlist-error">
              <div>
                <strong>
                  Couldn't load your watchlists.
                </strong>

                <p>
                  {watchlistsError}
                </p>
              </div>

              <button
                type="button"
                onClick={loadWatchlists}
              >
                Try again
              </button>
            </div>
          )}

          {/* ================= LOADING ================= */}

          {watchlistsLoading && !watchlistsError && (
            <div className="watchlist-loading">
              <div className="loading-spinner" />
              <p>Loading your watchlists...</p>
            </div>
          )}

          {/* ================= WATCHLISTS ================= */}

          {!watchlistsLoading &&
            !watchlistsError &&
            watchlists.length > 0 && (
              <div className="watchlist-grid">

                {watchlists.map((watchlist) => (
                  <article
                    key={watchlist._id}
                    className="watchlist-card"
                    onClick={() =>
                      navigate(`/watchlist/${watchlist._id}`)
                    }
                  >

                    <div className="watchlist-card-top">

                      <div className="watchlist-card-icon">
                        <svg
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 17L9 12L13 15L20 7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      <span className="watchlist-stock-count">
                        {watchlist.stocks.length}{" "}
                        {watchlist.stocks.length === 1
                          ? "stock"
                          : "stocks"}
                      </span>

                    </div>

                    <h3>
                      {watchlist.name}
                    </h3>

                    <p>
                      {watchlist.stocks.length === 0
                        ? "No stocks added yet."
                        : "Ready to track meaningful changes."}
                    </p>

                    {/* ================= CARD ACTIONS ================= */}

                    <div className="watchlist-card-actions">

                      <button
                        type="button"
                        className="watchlist-rename-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRenameModal(watchlist);
                        }}
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        className="watchlist-delete-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeleteModal(watchlist);
                        }}
                      >
                        Delete
                      </button>

                    </div>

                  </article>
                ))}

              </div>
            )}

          {/* ================= EMPTY STATE ================= */}

          {!watchlistsLoading &&
            !watchlistsError &&
            watchlists.length === 0 && (
              <div className="empty-watchlist">

                <div className="empty-chart">
                  <svg
                    viewBox="0 0 120 70"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 58L28 43L47 49L68 27L84 36L115 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <circle
                      cx="115"
                      cy="8"
                      r="4"
                      fill="currentColor"
                    />
                  </svg>
                </div>

                <h3>
                  Start building your watchlist
                </h3>

                <p>
                  Add the stocks you care about. We'll track
                  their latest market state and compare it
                  with your previous check.
                </p>

                <button
                  type="button"
                  className="empty-create-button"
                  onClick={openCreateModal}
                >
                  Create your first watchlist
                  <span>→</span>
                </button>

              </div>
            )}

        </section>

        {/* ================= PRODUCT IDEA ================= */}

        <section className="how-it-works">

          <div className="section-heading">
            <div>
              <span className="section-label">
                HOW MARKETPULSE WORKS
              </span>

              <h2>
                Less noise. More signal.
              </h2>
            </div>
          </div>

          <div className="workflow-grid">

            <div className="workflow-card">
              <span>01</span>

              <h3>
                Build your watchlist
              </h3>

              <p>
                Choose the stocks you actually care about.
              </p>
            </div>

            <div className="workflow-card">
              <span>02</span>

              <h3>
                Come back later
              </h3>

              <p>
                MarketPulse remembers the last successful
                check of your watchlist.
              </p>
            </div>

            <div className="workflow-card">
              <span>03</span>

              <h3>
                Understand what changed
              </h3>

              <p>
                Meaningful movements are highlighted with
                reasons instead of overwhelming you with data.
              </p>
            </div>

          </div>

        </section>

      </main>

      {/* ================= FOOTER ================= */}

      <footer className="dashboard-footer">
        <span>MarketPulse</span>
        <span>Market intelligence, simplified.</span>
      </footer>

      {/* =====================================================
          CREATE WATCHLIST MODAL
          ===================================================== */}

      {showCreateModal && (
        <div
          className="watchlist-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div
            className="watchlist-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-watchlist-title"
          >

            <div className="watchlist-modal-header">

              <div>
                <span className="section-label">
                  NEW WATCHLIST
                </span>

                <h2 id="create-watchlist-title">
                  Create a watchlist
                </h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCreateModal}
                disabled={creatingWatchlist}
                aria-label="Close"
              >
                ×
              </button>

            </div>

            <form onSubmit={handleCreateWatchlist}>

              <div className="watchlist-form-field">

                <label htmlFor="watchlist-name">
                  Watchlist name
                </label>

                <input
                  id="watchlist-name"
                  type="text"
                  value={watchlistName}
                  onChange={(event) => {
                    setWatchlistName(event.target.value);
                    setCreateError("");
                  }}
                  placeholder="e.g. Long-term picks"
                  maxLength={100}
                  autoFocus
                  disabled={creatingWatchlist}
                />

                <div className="watchlist-input-footer">

                  <span>
                    Give your watchlist a simple name.
                  </span>

                  <span>
                    {watchlistName.length}/100
                  </span>

                </div>

              </div>

              {createError && (
                <div className="create-watchlist-error">
                  {createError}
                </div>
              )}

              <div className="watchlist-modal-actions">

                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={closeCreateModal}
                  disabled={creatingWatchlist}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-create-button"
                  disabled={creatingWatchlist}
                >
                  {creatingWatchlist
                    ? "Creating..."
                    : "Create watchlist"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* =====================================================
          RENAME WATCHLIST MODAL
          ===================================================== */}

      {showRenameModal && renameWatchlistTarget && (
        <div
          className="watchlist-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRenameModal();
            }
          }}
        >
          <div
            className="watchlist-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-watchlist-title"
          >

            <div className="watchlist-modal-header">

              <div>
                <span className="section-label">
                  EDIT WATCHLIST
                </span>

                <h2 id="rename-watchlist-title">
                  Rename watchlist
                </h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRenameModal}
                disabled={renamingWatchlist}
                aria-label="Close"
              >
                ×
              </button>

            </div>

            <form onSubmit={handleRenameWatchlist}>

              <div className="watchlist-form-field">

                <label htmlFor="rename-watchlist-name">
                  Watchlist name
                </label>

                <input
                  id="rename-watchlist-name"
                  type="text"
                  value={renameName}
                  onChange={(event) => {
                    setRenameName(event.target.value);
                    setRenameError("");
                  }}
                  placeholder="e.g. Long-term picks"
                  maxLength={100}
                  autoFocus
                  disabled={renamingWatchlist}
                />

                <div className="watchlist-input-footer">

                  <span>
                    Choose a clear name for this watchlist.
                  </span>

                  <span>
                    {renameName.length}/100
                  </span>

                </div>

              </div>

              {renameError && (
                <div className="create-watchlist-error">
                  {renameError}
                </div>
              )}

              <div className="watchlist-modal-actions">

                <button
                  type="button"
                  className="modal-cancel-button"
                  onClick={closeRenameModal}
                  disabled={renamingWatchlist}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-create-button"
                  disabled={renamingWatchlist}
                >
                  {renamingWatchlist
                    ? "Saving..."
                    : "Save changes"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* =====================================================
          DELETE WATCHLIST CONFIRMATION MODAL
          ===================================================== */}

      {showDeleteModal && deleteWatchlistTarget && (
        <div
          className="watchlist-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteModal();
            }
          }}
        >
          <div
            className="watchlist-modal delete-watchlist-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-watchlist-title"
          >

            <div className="delete-watchlist-icon">
              !
            </div>

            <div className="delete-watchlist-content">

              <span className="section-label">
                DELETE WATCHLIST
              </span>

              <h2 id="delete-watchlist-title">
                Delete "{deleteWatchlistTarget.name}"?
              </h2>

              <p>
                This will permanently remove this watchlist.
                This action cannot be undone.
              </p>

            </div>

            {deleteError && (
              <div className="create-watchlist-error">
                {deleteError}
              </div>
            )}

            <div className="watchlist-modal-actions">

              <button
                type="button"
                className="modal-cancel-button"
                onClick={closeDeleteModal}
                disabled={deletingWatchlist}
              >
                Cancel
              </button>

              <button
                type="button"
                className="modal-delete-button"
                onClick={handleDeleteWatchlist}
                disabled={deletingWatchlist}
              >
                {deletingWatchlist
                  ? "Deleting..."
                  : "Delete watchlist"}
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}