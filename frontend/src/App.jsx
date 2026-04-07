import { Navigate, Route, Routes, Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";
import { api } from "./api";
import "./App.css";

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); await login(email, password); }}>
      <h2>Login</h2>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button>Login</button>
    </form>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", password: "", role: "candidate" });
  return (
    <form className="card" onSubmit={async (e) => { e.preventDefault(); await register(form); }}>
      <h2>Register</h2>
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
        <option value="candidate">Candidate</option>
        <option value="employer">Employer</option>
      </select>
      <button>Create account</button>
    </form>
  );
}

function CandidateDashboard() {
  const [keyword, setKeyword] = useState("");
  const [jobs, setJobs] = useState([]);
  const [recommended, setRecommended] = useState([]);
  return (
    <div className="card">
      <h2>Candidate Dashboard</h2>
      <div className="row">
        <input placeholder="Keyword from job description" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button onClick={async () => setJobs(await api(`/api/jobs/search?keyword=${encodeURIComponent(keyword)}`))}>Search Jobs</button>
        <button onClick={async () => setRecommended(await api("/api/recommendations/jobs-for-candidate"))}>Top 10 Jobs</button>
      </div>
      <h3>Search Results</h3>
      <pre>{JSON.stringify(jobs, null, 2)}</pre>
      <h3>Recommendations</h3>
      <pre>{JSON.stringify(recommended, null, 2)}</pre>
    </div>
  );
}

function EmployerDashboard() {
  const [jobId, setJobId] = useState("");
  const [recs, setRecs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  return (
    <div className="card">
      <h2>Employer Dashboard</h2>
      <div className="row">
        <button onClick={async () => setCandidates(await api("/api/candidates/search"))}>Search Candidates</button>
        <input placeholder="Job ID" value={jobId} onChange={(e) => setJobId(e.target.value)} />
        <button onClick={async () => setRecs(await api(`/api/recommendations/candidates-for-job/${jobId}`))}>Top 10 Candidates</button>
      </div>
      <h3>Candidates</h3>
      <pre>{JSON.stringify(candidates, null, 2)}</pre>
      <h3>Recommendations</h3>
      <pre>{JSON.stringify(recs, null, 2)}</pre>
    </div>
  );
}

function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="card">
      <h1>SkillMesh</h1>
      <p>Intelligent Talent Matching Platform</p>
      <div className="row">
        {!user && <Link to="/login">Login</Link>}
        {!user && <Link to="/register">Register</Link>}
        {user && <button onClick={logout}>Logout ({user.email})</button>}
        {user?.role === "candidate" && <Link to="/candidate">Candidate Portal</Link>}
        {user?.role === "employer" && <Link to="/employer">Employer Portal</Link>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/candidate" element={<Protected roles={["candidate"]}><CandidateDashboard /></Protected>} />
      <Route path="/employer" element={<Protected roles={["employer"]}><EmployerDashboard /></Protected>} />
    </Routes>
  );
}
