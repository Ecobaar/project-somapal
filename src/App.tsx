import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  NotebookPen,
  Plus,
  Search,
  ScanLine,
  Settings,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { parseRosterText, type RosterRow } from "./roster-import";
import "./somapal.css";

type ClassRecord = {
  id: string;
  name: string;
  grade: string;
  subject: string;
  term: string;
  year: number;
};
type Learner = {
  id: string;
  classId: string;
  name: string;
  admissionNumber: string;
};
type Assessment = {
  id: string;
  classId: string;
  learnerId: string;
  strand: string;
  subStrand: string;
  level: string;
  assessedOn: string;
  term: string;
  year: number;
};
type LessonPlan = {
  id: string;
  classId: string;
  grade: string;
  subject: string;
  strand: string;
  subStrand: string;
  learningOutcomes: string;
  inquiryQuestion: string;
  resources: string;
  activities: string;
  reflection: string;
  week: number;
  term: string;
  year: number;
};
type DataStore = {
  classes: ClassRecord[];
  learners: Learner[];
  assessments: Assessment[];
  plans: LessonPlan[];
  remarks: Record<string, string>;
};
type Profile = {
  fullName: string;
  schoolName: string;
  phoneNumber: string;
  grades: string;
  subjects: string;
};
type View = "home" | "classes" | "assessment" | "plans" | "reports" | "account";
type PrintSheet = {
  kind: "roster" | "assessment" | "plans" | "report";
  planId?: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const emptyData: DataStore = {
  classes: [],
  learners: [],
  assessments: [],
  plans: [],
  remarks: {},
};
const levels = [
  { code: "EE", label: "Exceeding", style: "ee" },
  { code: "ME", label: "Meeting", style: "me" },
  { code: "AE", label: "Approaching", style: "ae" },
  { code: "BE", label: "Below", style: "be" },
];
const grades = [
  "PP1",
  "PP2",
  ...Array.from({ length: 9 }, (_, index) => `Grade ${index + 1}`),
];
const today = new Date();
const currentYear = today.getFullYear();
const currentDate = [
  currentYear,
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");
const currentWeekStart = new Date(today);
currentWeekStart.setDate(
  currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7),
);
currentWeekStart.setHours(0, 0, 0, 0);

function id() {
  return crypto.randomUUID();
}
function readPreview(): DataStore {
  try {
    return {
      ...emptyData,
      ...JSON.parse(localStorage.getItem("somapal-preview-data") || "{}"),
    };
  } catch {
    return emptyData;
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("somapal-theme") === "dark" ? "dark" : "light"),
  );
  const [preview, setPreview] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    fullName: "",
    schoolName: "",
    phoneNumber: "",
    grades: "",
    subjects: "",
  });
  const [data, setData] = useState<DataStore>(readPreview);
  const [view, setView] = useState<View>("home");
  const [notice, setNotice] = useState("");
  const [classId, setClassId] = useState("");
  const [learnerId, setLearnerId] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Learner | null>(null);
  const [classForm, setClassForm] = useState({
    name: "",
    grade: "Grade 5",
    subject: "",
    term: "Term 1",
    year: currentYear,
  });
  const [learnerForm, setLearnerForm] = useState({ name: "", admission: "" });
  const [editForm, setEditForm] = useState({ name: "", admission: "" });
  const [bulk, setBulk] = useState("");
  const [assessment, setAssessment] = useState({
    classId: "",
    strand: "",
    subStrand: "",
    date: currentDate,
  });
  const [marked, setMarked] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState({
    classId: "",
    strand: "",
    subStrand: "",
    outcomes: "",
    question: "",
    resources: "",
    activities: "",
    reflection: "",
    week: 1,
    term: "Term 1",
    year: currentYear,
  });
  const [planTerm, setPlanTerm] = useState("All terms");
  const [planWeek, setPlanWeek] = useState("All weeks");
  const [reportTerm, setReportTerm] = useState("Term 1");
  const [reportYear, setReportYear] = useState(currentYear);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [rosterDraft, setRosterDraft] = useState<RosterRow[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [printSheet, setPrintSheet] = useState<PrintSheet | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("somapal-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!printSheet) return;
    document.body.dataset.printing = "true";
    const afterPrint = () => setPrintSheet(null);
    window.addEventListener("afterprint", afterPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", afterPrint);
      delete document.body.dataset.printing;
    };
  }, [printSheet]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: result }) => {
      setUser(result.session?.user ?? null);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (preview)
      localStorage.setItem("somapal-preview-data", JSON.stringify(data));
  }, [data, preview]);

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    const load = async () => {
      const [c, l, a, p, r, t] = await Promise.all([
        supabase.from("classes").select("*").order("created_at"),
        supabase.from("learners").select("*").order("name"),
        supabase
          .from("assessments")
          .select("*")
          .order("assessed_on", { ascending: false }),
        supabase
          .from("lesson_plans")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("learner_remarks").select("*"),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      const error = [c, l, a, p, r].find((result) => result.error)?.error;
      if (error) setNotice(`Could not load records: ${error.message}`);
      setData({
        classes: (c.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          grade: row.grade,
          subject: row.subject,
          term: row.term,
          year: row.year,
        })),
        learners: (l.data ?? []).map((row) => ({
          id: row.id,
          classId: row.class_id,
          name: row.name,
          admissionNumber: row.admission_number ?? "",
        })),
        assessments: (a.data ?? []).map((row) => ({
          id: row.id,
          classId: row.class_id,
          learnerId: row.learner_id,
          strand: row.strand,
          subStrand: row.sub_strand,
          level: row.level,
          assessedOn: row.assessed_on,
          term: row.term,
          year: row.year,
        })),
        plans: (p.data ?? []).map((row) => ({
          id: row.id,
          classId: row.class_id,
          grade: row.grade,
          subject: row.subject,
          strand: row.strand,
          subStrand: row.sub_strand,
          learningOutcomes: row.learning_outcomes,
          inquiryQuestion: row.inquiry_question,
          resources: row.resources,
          activities: row.activities,
          reflection: row.reflection,
          week: row.week,
          term: row.term,
          year: row.year,
        })),
        remarks: Object.fromEntries(
          (r.data ?? []).map((row) => [
            `${row.learner_id}:${row.term}:${row.year}`,
            row.remark,
          ]),
        ),
      });
      if (t.data)
        setProfile({
          fullName: t.data.full_name ?? "",
          schoolName: t.data.school_name ?? "",
          phoneNumber: t.data.phone_number ?? "",
          grades: (t.data.grades ?? []).join(", "),
          subjects: (t.data.subjects ?? []).join(", "),
        });
    };
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const signedIn = preview || Boolean(user);
  const activeClass = data.classes.find((item) => item.id === classId);
  const activeLearner = data.learners.find((item) => item.id === learnerId);
  const roster = data.learners.filter(
    (item) =>
      item.classId === classId &&
      `${item.name} ${item.admissionNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  function message(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3500);
  }
  function patchData(change: (current: DataStore) => DataStore) {
    setData((current) => change(current));
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authMode === "signup") {
        const name = String(values.get("fullName") ?? "").trim();
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              school_name: String(values.get("schoolName") ?? ""),
              phone_number: String(values.get("phone") ?? ""),
              grades: String(values.get("grades") ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              subjects: String(values.get("subjects") ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            },
          },
        });
        if (error) throw error;
        if (!result.session)
          setAuthError(
            "Account created. Check your email to confirm, then sign in.",
          );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Could not sign in.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (supabase && user) await supabase.auth.signOut();
    setUser(null);
    setPreview(false);
    setData(emptyData);
    setView("home");
  }

  async function addClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry: ClassRecord = {
      ...classForm,
      id: id(),
      name: classForm.name.trim(),
      subject: classForm.subject.trim(),
    };
    if (!entry.name || !entry.subject) return;
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("classes")
        .insert({
          name: entry.name,
          grade: entry.grade,
          subject: entry.subject,
          term: entry.term,
          year: entry.year,
        })
        .select()
        .single();
      if (error) return message(error.message);
      entry.id = saved.id;
    }
    patchData((current) => ({
      ...current,
      classes: [...current.classes, entry],
    }));
    setClassForm({ ...classForm, name: "", subject: "" });
    setClassId(entry.id);
    message("Class added");
  }

  async function addLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId || !learnerForm.name.trim()) return;
    const entry: Learner = {
      id: id(),
      classId,
      name: learnerForm.name.trim(),
      admissionNumber: learnerForm.admission.trim(),
    };
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("learners")
        .insert({
          class_id: classId,
          name: entry.name,
          admission_number: entry.admissionNumber || null,
        })
        .select()
        .single();
      if (error) return message(error.message);
      entry.id = saved.id;
    }
    patchData((current) => ({
      ...current,
      learners: [...current.learners, entry],
    }));
    setLearnerForm({ name: "", admission: "" });
  }

  async function addBulk() {
    const rows = parseRosterText(bulk);
    if (!classId || !rows.length) return;
    const entries = rows.map((row) => ({
      id: id(),
      classId,
      name: row.name,
      admissionNumber: row.admissionNumber,
    }));
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("learners")
        .insert(
          rows.map((row) => ({
            class_id: classId,
            name: row.name,
            admission_number: row.admissionNumber || null,
          })),
        )
        .select();
      if (error) return message(error.message);
      entries.forEach((entry, index) => {
        entry.id = saved[index].id;
      });
    }
    patchData((current) => ({
      ...current,
      learners: [...current.learners, ...entries],
    }));
    setBulk("");
    message(`${rows.length} learners added`);
  }

  async function scanRoster() {
    if (!rosterFile) return;
    setScanBusy(true);
    setScanProgress(0);
    try {
      const { recognize } = await import("tesseract.js");
      const { data: result } = await recognize(rosterFile, "eng", {
        logger: (event) => {
          if (event.status === "recognizing text")
            setScanProgress(Math.round(event.progress * 100));
        },
      });
      const rows = parseRosterText(result.text);
      if (!rows.length) {
        message(
          "No learner rows were recognized. Try a clearer image or enter the names manually.",
        );
        return;
      }
      setRosterDraft(rows);
      message(`${rows.length} rows scanned. Review them before creating the class.`);
    } catch (error) {
      message(
        `Could not scan this image: ${error instanceof Error ? error.message : "OCR failed."}`,
      );
    } finally {
      setScanBusy(false);
    }
  }

  async function saveScannedClass() {
    const learners = rosterDraft
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        admissionNumber: row.admissionNumber.trim(),
      }))
      .filter((row) => row.name);
    if (!classForm.name.trim() || !classForm.subject.trim() || !learners.length)
      return message("Complete the class details and review at least one learner.");

    const entry: ClassRecord = {
      ...classForm,
      id: id(),
      name: classForm.name.trim(),
      subject: classForm.subject.trim(),
    };
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("classes")
        .insert({
          name: entry.name,
          grade: entry.grade,
          subject: entry.subject,
          term: entry.term,
          year: entry.year,
        })
        .select()
        .single();
      if (error) return message(error.message);
      entry.id = saved.id;
    }

    const entries: Learner[] = learners.map((row) => ({
      ...row,
      id: id(),
      classId: entry.id,
    }));
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("learners")
        .insert(
          learners.map((row) => ({
            class_id: entry.id,
            name: row.name,
            admission_number: row.admissionNumber || null,
          })),
        )
        .select();
      if (error) {
        patchData((current) => ({
          ...current,
          classes: [...current.classes, entry],
        }));
        setClassId(entry.id);
        setClassForm({ ...classForm, name: "", subject: "" });
        setBulk(
          learners
            .map(
              (learner) =>
                `${learner.name} | ${learner.admissionNumber}`,
            )
            .join("\n"),
        );
        return message(
          `Class created, but learners could not be saved: ${error.message}. Select the class and retry from its learner list.`,
        );
      }
      entries.forEach((learner, index) => {
        learner.id = saved[index].id;
      });
    }

    patchData((current) => ({
      ...current,
      classes: [...current.classes, entry],
      learners: [...current.learners, ...entries],
    }));
    setClassId(entry.id);
    setClassForm({ ...classForm, name: "", subject: "" });
    setRosterFile(null);
    setRosterDraft([]);
    message(`Class created with ${entries.length} learners`);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editForm.name.trim()) return;
    if (supabase && user) {
      const { error } = await supabase
        .from("learners")
        .update({
          name: editForm.name.trim(),
          admission_number: editForm.admission.trim() || null,
        })
        .eq("id", editing.id);
      if (error) return message(error.message);
    }
    patchData((current) => ({
      ...current,
      learners: current.learners.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              name: editForm.name.trim(),
              admissionNumber: editForm.admission.trim(),
            }
          : item,
      ),
    }));
    setEditing(null);
  }

  async function removeLearner(learner: Learner) {
    if (!window.confirm(`Remove ${learner.name} and their records?`)) return;
    if (supabase && user) {
      const { error } = await supabase
        .from("learners")
        .delete()
        .eq("id", learner.id);
      if (error) return message(error.message);
    }
    patchData((current) => ({
      ...current,
      learners: current.learners.filter((item) => item.id !== learner.id),
      assessments: current.assessments.filter(
        (item) => item.learnerId !== learner.id,
      ),
      remarks: Object.fromEntries(
        Object.entries(current.remarks).filter(
          ([key]) => !key.startsWith(`${learner.id}:`),
        ),
      ),
    }));
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assessmentClass = data.classes.find(
      (item) => item.id === assessment.classId,
    );
    const rows: Assessment[] = data.learners
      .filter((item) => item.classId === assessment.classId && marked[item.id])
      .map((item) => ({
        id: id(),
        classId: assessment.classId,
        learnerId: item.id,
        strand: assessment.strand.trim(),
        subStrand: assessment.subStrand.trim(),
        level: marked[item.id],
        assessedOn: assessment.date,
        term: assessmentClass?.term ?? "Term 1",
        year: assessmentClass?.year ?? new Date().getFullYear(),
      }));
    if (
      !assessment.strand.trim() ||
      !assessment.subStrand.trim() ||
      !rows.length
    )
      return message(
        "Add a strand and sub-strand, then tap a level for at least one learner.",
      );
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("assessments")
        .insert(
          rows.map((item) => ({
            class_id: item.classId,
            learner_id: item.learnerId,
            strand: item.strand,
            sub_strand: item.subStrand,
            level: item.level,
            assessed_on: item.assessedOn,
            term: item.term,
            year: item.year,
          })),
        )
        .select();
      if (error) return message(error.message);
      rows.forEach((item, index) => {
        item.id = saved[index].id;
      });
    }
    patchData((current) => ({
      ...current,
      assessments: [...rows, ...current.assessments],
    }));
    setMarked({});
    message(`Saved for ${rows.length} learners`);
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cls = data.classes.find((item) => item.id === plan.classId);
    if (
      !cls ||
      !plan.strand.trim() ||
      !plan.subStrand.trim() ||
      !plan.outcomes.trim()
    )
      return message(
        "Choose a class and complete strand, sub-strand and learning outcomes.",
      );
    const entry: LessonPlan = {
      id: id(),
      classId: cls.id,
      grade: cls.grade,
      subject: cls.subject,
      strand: plan.strand.trim(),
      subStrand: plan.subStrand.trim(),
      learningOutcomes: plan.outcomes,
      inquiryQuestion: plan.question,
      resources: plan.resources,
      activities: plan.activities,
      reflection: plan.reflection,
      week: plan.week,
      term: plan.term,
      year: plan.year,
    };
    if (supabase && user) {
      const { data: saved, error } = await supabase
        .from("lesson_plans")
        .insert({
          class_id: entry.classId,
          grade: entry.grade,
          subject: entry.subject,
          strand: entry.strand,
          sub_strand: entry.subStrand,
          learning_outcomes: entry.learningOutcomes,
          inquiry_question: entry.inquiryQuestion,
          resources: entry.resources,
          activities: entry.activities,
          reflection: entry.reflection,
          week: entry.week,
          term: entry.term,
          year: entry.year,
        })
        .select()
        .single();
      if (error) return message(error.message);
      entry.id = saved.id;
    }
    patchData((current) => ({ ...current, plans: [entry, ...current.plans] }));
    message("Lesson plan saved");
  }

  async function saveRemark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLearner) return;
    const remark = String(
      new FormData(event.currentTarget).get("remark") ?? "",
    );
    const key = `${activeLearner.id}:${reportTerm}:${reportYear}`;
    if (supabase && user) {
      const { error } = await supabase
        .from("learner_remarks")
        .upsert(
          {
            learner_id: activeLearner.id,
            term: reportTerm,
            year: reportYear,
            remark,
          },
          { onConflict: "learner_id,term,year" },
        );
      if (error) return message(error.message);
    }
    patchData((current) => ({
      ...current,
      remarks: { ...current.remarks, [key]: remark },
    }));
    message("Remark saved");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.fullName,
      school_name: profile.schoolName,
      phone_number: profile.phoneNumber,
      grades: profile.grades
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      subjects: profile.subjects
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    if (error) return message(error.message);
    message("Profile saved");
  }

  function exportPdf(kind: PrintSheet["kind"], planId?: string) {
    if (kind === "roster" && !activeClass)
      return message("Choose a class before exporting its roster.");
    if (
      kind === "assessment" &&
      (!assessment.classId || !Object.keys(marked).length)
    )
      return message("Choose a class and mark at least one learner first.");
    if (kind === "plans" && !plans.length)
      return message("There are no lesson plans to export.");
    if (kind === "report" && !activeLearner)
      return message("Choose a learner before exporting their report.");
    setPrintSheet({ kind, planId });
  }

  const nav = [
    { id: "home" as const, label: "Home", icon: LayoutDashboard },
    { id: "classes" as const, label: "Classes", icon: Users },
    { id: "assessment" as const, label: "Assess", icon: ClipboardCheck },
    { id: "plans" as const, label: "Plans", icon: NotebookPen },
    { id: "reports" as const, label: "Reports", icon: FileText },
  ];

  if (authLoading)
    return (
      <div className="loading">
        <Brand /> <span>Getting your records ready…</span>
      </div>
    );

  if (!signedIn)
    return (
      <main className="auth-page">
        <div className="auth-brand">
          <Brand />
          <button
            className="icon-button theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
        <section className="auth-panel">
          <p className="eyebrow">LESS PAPERWORK. MORE TEACHING.</p>
          <h1>
            {authMode === "signup"
              ? "Start your teacher account"
              : "Welcome back"}
          </h1>
          <p className="muted">
            Your CBC classes, assessments and lesson plans, together in one
            quiet place.
          </p>
          {supabase ? (
            <form className="stack-form" onSubmit={authenticate}>
              {authMode === "signup" && (
                <>
                  <Field
                    label="Full name"
                    name="fullName"
                    required
                    autoComplete="name"
                  />
                  <Field label="School name" name="schoolName" required />
                  <Field
                    label="Phone number"
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                  />
                  <Field
                    label="Grades taught"
                    name="grades"
                    placeholder="Grade 4, Grade 5"
                    required
                  />
                  <Field
                    label="Subjects taught"
                    name="subjects"
                    placeholder="English, Mathematics"
                    required
                  />
                </>
              )}
              <Field
                label="Email address"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
              <Field
                label="Password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={
                  authMode === "signup" ? "new-password" : "current-password"
                }
              />
              {authError && <p className="form-message">{authError}</p>}
              <button
                className="button primary auth-submit"
                disabled={authBusy}
              >
                {authBusy
                  ? "Please wait…"
                  : authMode === "signup"
                    ? "Create account"
                    : "Sign in"}{" "}
                <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "signin" : "signup");
                  setAuthError("");
                }}
              >
                {authMode === "signup"
                  ? "Already registered? Sign in"
                  : "New to SomaPal? Create an account"}
              </button>
            </form>
          ) : (
            <div className="setup-notice">
              <strong>Connect your private workspace</strong>
              <p>
                Add Supabase credentials to `.env.local` and apply the included
                database migration to enable secure accounts and sync.
              </p>
              <button
                className="button primary"
                onClick={() => {
                  setPreview(true);
                  setData(readPreview());
                }}
              >
                Open on-device preview <ArrowRight size={17} />
              </button>
              <small>
                Preview records stay in this browser and are not synced.
              </small>
            </div>
          )}
        </section>
        <p className="auth-footer">
          Made for the everyday work of Kenyan CBC teachers.
        </p>
      </main>
    );

  const weeklyCount = data.assessments.filter(
    (item) => new Date(`${item.assessedOn}T00:00:00`) >= currentWeekStart,
  ).length;
  const currentAssessments = data.assessments.filter(
    (item) =>
      item.learnerId === learnerId &&
      item.term === reportTerm &&
      item.year === reportYear,
  );
  const grouped = currentAssessments.reduce<Record<string, Assessment[]>>(
    (groups, item) => {
      const subject =
        data.classes.find((cls) => cls.id === item.classId)?.subject ??
        "Subject";
      const key = `${subject} / ${item.strand}`;
      groups[key] = [...(groups[key] ?? []), item];
      return groups;
    },
    {},
  );
  const plans = data.plans.filter(
    (item) =>
      (planTerm === "All terms" || item.term === planTerm) &&
      (planWeek === "All weeks" || item.week === Number(planWeek)),
  );
  const learnerCount = (idValue: string) =>
    data.learners.filter((item) => item.classId === idValue).length;
  const printablePlans =
    printSheet?.kind === "plans"
      ? plans.filter((item) => !printSheet.planId || item.id === printSheet.planId)
      : [];

  return (
    <div className="app-shell">
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      <header className="topbar">
        <button className="wordmark" onClick={() => setView("home")}>
          <Brand />
        </button>
        <div className="topbar-right">
          {preview && <span className="preview-badge">On-device preview</span>}
          <button
            className="icon-button theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="icon-button"
            aria-label="Teacher profile"
            onClick={() => setView("account")}
          >
            <Settings size={19} />
          </button>
          <span className="avatar">
            {(profile.fullName || user?.email || "T").slice(0, 1).toUpperCase()}
          </span>
        </div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <p className="side-label">YOUR WORKSPACE</p>
          <nav>
            {nav.map(({ id: target, label, icon: Icon }) => (
              <button
                key={target}
                className={`nav-link ${view === target ? "active" : ""}`}
                onClick={() => setView(target)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {target === "classes" && data.classes.length > 0 && (
                  <small>{data.classes.length}</small>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="teacher-mini">
              <span className="avatar">
                {(profile.fullName || user?.email || "T")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <span>
                <strong>{profile.fullName || "Teacher"}</strong>
                <small>{profile.schoolName || "My school"}</small>
              </span>
            </div>
            <button className="nav-link" onClick={() => void signOut()}>
              <LogOut size={17} />
              <span>{preview ? "Exit preview" : "Sign out"}</span>
            </button>
          </div>
        </aside>
        <main className="main-content">
          {view === "home" && (
            <>
              <div className="page-heading home-heading">
                <div>
                  <p className="eyebrow">
                    {new Intl.DateTimeFormat("en-KE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                      .format(today)
                      .toUpperCase()}
                  </p>
                  <h1>
                    Good morning
                    {profile.fullName
                      ? `, ${profile.fullName.split(" ")[0]}`
                      : ""}
                    .
                  </h1>
                  <p className="muted">
                    Your teaching day, a little more organised.
                  </p>
                </div>
                <button
                  className="button primary desktop-cta"
                  onClick={() => setView("assessment")}
                >
                  <Plus size={17} /> Record assessment
                </button>
              </div>
              <section className="summary-grid">
                <Summary
                  label="My classes"
                  value={data.classes.length}
                  caption="Active this term"
                  icon={<Users size={19} />}
                />
                <Summary
                  label="Learners"
                  value={data.learners.length}
                  caption="Across all classes"
                  icon={<BookOpen size={19} />}
                />
                <Summary
                  label="Assessments"
                  value={weeklyCount}
                  caption="Recorded this week"
                  icon={<ClipboardCheck size={19} />}
                />
              </section>
              <section className="content-section">
                <SectionTitle
                  eyebrow="PICK UP WHERE YOU LEFT OFF"
                  title="Quick actions"
                />
                <div className="action-grid">
                  <Action
                    title="Record assessment"
                    detail="Tap a level for each learner"
                    icon={<ClipboardCheck size={20} />}
                    onClick={() => setView("assessment")}
                  />
                  <Action
                    title="New lesson plan"
                    detail="Capture this week's learning"
                    icon={<NotebookPen size={20} />}
                    onClick={() => setView("plans")}
                  />
                  <Action
                    title="My classes"
                    detail="Learners and class details"
                    icon={<Users size={20} />}
                    onClick={() => setView("classes")}
                  />
                </div>
              </section>
              <section className="content-section">
                <SectionTitle
                  eyebrow="YOUR TEACHING"
                  title="My classes"
                  action={
                    <button
                      className="text-button"
                      onClick={() => setView("classes")}
                    >
                      View all <ArrowRight size={15} />
                    </button>
                  }
                />
                {data.classes.length ? (
                  <div className="class-grid">
                    {data.classes.slice(0, 3).map((item) => (
                      <button
                        className="class-card"
                        key={item.id}
                        onClick={() => {
                          setClassId(item.id);
                          setView("classes");
                        }}
                      >
                        <span className="class-card-top">
                          <span className="grade-token">
                            {item.grade.replace("Grade ", "")}
                          </span>
                          <span className="term-badge">
                            {item.term} {item.year}
                          </span>
                        </span>
                        <strong>{item.name}</strong>
                        <span className="muted">{item.subject}</span>
                        <span className="class-card-foot">
                          {learnerCount(item.id)} learners{" "}
                          <ArrowRight size={15} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Your classes will appear here"
                    text="Add a class to get started with learners and records."
                    button="Add your first class"
                    onClick={() => setView("classes")}
                  />
                )}
              </section>
            </>
          )}

          {view === "classes" && (
            <>
              <PageTitle
                eyebrow="YOUR TEACHING SPACE"
                title="My classes"
                subtitle="Keep each class and its learner list in one place."
              />
              <section className="panel">
                <SectionTitle
                  title="Add a class"
                  detail="Set up a class for this term."
                  icon={<Plus size={18} />}
                />
                <form className="form-grid class-form" onSubmit={addClass}>
                  <Field
                    label="Class name"
                    value={classForm.name}
                    onChange={(value) =>
                      setClassForm({ ...classForm, name: value })
                    }
                    placeholder="Grade 5 West"
                    required
                  />
                  <Select
                    label="Grade"
                    value={classForm.grade}
                    onChange={(value) =>
                      setClassForm({ ...classForm, grade: value })
                    }
                    options={grades}
                  />
                  <Field
                    label="Subject"
                    value={classForm.subject}
                    onChange={(value) =>
                      setClassForm({ ...classForm, subject: value })
                    }
                    placeholder="Mathematics"
                    required
                  />
                  <Select
                    label="Term"
                    value={classForm.term}
                    onChange={(value) =>
                      setClassForm({ ...classForm, term: value })
                    }
                    options={["Term 1", "Term 2", "Term 3"]}
                  />
                  <Field
                    label="Year"
                    type="number"
                    value={String(classForm.year)}
                    onChange={(value) =>
                      setClassForm({ ...classForm, year: Number(value) })
                    }
                    required
                  />
                  <button className="button primary form-end">
                    <Plus size={17} /> Add class
                  </button>
                </form>
                <div className="roster-import">
                  <div className="roster-import-heading">
                    <div>
                      <h3>
                        <ScanLine size={18} /> Scan a class list
                      </h3>
                      <p className="muted">
                        Add class details above, then take a clear photo or
                        choose an image of the learner list.
                      </p>
                    </div>
                    <label className="button secondary scan-file-button">
                      <Camera size={16} />
                      {rosterFile ? "Change image" : "Take photo / choose image"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => {
                          setRosterFile(event.target.files?.[0] ?? null);
                          setRosterDraft([]);
                        }}
                      />
                    </label>
                  </div>
                  {rosterFile && (
                    <div className="scan-controls">
                      <span>{rosterFile.name}</span>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={scanBusy}
                        onClick={() => void scanRoster()}
                      >
                        <ScanLine size={16} />
                        {scanBusy
                          ? `Scanning ${scanProgress}%`
                          : "Read learner list"}
                      </button>
                    </div>
                  )}
                  <small className="scan-privacy">
                    Text recognition runs in your browser. The first scan may
                    download the English OCR model; the photo is not uploaded.
                  </small>
                  {!!rosterDraft.length && (
                    <div className="roster-review">
                      <div className="roster-review-heading">
                        <strong>Review scanned learners</strong>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            setRosterDraft([
                              ...rosterDraft,
                              { name: "", admissionNumber: "" },
                            ])
                          }
                        >
                          <Plus size={15} /> Add row
                        </button>
                      </div>
                      <p className="muted">
                        Correct names and admission numbers before saving.
                      </p>
                      {rosterDraft.map((row, index) => (
                        <div className="roster-draft-row" key={index}>
                          <input
                            aria-label={`Learner ${index + 1} name`}
                            value={row.name}
                            placeholder="Learner name"
                            onChange={(event) =>
                              setRosterDraft((current) =>
                                current.map((item, rowIndex) =>
                                  rowIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <input
                            aria-label={`Learner ${index + 1} admission number`}
                            value={row.admissionNumber}
                            placeholder="Admission no. (optional)"
                            onChange={(event) =>
                              setRosterDraft((current) =>
                                current.map((item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        admissionNumber: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                          <button
                            className="icon-button danger"
                            type="button"
                            aria-label={`Remove learner row ${index + 1}`}
                            onClick={() =>
                              setRosterDraft((current) =>
                                current.filter(
                                  (_item, rowIndex) => rowIndex !== index,
                                ),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="button primary"
                        type="button"
                        onClick={() => void saveScannedClass()}
                      >
                        <Users size={16} /> Create class and add learners
                      </button>
                    </div>
                  )}
                </div>
              </section>
              <div className="class-workspace">
                <section className="panel class-picker">
                  <SectionTitle title="Classes" badge={data.classes.length} />
                  {data.classes.map((item) => (
                    <button
                      className={`class-option ${classId === item.id ? "selected" : ""}`}
                      key={item.id}
                      onClick={() => {
                        setClassId(item.id);
                        setSearch("");
                      }}
                    >
                      <span className="grade-token">
                        {item.grade.replace("Grade ", "")}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.subject} · {item.term} {item.year}
                        </small>
                      </span>
                      <span className="option-count">
                        {learnerCount(item.id)}
                      </span>
                    </button>
                  ))}
                  {!data.classes.length && (
                    <p className="empty-inline">
                      No classes yet. Add one above.
                    </p>
                  )}
                </section>
                <section className="panel roster-panel">
                  {activeClass ? (
                    <>
                      <div className="roster-heading">
                        <div>
                          <p className="eyebrow">
                            {activeClass.grade} · {activeClass.subject}
                          </p>
                          <h2>{activeClass.name}</h2>
                        </div>
                        <div className="roster-actions">
                          <span className="term-badge">
                            {activeClass.term} {activeClass.year}
                          </span>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => exportPdf("roster")}
                          >
                            <Download size={16} /> Export PDF
                          </button>
                        </div>
                      </div>
                      <form className="learner-add" onSubmit={addLearner}>
                        <Field
                          label="Learner name"
                          value={learnerForm.name}
                          onChange={(value) =>
                            setLearnerForm({ ...learnerForm, name: value })
                          }
                          placeholder="Full name"
                          required
                        />
                        <Field
                          label="Admission no."
                          value={learnerForm.admission}
                          onChange={(value) =>
                            setLearnerForm({ ...learnerForm, admission: value })
                          }
                          placeholder="Optional"
                        />
                        <button className="button secondary">
                          <Plus size={16} /> Add learner
                        </button>
                      </form>
                      <details className="bulk-box">
                        <summary>
                          <Users size={16} /> Add a list of names
                        </summary>
                        <p>
                          Paste one learner per line. Use Name | Admission no.
                          to include admission numbers.
                        </p>
                        <textarea
                          rows={4}
                          value={bulk}
                          onChange={(event) => setBulk(event.target.value)}
                          placeholder={"Amina Wanjiku\nBrian Otieno\n…"}
                        />
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => void addBulk()}
                        >
                          <Plus size={16} /> Add names
                        </button>
                      </details>
                      <div className="roster-tools">
                        <h3>
                          Learners{" "}
                          <span className="count-badge">
                            {learnerCount(activeClass.id)}
                          </span>
                        </h3>
                        <label className="search-box">
                          <Search size={16} />
                          <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            aria-label="Search learners"
                            placeholder="Search learners"
                          />
                        </label>
                      </div>
                      <div className="learner-list">
                        {roster.map((item) =>
                          editing?.id === item.id ? (
                            <form
                              className="learner-row edit-learner"
                              key={item.id}
                              onSubmit={saveEdit}
                            >
                              <input
                                aria-label="Learner name"
                                value={editForm.name}
                                onChange={(event) =>
                                  setEditForm({
                                    ...editForm,
                                    name: event.target.value,
                                  })
                                }
                                required
                              />
                              <input
                                aria-label="Admission number"
                                value={editForm.admission}
                                onChange={(event) =>
                                  setEditForm({
                                    ...editForm,
                                    admission: event.target.value,
                                  })
                                }
                                placeholder="Admission no."
                              />
                              <button
                                className="icon-button"
                                aria-label="Save learner"
                              >
                                <Check size={17} />
                              </button>
                              <button
                                className="icon-button"
                                type="button"
                                aria-label="Cancel"
                                onClick={() => setEditing(null)}
                              >
                                <X size={17} />
                              </button>
                            </form>
                          ) : (
                            <div className="learner-row" key={item.id}>
                              <span className="learner-initial">
                                {item.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="learner-copy">
                                <strong>{item.name}</strong>
                                <small>
                                  {item.admissionNumber ||
                                    "No admission number"}
                                </small>
                              </span>
                              <button
                                className="icon-button"
                                aria-label={`Edit ${item.name}`}
                                onClick={() => {
                                  setEditing(item);
                                  setEditForm({
                                    name: item.name,
                                    admission: item.admissionNumber,
                                  });
                                }}
                              >
                                <Settings size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                aria-label={`Remove ${item.name}`}
                                onClick={() => void removeLearner(item)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ),
                        )}
                        {!roster.length && (
                          <p className="empty-inline">
                            {search
                              ? "No learners match your search."
                              : "No learners in this class yet."}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <Empty
                      title="Select a class"
                      text="Choose a class to manage its learner list."
                    />
                  )}
                </section>
              </div>
            </>
          )}

          {view === "assessment" && (
            <>
              <PageTitle
                eyebrow="QUICK ASSESSMENT"
                title="How are they doing?"
                subtitle="Choose a strand, then tap one level for each learner."
              />
              {!data.classes.length ? (
                <Empty
                  title="Add a class first"
                  text="Learners need a class before you can record an assessment."
                  button="Go to my classes"
                  onClick={() => setView("classes")}
                />
              ) : (
                <form onSubmit={saveAssessment}>
                  <section className="panel assessment-setup">
                    <div className="form-grid">
                      <Select
                        label="Class"
                        value={assessment.classId}
                        onChange={(value) => {
                          setAssessment({ ...assessment, classId: value });
                          setClassId(value);
                          setMarked({});
                        }}
                        options={data.classes.map((item) => item.id)}
                        labels={Object.fromEntries(
                          data.classes.map((item) => [
                            item.id,
                            `${item.name} · ${item.subject}`,
                          ]),
                        )}
                      />
                      <Field
                        label="Strand"
                        value={assessment.strand}
                        onChange={(value) =>
                          setAssessment({ ...assessment, strand: value })
                        }
                        placeholder="e.g. Numbers"
                        required
                      />
                      <Field
                        label="Sub-strand"
                        value={assessment.subStrand}
                        onChange={(value) =>
                          setAssessment({ ...assessment, subStrand: value })
                        }
                        placeholder="e.g. Whole numbers"
                        required
                      />
                      <Field
                        label="Date"
                        type="date"
                        value={assessment.date}
                        onChange={(value) =>
                          setAssessment({ ...assessment, date: value })
                        }
                        required
                      />
                    </div>
                  </section>
                  {assessment.classId && (
                    <>
                      <div className="level-legend">
                        {levels.map((level) => (
                          <span key={level.code}>
                            <i className={`level-dot ${level.style}`} />
                            <b>{level.code}</b> {level.label}
                          </span>
                        ))}
                      </div>
                      <section className="panel assessment-list">
                        {data.learners
                          .filter((item) => item.classId === assessment.classId)
                          .map((item, index) => (
                            <div className="assessment-row" key={item.id}>
                              <span className="row-number">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="assessment-learner">
                                <strong>{item.name}</strong>
                                <small>{item.admissionNumber || " "}</small>
                              </span>
                              <div className="level-buttons">
                                {levels.map((level) => (
                                  <button
                                    key={level.code}
                                    type="button"
                                    aria-label={`${item.name}: ${level.label}`}
                                    aria-pressed={
                                      marked[item.id] === level.code
                                    }
                                    className={`level-button ${level.style} ${marked[item.id] === level.code ? "chosen" : ""}`}
                                    onClick={() =>
                                      setMarked({
                                        ...marked,
                                        [item.id]: level.code,
                                      })
                                    }
                                  >
                                    {level.code}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        {data.learners.filter(
                          (item) => item.classId === assessment.classId,
                        ).length === 0 && (
                          <p className="empty-inline">
                            Add learners to this class to start assessing.
                          </p>
                        )}
                      </section>
                      <div className="assessment-footer">
                        <span>
                          {Object.keys(marked).length} of{" "}
                          {
                            data.learners.filter(
                              (item) => item.classId === assessment.classId,
                            ).length
                          }{" "}
                          learners marked
                        </span>
                        <button
                          type="button"
                          className="button secondary"
                          disabled={!Object.keys(marked).length}
                          onClick={() => exportPdf("assessment")}
                        >
                          <Download size={16} /> Export PDF
                        </button>
                        <button
                          className="button primary"
                          disabled={!Object.keys(marked).length}
                        >
                          <Check size={17} /> Save assessment
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </>
          )}

          {view === "plans" && (
            <>
              <PageTitle
                eyebrow="CBC LESSON PLANNING"
                title="Lesson plans"
                subtitle="A clear record of what you planned and how the lesson went."
              />
              {!data.classes.length ? (
                <Empty
                  title="Add a class first"
                  text="Lesson plans are saved with a class, term and week."
                  button="Go to my classes"
                  onClick={() => setView("classes")}
                />
              ) : (
                <>
                  <section className="panel">
                    <SectionTitle
                      title="New lesson plan"
                      detail="Fill in the essentials. Reflection can be added after the lesson."
                      icon={<NotebookPen size={19} />}
                    />
                    <form className="lesson-form" onSubmit={savePlan}>
                      <div className="form-grid">
                        <Select
                          label="Class"
                          value={plan.classId}
                          onChange={(value) => {
                            const cls = data.classes.find(
                              (item) => item.id === value,
                            );
                            setPlan({
                              ...plan,
                              classId: value,
                              term: cls?.term ?? plan.term,
                              year: cls?.year ?? plan.year,
                            });
                          }}
                          options={data.classes.map((item) => item.id)}
                          labels={Object.fromEntries(
                            data.classes.map((item) => [
                              item.id,
                              `${item.name} · ${item.subject}`,
                            ]),
                          )}
                        />
                        <Select
                          label="Term"
                          value={plan.term}
                          onChange={(value) =>
                            setPlan({ ...plan, term: value })
                          }
                          options={["Term 1", "Term 2", "Term 3"]}
                        />
                        <Field
                          label="Week"
                          type="number"
                          min="1"
                          max="20"
                          value={String(plan.week)}
                          onChange={(value) =>
                            setPlan({ ...plan, week: Number(value) })
                          }
                        />
                        <Field
                          label="Year"
                          type="number"
                          value={String(plan.year)}
                          onChange={(value) =>
                            setPlan({ ...plan, year: Number(value) })
                          }
                        />
                      </div>
                      <div className="form-grid">
                        <Field
                          label="Strand"
                          value={plan.strand}
                          onChange={(value) =>
                            setPlan({ ...plan, strand: value })
                          }
                          placeholder="e.g. Living things"
                          required
                        />
                        <Field
                          label="Sub-strand"
                          value={plan.subStrand}
                          onChange={(value) =>
                            setPlan({ ...plan, subStrand: value })
                          }
                          placeholder="e.g. Plants"
                          required
                        />
                      </div>
                      <TextArea
                        label="Specific learning outcomes"
                        value={plan.outcomes}
                        onChange={(value) =>
                          setPlan({ ...plan, outcomes: value })
                        }
                        placeholder="By the end of the lesson, the learner should be able to…"
                        required
                      />
                      <TextArea
                        label="Key inquiry question"
                        value={plan.question}
                        onChange={(value) =>
                          setPlan({ ...plan, question: value })
                        }
                        placeholder="What question will guide the learning?"
                      />
                      <TextArea
                        label="Learning resources"
                        value={plan.resources}
                        onChange={(value) =>
                          setPlan({ ...plan, resources: value })
                        }
                        placeholder="Books, materials, local environment…"
                      />
                      <TextArea
                        label="Learning activities"
                        value={plan.activities}
                        onChange={(value) =>
                          setPlan({ ...plan, activities: value })
                        }
                        placeholder="Introduction, learner activities, conclusion…"
                        rows={4}
                      />
                      <TextArea
                        label="Reflection"
                        value={plan.reflection}
                        onChange={(value) =>
                          setPlan({ ...plan, reflection: value })
                        }
                        placeholder="What worked? What needs follow-up?"
                      />
                      <button className="button primary">
                        <Check size={17} /> Save lesson plan
                      </button>
                    </form>
                  </section>
                  <section className="content-section plans-list-section">
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">YOUR PLANNING RECORD</p>
                        <h2>Saved lesson plans</h2>
                      </div>
                      <div className="planning-actions">
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => exportPdf("plans")}
                        >
                          <Download size={16} /> Export PDF
                        </button>
                        <div className="filter-row">
                          <Select
                            label="Term"
                            compact
                            value={planTerm}
                            onChange={setPlanTerm}
                            options={[
                              "All terms",
                              "Term 1",
                              "Term 2",
                              "Term 3",
                            ]}
                          />
                          <Select
                            label="Week"
                            compact
                            value={planWeek}
                            onChange={setPlanWeek}
                            options={[
                              "All weeks",
                              ...Array.from({ length: 14 }, (_, index) =>
                                String(index + 1),
                              ),
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                    {plans.length ? (
                      <div className="plan-list">
                        {plans.map((item) => (
                          <article
                            className="plan-card"
                            data-plan-id={item.id}
                            key={item.id}
                          >
                            <div className="plan-card-top">
                              <span className="week-badge">
                                WEEK {item.week}
                              </span>
                              <span className="term-badge">
                                {item.term} {item.year}
                              </span>
                              <button
                                className="button secondary no-print"
                                type="button"
                                aria-label="Export lesson plan PDF"
                                onClick={() => exportPdf("plans", item.id)}
                              >
                                <Download size={15} /> PDF
                              </button>
                            </div>
                            <h3>
                              {item.strand} <span>·</span> {item.subStrand}
                            </h3>
                            <p className="muted">
                              {item.grade} · {item.subject} ·{" "}
                              {
                                data.classes.find(
                                  (cls) => cls.id === item.classId,
                                )?.name
                              }
                            </p>
                            <p className="outcome-preview">
                              {item.learningOutcomes}
                            </p>
                            <details>
                              <summary>View full plan</summary>
                              <PlanBody plan={item} />
                            </details>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="No plans match these filters"
                        text="Save a lesson plan or adjust the term and week."
                      />
                    )}
                  </section>
                </>
              )}
            </>
          )}

          {view === "reports" && (
            <>
              <PageTitle
                eyebrow="LEARNER PROGRESS"
                title="Learner reports"
                subtitle="Review progress by subject and strand, then add your end-of-term remark."
              />
              {!data.classes.length ? (
                <Empty
                  title="Add a class first"
                  text="Reports are built from your class assessment records."
                  button="Go to my classes"
                  onClick={() => setView("classes")}
                />
              ) : (
                <>
                  <section className="panel report-filters">
                    <Select
                      label="Class"
                      value={classId}
                      onChange={(value) => {
                        setClassId(value);
                        setLearnerId(
                          data.learners.find((item) => item.classId === value)
                            ?.id ?? "",
                        );
                      }}
                      options={data.classes.map((item) => item.id)}
                      labels={Object.fromEntries(
                        data.classes.map((item) => [
                          item.id,
                          `${item.name} · ${item.subject}`,
                        ]),
                      )}
                    />
                    <Select
                      label="Learner"
                      value={learnerId}
                      onChange={setLearnerId}
                      options={data.learners
                        .filter((item) => item.classId === classId)
                        .map((item) => item.id)}
                      labels={Object.fromEntries(
                        data.learners
                          .filter((item) => item.classId === classId)
                          .map((item) => [item.id, item.name]),
                      )}
                    />
                    <Select
                      label="Term"
                      value={reportTerm}
                      onChange={setReportTerm}
                      options={["Term 1", "Term 2", "Term 3"]}
                    />
                    <Field
                      label="Year"
                      type="number"
                      value={String(reportYear)}
                      onChange={(value) => setReportYear(Number(value))}
                    />
                  </section>
                  {activeLearner ? (
                    <section className="panel report-sheet">
                      <div className="report-heading">
                        <div>
                          <p className="eyebrow">LEARNER PROGRESS REPORT</p>
                          <h2>{activeLearner.name}</h2>
                          <p className="muted">
                            {
                              data.classes.find(
                                (item) => item.id === activeLearner.classId,
                              )?.name
                            }{" "}
                            ·{" "}
                            {
                              data.classes.find(
                                (item) => item.id === activeLearner.classId,
                              )?.subject
                            }{" "}
                            · {reportTerm} {reportYear}
                          </p>
                          {activeLearner.admissionNumber && (
                            <small>
                              Admission no. {activeLearner.admissionNumber}
                            </small>
                          )}
                        </div>
                        <button
                          className="button secondary no-print"
                          type="button"
                          onClick={() => exportPdf("report")}
                        >
                          <Download size={17} /> Export PDF
                        </button>
                      </div>
                      <div className="report-assessments">
                        <h3>Recorded assessments</h3>
                        {Object.keys(grouped).length ? (
                          Object.entries(grouped).map(([group, entries]) => (
                            <div className="report-group" key={group}>
                              <div className="report-group-title">
                                <strong>{group}</strong>
                                <span>
                                  {entries.length} record
                                  {entries.length === 1 ? "" : "s"}
                                </span>
                              </div>
                              {entries.map((entry) => (
                                <div className="report-result" key={entry.id}>
                                  <span>{entry.subStrand}</span>
                                  <time>
                                    {new Date(
                                      `${entry.assessedOn}T00:00:00`,
                                    ).toLocaleDateString("en-KE", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </time>
                                  <b
                                    className={`result ${entry.level.toLowerCase()}`}
                                  >
                                    {entry.level}
                                  </b>
                                </div>
                              ))}
                            </div>
                          ))
                        ) : (
                          <p className="empty-inline">
                            No assessments recorded for this learner yet.
                          </p>
                        )}
                      </div>
                      <form className="remark-form" onSubmit={saveRemark}>
                        <TextArea
                          key={`${learnerId}-${reportTerm}-${reportYear}`}
                          label="Teacher's end-of-term remark"
                          name="remark"
                          defaultValue={
                            data.remarks[
                              `${learnerId}:${reportTerm}:${reportYear}`
                            ] ?? ""
                          }
                          placeholder="A short note on progress and next steps…"
                          rows={3}
                        />
                        <button className="button primary no-print">
                          <Check size={17} /> Save remark
                        </button>
                      </form>
                    </section>
                  ) : (
                    <Empty
                      title="Choose a learner"
                      text="Select a learner to view their progress."
                    />
                  )}
                </>
              )}
            </>
          )}

          {view === "account" && (
            <>
              <PageTitle
                eyebrow="YOUR ACCOUNT"
                title="Teacher profile"
                subtitle="Your details help keep your records organised."
              />
              <section className="panel">
                {supabase && user ? (
                  <form
                    className="form-grid profile-form"
                    onSubmit={saveProfile}
                  >
                    <Field
                      label="Full name"
                      value={profile.fullName}
                      onChange={(value) =>
                        setProfile({ ...profile, fullName: value })
                      }
                      required
                    />
                    <Field
                      label="School name"
                      value={profile.schoolName}
                      onChange={(value) =>
                        setProfile({ ...profile, schoolName: value })
                      }
                      required
                    />
                    <Field
                      label="Phone number"
                      type="tel"
                      value={profile.phoneNumber}
                      onChange={(value) =>
                        setProfile({ ...profile, phoneNumber: value })
                      }
                      required
                    />
                    <Field
                      label="Grades taught"
                      value={profile.grades}
                      onChange={(value) =>
                        setProfile({ ...profile, grades: value })
                      }
                      required
                      hint="Separate multiple grades with commas."
                    />
                    <Field
                      label="Subjects taught"
                      value={profile.subjects}
                      onChange={(value) =>
                        setProfile({ ...profile, subjects: value })
                      }
                      required
                      hint="Separate multiple subjects with commas."
                    />
                    <button className="button primary">
                      <Check size={17} /> Save profile
                    </button>
                  </form>
                ) : (
                  <div className="preview-account">
                    <span className="preview-badge">On-device preview</span>
                    <p>
                      This preview stays in this browser. Connect Supabase to
                      create a private account and sync your records securely.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => void signOut()}
                    >
                      Exit preview
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Main navigation">
        {nav.map(({ id: target, label, icon: Icon }) => (
          <button
            className={view === target ? "active" : ""}
            key={target}
            onClick={() => setView(target)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="print-only print-brand">
        SomaPal · CBC Teacher Records
      </div>
      {printSheet && (
        <section className={`pdf-sheet pdf-${printSheet.kind}`}>
          <header className="pdf-header">
            <p className="eyebrow">SOMAPAL · CBC TEACHER RECORDS</p>
            <h1>
              {printSheet.kind === "roster" && "Class learner register"}
              {printSheet.kind === "assessment" && "Class assessment"}
              {printSheet.kind === "plans" && "Lesson plans"}
              {printSheet.kind === "report" && "Learner progress report"}
            </h1>
            {printSheet.kind === "roster" && activeClass && (
              <p>
                {activeClass.name} · {activeClass.grade} · {activeClass.subject} ·{" "}
                {activeClass.term} {activeClass.year}
              </p>
            )}
            {printSheet.kind === "assessment" && (
              <p>
                {data.classes.find((item) => item.id === assessment.classId)
                  ?.name ?? "Class"}{" "}
                · {assessment.strand} / {assessment.subStrand} ·{" "}
                {assessment.date}
              </p>
            )}
            {printSheet.kind === "report" && activeLearner && (
              <p>
                {activeLearner.name} ·{" "}
                {data.classes.find(
                  (item) => item.id === activeLearner.classId,
                )?.name ?? "Class"}{" "}
                · {reportTerm} {reportYear}
              </p>
            )}
            {printSheet.kind === "plans" && (
              <p>
                {planTerm === "All terms" ? "All terms" : planTerm}
                {planWeek === "All weeks" ? "" : ` · Week ${planWeek}`}
              </p>
            )}
          </header>
          {printSheet.kind === "roster" && activeClass && (
            <table className="pdf-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Learner name</th>
                  <th>Admission number</th>
                </tr>
              </thead>
              <tbody>
                {data.learners
                  .filter((item) => item.classId === activeClass.id)
                  .map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.admissionNumber || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          {printSheet.kind === "assessment" && (
            <>
              <p className="pdf-subtitle">
                Term{" "}
                {data.classes.find((item) => item.id === assessment.classId)
                  ?.term ?? "1"}{" "}
                · {data.classes.find((item) => item.id === assessment.classId)
                  ?.year ?? currentYear}
              </p>
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Learner name</th>
                    <th>Admission number</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {data.learners
                    .filter((item) => item.classId === assessment.classId)
                    .map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.name}</td>
                        <td>{item.admissionNumber || "—"}</td>
                        <td>{marked[item.id] || "Not marked"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
          {printSheet.kind === "plans" &&
            printablePlans.map((item) => (
              <article className="pdf-plan" key={item.id}>
                <h2>
                  {item.strand} · {item.subStrand}
                </h2>
                <p>
                  {item.grade} · {item.subject} ·{" "}
                  {data.classes.find((cls) => cls.id === item.classId)?.name} ·
                  Week {item.week} · {item.term} {item.year}
                </p>
                <PlanBody plan={item} />
              </article>
            ))}
          {printSheet.kind === "report" && activeLearner && (
            <>
              {activeLearner.admissionNumber && (
                <p>Admission number: {activeLearner.admissionNumber}</p>
              )}
              <h2>Recorded assessments</h2>
              {Object.keys(grouped).length ? (
                Object.entries(grouped).map(([group, entries]) => (
                  <section className="pdf-report-group" key={group}>
                    <h3>{group}</h3>
                    <table className="pdf-table">
                      <thead>
                        <tr>
                          <th>Sub-strand</th>
                          <th>Date</th>
                          <th>Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.subStrand}</td>
                            <td>{entry.assessedOn}</td>
                            <td>{entry.level}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))
              ) : (
                <p>No assessments recorded for this learner yet.</p>
              )}
              <h2>Teacher's end-of-term remark</h2>
              <p className="pdf-remark">
                {data.remarks[
                  `${activeLearner.id}:${reportTerm}:${reportYear}`
                ] || "No remark recorded."}
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark">
        <BookOpen size={19} />
      </span>
      <strong>SomaPal</strong>
    </span>
  );
}
function Field({
  label,
  value,
  onChange,
  name,
  hint,
  ...props
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  min?: string;
  max?: string;
  minLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        {...props}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  labels = {},
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <label className={`field ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={item} value={item}>
            {labels[item] ?? item}
          </option>
        ))}
      </select>
    </label>
  );
}
function TextArea({
  label,
  value,
  defaultValue,
  onChange,
  name,
  rows = 3,
  required,
  placeholder,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        rows={rows}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  );
}
function SectionTitle({
  eyebrow,
  title,
  detail,
  icon,
  action,
  badge,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  icon?: ReactNode;
  action?: ReactNode;
  badge?: number;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>
          {icon}
          {title}
          {badge !== undefined && <span className="count-badge">{badge}</span>}
        </h2>
        {detail && <p className="muted">{detail}</p>}
      </div>
      {action}
    </div>
  );
}
function Summary({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: number;
  caption: string;
  icon: ReactNode;
}) {
  return (
    <article className="summary-card">
      <span className="summary-icon">{icon}</span>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}
function Action({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className="action-card" onClick={onClick}>
      <span className="action-icon">{icon}</span>
      <span className="action-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRight className="action-arrow" size={18} />
    </button>
  );
}
function Empty({
  title,
  text,
  button,
  onClick,
}: {
  title: string;
  text: string;
  button?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={22} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {button && onClick && (
        <button className="button secondary" onClick={onClick}>
          {button} <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function PlanBody({ plan }: { plan: LessonPlan }) {
  return (
    <div className="plan-details">
      {[
        ["Learning outcomes", plan.learningOutcomes],
        ["Key inquiry question", plan.inquiryQuestion],
        ["Learning resources", plan.resources],
        ["Learning activities", plan.activities],
        ["Reflection", plan.reflection],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <strong>{label}</strong>
            <p>{value}</p>
          </div>
        ))}
    </div>
  );
}

export default App;
