import { NextRequest, NextResponse } from "next/server";

import {
	fetchSchedule,
	getBeijingDateString,
	getSigningTimestamp,
	isCourseInSignWindow,
	login,
	signCourse,
	UcasAutoSignError
} from "@/lib/ucas-auto-sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
	"Cache-Control": "no-store",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"X-Frame-Options": "DENY"
};

function json(body: unknown, status = 200) {
	return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

function isAuthorized(request: NextRequest): boolean {
	const expected = process.env.CRON_SECRET?.trim();
	if (!expected) {
		return false;
	}

	const authorization = request.headers.get("authorization") ?? "";
	const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
	const provided = bearer || request.headers.get("x-cron-secret")?.trim() || "";
	return provided === expected;
}

export async function GET(request: NextRequest) {
	if (!process.env.CRON_SECRET?.trim()) {
		return json({ message: "自动签到未配置 CRON_SECRET", code: "AUTO_SIGN_NOT_CONFIGURED" }, 503);
	}

	if (!isAuthorized(request)) {
		return json({ message: "未授权的自动签到请求" }, 401);
	}

	const username = process.env.UCAS_USERNAME?.trim() ?? "";
	const password = process.env.UCAS_PASSWORD ?? "";
	if (!username || !password) {
		return json(
			{ message: "自动签到未配置 UCAS_USERNAME 或 UCAS_PASSWORD", code: "AUTO_SIGN_NOT_CONFIGURED" },
			503
		);
	}

	const date = getBeijingDateString();

	try {
		const { sessionId, userId } = await login(username, password);
		const courses = await fetchSchedule(sessionId, userId, date);
		const candidates = courses.filter(
			(course) =>
				course.signStatus !== "1" &&
				/^\d{7}$/.test(course.id ?? "") &&
				isCourseInSignWindow(course, date)
		);

		if (candidates.length === 0) {
			return json({ success: true, date, checked: courses.length, signed: [], skipped: "no-candidates" });
		}

		const timestamp = await getSigningTimestamp();
		const signed: Array<{ courseId: string; courseName: string; success: boolean; message: string }> = [];

		for (const course of candidates) {
			const courseId = course.id as string;
			const result = await signCourse(sessionId, userId, courseId, timestamp);
			signed.push({
				courseId,
				courseName: course.courseName ?? "",
				success: result.status === "0" && result.stuSignStatus === "1",
				message: result.message
			});
		}

		console.info(
			"[course-uuid/cron-sign]",
			JSON.stringify({ date, checked: courses.length, candidates: candidates.length, signed })
		);

		return json({ success: true, date, checked: courses.length, signed });
	} catch (error) {
		const message = error instanceof UcasAutoSignError ? error.message : "自动签到服务异常";
		console.error("[course-uuid/cron-sign]", message);
		return json({ success: false, date, message, code: "AUTO_SIGN_UPSTREAM_ERROR" }, 502);
	}
}
