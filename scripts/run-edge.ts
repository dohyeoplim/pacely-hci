import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(file: string): void {
    let text: string;
    try {
        text = readFileSync(file, "utf8");
    } catch {
        return;
    }
    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const k = line.slice(0, eq).trim();
        const v = line
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
        if (!(k in process.env)) process.env[k] = v;
    }
}

loadDotEnv(resolve(process.cwd(), ".env.local"));

const action = process.argv[2] ?? "ping";
const allowed = new Set([
    "ping",
    "ensure-schema",
    "log",
    "ensure-event-schema",
    "event",
]);
if (!allowed.has(action)) {
    console.error(`Unknown action: ${action}`);
    console.error(
        "Usage: tsx scripts/run-edge.ts [ping|ensure-schema|log|ensure-event-schema|event]",
    );
    process.exit(2);
}

function syntheticPayload() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tz = -now.getTimezoneOffset();
    const sign = tz >= 0 ? "+" : "-";
    const tzAbs = Math.abs(tz);
    const isoLocal =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
        `${sign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;

    return {
        sessionId: `mtr_test_${Date.now().toString(36)}`,
        planId: `plan_test_${Date.now().toString(36)}`,
        timestamp: isoLocal,
        participantId: "P000",
        appVersion: "0.1.0-prototype",
        backend: "mock",

        experimentGroup: "pacely",
        persona: "gentle",
        personaOrder: "companion-first",
        rewardEnabled: true,

        goalText: "2주 안에 운영체제 시험 준비하기 (테스트 로그)",
        shortTitle: "운영체제 시험",
        goalCategory: "exam",
        planSpanDays: 14,
        dailyHours: 3,
        subjectCount: 4,
        milestoneCount: 3,

        planDurationSec: 142.5,
        timeOnGoalSec: 31.2,
        timeOnPeriodSec: 18.4,
        timeOnHoursSec: 9.1,
        timeOnPersonaSec: 12.7,
        timeOnPlanSec: 71.1,
        planGenerationSec: 4.8,
        goalParseSec: 1.6,

        revisionCount: 1,
        planRegenerationCount: 0,
        missionAddCount: 2,
        missionEditCount: 3,
        missionDeleteCount: 1,
        totalMissionEdits: 6,
        retryCount: 0,

        subtaskCount: 56,
        subtasksPerDayMean: 4,
        subtasksPerDaySd: 0.5,
        taskDurationMeanMin: 32.5,
        taskDurationSdMin: 12.8,

        actionableTaskCount: 48,
        actionableTaskRate: 0.86,
        specificityScoreMean: 0.74,
        timeClarityScore: 0.71,
        priorityClarityScore: 0.66,

        preBurden: 6,
        postBurden: 3,
        burdenReduction: 3,
        confidence: 5,
        planClarity: 6,
        immediateActionability: 6,
        nasaTlxMental: 4,
        nasaTlxTemporal: 5,
        nasaTlxEffort: 5,
        nasaTlxFrustration: 2,
        preSurveyCompleted: true,
        postSurveyCompleted: true,

        locale: "ko-KR",
        userAgent: "scripts/run-edge.ts (synthetic test row)",
        rawJson: JSON.stringify({
            note: "Inserted by scripts/run-edge.ts log smoke test",
            generatedAt: isoLocal,
        }),
    };
}

/* Mini event batch — exercises every column kind in the event DB:
   identity, select, number, checkbox, date, rich_text. Spans multiple
   event types so the Notion timeline shows variety. */
function syntheticEventBatch() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tz = -now.getTimezoneOffset();
    const sign = tz >= 0 ? "+" : "-";
    const tzAbs = Math.abs(tz);
    const isoLocal =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
        `${sign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;

    const appSessionId = `app_test_${Date.now().toString(36)}`;
    const planSessionId = `mtr_test_${Date.now().toString(36)}`;
    const hour = now.getHours();
    const tod =
        hour < 6
            ? "night"
            : hour < 12
              ? "morning"
              : hour < 18
                ? "afternoon"
                : "evening";

    const base = {
        appSessionId,
        planSessionId,
        timestamp: isoLocal,
        participantId: "P000",
        route: "/home",
        goalId: "goal_test",
        missionId: "",
        timeSinceAppOpenSec: 30,
        timeOfDay: tod,
        dayOfWeek: now.getDay(),
        hourOfDay: hour,
        appVersion: "0.1.0-prototype",
        backend: "mock",
        experimentGroup: "pacely",
        persona: "gentle",
        personaOrder: "companion-first",
        goalTitle: "운영체제 시험 (테스트)",
        goalCategory: "exam",
        goalAdherenceRate: 0.45,
        currentStreak: 3,
        totalHours: 4.5,
        missionTitle: "",
        missionEstimatedMin: null as number | null,
        missionWasLate: false,
        milestoneReached: false,
        notificationTrigger: "",
        sheetName: "",
        payloadJson: "",
    };

    return [
        {
            ...base,
            eventId: `ev_${Date.now().toString(36)}_1`,
            eventType: "app_session_start",
        },
        {
            ...base,
            eventId: `ev_${Date.now().toString(36)}_2`,
            eventType: "route_change",
            route: "/planning",
            payloadJson: JSON.stringify({ from: "/home", to: "/planning" }),
        },
        {
            ...base,
            eventId: `ev_${Date.now().toString(36)}_3`,
            eventType: "sheet_opened",
            route: "/planning",
            sheetName: "burden_survey",
        },
        {
            ...base,
            eventId: `ev_${Date.now().toString(36)}_4`,
            eventType: "mission_completed",
            missionId: "m_test_42",
            missionTitle: "선형대수 1단원 예제 3문제 풀기",
            missionEstimatedMin: 45,
            missionWasLate: false,
            milestoneReached: true,
        },
        {
            ...base,
            eventId: `ev_${Date.now().toString(36)}_5`,
            eventType: "notification_received",
            notificationTrigger: "milestone",
            payloadJson: JSON.stringify({
                message: "오늘 다 했어요! 잘하고 있어요.",
            }),
        },
    ];
}

const { default: handler } = (await import("../api/metrics.ts")) as {
    default: (req: Request) => Promise<Response>;
};

const body =
    action === "log"
        ? { action, payload: syntheticPayload() }
        : action === "event"
          ? { action, payload: syntheticEventBatch() }
          : { action };

const req = new Request("http://localhost/api/metrics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
});

const resp = await handler(req);
const respBody = await resp.json().catch(() => ({}));

console.log(`HTTP ${resp.status}`);
console.log(JSON.stringify(respBody, null, 2));
process.exit(resp.ok ? 0 : 1);
