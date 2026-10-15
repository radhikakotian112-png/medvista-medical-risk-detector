import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CirclePlus,
  HeartPulse,
  LockKeyhole,
  Mail,
  Pill,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { googleLogin, login, register } from "../api";
import "./Login.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function startSession(data, navigate) {
  localStorage.setItem("accessToken", data.access_token);
  localStorage.setItem("loggedIn", "true");
  localStorage.setItem("user", JSON.stringify(data.user));
  navigate("/dashboard");
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    const handleGoogleCredential = async (credential) => {
      setError("");
      setLoading(true);
      try {
        startSession(await googleLogin(credential), navigate);
      } catch (authError) {
        setError(authError.message || "Google sign-in failed");
      } finally {
        setLoading(false);
      }
    };

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handleGoogleCredential(response.credential),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.floor(googleButtonRef.current.clientWidth),
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => setError("Google sign-in could not be loaded");
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!email || !password) {
        setError("Please enter email and password");
        return;
      }

      startSession(isRegistering ? await register(email, password) : await login(email, password), navigate);
    } catch (apiError) {
      setError(apiError.message || "Could not authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-brief" aria-label="MedVista clinical platform">
          <div className="login-brand">
            <span className="login-brand-mark"><HeartPulse size={23} /></span>
            <span>MedVista</span>
          </div>

          <div className="login-floating-icons" aria-hidden="true">
            <span className="floating-icon floating-icon-one"><HeartPulse size={18} /></span>
            <span className="floating-icon floating-icon-two"><CirclePlus size={16} /></span>
            <span className="floating-icon floating-icon-three"><Activity size={15} /></span>
          </div>

          <div className="login-brief-copy">
            <span className="login-overline"><span className="login-pulse-dot" /> Secure clinical workspace</span>
            <h1>Care decisions,<br /><em>made clearer.</em></h1>
            <p>Bring patient history, risk signals, and thoughtful review into one focused space for your care team.</p>
          </div>

          <div className="login-doctor-visual" aria-hidden="true">
            <div className="doctor-aura"><Stethoscope size={72} /></div>
          </div>

          <div className="login-signal" aria-hidden="true">
            <div className="signal-line"><span /><span /><span /><span /><span /></div>
            <div className="signal-label"><Activity size={16} /> Live care intelligence</div>
          </div>

          <div className="login-brief-footer">
            <div><ShieldCheck size={17} /><span>Protected clinical data</span></div>
            <div><Stethoscope size={17} /><span>Built for care teams</span></div>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-icons" aria-hidden="true">
            <span className="card-icon card-icon-one"><Activity size={25} /></span>
            <span className="card-icon card-icon-two"><ShieldCheck size={21} /></span>
            <span className="card-icon card-icon-three"><HeartPulse size={20} /></span>
            <span className="card-icon card-icon-four"><CirclePlus size={17} /></span>
            <span className="card-icon card-icon-five"><Pill size={18} /></span>
            <span className="card-icon card-icon-six"><Syringe size={19} /></span>
          </div>
          <div className="login-card-heading">
            <div className="login-icon-orbit" aria-hidden="true"><LockKeyhole size={20} /></div>
            <span className="login-card-kicker">{isRegistering ? "New account" : "Welcome back"}</span>
            <h2>{isRegistering ? "Create your MedVista account" : "Sign in to MedVista"}</h2>
            <p>{isRegistering ? "Use your email to create a secure clinical workspace account." : "Access your clinical dashboard and continue your review."}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email address</label>
            <div className="login-input-wrap">
              <Mail size={17} aria-hidden="true" />
              <input id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@hospital.org" autoComplete="email" required />
            </div>

            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 8 characters" autoComplete={isRegistering ? "new-password" : "current-password"} minLength={8} required />
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-submit" type="submit" disabled={loading}>
              <span>{loading ? (isRegistering ? "Creating account..." : "Signing in...") : (isRegistering ? "Create account" : "Continue securely")}</span>
              {!loading && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>

          <div className="login-divider"><span>or</span></div>
          {GOOGLE_CLIENT_ID ? (
            <div className="login-google-button" ref={googleButtonRef} />
          ) : (
            <p className="login-google-unavailable">Google sign-in needs VITE_GOOGLE_CLIENT_ID configured.</p>
          )}

          <button className="login-mode-toggle" type="button" onClick={() => { setIsRegistering((value) => !value); setError(""); }}>
            {isRegistering ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>

          <div className="login-assurance"><CheckCircle2 size={15} /> Your session is encrypted and private</div>
        </section>
      </div>
    </div>
  );
}