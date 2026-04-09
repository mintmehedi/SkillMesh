import { Navigate, Route, Routes, Link } from "react-router-dom";
import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await login(email, password);
        } catch (err) {
          setError(String(err.message || err));
        }
      }}
    >
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button>Login</button>
    </form>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", username: "", password: "", role: "candidate" });
  const [error, setError] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        try {
          await register(form);
        } catch (err) {
          setError(String(err.message || err));
        }
      }}
    >
      <h2>Register</h2>
      {error && <p className="error">{error}</p>}
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
  const [profile, setProfile] = useState({
    full_name: "",
    contact: "",
    education_level: "",
    major: "",
    years_experience: 0,
    location: "",
    preferred_mode: "",
    summary: "",
    skills: [],
  });
  const [skillInput, setSkillInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [jobs, setJobs] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/candidates/profile");
        if (data && data.id) setProfile(data);
      } catch {
        // Ignore on first load if profile doesn't exist.
      }
    })();
  }, []);

  async function saveProfile() {
    setError("");
    setStatus("");
    try {
      const payload = {
        ...profile,
        years_experience: Number(profile.years_experience || 0),
      };
      const data = await api("/api/candidates/profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setProfile(data);
      setStatus("Profile saved.");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function uploadResume() {
    if (!resumeFile) return;
    setError("");
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("file", resumeFile);
      const resume = await api("/api/candidates/resume/upload", {
        method: "POST",
        body: fd,
      });
      setStatus("Resume uploaded and parsed.");
      if (resume?.parsed_json) {
        const refreshed = await api("/api/candidates/profile");
        if (refreshed && refreshed.id) setProfile(refreshed);
      }
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function searchJobs() {
    setJobs(await api(`/api/jobs/search?keyword=${encodeURIComponent(keyword)}`));
  }

  async function loadRecommendations() {
    setRecommended(await api("/api/recommendations/jobs-for-candidate"));
  }

  async function applyToJob(jobId) {
    setError("");
    setStatus("");
    try {
      await api("/api/applications/", {
        method: "POST",
        body: JSON.stringify({ job: jobId }),
      });
      setStatus(`Applied to job #${jobId}`);
      await loadApplications();
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function loadApplications() {
    setMyApplications(await api("/api/applications/"));
  }

  function addSkill() {
    const value = skillInput.trim();
    if (!value) return;
    setProfile((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { skill_name: value, level: 1 }],
    }));
    setSkillInput("");
  }

  function removeSkill(index) {
    setProfile((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="card">
      <h2>Candidate Dashboard</h2>
      {status && <p className="success">{status}</p>}
      {error && <p className="error">{error}</p>}
      <h3>My Profile</h3>
      <div className="grid">
        <input placeholder="Full name" value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
        <input placeholder="Contact" value={profile.contact || ""} onChange={(e) => setProfile({ ...profile, contact: e.target.value })} />
        <input placeholder="Education" value={profile.education_level || ""} onChange={(e) => setProfile({ ...profile, education_level: e.target.value })} />
        <input placeholder="Major" value={profile.major || ""} onChange={(e) => setProfile({ ...profile, major: e.target.value })} />
        <input placeholder="Years experience" type="number" value={profile.years_experience || 0} onChange={(e) => setProfile({ ...profile, years_experience: e.target.value })} />
        <input placeholder="Location" value={profile.location || ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
        <input placeholder="Preferred mode" value={profile.preferred_mode || ""} onChange={(e) => setProfile({ ...profile, preferred_mode: e.target.value })} />
        <input placeholder="Summary" value={profile.summary || ""} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} />
      </div>
      <div className="row">
        <input placeholder="Add skill (e.g. python)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} />
        <button type="button" onClick={addSkill}>Add Skill</button>
      </div>
      <div className="chipWrap">
        {(profile.skills || []).map((s, i) => (
          <span className="chip" key={`${s.skill_name}-${i}`}>
            {s.skill_name}
            <button type="button" onClick={() => removeSkill(i)}>x</button>
          </span>
        ))}
      </div>
      <button onClick={saveProfile}>Save Profile</button>

      <h3>Resume Upload</h3>
      <div className="row">
        <input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
        <button onClick={uploadResume}>Upload + Parse</button>
      </div>

      <h3>Search Jobs</h3>
      <div className="row">
        <input placeholder="Keyword from job description" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <button onClick={searchJobs}>Search Jobs</button>
        <button onClick={loadRecommendations}>Top 10 Jobs</button>
        <button onClick={loadApplications}>My Applications</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Location</th>
            <th>Mode</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.id}</td>
              <td>{j.title}</td>
              <td>{j.location || "-"}</td>
              <td>{j.work_mode}</td>
              <td><button onClick={() => applyToJob(j.id)}>Apply</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Recommendations</h3>
      <table>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Score</th>
            <th>Matched Skills</th>
            <th>Experience Gap</th>
          </tr>
        </thead>
        <tbody>
          {recommended.map((r) => (
            <tr key={r.job_id}>
              <td>{r.job_id}</td>
              <td>{r.score}</td>
              <td>{(r.explanation?.matched_skills || []).join(", ") || "-"}</td>
              <td>{r.explanation?.experience_gap ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>My Applications</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Job</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {myApplications.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.job}</td>
              <td>{a.status}</td>
              <td>{a.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployerDashboard() {
  const [company, setCompany] = useState({
    company_name: "",
    description: "",
    website: "",
    location: "",
  });
  const [jobForm, setJobForm] = useState({
    title: "",
    company_info: "",
    jd_text: "",
    required_education: "",
    required_experience: 0,
    work_mode: "onsite",
    location: "",
    status: "open",
    skills: [],
  });
  const [jobSkillInput, setJobSkillInput] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidateFilters, setCandidateFilters] = useState({
    skills: "",
    education: "",
    experience_min: "",
    location: "",
  });
  const [recs, setRecs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await api("/api/employers/company/profile");
        if (c?.id) setCompany(c);
      } catch {
        // No profile yet.
      }
      const myJobs = await api("/api/employers/jobs");
      setJobs(myJobs);
    })();
  }, []);

  async function saveCompany() {
    setError("");
    setStatus("");
    try {
      const c = await api("/api/employers/company/profile", {
        method: "POST",
        body: JSON.stringify(company),
      });
      setCompany(c);
      setStatus("Company profile saved.");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  function addJobSkill() {
    const value = jobSkillInput.trim();
    if (!value) return;
    setJobForm((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { skill_name: value, weight: 1 }],
    }));
    setJobSkillInput("");
  }

  async function createJob() {
    setError("");
    setStatus("");
    try {
      await api("/api/employers/jobs", {
        method: "POST",
        body: JSON.stringify({
          ...jobForm,
          required_experience: Number(jobForm.required_experience || 0),
        }),
      });
      const myJobs = await api("/api/employers/jobs");
      setJobs(myJobs);
      setStatus("Job created.");
    } catch (err) {
      setError(String(err.message || err));
    }
  }

  async function searchCandidates() {
    const q = new URLSearchParams(candidateFilters).toString();
    setCandidates(await api(`/api/candidates/search?${q}`));
  }

  async function getRecommendations() {
    const id = selectedJobId || jobs[0]?.id;
    if (!id) return;
    setRecs(await api(`/api/recommendations/candidates-for-job/${id}`));
  }

  return (
    <div className="card">
      <h2>Employer Dashboard</h2>
      {status && <p className="success">{status}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Company Profile</h3>
      <div className="grid">
        <input placeholder="Company name" value={company.company_name || ""} onChange={(e) => setCompany({ ...company, company_name: e.target.value })} />
        <input placeholder="Website" value={company.website || ""} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
        <input placeholder="Location" value={company.location || ""} onChange={(e) => setCompany({ ...company, location: e.target.value })} />
        <input placeholder="Description" value={company.description || ""} onChange={(e) => setCompany({ ...company, description: e.target.value })} />
      </div>
      <button onClick={saveCompany}>Save Company</button>

      <h3>Create Job</h3>
      <div className="grid">
        <input placeholder="Title" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
        <input placeholder="Company info" value={jobForm.company_info} onChange={(e) => setJobForm({ ...jobForm, company_info: e.target.value })} />
        <input placeholder="Required education" value={jobForm.required_education} onChange={(e) => setJobForm({ ...jobForm, required_education: e.target.value })} />
        <input placeholder="Required experience" type="number" value={jobForm.required_experience} onChange={(e) => setJobForm({ ...jobForm, required_experience: e.target.value })} />
        <input placeholder="Location" value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} />
        <select value={jobForm.work_mode} onChange={(e) => setJobForm({ ...jobForm, work_mode: e.target.value })}>
          <option value="onsite">On-site</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>
      <textarea placeholder="Job description" value={jobForm.jd_text} onChange={(e) => setJobForm({ ...jobForm, jd_text: e.target.value })} />
      <div className="row">
        <input placeholder="Add job skill" value={jobSkillInput} onChange={(e) => setJobSkillInput(e.target.value)} />
        <button type="button" onClick={addJobSkill}>Add Skill</button>
      </div>
      <div className="chipWrap">
        {(jobForm.skills || []).map((s, i) => <span className="chip" key={`${s.skill_name}-${i}`}>{s.skill_name}</span>)}
      </div>
      <button onClick={createJob}>Create Job</button>

      <h3>My Jobs</h3>
      <table>
        <thead><tr><th>ID</th><th>Title</th><th>Mode</th><th>Location</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} onClick={() => setSelectedJobId(j.id)}>
              <td>{j.id}</td><td>{j.title}</td><td>{j.work_mode}</td><td>{j.location || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Candidate Search</h3>
      <div className="grid">
        <input placeholder="Skill" value={candidateFilters.skills} onChange={(e) => setCandidateFilters({ ...candidateFilters, skills: e.target.value })} />
        <input placeholder="Education" value={candidateFilters.education} onChange={(e) => setCandidateFilters({ ...candidateFilters, education: e.target.value })} />
        <input placeholder="Min experience" value={candidateFilters.experience_min} onChange={(e) => setCandidateFilters({ ...candidateFilters, experience_min: e.target.value })} />
        <input placeholder="Location" value={candidateFilters.location} onChange={(e) => setCandidateFilters({ ...candidateFilters, location: e.target.value })} />
      </div>
      <div className="row">
        <button onClick={searchCandidates}>Search Candidates</button>
        <button onClick={getRecommendations}>Top 10 Candidates for Selected Job</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Name</th><th>Education</th><th>Exp</th><th>Location</th></tr></thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id}><td>{c.id}</td><td>{c.full_name}</td><td>{c.education_level || "-"}</td><td>{c.years_experience}</td><td>{c.location || "-"}</td></tr>
          ))}
        </tbody>
      </table>

      <h3>Recommendations</h3>
      <table>
        <thead><tr><th>Candidate ID</th><th>Score</th><th>Skills</th><th>Exp Gap</th></tr></thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.candidate_id}>
              <td>{r.candidate_id}</td>
              <td>{r.score}</td>
              <td>{(r.explanation?.matched_skills || []).join(", ") || "-"}</td>
              <td>{r.explanation?.experience_gap ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
