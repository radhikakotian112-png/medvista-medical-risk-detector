import { useEffect, useState } from "react";
import "./App.css";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import PatientForm from "./pages/PatientForm";
import PatientHistory from "./pages/PatientHistory";
import Reports from "./pages/Reports";
import Alert from "./pages/Alerts";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import Home from "./pages/home";
import { getTranslations } from "./translations";

const defaultSettings = {
  theme: "light",
  compactMode: false,
  emailNotifications: true,
  smsNotifications: false,
  autoSaveReports: true,
  language: "English",
};

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem("medvistaSettings") || "{}") };
  } catch {
    return defaultSettings;
  }
}

function ProtectedRoute({ children }) {
  const isAuthenticated = Boolean(localStorage.getItem("accessToken"));
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function AdminRoute({ children }) {
  const isAdmin = getCurrentUser()?.role === "admin";
  return isAdmin ? <ProtectedRoute>{children}</ProtectedRoute> : <Navigate to="/dashboard" replace />;
}

function App() {
  const isAuthenticated = Boolean(localStorage.getItem("accessToken"));
  const [settings, setSettings] = useState(loadSettings);
  const translations = getTranslations(settings.language);
  const user = getCurrentUser();

  const location = useLocation();

const showAppLayout =
  isAuthenticated &&
  location.pathname !== "/" &&
  location.pathname !== "/login";


  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.compact = settings.compactMode ? "true" : "false";
    localStorage.setItem("medvistaSettings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (changes) => {
    setSettings((current) => ({ ...current, ...changes }));
  };

  return (
    <div className="app">
{showAppLayout && <Sidebar t={translations} isAdmin={user?.role === "admin"} />}
      <div className="main">
    {showAppLayout && <Navbar t={translations} />}

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Home />} />

            <Route
              path="/login"
              element={<Login />}
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />

            <Route
              path="/patient"
              element={
                <ProtectedRoute>
                  <PatientForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <PatientHistory />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />

            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <Alert />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings settings={settings} t={translations} onChange={updateSettings} onReset={() => setSettings(defaultSettings)} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/contact"
              element={
                <ProtectedRoute>
                  <Contact />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;