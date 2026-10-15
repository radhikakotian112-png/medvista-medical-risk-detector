import { useEffect, useState } from "react";
import { Activity, FileText, ShieldCheck, Users } from "lucide-react";
import { getAdminOverview } from "../api";
import "./Admin.css";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

export default function Admin() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminOverview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load admin overview");
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main className="admin-page">
        <p className="admin-error" role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="admin-eyebrow"><ShieldCheck size={15} /> Administration</div>
        <h1>System overview</h1>
        <p>Account and platform activity at a glance.</p>
      </header>

      <section className="admin-stats" aria-label="Platform totals">
        <article className="admin-stat">
          <span className="admin-stat-icon admin-users"><Users size={19} /></span>
          <div><span>Registered accounts</span><strong>{overview?.userCount ?? "--"}</strong></div>
        </article>
        <article className="admin-stat">
          <span className="admin-stat-icon admin-assessments"><Activity size={19} /></span>
          <div><span>Assessments</span><strong>{overview?.assessmentCount ?? "--"}</strong></div>
        </article>
        <article className="admin-stat">
          <span className="admin-stat-icon admin-documents"><FileText size={19} /></span>
          <div><span>Uploaded documents</span><strong>{overview?.documentCount ?? "--"}</strong></div>
        </article>
      </section>

      <section className="admin-accounts" aria-labelledby="admin-accounts-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="admin-accounts-title">Accounts</h2>
            <p>{overview ? `${overview.users.length} accounts` : "Loading accounts..."}</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>
              {overview?.users.map((user) => (
                <tr key={user.email}>
                  <td>{user.email}</td>
                  <td><span className={`admin-role ${user.role === "admin" ? "admin-role-admin" : ""}`}>{user.role}</span></td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {overview && overview.users.length === 0 && (
                <tr><td colSpan="3" className="admin-empty">No accounts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}