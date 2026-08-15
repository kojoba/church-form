"use client";

import { FormEvent, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

const EDUCATION_LEVELS = [
  { value: "Junior High", short: "JHS", number: "01" },
  { value: "Senior High", short: "SHS", number: "02" },
  { value: "Undergraduate", short: "UG", number: "03" },
  { value: "Graduate", short: "GR", number: "04" },
] as const;

const EVENT_DATES = [
  {
    label: "Conference date",
    day: "Saturday",
    date: "12 September",
    year: "2026",
    number: "12",
    variant: "conference",
  },
  {
    label: "Launch date",
    day: "Sunday",
    date: "16 August",
    year: "2026",
    number: "16",
    variant: "launch",
  },
] as const;

const CONFERENCE_VALUES = ["Inspire", "Equip", "Empower", "Transform"];

type FormState = {
  full_name: string;
  date_of_birth: string;
  contact_number: string;
  email: string;
  education_level: string;
};

type Member = {
  id: number;
  full_name: string;
  date_of_birth: string;
  contact_number: string;
  email: string | null;
  education_level: string;
  created_at: string;
};

type View = "register" | "login" | "dashboard";

const EMPTY_FORM: FormState = {
  full_name: "",
  date_of_birth: "",
  contact_number: "",
  email: "",
  education_level: "",
};

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Home() {
  const [view, setView] = useState<View>("register");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginStatus, setLoginStatus] = useState<
    "idle" | "submitting" | "error"
  >("idle");
  const [loginMessage, setLoginMessage] = useState("");
  const [token, setToken] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [educationFilter, setEducationFilter] = useState("All levels");

  const completedFields = useMemo(
    () =>
      [
        form.full_name,
        form.date_of_birth,
        form.contact_number,
        form.education_level,
      ].filter(Boolean).length,
    [form],
  );

  const progress = Math.round((completedFields / 4) * 100);
  const today = new Date().toISOString().slice(0, 10);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        const firstFieldError = payload.errors
          ? Object.values(payload.errors)[0]
          : null;
        throw new Error(
          (firstFieldError as string) ||
            payload.message ||
            "We could not save your details.",
        );
      }

      setStatus("success");
      setMessage(
        "Registration received. We look forward to welcoming you to FGC 2026.",
      );
      setForm(EMPTY_FORM);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  async function loadMembers(accessToken: string) {
    setMembersLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/members`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json();

      if (response.status === 401) {
        sessionStorage.removeItem("church_admin_token");
        setToken("");
        setView("login");
        setLoginStatus("error");
        setLoginMessage("Your session has expired. Please sign in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(payload.message || "Unable to retrieve members.");
      }

      setMembers(payload.data ?? []);
    } catch (error) {
      setLoginMessage(
        error instanceof Error ? error.message : "Unable to retrieve members.",
      );
    } finally {
      setMembersLoading(false);
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginStatus("submitting");
    setLoginMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Login failed.");
      }

      sessionStorage.setItem("church_admin_token", payload.token);
      setToken(payload.token);
      setLoginStatus("idle");
      setLoginForm({ username: "", password: "" });
      setView("dashboard");
      await loadMembers(payload.token);
    } catch (error) {
      setLoginStatus("error");
      setLoginMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    }
  }

  function openAdmin() {
    const savedToken =
      token || sessionStorage.getItem("church_admin_token") || "";

    if (savedToken) {
      setToken(savedToken);
      setView("dashboard");
      void loadMembers(savedToken);
      return;
    }

    setView("login");
  }

  function logout() {
    sessionStorage.removeItem("church_admin_token");
    setToken("");
    setMembers([]);
    setSearch("");
    setEducationFilter("All levels");
    setView("login");
  }

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !query ||
        member.full_name.toLowerCase().includes(query) ||
        member.contact_number.toLowerCase().includes(query) ||
        (member.email ?? "").toLowerCase().includes(query);

      const matchesEducation =
        educationFilter === "All levels" ||
        member.education_level === educationFilter;

      return matchesSearch && matchesEducation;
    });
  }, [educationFilter, members, search]);

  const membersWithEmail = members.filter((member) => member.email).length;

  return (
    <main className="site-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#top"
          aria-label="Future Generation Conference home"
          onClick={() => setView("register")}
        >
          <img
            className="brand-logo"
            src="/fgc-logo.jpeg"
            alt="Future Generation Conference"
          />

          <span className="brand-name">
            <strong>Future Generation</strong>
            <em>Conference 2026</em>
          </span>
        </a>

        <div className="header-note">
          <span className="live-dot" />
          {view === "register"
            ? "Conference registration now open"
            : "FGC administrator workspace"}
        </div>

        <button
          className="admin-link"
          type="button"
          onClick={view === "register" ? openAdmin : () => setView("register")}
        >
          {view === "register" ? "Admin access" : "Public form"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </header>

      {view === "register" && (
        <section className="registration-layout" id="top">
          <aside className="story-panel">
            <div className="orb orb-one" />
            <div className="orb orb-two" />

            <p className="eyebrow">
              <span>FG</span> Future Generation Conference
            </p>

            <div className="story-copy">
              <p className="conference-greeting">Hello FGC family,</p>

              <h1>
                One vision.
                <br />
                One purpose.
                <br />
                <em>One generation.</em>
              </h1>

              <p className="conference-intro">
                Join a generation prepared to inspire, equip, empower and
                transform. Register your details for the Future Generation
                Conference 2026.
              </p>

              <div className="event-dates">
                {EVENT_DATES.map((event) => (
                  <article
                    className={`event-date-item ${event.variant}`}
                    key={event.label}
                  >
                    <small>{event.label}</small>

                    <p>
                      <strong>{event.day}</strong>
                      <span>{event.date}</span>
                      <b>{event.year}</b>
                    </p>
                  </article>
                ))}
              </div>

              {/* <div className="conference-note">
                <span aria-hidden="true">↗</span>

                <p>
                  <strong>Department preparation</strong>
                  Departments are encouraged to begin preparations and submit
                  their proposed budgets ahead of the conference.
                </p>
              </div> */}
            </div>

            <div className="story-footer fgc-footer">
              <div className="conference-values">
                {CONFERENCE_VALUES.map((value, index) => (
                  <span key={value}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    {value}
                  </span>
                ))}
              </div>

              <p>
                Inspire today. Empower tomorrow.
                <strong>FGC 2026</strong>
              </p>
            </div>
          </aside>

          <section className="form-panel" aria-labelledby="form-title">
            <div className="form-heading">
              <div>
                <p className="section-kicker">Conference registration</p>
                <h2 id="form-title">Reserve your place at FGC 2026.</h2>
              </div>

              <div
                className="progress-ring"
                style={
                  {
                    "--progress": `${progress * 3.6}deg`,
                  } as React.CSSProperties
                }
                aria-label={`${progress}% complete`}
              >
                <span>{progress}%</span>
              </div>
            </div>

            <form onSubmit={submitForm} className="member-form">
              <div className="field-grid">
                <label className="field field-wide">
                  <span className="field-label">
                    Full name <b>Required</b>
                  </span>
                  <span className="input-wrap">
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(event) =>
                        updateField("full_name", event.target.value)
                      }
                      placeholder="e.g. Ama Serwaa Boateng"
                      minLength={2}
                      autoComplete="name"
                      required
                    />
                    <span className="input-index">01</span>
                  </span>
                </label>

                <label className="field">
                  <span className="field-label">
                    Date of birth <b>Required</b>
                  </span>
                  <span className="input-wrap">
                    <input
                      type="date"
                      value={form.date_of_birth}
                      max={today}
                      onChange={(event) =>
                        updateField("date_of_birth", event.target.value)
                      }
                      required
                    />
                    <span className="input-index">02</span>
                  </span>
                </label>

                <label className="field">
                  <span className="field-label">
                    Contact number <b>Required</b>
                  </span>
                  <span className="input-wrap">
                    <input
                      type="tel"
                      value={form.contact_number}
                      onChange={(event) =>
                        updateField("contact_number", event.target.value)
                      }
                      placeholder="024 123 4567"
                      autoComplete="tel"
                      required
                    />
                    <span className="input-index">03</span>
                  </span>
                </label>

                <label className="field field-wide">
                  <span className="field-label">
                    Email address <i>Optional</i>
                  </span>
                  <span className="input-wrap">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    <span className="input-index">04</span>
                  </span>
                </label>
              </div>

              <fieldset className="education-field">
                <legend>
                  <span>Highest level of education</span>
                  <b>Choose one</b>
                </legend>

                <div className="education-options">
                  {EDUCATION_LEVELS.map((level) => (
                    <label
                      className={`education-option ${
                        form.education_level === level.value ? "selected" : ""
                      }`}
                      key={level.value}
                    >
                      <input
                        type="radio"
                        name="education_level"
                        value={level.value}
                        checked={form.education_level === level.value}
                        onChange={(event) =>
                          updateField("education_level", event.target.value)
                        }
                        required
                      />
                      <span className="education-number">{level.number}</span>
                      <strong>{level.short}</strong>
                      <small>{level.value}</small>
                      <span className="education-check">✓</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {message && (
                <div
                  className={`form-message ${status}`}
                  role={status === "error" ? "alert" : "status"}
                >
                  <span aria-hidden="true">
                    {status === "success" ? "✓" : "!"}
                  </span>
                  {message}
                </div>
              )}

              <div className="form-actions">
                <p>
                  Your details will be used for conference communication,
                  planning and participant coordination.
                </p>

                <button type="submit" disabled={status === "submitting"}>
                  <span>
                    {status === "submitting"
                      ? "Registering…"
                      : "Register for FGC"}
                  </span>
                  <i aria-hidden="true">→</i>
                </button>
              </div>
            </form>
          </section>
        </section>
      )}

      {view === "login" && (
        <section className="login-layout" id="admin">
          <aside className="login-story">
            <div className="login-grid" aria-hidden="true" />
            <p className="eyebrow">
              <span>02</span> Private workspace
            </p>
            <div>
              <p className="login-overline">FGC coordination desk</p>

              <h1>
                Plan with clarity.
                <br />
                <em>Empower a generation.</em>
              </h1>
              <p className="login-description">
                Sign in to view the people who have shared their details with
                your church. This area is reserved for authorised leaders.
              </p>
            </div>
            <div className="privacy-stamp">
              <span>Protected</span>
              <p>
                Personal information
                <strong>Handle with care</strong>
              </p>
            </div>
          </aside>

          <section className="login-panel" aria-labelledby="login-title">
            <form className="login-card" onSubmit={submitLogin}>
              <div className="login-card-number">CC / 02</div>
              <p className="section-kicker">FGC coordination desk</p>
              <h1>Conference registrations</h1>
              <p className="login-intro">
                Enter the fixed administrator credentials configured in your
                backend environment file.
              </p>

              <label className="login-field">
                <span>Username</span>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="login-field">
                <span>Password</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {loginMessage && (
                <div className="login-error" role="alert">
                  <span>!</span> {loginMessage}
                </div>
              )}

              <button
                className="login-submit"
                type="submit"
                disabled={loginStatus === "submitting"}
              >
                <span>
                  {loginStatus === "submitting"
                    ? "Signing in…"
                    : "Enter dashboard"}
                </span>
                <i aria-hidden="true">→</i>
              </button>

              <p className="login-footnote">
                The login token is kept only for this browser session.
              </p>
            </form>
          </section>
        </section>
      )}

      {view === "dashboard" && (
        <section className="dashboard" id="admin">
          <div className="dashboard-topbar">
            <div>
              <p className="section-kicker">Member care desk</p>
              <h2>Registered participants</h2>
            </div>
            <div className="dashboard-actions">
              <button type="button" onClick={() => void loadMembers(token)}>
                Refresh data
              </button>
              <button className="logout-button" type="button" onClick={logout}>
                Sign out <span>↗</span>
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <article className="stat-card stat-primary">
              <span className="stat-number">
                {members.length.toString().padStart(2, "0")}
              </span>
              <div>
                <p>Total registrations</p>
                <small>All submitted member forms</small>
              </div>
              <b>01</b>
            </article>
            <article className="stat-card">
              <span className="stat-number">
                {membersWithEmail.toString().padStart(2, "0")}
              </span>
              <div>
                <p>Email available</p>
                <small>Members reachable by email</small>
              </div>
              <b>02</b>
            </article>
            <article className="stat-card stat-acid">
              <span className="stat-number">
                {members
                  .filter((member) => member.education_level === "Graduate")
                  .length.toString()
                  .padStart(2, "0")}
              </span>
              <div>
                <p>Graduate members</p>
                <small>Education snapshot</small>
              </div>
              <b>03</b>
            </article>
          </div>

          <div className="directory-panel">
            <div className="directory-toolbar">
              <div>
                <h2>Member records</h2>
                <p>{filteredMembers.length} visible records</p>
              </div>
              <div className="directory-filters">
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, phone or email"
                    aria-label="Search members"
                  />
                </label>
                <label className="filter-select">
                  <span className="sr-only">Filter by education</span>
                  <select
                    value={educationFilter}
                    onChange={(event) => setEducationFilter(event.target.value)}
                  >
                    <option>All levels</option>
                    {EDUCATION_LEVELS.map((level) => (
                      <option key={level.value}>{level.value}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {membersLoading ? (
              <div className="directory-state">
                <span className="loading-mark" />
                Loading member records…
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="directory-state">
                <span className="empty-mark">0</span>
                <strong>No matching members</strong>
                <p>Try changing your search or education filter.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Contact</th>
                      <th>Date of birth</th>
                      <th>Education</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.id}>
                        <td data-label="Member">
                          <span className="member-avatar">
                            {initials(member.full_name)}
                          </span>
                          <span className="member-identity">
                            <strong>{member.full_name}</strong>
                            <small>{member.email || "No email provided"}</small>
                          </span>
                        </td>
                        <td data-label="Contact">{member.contact_number}</td>
                        <td data-label="Date of birth">
                          {formatDate(member.date_of_birth)}
                        </td>
                        <td data-label="Education">
                          <span className="education-badge">
                            {member.education_level}
                          </span>
                        </td>
                        <td data-label="Joined">
                          {formatDate(member.created_at.slice(0, 10))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="site-footer">
        <p>Future Generation Conference. &copy; 2026</p>
        <p>Designed by · Kojo</p>
      </footer>
    </main>
  );
}
