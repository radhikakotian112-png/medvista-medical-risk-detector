import { NavLink } from "react-router-dom";
import {
  FaHospital,
  FaChartBar,
  FaBell,
  FaCog,
  FaAddressBook,
  FaUserShield,
} from "react-icons/fa";
import { FaClockRotateLeft } from "react-icons/fa6";
import { MdAssessment } from "react-icons/md";

function Sidebar({ t, isAdmin }) {
  return (
    <aside className="sidebar">

      {/* ================= LOGO ================= */}

      <div className="logo">

        <div className="sidebar-logo-icon">
          <div className="logo-glow"></div>

          <div className="logo-ring ring-one"></div>
          <div className="logo-ring ring-two"></div>

          <FaHospital />

          <span className="logo-pulse"></span>
        </div>

        <span className="logo-text">MedVista</span>

      </div>


      {/* ================= MENU ================= */}

      <nav className="sidebar-menu">

        <NavLink to="/dashboard" className="menu-btn" title="Assessment Dashboard">
          <span className="menu-icon">
            <MdAssessment />
          </span>
          <span>Assessment Dashboard</span>
        </NavLink>


        <NavLink to="/history" className="menu-btn">
          <span className="menu-icon">
            <FaClockRotateLeft />
          </span>
          <span>{t.patientHistory}</span>
        </NavLink>


        <NavLink to="/reports" className="menu-btn">
          <span className="menu-icon">
            <FaChartBar />
          </span>
          <span>{t.reports}</span>
        </NavLink>


        <NavLink to="/alerts" className="menu-btn">
          <span className="menu-icon">
            <FaBell />
            <span className="notification-dot"></span>
          </span>
          <span>{t.alerts}</span>
        </NavLink>


        <NavLink to="/settings" className="menu-btn">
          <span className="menu-icon">
            <FaCog />
          </span>
          <span>{t.settings}</span>
        </NavLink>


        <NavLink to="/contact" className="menu-btn">
          <span className="menu-icon">
            <FaAddressBook />
          </span>
          <span>{t.contact}</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin" className="menu-btn">
            <span className="menu-icon">
              <FaUserShield />
            </span>
            <span>Admin panel</span>
          </NavLink>
        )}

      </nav>

    </aside>
  );
}

export default Sidebar;