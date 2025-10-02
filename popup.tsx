import React, { useEffect, useRef, useState } from "react";
import "./style.css"

const LS_KEY = "plasmo_extension_state_v1";

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getInitialState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const now = new Date();
  const activity = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(now.getDate() - (6 - i));
    return { date: todayKey(d), seconds: 0 };
  });
  return {
    goal: "Finish weekly report",
    tasks: [
      { id: 1, text: "Quick inbox triage", done: false },
      { id: 2, text: "Standup notes", done: false },
    ],
    activity,
    focusMode: false,
  };
}

function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function ActivityGraph({ activity = [], maxSeconds = 60 }) {
  // small bar chart: 7 bars
  const w = 300;
  const h = 80;
  const padding = 8;
  const barGap = 8;
  const barWidth = (w - padding * 2 - barGap * (activity.length - 1)) / activity.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      {activity.map((a, i) => {
        const val = Math.max(0, a.seconds);
        const height = Math.max(2, (val / Math.max(1, maxSeconds)) * (h - 28));
        const x = padding + i * (barWidth + barGap);
        const y = h - height - 18;
        const isToday = a.date === todayKey();
        return (
          <g key={a.date} transform={`translate(${x},0)`}>
            <rect
              x={0}
              y={y}
              width={barWidth}
              height={height}
              rx={4}
              className={isToday ? "fill-indigo-600" : "fill-gray-300"}
            />
            <text
              x={barWidth / 2}
              y={h - 6}
              fontSize="10"
              textAnchor="middle"
              className="fill-gray-600"
            >
              {a.date.slice(5)}{/* MM-DD */}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function IndexPopup() {
  const [state, setState] = useState(getInitialState);
  const { goal, tasks, activity, focusMode } = state;
  const intervalRef = useRef(null);
  const [taskInput, setTaskInput] = useState("");

  // normalize last 7 days on mount
  useEffect(() => {
    setState((s) => {
      const now = new Date();
      const desired = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        const key = todayKey(d);
        const found = s.activity?.find((a) => a.date === key);
        return { date: key, seconds: found ? found.seconds : 0 };
      });
      const next = { ...s, activity: desired };
      saveState(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(() => {
    saveState(state);
  }, [state]);

  // timer effect
  useEffect(() => {
    if (focusMode) {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        setState((s) => {
          const today = todayKey();
          const nextActivity = s.activity.map((a) =>
            a.date === today ? { ...a, seconds: a.seconds + 1 } : a
          );
          return { ...s, activity: nextActivity };
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [focusMode]);

  // handlers
  function toggleFocusMode() {
    setState((s) => ({ ...s, focusMode: !s.focusMode }));
  }

  function setGoalText(text) {
    setState((s) => ({ ...s, goal: text }));
  }

  function addTask(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    setState((s) => ({ ...s, tasks: [...s.tasks, { id: Date.now(), text: trimmed, done: false }] }));
    setTaskInput("");
  }

  function toggleTask(id) {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  }

  function deleteTask(id) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }

  function clearToday() {
    const today = todayKey();
    setState((s) => ({ ...s, activity: s.activity.map((a) => (a.date === today ? { ...a, seconds: 0 } : a)) }));
  }

  // derived
  const today = todayKey();
  const todayEntry = activity.find((a) => a.date === today) || { seconds: 0 };
  const maxSeconds = Math.max(...activity.map((a) => a.seconds), 60);

  return (
    <div className="w-80 p-4 font-sans">
      <h2 className="text-lg font-semibold mb-2">
        Welcome to your{" "}
        <a href="https://www.plasmo.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
          Plasmo
        </a>{" "}
        Extension!
      </h2>

      {/* Goal */}
      <div className="mb-4">
        <div className="text-xs text-gray-500">Today's Goal</div>
        <input
          value={goal}
          onChange={(e) => setGoalText(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
        />
      </div>

      {/* Time spent + focus button */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="text-xs text-gray-500">Time spent today</div>
          <div className="text-xl font-bold">{formatSeconds(todayEntry.seconds)}</div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={toggleFocusMode}
            className={`px-3 py-2 rounded-md text-white font-semibold shadow-sm focus:outline-none ${
              focusMode ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
            }`}
            aria-pressed={focusMode}
          >
            {focusMode ? "Stop Focus" : "Start Focus"}
          </button>
          <button
            onClick={clearToday}
            className="px-2 py-1 rounded-md border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50"
            title="Reset today's tracked time"
          >
            Reset Today
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">Last 7 days</div>
        <div className="bg-white rounded-md p-2 border border-gray-100">
          <ActivityGraph activity={activity} maxSeconds={maxSeconds} />
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-gray-500">Tasks</div>
          <a href="https://docs.plasmo.com" target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
            View Docs
          </a>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTask(taskInput); }}
            placeholder="Add a task..."
            className="flex-1 px-3 py-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={() => addTask(taskInput)}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          >
            Add
          </button>
        </div>

        <ul className="space-y-2 max-h-40 overflow-auto pr-1">
          {tasks.length === 0 && <li className="text-sm text-gray-500">No tasks yet</li>}
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between bg-white p-2 rounded-md border border-gray-100">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTask(t.id)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <span className={`text-sm ${t.done ? "line-through text-gray-400" : "text-gray-800"}`}>{t.text}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => deleteTask(t.id)} className="text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* small footer */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        Data stored locally • Works offline
      </div>
    </div>
  );
}
