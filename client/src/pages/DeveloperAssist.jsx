import { useMemo, useState } from "react";
import {
  Code2,
  Bug,
  ShieldCheck,
  Lightbulb,
  Search,
  Sparkles,
  Copy,
  Check,
  Terminal,
  BookOpen,
  ChevronRight,
  AlertTriangle,
  Zap,
  FileCode2,
  RefreshCw,
  Lock,
  GitBranch,
} from "lucide-react";

const tools = [
  {
    id: "error",
    title: "Error Explainer",
    description: "Understand errors and find possible solutions.",
    icon: Bug,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    id: "debug",
    title: "Debugging Guide",
    description: "Follow a structured debugging process.",
    icon: Search,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: "review",
    title: "Code Review",
    description: "Review your code quality before committing.",
    icon: Code2,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    id: "security",
    title: "Security Check",
    description: "Check common application security risks.",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

const errorKnowledge = [
  {
    keywords: ["cannot read properties", "undefined"],
    title: "Undefined Property Error",
    explanation:
      "Your code is trying to access a property on a value that is undefined.",
    solution:
      "Check whether the object exists before accessing its property. Use optional chaining (?.), conditional rendering, or validate the API response.",
    example: "const userName = user?.name || 'Guest';",
  },
  {
    keywords: ["is not a function"],
    title: "Function Not Found",
    explanation:
      "You are trying to call something as a function, but its current value is not callable.",
    solution:
      "Check the variable name, import/export syntax, and whether the function actually exists. Also verify that you are calling the correct method.",
    example: "if (typeof myFunction === 'function') {\n  myFunction();\n}",
  },
  {
    keywords: ["failed to fetch", "network error", "econnrefused"],
    title: "Network / Server Connection Error",
    explanation:
      "Your frontend cannot successfully communicate with the backend server.",
    solution:
      "Verify that the backend is running, check your API URL, inspect CORS configuration, and confirm the endpoint and HTTP method.",
    example: "const API_URL = 'http://localhost:5000/api';",
  },
  {
    keywords: ["duplicate key", "e11000"],
    title: "MongoDB Duplicate Key Error",
    explanation:
      "MongoDB rejected the operation because a unique field already exists in another document.",
    solution:
      "Check the unique index, validate the email or other unique field before inserting, and return a proper 409 Conflict response.",
    example:
      "if (error.code === 11000) {\n  return res.status(409).json({\n    message: 'Record already exists'\n  });\n}",
  },
  {
    keywords: ["jwt malformed", "invalid token", "jwt expired"],
    title: "JWT Authentication Error",
    explanation: "The token is invalid, incorrectly formatted, or has expired.",
    solution:
      "Check the Authorization header, token generation secret, expiration time, and Bearer token format.",
    example: "Authorization: Bearer YOUR_JWT_TOKEN",
  },
  {
    keywords: ["cors"],
    title: "CORS Error",
    explanation:
      "The browser is blocking a cross-origin request because the server's CORS policy does not allow it.",
    solution:
      "Configure the backend to allow your frontend origin and the required HTTP methods and headers.",
    example:
      "app.use(cors({\n  origin: process.env.CLIENT_URL,\n  credentials: true\n}));",
  },
  {
    keywords: [
      "module not found",
      "err_module_not_found",
      "cannot find module",
    ],
    title: "Module Not Found",
    explanation:
      "Node.js or your frontend bundler cannot locate a requested module or file.",
    solution:
      "Check the import path, filename spelling, file extension, package installation, and letter casing.",
    example: "import User from '../models/User.js';",
  },
  {
    keywords: ["referenceerror"],
    title: "Reference Error",
    explanation:
      "Your code is accessing a variable that has not been declared or is not available in the current scope.",
    solution: "Check spelling, variable declarations, scope, and imports.",
    example: "const message = 'Hello Developer';\nconsole.log(message);",
  },
  {
    keywords: ["syntaxerror"],
    title: "Syntax Error",
    explanation: "The JavaScript parser found invalid syntax in your code.",
    solution:
      "Check brackets, parentheses, commas, quotes, and JSX tag closing. Read the file and line number shown in the terminal.",
    example: "const user = {\n  name: 'Jinesh',\n  role: 'Developer'\n};",
  },
];

const reviewItems = [
  {
    category: "Code Quality",
    items: [
      "Use meaningful variable and function names",
      "Break large components into smaller components",
      "Remove unused imports and variables",
      "Avoid unnecessary code duplication",
    ],
  },
  {
    category: "Performance",
    items: [
      "Avoid unnecessary component re-renders",
      "Use pagination for large datasets",
      "Optimize images and static assets",
      "Avoid unnecessary database queries",
    ],
  },
  {
    category: "Reliability",
    items: [
      "Handle API errors properly",
      "Validate user input",
      "Add loading and empty states",
      "Test important application flows",
    ],
  },
];

const securityItems = [
  {
    title: "Password Security",
    description:
      "Hash passwords with bcrypt. Never store plain-text passwords.",
    icon: Lock,
  },
  {
    title: "JWT Protection",
    description:
      "Use secure secrets, token expiration, and protected backend routes.",
    icon: ShieldCheck,
  },
  {
    title: "Input Validation",
    description: "Validate and sanitize incoming data on the server.",
    icon: Check,
  },
  {
    title: "Database Security",
    description:
      "Use environment variables and avoid exposing database credentials.",
    icon: Terminal,
  },
  {
    title: "Authorization",
    description:
      "Check resource ownership and user permissions on every protected action.",
    icon: GitBranch,
  },
  {
    title: "HTTP Security",
    description:
      "Use Helmet, HTTPS in production, and carefully configured CORS.",
    icon: ShieldCheck,
  },
];

const nextSteps = [
  {
    title: "Improve project validation",
    description:
      "Validate incoming request data and reject invalid values before database operations.",
    tag: "Backend",
    priority: "High",
  },
  {
    title: "Add automated tests",
    description:
      "Test authentication, project CRUD, task creation, and authorization.",
    tag: "Testing",
    priority: "High",
  },
  {
    title: "Optimize database queries",
    description: "Review indexes, pagination, and unnecessary MongoDB queries.",
    tag: "Database",
    priority: "Medium",
  },
  {
    title: "Prepare production deployment",
    description:
      "Configure production environment variables, logging, and deployment settings.",
    tag: "Deployment",
    priority: "Medium",
  },
];

const resources = [
  {
    title: "React Documentation",
    description: "Components, hooks, state and application architecture.",
    url: "https://react.dev/learn",
    tag: "Frontend",
  },
  {
    title: "Node.js Documentation",
    description: "Runtime, modules, APIs and asynchronous programming.",
    url: "https://nodejs.org/docs/latest/api/",
    tag: "Backend",
  },
  {
    title: "Express Documentation",
    description: "Routing, middleware, error handling and APIs.",
    url: "https://expressjs.com/",
    tag: "Backend",
  },
  {
    title: "MongoDB Documentation",
    description: "Queries, indexes, aggregation and schema design.",
    url: "https://www.mongodb.com/docs/",
    tag: "Database",
  },
  {
    title: "OWASP Top 10",
    description:
      "Learn about the most important web application security risks.",
    url: "https://owasp.org/www-project-top-ten/",
    tag: "Security",
  },
  {
    title: "MDN JavaScript Guide",
    description: "Core JavaScript concepts and language fundamentals.",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
    tag: "JavaScript",
  },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">
        {eyebrow}
      </p>
      <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      )}
    </div>
  );
}

export default function DeveloperAssist() {
  const [activeTool, setActiveTool] = useState("error");
  const [errorInput, setErrorInput] = useState("");
  const [errorResult, setErrorResult] = useState(null);
  const [debugStep, setDebugStep] = useState(0);
  const [checkedItems, setCheckedItems] = useState({});
  const [copied, setCopied] = useState(false);

  const totalReviewItems = useMemo(
    () => reviewItems.reduce((total, group) => total + group.items.length, 0),
    [],
  );

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  const handleExplainError = () => {
    const query = errorInput.trim().toLowerCase();

    if (!query) return;

    const match = errorKnowledge.find((item) =>
      item.keywords.some((keyword) => query.includes(keyword)),
    );

    if (match) {
      setErrorResult(match);
    } else {
      setErrorResult({
        title: "Error Not Recognized",
        explanation:
          "This error is not available in the current built-in knowledge base.",
        solution:
          "Check the complete error message, identify the file and line number, inspect the stack trace, and verify recent code changes. Try searching the exact error message in the official documentation.",
        example: null,
      });
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const toggleChecklist = (key) => {
    setCheckedItems((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const debugSteps = [
    {
      title: "Reproduce the issue",
      description:
        "Identify the exact action that causes the problem. Try to reproduce it consistently.",
      tasks: [
        "Write down the steps to reproduce the issue",
        "Identify which page or API endpoint is affected",
        "Check whether the issue happens every time",
      ],
    },
    {
      title: "Read the error",
      description:
        "Inspect the browser console, terminal, network tab, and backend logs.",
      tasks: [
        "Read the complete error message",
        "Find the file name and line number",
        "Inspect the stack trace",
      ],
    },
    {
      title: "Isolate the problem",
      description:
        "Narrow down the code responsible for the issue instead of changing multiple files at once.",
      tasks: [
        "Check recent code changes",
        "Verify API request and response",
        "Inspect variable values and data types",
      ],
    },
    {
      title: "Fix and verify",
      description:
        "Apply the smallest reasonable fix and verify that it does not break existing features.",
      tasks: [
        "Fix the root cause",
        "Test the original issue again",
        "Check related functionality",
      ],
    },
  ];

  const activeDebugStep = debugSteps[debugStep];

  const renderToolContent = () => {
    if (activeTool === "error") {
      return (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Paste your error message
            </label>

            <textarea
              value={errorInput}
              onChange={(event) => setErrorInput(event.target.value)}
              placeholder="Example: TypeError: Cannot read properties of undefined (reading 'name')"
              rows={5}
              className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#0b0f1a] p-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleExplainError}
            disabled={!errorInput.trim()}
            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={16} />
            Explain Error
          </button>

          {errorResult && (
            <div className="space-y-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                <h3 className="font-semibold text-white">
                  {errorResult.title}
                </h3>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  What happened?
                </p>
                <p className="text-sm leading-6 text-slate-300">
                  {errorResult.explanation}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recommended solution
                </p>
                <p className="text-sm leading-6 text-slate-300">
                  {errorResult.solution}
                </p>
              </div>

              {errorResult.example && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Example
                    </p>

                    <button
                      onClick={() => handleCopy(errorResult.example)}
                      className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <pre className="overflow-x-auto rounded-xl bg-[#080b14] p-4 text-xs leading-6 text-emerald-300">
                    <code>{errorResult.example}</code>
                  </pre>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                This is a built-in troubleshooting guide, not an AI-generated
                diagnosis. Verify the suggested fix against your actual code.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (activeTool === "debug") {
      return (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {debugSteps.map((step, index) => (
              <button
                key={step.title}
                onClick={() => setDebugStep(index)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  debugStep === index
                    ? "bg-indigo-500 text-white"
                    : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
                }`}
              >
                Step {index + 1}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-[#0b0f1a] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Bug size={20} />
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  DEBUGGING PROCESS · {debugStep + 1}/4
                </p>
                <h3 className="font-semibold text-white">
                  {activeDebugStep.title}
                </h3>
              </div>
            </div>

            <p className="mb-5 text-sm leading-6 text-slate-400">
              {activeDebugStep.description}
            </p>

            <div className="space-y-3">
              {activeDebugStep.tasks.map((task, index) => (
                <label
                  key={task}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-indigo-500"
                    checked={!!checkedItems[`debug-${debugStep}-${index}`]}
                    onChange={() =>
                      toggleChecklist(`debug-${debugStep}-${index}`)
                    }
                  />
                  {task}
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setDebugStep((step) => Math.max(0, step - 1))}
                disabled={debugStep === 0}
                className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-slate-300 disabled:opacity-30"
              >
                Previous
              </button>

              <button
                onClick={() => setDebugStep((step) => Math.min(3, step + 1))}
                disabled={debugStep === 3}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-30"
              >
                Next Step
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTool === "review") {
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#0b0f1a] p-4">
            <div>
              <p className="text-sm font-semibold text-white">
                Review Progress
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {checkedCount} of {totalReviewItems} checks completed
              </p>
            </div>

            <div className="text-xl font-bold text-indigo-300">
              {Math.round((checkedCount / totalReviewItems) * 100)}%
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{
                width: `${(checkedCount / totalReviewItems) * 100}%`,
              }}
            />
          </div>

          {reviewItems.map((group) => (
            <div
              key={group.category}
              className="rounded-xl border border-white/[0.07] bg-[#0b0f1a] p-4"
            >
              <h3 className="mb-4 text-sm font-semibold text-white">
                {group.category}
              </h3>

              <div className="space-y-3">
                {group.items.map((item) => {
                  const key = `review-${item}`;

                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-3 text-sm text-slate-400"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedItems[key]}
                        onChange={() => toggleChecklist(key)}
                        className="mt-0.5 accent-indigo-500"
                      />
                      <span
                        className={
                          checkedItems[key] ? "text-slate-500 line-through" : ""
                        }
                      >
                        {item}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={() => setCheckedItems({})}
            className="flex items-center gap-2 text-xs text-slate-500 transition hover:text-white"
          >
            <RefreshCw size={13} />
            Reset checklist
          </button>
        </div>
      );
    }

    if (activeTool === "security") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {securityItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-xl border border-white/[0.07] bg-[#0b0f1a] p-4 transition hover:border-emerald-500/20"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Icon size={18} />
                </div>

                <h3 className="mb-2 text-sm font-semibold text-white">
                  {item.title}
                </h3>

                <p className="text-xs leading-6 text-slate-400">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#171b38] via-[#111629] to-[#0c101b] p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-300">
            <Sparkles size={14} />
            YOUR DEVELOPMENT TOOLKIT
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Build smarter.
            <br />
            <span className="text-indigo-400">Debug faster.</span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
            A dedicated space for debugging, code quality, security awareness,
            and better development practices.
          </p>

          <button
            onClick={() => {
              setActiveTool("error");
              document
                .getElementById("developer-tools")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Explore Developer Tools
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-4 right-8 hidden opacity-20 lg:block">
          <Code2 size={190} strokeWidth={0.8} />
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Developer Tools",
            value: "04",
            icon: Code2,
            color: "text-indigo-400",
          },
          {
            label: "Review Checks",
            value: String(totalReviewItems).padStart(2, "0"),
            icon: Check,
            color: "text-emerald-400",
          },
          {
            label: "Security Topics",
            value: String(securityItems.length).padStart(2, "0"),
            icon: ShieldCheck,
            color: "text-blue-400",
          },
          {
            label: "Learning Resources",
            value: String(resources.length).padStart(2, "0"),
            icon: BookOpen,
            color: "text-purple-400",
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.07] bg-[#101522] p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon size={19} className={stat.color} />
                <Zap size={14} className="text-slate-700" />
              </div>

              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </section>

      {/* Main Tools */}
      <section id="developer-tools">
        <SectionHeading
          eyebrow="Developer Workspace"
          title="What do you want to work on?"
          description="Choose a tool to get started with your development workflow."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-indigo-500/50 bg-indigo-500/[0.08]"
                    : "border-white/[0.07] bg-[#101522] hover:border-white/20"
                }`}
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tool.bg} ${tool.color}`}
                >
                  <Icon size={20} />
                </div>

                <h3 className="text-sm font-semibold text-white">
                  {tool.title}
                </h3>

                <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">
                  {tool.description}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-300">
                    Open Tool
                  </span>
                  <ChevronRight size={15} className="text-slate-500" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Tool */}
      <section className="rounded-2xl border border-white/[0.07] bg-[#101522] p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">
              Interactive Workspace
            </p>
            <h2 className="text-xl font-bold text-white">
              {tools.find((tool) => tool.id === activeTool)?.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {tools.find((tool) => tool.id === activeTool)?.description}
            </p>
          </div>

          <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300 sm:flex">
            <FileCode2 size={20} />
          </div>
        </div>

        {renderToolContent()}
      </section>

      {/* Project Next Steps */}
      <section>
        <SectionHeading
          eyebrow="Development Roadmap"
          title="Recommended next steps"
          description="Practical improvements that can make a development project more reliable and production-ready."
        />

        <div className="grid gap-3 md:grid-cols-2">
          {nextSteps.map((step, index) => (
            <div
              key={step.title}
              className="flex gap-4 rounded-2xl border border-white/[0.07] bg-[#101522] p-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-sm font-bold text-indigo-300">
                0{index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {step.title}
                  </h3>

                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                      step.priority === "High"
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {step.priority}
                  </span>
                </div>

                <p className="text-xs leading-6 text-slate-500">
                  {step.description}
                </p>

                <span className="mt-3 inline-block rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">
                  {step.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Learning Resources */}
      <section>
        <SectionHeading
          eyebrow="Keep Learning"
          title="Developer resources"
          description="Official documentation and trusted references for your development journey."
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <a
              key={resource.title}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-xl border border-white/[0.07] bg-[#101522] p-4 transition hover:border-indigo-500/30 hover:bg-indigo-500/[0.04]"
            >
              <div className="mb-3 flex items-center justify-between">
                <BookOpen size={18} className="text-indigo-400" />
                <ChevronRight
                  size={16}
                  className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-300"
                />
              </div>

              <h3 className="text-sm font-semibold text-white">
                {resource.title}
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {resource.description}
              </p>

              <span className="mt-3 inline-block text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                {resource.tag}
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2 rounded-xl border border-amber-500/10 bg-amber-500/[0.04] p-4 text-xs leading-5 text-slate-400">
        <Lightbulb size={17} className="shrink-0 text-amber-400" />
        Developer Assist currently uses built-in guides and checklists. It does
        not send your code to an AI model or automatically analyze your project.
      </div>
    </div>
  );
}
