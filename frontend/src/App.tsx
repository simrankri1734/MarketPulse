import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WatchlistPage from "./pages/Watchlist";
import { auth } from "./lib/firebase";

function ProtectedRoute({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading MarketPulse...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* =====================================================
          LOGIN
          ===================================================== */}

      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* =====================================================
          DASHBOARD
          ===================================================== */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute user={user}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          WATCHLIST DETAIL
          ===================================================== */}

      <Route
        path="/watchlist/:id"
        element={
          <ProtectedRoute user={user}>
            <WatchlistPage />
          </ProtectedRoute>
        }
      />

      {/* =====================================================
          ROOT
          ===================================================== */}

      <Route
        path="/"
        element={
          <Navigate
            to={user ? "/dashboard" : "/login"}
            replace
          />
        }
      />

      {/* =====================================================
          UNKNOWN ROUTES
          ===================================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to={user ? "/dashboard" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}